import { parse } from 'acorn';
import type { CallExpression, Expression, Node, Program } from 'acorn';

/** A timed operation the script asks the farm to perform. */
export interface Action {
  /** Cost in deciticks. */
  readonly deciticks: number;
  /**
   * Applies the effect once the cost has been charged. `startedAt` is the world time (in
   * deciticks) when the action began: actions act on the world as it was at that moment.
   */
  apply(startedAt: number): void;
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

/**
 * Interprets a script as a coroutine: it yields every timed action and can be
 * paused between two of them, which is what makes `step(n)` possible.
 */
export function* interpret(program: Program, env: Environment): Generator<Action, void, void> {
  function* evaluate(node: Expression): Generator<Action, unknown, void> {
    switch (node.type) {
      case 'Literal':
        return node.value;
      case 'MemberExpression': {
        if (node.object.type === 'Identifier' && !node.computed && node.property.type === 'Identifier') {
          const group = env.constants[node.object.name];
          if (group && node.property.name in group) return group[node.property.name];
        }
        throw new ScriptError('Unknown value', lineOf(node));
      }
      case 'CallExpression':
        return yield* call(node);
      default:
        throw new ScriptError(`Unsupported syntax: ${node.type}`, lineOf(node));
    }
  }

  function* call(node: CallExpression): Generator<Action, unknown, void> {
    if (node.callee.type !== 'Identifier') {
      throw new ScriptError('Unsupported call', lineOf(node));
    }
    const command = env.commands[node.callee.name];
    if (!command) throw new ScriptError(`Unknown command: ${node.callee.name}`, lineOf(node));

    const args: unknown[] = [];
    for (const arg of node.arguments) {
      if (arg.type === 'SpreadElement') throw new ScriptError('Unsupported syntax: SpreadElement', lineOf(arg));
      args.push(yield* evaluate(arg));
    }
    let action: Action;
    try {
      action = command(args);
    } catch (error) {
      throw new ScriptError((error as Error).message, lineOf(node));
    }
    yield action;
    return undefined;
  }

  for (const statement of program.body) {
    if (statement.type !== 'ExpressionStatement') {
      throw new ScriptError(`Unsupported syntax: ${statement.type}`, lineOf(statement));
    }
    yield* evaluate(statement.expression);
  }
}
