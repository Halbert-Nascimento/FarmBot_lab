import type { AnyNode, Program } from 'acorn';
import { ScriptError } from './script-error';

export const LAYER_COUNT = 10;

/**
 * The layer that unlocks each piece of the language (GDD 11.2). Every layer also has what the layers
 * before it unlock. What is not listed here (a command call, a constant such as Dir.EAST, a block, a
 * comment) belongs to the first layer, which needs no unlocking.
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

interface Use {
  readonly feature: SyntaxFeature;
  readonly node: AnyNode;
}

/** Every name the script declares itself: a call to one of them is a call to a function of the player's. */
function declaredNames(root: AnyNode): Set<string> {
  const names = new Set<string>();
  const collect = (node: AnyNode): void => {
    const any = node as unknown as { id?: AnyNode & { name?: string }; params?: (AnyNode & { name?: string })[] };
    if (any.id?.type === 'Identifier' && any.id.name) names.add(any.id.name);
    for (const param of any.params ?? []) if (param.type === 'Identifier' && param.name) names.add(param.name);
    for (const child of childrenOf(node)) collect(child);
  };
  collect(root);
  return names;
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

/**
 * Looks at the structure of the whole script (never at its text, so words inside a text, a comment or a
 * name are not mistaken for the language) and refuses it, before anything runs, if it uses something the
 * layer has not unlocked yet. It names the first such thing, by its place in the script.
 */
export function checkLayer(program: Program, layer: number, constantGroups: ReadonlySet<string>): void {
  if (layer >= LAYER_COUNT) return;
  const declared = declaredNames(program);
  const uses: Use[] = [];
  const use = (feature: SyntaxFeature, node: AnyNode): void => {
    uses.push({ feature, node });
  };

  const visit = (node: AnyNode, insideLoop: boolean): void => {
    let childrenInsideLoop = insideLoop;
    let skip: AnyNode | undefined;
    switch (node.type) {
      case 'Literal':
        use('literal', node);
        break;
      case 'TemplateLiteral':
        use('templateString', node);
        break;
      case 'VariableDeclaration':
        use('variable', node);
        break;
      case 'AssignmentExpression':
        use('assignment', node);
        break;
      case 'UpdateExpression':
        use('increment', node);
        break;
      case 'BinaryExpression':
        use(COMPARISONS.has(node.operator) ? 'comparison' : 'arithmetic', node);
        break;
      case 'UnaryExpression':
        use(node.operator === '!' ? 'logical' : 'arithmetic', node);
        break;
      case 'LogicalExpression':
        use('logical', node);
        break;
      case 'IfStatement':
        use('if', node);
        break;
      case 'ForStatement':
        use(insideLoop ? 'nestedLoop' : 'for', node);
        childrenInsideLoop = true;
        break;
      case 'WhileStatement':
      case 'DoWhileStatement':
        use(insideLoop ? 'nestedLoop' : 'while', node);
        childrenInsideLoop = true;
        break;
      case 'BreakStatement':
        use('break', node);
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        use('function', node);
        childrenInsideLoop = false;
        break;
      case 'ReturnStatement':
        use('return', node);
        break;
      case 'ArrayExpression':
        use('list', node);
        break;
      case 'ObjectExpression':
        use('object', node);
        break;
      case 'CallExpression': {
        const { callee } = node;
        if (callee.type === 'Identifier') {
          if (declared.has(callee.name)) use('functionCall', node);
        } else if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
          if (LIST_METHODS.has(callee.property.name)) {
            use('listMethod', callee);
            skip = callee;
            visit(callee.object, childrenInsideLoop);
          }
        } else {
          use('functionCall', node);
        }
        break;
      }
      case 'MemberExpression': {
        const isConstant =
          !node.computed && node.object.type === 'Identifier' && constantGroups.has(node.object.name) && !declared.has(node.object.name);
        if (isConstant) return;
        if (node.computed) use('indexAccess', node);
        else if (node.property.type === 'Identifier' && node.property.name === 'length') use('listLength', node);
        else use('propertyAccess', node);
        break;
      }
      default:
        break;
    }
    for (const child of childrenOf(node)) if (child !== skip) visit(child, childrenInsideLoop);
  };
  visit(program, false);

  const locked = uses
    .filter(({ feature }) => SYNTAX_LAYERS[feature] > layer)
    .sort((a, b) => a.node.start - b.node.start)[0];
  if (locked) {
    throw new ScriptError('layerLocked', locked.node.loc?.start.line ?? 0, {
      feature: locked.feature,
      layer: SYNTAX_LAYERS[locked.feature],
    });
  }
}
