/**
 * The layers of the language (GDD 11.2): which pieces of JavaScript the player has unlocked so far.
 * The check looks at the structure of the script, never at its text.
 */
import type { AnyNode, Program } from 'acorn';
import { ScriptError } from './script-error';

/** How many layers there are. The player has unlocked layers 1 up to some number of them. */
export const LAYER_COUNT = 10;

/**
 * The layer that unlocks each piece of the language. Every layer also has what the layers before it
 * unlock. What is not listed here (a command call, a constant such as Dir.EAST, a block, a comment)
 * belongs to the first layer, which needs no unlocking.
 *
 * It only needs to list what the interpreter runs: anything else (the ternary operator, `continue`,
 * `for...of`, `try`...) is refused by the interpreter itself. A piece of syntax that the interpreter
 * learns to run must be given a layer here before it is released.
 */
export const SYNTAX_LAYERS = {
  literal: 2,
  templateString: 3,
  variable: 3,
  assignment: 3,
  increment: 3,
  arithmetic: 3,
  comparison: 4,
  logical: 4,
  if: 4,
  for: 5,
  while: 6,
  break: 6,
  nestedLoop: 7,
  function: 8,
  return: 8,
  functionCall: 8,
  list: 9,
  listMethod: 9,
  indexAccess: 9,
  listLength: 9,
  object: 10,
  propertyAccess: 10,
} as const;

export type SyntaxFeature = keyof typeof SYNTAX_LAYERS;

const COMPARISONS = new Set(['==', '===', '!=', '!==', '<', '<=', '>', '>=']);
const LIST_METHODS = new Set(['push', 'pop']);

/** Where a piece of the language was found in the script. */
interface Sighting {
  readonly feature: SyntaxFeature;
  readonly node: AnyNode;
}

function childrenOf(node: AnyNode): AnyNode[] {
  const children: AnyNode[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'type') continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === 'object' && item !== null && typeof (item as { type?: unknown }).type === 'string') {
        children.push(item as AnyNode);
      }
    }
  }
  return children;
}

function nameOf(node: AnyNode | null | undefined): string[] {
  return node?.type === 'Identifier' ? [node.name] : [];
}

/** The names a list of statements declares in its own block: variables and functions. */
function declaredBy(statements: readonly AnyNode[]): Set<string> {
  const names = new Set<string>();
  for (const statement of statements) {
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) for (const name of nameOf(declarator.id)) names.add(name);
    } else if (statement.type === 'FunctionDeclaration') {
      for (const name of nameOf(statement.id)) names.add(name);
    }
  }
  return names;
}

/** The names a node brings into existence for what is inside it, if it opens a scope. */
function scopeOf(node: AnyNode): Set<string> | undefined {
  switch (node.type) {
    case 'Program':
    case 'BlockStatement':
      return declaredBy(node.body);
    case 'ForStatement':
      return node.init?.type === 'VariableDeclaration' ? declaredBy([node.init]) : new Set();
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return new Set(node.params.flatMap(nameOf));
    default:
      return undefined;
  }
}

const isSignedNumber = (node: AnyNode): boolean =>
  node.type === 'UnaryExpression' &&
  (node.operator === '-' || node.operator === '+') &&
  node.argument.type === 'Literal' &&
  typeof node.argument.value === 'number';

/**
 * Looks at the structure of the whole script (so words inside a text, a comment or a name are not
 * mistaken for the language) and refuses it, before anything runs, if it uses something the layer
 * has not unlocked yet. It names the first such thing, by its place in the script.
 *
 * A name the script declares hides a command or a group of constants of the same name only where it is
 * in scope, the way the interpreter resolves names. Loops count as nested by how the code is written:
 * a loop inside a function counts as the first loop of that function, wherever the function is called.
 */
export function checkLayer(program: Program, layer: number, constantGroups: ReadonlySet<string>): void {
  if (layer >= LAYER_COUNT) return;
  const sightings: Sighting[] = [];
  const scopes: Set<string>[] = [];
  const record = (feature: SyntaxFeature, node: AnyNode): void => {
    sightings.push({ feature, node });
  };
  const isDeclared = (name: string): boolean => scopes.some((scope) => scope.has(name));

  /** The piece of the language a call is: a function of the player's, a list method, or a command. */
  const recordCall = (call: Extract<AnyNode, { type: 'CallExpression' }>): void => {
    const { callee } = call;
    if (callee.type === 'Identifier') {
      if (isDeclared(callee.name)) record('functionCall', call);
    } else if (callee.type === 'MemberExpression') {
      // A method call on a value is judged by its member (a list's push, an object's property).
      if (callee.computed || callee.property.type !== 'Identifier') record('functionCall', call);
    } else {
      record('functionCall', call);
    }
  };

  /** What reading a member of something is: a constant of the game, a list position, a length or a property. */
  const memberFeature = (member: Extract<AnyNode, { type: 'MemberExpression' }>): SyntaxFeature | undefined => {
    const { object, property } = member;
    if (!member.computed && object.type === 'Identifier' && constantGroups.has(object.name) && !isDeclared(object.name)) {
      return undefined;
    }
    if (member.computed) return 'indexAccess';
    return property.type === 'Identifier' && property.name === 'length' ? 'listLength' : 'propertyAccess';
  };

  const visit = (node: AnyNode, insideLoop: boolean): void => {
    const scope = scopeOf(node);
    if (scope) scopes.push(scope);
    let childrenInsideLoop = insideLoop;
    let alreadyVisited: AnyNode | undefined;
    switch (node.type) {
      case 'Literal':
        record('literal', node);
        break;
      case 'TemplateLiteral':
        record('templateString', node);
        break;
      case 'VariableDeclaration':
        record('variable', node);
        break;
      case 'AssignmentExpression':
        record('assignment', node);
        break;
      case 'UpdateExpression':
        record('increment', node);
        break;
      case 'BinaryExpression':
        record(COMPARISONS.has(node.operator) ? 'comparison' : 'arithmetic', node);
        break;
      case 'UnaryExpression':
        if (node.operator === '!') record('logical', node);
        else if (!isSignedNumber(node)) record('arithmetic', node);
        break;
      case 'LogicalExpression':
        record('logical', node);
        break;
      case 'IfStatement':
        record('if', node);
        break;
      case 'ForStatement':
        record(insideLoop ? 'nestedLoop' : 'for', node);
        childrenInsideLoop = true;
        break;
      case 'WhileStatement':
      case 'DoWhileStatement':
        record(insideLoop ? 'nestedLoop' : 'while', node);
        childrenInsideLoop = true;
        break;
      case 'BreakStatement':
        record('break', node);
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        record('function', node);
        childrenInsideLoop = false;
        break;
      case 'ReturnStatement':
        record('return', node);
        break;
      case 'ArrayExpression':
        record('list', node);
        break;
      case 'ObjectExpression':
        record('object', node);
        break;
      case 'CallExpression': {
        const { callee } = node;
        if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier' && LIST_METHODS.has(callee.property.name)) {
          record('listMethod', callee);
          alreadyVisited = callee;
          visit(callee.object, childrenInsideLoop);
        } else {
          recordCall(node);
        }
        break;
      }
      case 'MemberExpression': {
        const feature = memberFeature(node);
        if (!feature) {
          if (scope) scopes.pop();
          return;
        }
        record(feature, node);
        break;
      }
      default:
        break;
    }
    for (const child of childrenOf(node)) if (child !== alreadyVisited) visit(child, childrenInsideLoop);
    if (scope) scopes.pop();
  };
  visit(program, false);

  const locked = sightings
    .filter(({ feature }) => SYNTAX_LAYERS[feature] > layer)
    .sort((a, b) => a.node.start - b.node.start)[0];
  if (locked) {
    throw new ScriptError('layerLocked', locked.node.loc?.start.line ?? 0, {
      feature: locked.feature,
      layer: SYNTAX_LAYERS[locked.feature],
    });
  }
}
