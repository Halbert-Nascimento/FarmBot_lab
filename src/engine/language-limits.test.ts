import { describe, expect, it } from 'vitest';
import { ScriptError } from './index';
import { failure, logged } from './test-utils';

describe('using a name before its declaration', () => {
  it('refuses a let that has not been reached yet, even when an outer variable has the same name', () => {
    const error = failure('let a = 1;\n{\n  log(a);\n  let a = 2;\n}');

    expect(error).toBeInstanceOf(ScriptError);
    expect((error as Error).message).toMatch(/Line 3: Cannot access 'a' before initialization/);
  });

  it('refuses to assign to a const that has not been reached yet', () => {
    expect((failure('a = 1;\nconst a = 2;') as Error).message).toMatch(/Line 1: Cannot access 'a' before initialization/);
  });

  it('says so when a function stored in a const is called too early', () => {
    expect((failure('log(f());\nconst f = () => 1;') as Error).message).toMatch(
      /Line 1: Cannot access 'f' before initialization/,
    );
  });

  it('still lets declared functions be called early', () => {
    expect(logged('log(f());\nfunction f() { return 1; }').values).toEqual([[1]]);
  });
});

describe('syntax the language does not have yet', () => {
  it('asks for let or const instead of var', () => {
    expect((failure('var a = 1;') as Error).message).toMatch(/Line 1: Unsupported syntax: var, use let or const/);
  });

  it('refuses a function declared as the lone body of an if', () => {
    expect((failure('if (true) function f() {}') as Error).message).toMatch(/Line 1: Unsupported syntax: FunctionDeclaration/);
  });

  it.each([
    ['the conditional operator', 'log(true ? 1 : 2);', 'ConditionalExpression'],
    ['continue', 'for (let i = 0; i < 2; i++) { continue; }', 'ContinueStatement'],
    ['typeof', 'log(typeof 1);', 'UnaryExpression'],
  ])('refuses %s, saying which syntax it is', (_label, source, node) => {
    expect((failure(source) as Error).message).toMatch(new RegExp(`Line 1: Unsupported syntax: ${node}`));
  });
});

describe('functions as values', () => {
  it('shows up as text when logged, never as the interpreter internals', () => {
    expect(logged('function f() {}\nconst g = () => 1;\nlog(f, g);').values).toEqual([['[function]', '[function]']]);
  });

  it('cannot be handed to a command that wants something else', () => {
    expect((failure('const f = () => 1;\nmove(f);') as Error).message).toMatch(/Line 2: move expects a direction/);
  });
});
