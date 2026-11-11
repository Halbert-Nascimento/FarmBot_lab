export type BinaryOperation = (a: unknown, b: unknown) => unknown;

// The player's operators follow JavaScript, including `==` and `!=`.
export const BINARY: Readonly<Record<string, BinaryOperation>> = {
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

export const UNARY: Readonly<Record<string, (value: unknown) => unknown>> = {
  '!': (v) => !v,
  '-': (v) => -(v as number),
  '+': (v) => +(v as number),
};
