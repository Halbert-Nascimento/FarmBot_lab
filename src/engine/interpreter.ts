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
import { ASSIGNMENT_COST, CALL_COST, OPERATION_COST } from './costs';
import type { Limits } from './limits';
import type { ErrorCode } from './messages';
import { BINARY, UNARY } from './operators';
import { Scope } from './scope';
import type { Binding } from './scope';
import { CommandError, ScriptError } from './script-error';
import {
  createObject,
  ensureTextFits,
  exceedsMemory,
  exportValue,
  importValue,
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
  /** True for time the script spent calculating, which is not a command and changes nothing in the farm. */
  readonly computation?: boolean;
}

export type Command = (args: readonly unknown[]) => Action;

export interface Environment {
  readonly commands: Readonly<Record<string, Command>>;
  readonly constants: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

function lineOf(node: Node): number {
  return node.loc?.start.line ?? 0;
}

/** How the parser starts its messages for the mistakes the game has its own words for. */
const SYNTAX_ERRORS: readonly (readonly [string, ErrorCode])[] = [
  ["'return' outside", 'syntaxReturnOutside'],
  ['Assigning to rvalue', 'syntaxInvalidAssignment'],
  ['Unexpected keyword', 'syntaxReservedWord'],
  ['The keyword', 'syntaxReservedWord'],
  ['Unexpected reserved word', 'syntaxReservedWord'],
  ['Unexpected token', 'syntaxUnexpectedToken'],
  ['Unterminated string constant', 'syntaxUnterminatedString'],
  ['Unterminated template', 'syntaxUnterminatedTemplate'],
  ['Unexpected character', 'syntaxUnexpectedChar'],
];

export function parseScript(source: string): Program {
  try {
    return parse(source, { ecmaVersion: 2022, sourceType: 'script', locations: true });
  } catch (error) {
    const line = (error as { loc?: { line: number } }).loc?.line ?? 0;
    // Acorn words its messages as "Unexpected token (3:4)": the position is already in the line.
    const detail = (error as Error).message.replace(/\s*\(\d+:\d+\)$/, '');
    const declared = /^Identifier '(.+)' has already been declared$/.exec(detail);
    if (declared) throw new ScriptError('syntaxAlreadyDeclared', line, { name: declared[1] });
    const known = SYNTAX_ERRORS.find(([start]) => detail.startsWith(start));
    throw new ScriptError(known ? known[1] : 'syntaxGeneric', line, { detail });
  }
}

/** How a statement ended, when it did not simply run to its end. */
type Completion = { readonly type: 'break' } | { readonly type: 'return'; readonly value: unknown } | undefined;

/** Something a script can read and write: a variable, a list item or an object property. */
interface Target {
  get(): unknown;
  set(value: unknown): void;
}

/** How many loop rounds, calls and commands pass between two looks at how much memory the script holds. */
const MEMORY_CHECK_INTERVAL = 1000;

/** The unsupported things the game has its own words for, by what the interpreter calls them. */
const WHAT_KEYS: Readonly<Record<string, string | undefined>> = {
  'regular expression': 'regex',
  bigint: 'bigint',
  'var, use let or const': 'var',
  'optional chaining': 'optionalChaining',
  hole: 'hole',
  method: 'method',
  'computed property name': 'computedKey',
};

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
  /** Time the script has spent calculating that the farm has not been charged for yet. */
  let pendingDeciticks = 0;
  let untilMemoryCheck = MEMORY_CHECK_INTERVAL;
  const globalScope = new Scope();
  /** The scopes the script is running in right now, innermost last: what it can still reach. */
  const activeScopes: Scope[] = [globalScope];

  function charge(deciticks: number): void {
    pendingDeciticks += deciticks;
  }

  function checkMemory(node: Node): void {
    if (--untilMemoryCheck > 0) return;
    untilMemoryCheck = MEMORY_CHECK_INTERVAL;
    if (exceedsMemory(activeScopes, limits.memoryUnits)) {
      throw new ScriptError('memory', lineOf(node));
    }
  }

  /** Hands the time spent calculating to the farm, even if it is none, so the world can move on. */
  function* yieldComputation(node: Node): Coroutine<void> {
    checkMemory(node);
    const deciticks = pendingDeciticks;
    pendingDeciticks = 0;
    yield { deciticks, apply: () => undefined, line: lineOf(node), computation: true };
  }

  /** Hands over the time spent calculating, if there is any, before something that must see the world move on. */
  function* settle(node: Node): Coroutine<void> {
    if (pendingDeciticks > 0) yield* yieldComputation(node);
  }

  /** A name that stands for a value but does not exist: what the player may have meant is a variable, a group of constants or a global. */
  function notDefined(name: string, scope: Scope, node: Node): ScriptError {
    const candidates = [...scope.names(), ...Object.keys(env.constants), ...Object.keys(GLOBALS)];
    return new ScriptError('notDefined', lineOf(node), { name, guess: name, candidates });
  }

  /** Every constant under its full name, in both languages: Dir.NORTH, Planta.CAPIM... */
  function constantNames(): string[] {
    return Object.entries(env.constants).flatMap(([group, constants]) => Object.keys(constants).map((key) => `${group}.${key}`));
  }

  function unsupported(node: Node, what: string = node.type): never {
    const whatKey = WHAT_KEYS[what];
    throw new ScriptError('unsupported', lineOf(node), whatKey ? { whatKey } : { what });
  }

  function lookup(name: string, scope: Scope, node: Node): Binding {
    const binding = scope.find(name);
    if (!binding) throw notDefined(name, scope, node);
    if (!binding.initialized) throw new ScriptError('beforeInit', lineOf(node), { name });
    return binding;
  }

  function store(name: string, value: unknown, scope: Scope, node: Node): void {
    const binding = lookup(name, scope, node);
    if (binding.constant) throw new ScriptError('constAssign', lineOf(node), { name });
    binding.value = value;
  }

  function makeFunction(
    node: ArrowFunctionExpression | FunctionExpression | FunctionDeclaration,
    scope: Scope,
  ): UserFunction {
    const params = node.params.map((param) => (param.type === 'Identifier' ? param.name : unsupported(param)));
    return new UserFunction(params, node.body, scope);
  }

  /** Runs an operator, turning anything the host JavaScript would reject into a mistake in the script. */
  function operate(node: Node, run: () => unknown): unknown {
    try {
      return run();
    } catch (error) {
      if (error instanceof ScriptError) throw error;
      throw new ScriptError('invalidOperation', lineOf(node));
    }
  }

  /** `left <operator> right`, paid for, with objects turned into text for `+` and texts kept short. */
  function applyBinary(operator: string, left: unknown, right: unknown, node: Node): unknown {
    const operation = BINARY[operator];
    if (!operation) return unsupported(node);
    charge(OPERATION_COST);
    const asOperand = (value: unknown): unknown =>
      operator === '+' && ((typeof value === 'object' && value !== null) || value instanceof UserFunction)
        ? stringify(value, lineOf(node), limits.collectionSize)
        : value;
    const result = operate(node, () => operation(asOperand(left), asOperand(right)));
    return typeof result === 'string' ? ensureTextFits(result, limits.collectionSize, lineOf(node)) : result;
  }

  function requireFunction(value: unknown, label: string | undefined, node: Node): UserFunction {
    if (!(value instanceof UserFunction)) {
      throw new ScriptError(label === undefined ? 'notAFunctionExpression' : 'notAFunction', lineOf(node), { name: label });
    }
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
        // Only text, numbers, booleans and null. A big integer would escape the cost of its arithmetic
        // and a regular expression is an object of the host JavaScript.
        if (node.regex) return unsupported(node, 'regular expression');
        if (typeof node.value === 'bigint') return unsupported(node, 'bigint');
        return node.value;
      case 'TemplateLiteral': {
        let text = '';
        for (const [index, quasi] of node.quasis.entries()) {
          text += quasi.value.cooked ?? '';
          const expression = node.expressions[index];
          if (expression) text += stringify(yield* evaluate(expression, scope), lineOf(node), limits.collectionSize);
        }
        return ensureTextFits(text, limits.collectionSize, lineOf(node));
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
        if (node.name in env.constants) {
          const [first = ''] = Object.keys(env.constants[node.name] ?? {});
          throw new ScriptError('constantGroup', lineOf(node), { name: node.name, example: `${node.name}.${first}` });
        }
        throw notDefined(node.name, scope, node);
      case 'MemberExpression': {
        if (node.object.type === 'Identifier' && !node.computed && !scope.find(node.object.name)) {
          const group = env.constants[node.object.name];
          if (group) {
            const name = (node.property as { name: string }).name;
            if (Object.hasOwn(group, name)) return group[name];
            throw new ScriptError('unknownValue', lineOf(node), {
              group: node.object.name,
              name,
              guess: `${node.object.name}.${name}`,
              candidates: constantNames(),
            });
          }
        }
        const target = yield* evaluate(node.object as Expression, scope);
        return readProperty(target, yield* keyOf(node, scope), lineOf(node));
      }
      case 'BinaryExpression': {
        const left = yield* evaluate(node.left as Expression, scope);
        const right = yield* evaluate(node.right, scope);
        return applyBinary(node.operator, left, right, node);
      }
      case 'LogicalExpression': {
        const left = yield* evaluate(node.left, scope);
        charge(OPERATION_COST);
        if (node.operator === '&&') return left ? yield* evaluate(node.right, scope) : left;
        if (node.operator === '||') return left ? left : yield* evaluate(node.right, scope);
        return unsupported(node);
      }
      case 'UnaryExpression': {
        const operation = UNARY[node.operator];
        if (!operation) return unsupported(node);
        const operand = yield* evaluate(node.argument, scope);
        charge(OPERATION_COST);
        return operate(node, () => operation(operand));
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
      value = applyBinary(node.operator.slice(0, -1), target.get(), right, node);
    }
    charge(ASSIGNMENT_COST);
    target.set(value);
    return value;
  }

  function* update(node: UpdateExpression, scope: Scope): Coroutine<unknown> {
    const target = yield* targetOf(node.argument, scope);
    const before = operate(node, () => Number(target.get())) as number;
    const after = node.operator === '++' ? before + 1 : before - 1;
    charge(OPERATION_COST + ASSIGNMENT_COST);
    target.set(after);
    return node.prefix ? after : before;
  }

  function* invoke(fn: UserFunction, args: readonly unknown[], node: Node): Coroutine<unknown> {
    if (depth >= limits.callDepth) throw new ScriptError('callDepth', lineOf(node));
    charge(CALL_COST);
    depth++;
    const slot = activeScopes.length;
    try {
      yield* settle(node);
      const local = new Scope(fn.scope);
      fn.params.forEach((name, index) => local.declare(name, args[index], false));
      activeScopes.push(local);
      if (fn.body.type === 'BlockStatement') {
        const completion = yield* executeAll(fn.body.body, local);
        return completion?.type === 'return' ? completion.value : undefined;
      }
      return yield* evaluate(fn.body, local);
    } finally {
      activeScopes.length = Math.min(activeScopes.length, slot);
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
        if (!command) {
          const guess = callee.name;
          throw new ScriptError('unknownCommand', lineOf(node), { name: guess, guess, candidates: [...scope.names(), ...Object.keys(env.commands)] });
        }
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
        throw new ScriptError('notAFunction', lineOf(node), { name });
      }
    } else if (callee.type === 'Super') {
      return unsupported(callee);
    } else {
      userFunction = requireFunction(yield* evaluate(callee, scope), undefined, node);
    }

    const args: unknown[] = [];
    for (const arg of node.arguments) {
      if (arg.type === 'SpreadElement') return unsupported(arg);
      args.push(yield* evaluate(arg, scope));
    }
    if (userFunction) return yield* invoke(userFunction, args, node);
    if (listMethod) {
      charge(CALL_COST);
      return listMethod(args);
    }

    if (!command) return unsupported(node);
    // Commands belong to the farm: they never get to see the interpreter's own objects.
    const handedOver = args.map((arg) => exportValue(arg, lineOf(node), limits.collectionSize * 10));
    let action: Action;
    try {
      action = command(handedOver);
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      throw new ScriptError(error.code, lineOf(node), { name: callee.type === 'Identifier' ? callee.name : '' });
    }
    yield* settle(node);
    return importValue(yield action);
  }

  /**
   * Marks one round of a loop. It spends no time, but lets the farm count the rounds that
   * made no progress and stop a loop that never will.
   */
  function* markRound(node: Node): Coroutine<void> {
    yield* yieldComputation(node);
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
          if (declarator.init) charge(ASSIGNMENT_COST);
          scope.declare(declarator.id.name, value, node.kind === 'const');
        }
        return undefined;
      case 'BlockStatement': {
        const inner = new Scope(scope);
        const slot = activeScopes.length;
        activeScopes.push(inner);
        try {
          return yield* executeAll(node.body, inner);
        } finally {
          activeScopes.length = slot;
        }
      }
      case 'IfStatement':
        if (yield* evaluate(node.test, scope)) return yield* execute(node.consequent, scope);
        if (node.alternate) return yield* execute(node.alternate, scope);
        return undefined;
      case 'WhileStatement':
        while (true) {
          const ending = yield* runRound(node, node.test, node.body, scope);
          if (ending) return ending.completion;
        }
      case 'ForStatement': {
        let round = new Scope(scope);
        const slot = activeScopes.length;
        activeScopes.push(round);
        try {
          if (node.init?.type === 'VariableDeclaration') yield* execute(node.init, round);
          else if (node.init) yield* evaluate(node.init, round);
          while (true) {
            const ending = yield* runRound(node, node.test, node.body, round);
            if (ending) return ending.completion;
            round = round.clone();
            activeScopes[slot] = round;
            if (node.update) yield* evaluate(node.update, round);
          }
        } finally {
          activeScopes.length = slot;
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

  yield* executeAll(program.body as Statement[], globalScope);
  yield* settle(program);
}
