import { parse } from 'acorn';
import type {
  ArrowFunctionExpression,
  AssignmentExpression,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  MemberExpression,
  Node,
  Program,
  Statement,
  UpdateExpression,
} from 'acorn';
import type { Limits } from './limits';
import { BINARY, UNARY } from './operators';
import { Scope } from './scope';
import type { Binding } from './scope';
import { ScriptError } from './script-error';
import {
  createObject,
  exportValue,
  LIST_METHODS,
  readProperty,
  stringify,
  tooBig,
  UserFunction,
  writeProperty,
} from './values';

export { ScriptError } from './script-error';

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

/** Something a script can read and write: a variable, a list item or an object property. */
interface Target {
  get(): unknown;
  set(value: unknown): void;
}

const GLOBALS: Readonly<Record<string, unknown>> = {
  undefined: undefined,
  NaN: Number.NaN,
  Infinity: Number.POSITIVE_INFINITY,
};

/**
 * Interprets a script as a coroutine: it yields every timed action and can be
 * paused between two of them, which is what makes `step(n)` possible.
 */
export function* interpret(
  program: Program,
  env: Environment,
  limits: Limits,
): Generator<Action, void, unknown> {
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

  /** The key a member expression names: `o.x` names "x", `o[k]` names whatever `k` is. */
  function* keyOf(node: MemberExpression, scope: Scope): Coroutine<unknown> {
    if (node.optional) return unsupported(node, 'optional chaining');
    if (node.computed) return yield* evaluate(node.property as Expression, scope);
    return (node.property as { name: string }).name;
  }

  function* evaluate(node: Expression, scope: Scope): Coroutine<unknown> {
    switch (node.type) {
      case 'ArrowFunctionExpression':
      case 'FunctionExpression':
        return makeFunction(node, scope);
      case 'Literal':
        return node.value;
      case 'TemplateLiteral': {
        let text = '';
        for (const [index, quasi] of node.quasis.entries()) {
          text += quasi.value.cooked ?? '';
          const expression = node.expressions[index];
          if (expression) text += stringify(yield* evaluate(expression, scope), lineOf(node), limits.collectionSize);
        }
        if (text.length > limits.collectionSize) throw tooBig('text', lineOf(node));
        return text;
      }
      case 'ArrayExpression': {
        if (node.elements.length > limits.collectionSize) throw tooBig('list', lineOf(node));
        const items: unknown[] = [];
        for (const element of node.elements) {
          if (element === null) return unsupported(node, 'hole');
          if (element.type === 'SpreadElement') return unsupported(element);
          items.push(yield* evaluate(element, scope));
        }
        return items;
      }
      case 'ObjectExpression': {
        const object = createObject();
        for (const property of node.properties) {
          if (property.type === 'SpreadElement') return unsupported(property);
          if (property.computed) return unsupported(property, 'computed property name');
          if (property.method || property.kind !== 'init') return unsupported(property, 'method');
          const key =
            property.key.type === 'Identifier'
              ? property.key.name
              : property.key.type === 'Literal'
                ? String(property.key.value)
                : unsupported(property.key);
          const value = yield* evaluate(property.value as Expression, scope);
          writeProperty(object, key, value, lineOf(property), limits.collectionSize);
        }
        return object;
      }
      case 'Identifier':
        if (scope.find(node.name)) return lookup(node.name, scope, node).value;
        if (node.name in GLOBALS) return GLOBALS[node.name];
        throw new ScriptError(`${node.name} is not defined`, lineOf(node));
      case 'MemberExpression': {
        if (node.object.type === 'Identifier' && !node.computed && !scope.find(node.object.name)) {
          const group = env.constants[node.object.name];
          if (group) {
            const name = (node.property as { name: string }).name;
            if (name in group) return group[name];
            throw new ScriptError('Unknown value', lineOf(node));
          }
        }
        const target = yield* evaluate(node.object as Expression, scope);
        return readProperty(target, yield* keyOf(node, scope), lineOf(node));
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
        return yield* update(node, scope);
      case 'CallExpression':
        return yield* call(node, scope);
      default:
        return unsupported(node);
    }
  }

  /** The variable, list item or property an assignment or an increment works on. */
  function* targetOf(node: Node, scope: Scope): Coroutine<Target> {
    if (node.type === 'Identifier') {
      const { name } = node as Identifier;
      return { get: () => lookup(name, scope, node).value, set: (value) => store(name, value, scope, node) };
    }
    if (node.type === 'MemberExpression') {
      const member = node as MemberExpression;
      const object = yield* evaluate(member.object as Expression, scope);
      const key = yield* keyOf(member, scope);
      return {
        get: () => readProperty(object, key, lineOf(member)),
        set: (value) => writeProperty(object, key, value, lineOf(member), limits.collectionSize),
      };
    }
    return unsupported(node);
  }

  function* assign(node: AssignmentExpression, scope: Scope): Coroutine<unknown> {
    const target = yield* targetOf(node.left, scope);
    const right = yield* evaluate(node.right, scope);
    let value = right;
    if (node.operator !== '=') {
      const operation = BINARY[node.operator.slice(0, -1)];
      if (!operation) return unsupported(node);
      value = operation(target.get(), right);
    }
    target.set(value);
    return value;
  }

  function* update(node: UpdateExpression, scope: Scope): Coroutine<unknown> {
    const target = yield* targetOf(node.argument, scope);
    const before = target.get() as number;
    const after = node.operator === '++' ? before + 1 : before - 1;
    target.set(after);
    return node.prefix ? after : before;
  }

  function* invoke(fn: UserFunction, args: readonly unknown[], node: Node): Coroutine<unknown> {
    if (depth >= limits.callDepth) throw new ScriptError('Maximum call depth exceeded', lineOf(node));
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
    let listMethod: ((args: readonly unknown[]) => unknown) | undefined;
    if (callee.type === 'Identifier') {
      if (scope.find(callee.name)) {
        userFunction = requireFunction(lookup(callee.name, scope, node).value, callee.name, node);
      } else {
        command = env.commands[callee.name];
        if (!command) throw new ScriptError(`Unknown command: ${callee.name}`, lineOf(node));
      }
    } else if (callee.type === 'MemberExpression') {
      const target = yield* evaluate(callee.object as Expression, scope);
      const key = yield* keyOf(callee, scope);
      const name = String(key);
      const member = readProperty(target, key, lineOf(node));
      if (member instanceof UserFunction) {
        userFunction = member;
      } else if (Array.isArray(target) && Object.hasOwn(LIST_METHODS, name)) {
        const method = LIST_METHODS[name];
        listMethod = (args) => method?.(target, args, limits.collectionSize, lineOf(node));
      } else {
        throw new ScriptError(`${name} is not a function`, lineOf(node));
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
    if (listMethod) return listMethod(args);

    if (!command) return unsupported(node);
    let action: Action;
    try {
      // Commands belong to the farm: they never get to see the interpreter's own objects.
      action = command(args.map((arg) => exportValue(arg)));
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
