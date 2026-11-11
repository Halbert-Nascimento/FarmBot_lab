import { parse } from 'acorn';
import type {
  ArrowFunctionExpression,
  AssignmentExpression,
  BlockStatement,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Node,
  Program,
  Statement,
  UpdateExpression,
} from 'acorn';
import { BINARY, UNARY } from './operators';
import { Scope } from './scope';
import type { Binding } from './scope';

/** A timed operation the script asks the farm to perform. */
export interface Action {
  /** Cost in deciticks. */
  readonly deciticks: number;
  /**
   * Applies the effect once the cost has been charged. `startedAt` is the world time (in
   * deciticks) when the action began: actions act on the world as it was at that moment.
   * What it returns is the value of the command call in the script.
   */
  apply(startedAt: number): unknown;
  /** The script line that asked for it, when it is not obvious from the command. */
  readonly line?: number;
}

export type Command = (args: readonly unknown[]) => Action;

export interface Environment {
  readonly commands: Readonly<Record<string, Command>>;
  readonly constants: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export class ScriptError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`Line ${line}: ${message}`);
    this.name = 'ScriptError';
  }
}

function lineOf(node: Node): number {
  return node.loc?.start.line ?? 0;
}

export function parseScript(source: string): Program {
  try {
    return parse(source, { ecmaVersion: 2022, sourceType: 'script', locations: true });
  } catch (error) {
    const line = (error as { loc?: { line: number } }).loc?.line ?? 0;
    throw new ScriptError((error as Error).message, line);
  }
}

/** How a statement ended, when it did not simply run to its end. */
type Completion = { readonly type: 'break' } | { readonly type: 'return'; readonly value: unknown } | undefined;

/** A function the player wrote. It remembers the scope it was written in. */
class UserFunction {
  constructor(
    readonly params: readonly string[],
    readonly body: BlockStatement | Expression,
    readonly scope: Scope,
  ) {}
}

/** Calls nested deeper than this are stopped, so a function that calls itself forever cannot hang the game. */
const MAX_CALL_DEPTH = 200;

const GLOBALS: Readonly<Record<string, unknown>> = {
  undefined: undefined,
  NaN: Number.NaN,
  Infinity: Number.POSITIVE_INFINITY,
};

/** What a function looks like to everything outside the interpreter (a log line, a command argument). */
const FUNCTION_AS_TEXT = '[function]';

/**
 * Interprets a script as a coroutine: it yields every timed action and can be
 * paused between two of them, which is what makes `step(n)` possible.
 */
export function* interpret(program: Program, env: Environment): Generator<Action, void, unknown> {
  type Coroutine<T> = Generator<Action, T, unknown>;

  /** Function declarations already made available at the start of their block. */
  const hoisted = new WeakSet<Node>();
  let depth = 0;

  function unsupported(node: Node, what: string = node.type): never {
    throw new ScriptError(`Unsupported syntax: ${what}`, lineOf(node));
  }

  function lookup(name: string, scope: Scope, node: Node): Binding {
    const binding = scope.find(name);
    if (!binding) throw new ScriptError(`${name} is not defined`, lineOf(node));
    if (!binding.initialized) throw new ScriptError(`Cannot access '${name}' before initialization`, lineOf(node));
    return binding;
  }

  function store(name: string, value: unknown, scope: Scope, node: Node): void {
    const binding = lookup(name, scope, node);
    if (binding.constant) throw new ScriptError(`Assignment to constant variable: ${name}`, lineOf(node));
    binding.value = value;
  }

  function makeFunction(
    node: ArrowFunctionExpression | FunctionExpression | FunctionDeclaration,
    scope: Scope,
  ): UserFunction {
    const params = node.params.map((param) => (param.type === 'Identifier' ? param.name : unsupported(param)));
    return new UserFunction(params, node.body, scope);
  }

  function requireFunction(value: unknown, label: string, node: Node): UserFunction {
    if (!(value instanceof UserFunction)) throw new ScriptError(`${label} is not a function`, lineOf(node));
    return value;
  }

  function* evaluate(node: Expression, scope: Scope): Coroutine<unknown> {
    switch (node.type) {
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        return makeFunction(node, scope);
      case 'Literal':
        return node.value;
      case 'Identifier':
        if (scope.find(node.name)) return lookup(node.name, scope, node).value;
        if (node.name in GLOBALS) return GLOBALS[node.name];
        throw new ScriptError(`${node.name} is not defined`, lineOf(node));
      case 'MemberExpression': {
        if (node.object.type === 'Identifier' && !node.computed && node.property.type === 'Identifier') {
          const group = env.constants[node.object.name];
          if (group && node.property.name in group) return group[node.property.name];
        }
        throw new ScriptError('Unknown value', lineOf(node));
      }
      case 'BinaryExpression': {
        const operation = BINARY[node.operator];
        if (!operation) return unsupported(node);
        const left = yield* evaluate(node.left as Expression, scope);
        const right = yield* evaluate(node.right, scope);
        return operation(left, right);
      }
      case 'LogicalExpression': {
        const left = yield* evaluate(node.left, scope);
        if (node.operator === '&&') return left ? yield* evaluate(node.right, scope) : left;
        if (node.operator === '||') return left ? left : yield* evaluate(node.right, scope);
        return unsupported(node);
      }
      case 'UnaryExpression': {
        const operation = UNARY[node.operator];
        if (!operation) return unsupported(node);
        return operation(yield* evaluate(node.argument, scope));
      }
      case 'AssignmentExpression':
        return yield* assign(node, scope);
      case 'UpdateExpression':
        return applyUpdate(node, scope);
      case 'CallExpression':
        return yield* call(node, scope);
      default:
        return unsupported(node);
    }
  }

  function* assign(node: AssignmentExpression, scope: Scope): Coroutine<unknown> {
    if (node.left.type !== 'Identifier') return unsupported(node.left);
    const right = yield* evaluate(node.right, scope);
    let value = right;
    if (node.operator !== '=') {
      const operation = BINARY[node.operator.slice(0, -1)];
      if (!operation) return unsupported(node);
      value = operation(lookup(node.left.name, scope, node).value, right);
    }
    store(node.left.name, value, scope, node);
    return value;
  }

  function applyUpdate(node: UpdateExpression, scope: Scope): unknown {
    if (node.argument.type !== 'Identifier') return unsupported(node.argument);
    const before = lookup(node.argument.name, scope, node).value as number;
    const after = node.operator === '++' ? before + 1 : before - 1;
    store(node.argument.name, after, scope, node);
    return node.prefix ? after : before;
  }

  function* invoke(fn: UserFunction, args: readonly unknown[], node: Node): Coroutine<unknown> {
    if (depth >= MAX_CALL_DEPTH) throw new ScriptError('Maximum call depth exceeded', lineOf(node));
    depth++;
    try {
      const local = new Scope(fn.scope);
      fn.params.forEach((name, index) => local.declare(name, args[index], false));
      if (fn.body.type === 'BlockStatement') {
        const completion = yield* executeAll(fn.body.body, local);
        return completion?.type === 'return' ? completion.value : undefined;
      }
      return yield* evaluate(fn.body, local);
    } finally {
      depth--;
    }
  }

  function* call(node: CallExpression, scope: Scope): Coroutine<unknown> {
    const { callee } = node;
    let userFunction: UserFunction | undefined;
    let command: Command | undefined;
    if (callee.type === 'Identifier') {
      if (scope.find(callee.name)) {
        userFunction = requireFunction(lookup(callee.name, scope, node).value, callee.name, node);
      } else {
        command = env.commands[callee.name];
        if (!command) throw new ScriptError(`Unknown command: ${callee.name}`, lineOf(node));
      }
    } else if (callee.type === 'Super') {
      return unsupported(callee);
    } else {
      userFunction = requireFunction(yield* evaluate(callee, scope), 'Expression', node);
    }

    const args: unknown[] = [];
    for (const arg of node.arguments) {
      if (arg.type === 'SpreadElement') return unsupported(arg);
      args.push(yield* evaluate(arg, scope));
    }
    if (userFunction) return yield* invoke(userFunction, args, node);

    if (!command) return unsupported(node);
    let action: Action;
    try {
      // Commands belong to the farm: they never get to see the interpreter's own objects.
      action = command(args.map((arg) => (arg instanceof UserFunction ? FUNCTION_AS_TEXT : arg)));
    } catch (error) {
      throw new ScriptError((error as Error).message, lineOf(node));
    }
    return yield action;
  }

  /**
   * Marks one round of a loop. It spends no time, but lets the farm count the rounds that
   * made no progress and stop a loop that never will.
   */
  function* markRound(node: Node): Coroutine<void> {
    yield { deciticks: 0, apply: () => undefined, line: lineOf(node) };
  }

  /** Runs one round of a loop. Returns how the loop ends, or `undefined` to go on with the next round. */
  function* runRound(
    node: Node,
    test: Expression | null | undefined,
    body: Statement,
    scope: Scope,
  ): Coroutine<{ readonly completion: Completion } | undefined> {
    yield* markRound(node);
    if (test && !(yield* evaluate(test, scope))) return { completion: undefined };
    const completion = yield* execute(body, scope);
    if (completion?.type === 'break') return { completion: undefined };
    return completion ? { completion } : undefined;
  }

  function* executeAll(statements: readonly Statement[], scope: Scope): Coroutine<Completion> {
    // Like JavaScript: functions can be called before their line, and a `let` or `const` exists
    // from the start of its block but cannot be used until its line runs.
    for (const statement of statements) {
      if (statement.type === 'FunctionDeclaration') {
        hoisted.add(statement);
        scope.declare(statement.id.name, makeFunction(statement, scope), false);
      } else if (statement.type === 'VariableDeclaration' && statement.kind !== 'var') {
        for (const declarator of statement.declarations) {
          if (declarator.id.type === 'Identifier') scope.reserve(declarator.id.name, statement.kind === 'const');
        }
      }
    }
    for (const statement of statements) {
      const completion = yield* execute(statement, scope);
      if (completion) return completion;
    }
    return undefined;
  }

  function* execute(node: Statement, scope: Scope): Coroutine<Completion> {
    switch (node.type) {
      case 'ExpressionStatement':
        yield* evaluate(node.expression, scope);
        return undefined;
      case 'VariableDeclaration':
        if (node.kind === 'var') return unsupported(node, 'var, use let or const');
        for (const declarator of node.declarations) {
          if (declarator.id.type !== 'Identifier') return unsupported(declarator.id);
          const value = declarator.init ? yield* evaluate(declarator.init, scope) : undefined;
          scope.declare(declarator.id.name, value, node.kind === 'const');
        }
        return undefined;
      case 'BlockStatement':
        return yield* executeAll(node.body, new Scope(scope));
      case 'IfStatement':
        if (yield* evaluate(node.test, scope)) return yield* execute(node.consequent, scope);
        if (node.alternate) return yield* execute(node.alternate, scope);
        return undefined;
      case 'WhileStatement':
        while (true) {
          const exit = yield* runRound(node, node.test, node.body, scope);
          if (exit) return exit.completion;
        }
      case 'ForStatement': {
        let round = new Scope(scope);
        if (node.init?.type === 'VariableDeclaration') yield* execute(node.init, round);
        else if (node.init) yield* evaluate(node.init, round);
        while (true) {
          const exit = yield* runRound(node, node.test, node.body, round);
          if (exit) return exit.completion;
          round = round.clone();
          if (node.update) yield* evaluate(node.update, round);
        }
      }
      case 'ReturnStatement':
        return { type: 'return', value: node.argument ? yield* evaluate(node.argument, scope) : undefined };
      case 'FunctionDeclaration':
        // Only a declaration at the start of a block is made available; anywhere else it would be ignored.
        return hoisted.has(node) ? undefined : unsupported(node);
      case 'BreakStatement':
        if (node.label) return unsupported(node);
        return { type: 'break' };
      case 'EmptyStatement':
        return undefined;
      default:
        return unsupported(node);
    }
  }

  yield* executeAll(program.body as Statement[], new Scope());
}
