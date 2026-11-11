import { parse } from 'acorn';
import type { AssignmentExpression, CallExpression, Expression, Node, Program, Statement, UpdateExpression } from 'acorn';

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

interface Binding {
  value: unknown;
  readonly constant: boolean;
}

/** A block of variables. Looking a name up walks outwards through the enclosing scopes. */
class Scope {
  private readonly bindings = new Map<string, Binding>();

  constructor(private readonly parent: Scope | null = null) {}

  declare(name: string, value: unknown, constant: boolean): void {
    this.bindings.set(name, { value, constant });
  }

  find(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.find(name);
  }
}

type Binary = (a: unknown, b: unknown) => unknown;

// The player's `==` and `!=` follow JavaScript.
const BINARY: Readonly<Record<string, Binary>> = {
  '+': (a, b) => (a as number) + (b as number),
  '-': (a, b) => (a as number) - (b as number),
  '*': (a, b) => (a as number) * (b as number),
  '/': (a, b) => (a as number) / (b as number),
  '%': (a, b) => (a as number) % (b as number),
  '**': (a, b) => (a as number) ** (b as number),
  '==': (a, b) => a == b,
  '!=': (a, b) => a != b,
  '===': (a, b) => a === b,
  '!==': (a, b) => a !== b,
  '<': (a, b) => (a as number) < (b as number),
  '<=': (a, b) => (a as number) <= (b as number),
  '>': (a, b) => (a as number) > (b as number),
  '>=': (a, b) => (a as number) >= (b as number),
};

const UNARY: Readonly<Record<string, (value: unknown) => unknown>> = {
  '!': (v) => !v,
  '-': (v) => -(v as number),
  '+': (v) => +(v as number),
};

const GLOBALS: Readonly<Record<string, unknown>> = { undefined: undefined, NaN: Number.NaN, Infinity: Number.POSITIVE_INFINITY };

/**
 * Interprets a script as a coroutine: it yields every timed action and can be
 * paused between two of them, which is what makes `step(n)` possible.
 */
export function* interpret(program: Program, env: Environment): Generator<Action, void, unknown> {
  type Run<T> = Generator<Action, T, unknown>;

  function unsupported(node: Node): never {
    throw new ScriptError(`Unsupported syntax: ${node.type}`, lineOf(node));
  }

  function lookup(name: string, scope: Scope, node: Node): Binding {
    const binding = scope.find(name);
    if (!binding) throw new ScriptError(`${name} is not defined`, lineOf(node));
    return binding;
  }

  function store(name: string, value: unknown, scope: Scope, node: Node): void {
    const binding = lookup(name, scope, node);
    if (binding.constant) throw new ScriptError(`Assignment to constant variable: ${name}`, lineOf(node));
    binding.value = value;
  }

  function* evaluate(node: Expression, scope: Scope): Run<unknown> {
    switch (node.type) {
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
        return update(node, scope);
      case 'CallExpression':
        return yield* call(node, scope);
      default:
        return unsupported(node);
    }
  }

  function* assign(node: AssignmentExpression, scope: Scope): Run<unknown> {
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

  function update(node: UpdateExpression, scope: Scope): unknown {
    if (node.argument.type !== 'Identifier') return unsupported(node.argument);
    const before = lookup(node.argument.name, scope, node).value as number;
    const after = node.operator === '++' ? before + 1 : before - 1;
    store(node.argument.name, after, scope, node);
    return node.prefix ? after : before;
  }

  function* call(node: CallExpression, scope: Scope): Run<unknown> {
    if (node.callee.type !== 'Identifier') {
      throw new ScriptError('Unsupported call', lineOf(node));
    }
    const command = env.commands[node.callee.name];
    if (!command) throw new ScriptError(`Unknown command: ${node.callee.name}`, lineOf(node));

    const args: unknown[] = [];
    for (const arg of node.arguments) {
      if (arg.type === 'SpreadElement') return unsupported(arg);
      args.push(yield* evaluate(arg, scope));
    }
    let action: Action;
    try {
      action = command(args);
    } catch (error) {
      throw new ScriptError((error as Error).message, lineOf(node));
    }
    return yield action;
  }

  function* executeAll(statements: readonly Statement[], scope: Scope): Run<void> {
    for (const statement of statements) yield* execute(statement, scope);
  }

  function* execute(node: Statement, scope: Scope): Run<void> {
    switch (node.type) {
      case 'ExpressionStatement':
        yield* evaluate(node.expression, scope);
        return;
      case 'VariableDeclaration':
        for (const declarator of node.declarations) {
          if (declarator.id.type !== 'Identifier') return unsupported(declarator.id);
          const value = declarator.init ? yield* evaluate(declarator.init, scope) : undefined;
          scope.declare(declarator.id.name, value, node.kind === 'const');
        }
        return;
      case 'BlockStatement':
        yield* executeAll(node.body, new Scope(scope));
        return;
      case 'IfStatement':
        if (yield* evaluate(node.test, scope)) yield* execute(node.consequent, scope);
        else if (node.alternate) yield* execute(node.alternate, scope);
        return;
      case 'EmptyStatement':
        return;
      default:
        return unsupported(node);
    }
  }

  yield* executeAll(program.body as Statement[], new Scope());
}
