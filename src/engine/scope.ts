export interface Binding {
  value: unknown;
  /** False between the start of a block and the line that declares the variable. */
  readonly initialized: boolean;
  readonly constant: boolean;
}

/** A block of variables. Looking a name up walks outwards through the enclosing scopes. */
export class Scope {
  private readonly variables = new Map<string, Binding>();

  constructor(private readonly parent: Scope | null = null) {}

  /** Makes a name exist in this block before its declaration runs, but not usable yet. */
  reserve(name: string, constant: boolean): void {
    this.variables.set(name, { value: undefined, initialized: false, constant });
  }

  declare(name: string, value: unknown, constant: boolean): void {
    this.variables.set(name, { value, initialized: true, constant });
  }

  /** Every variable this block itself holds, not counting the enclosing blocks. */
  bindings(): IterableIterator<Binding> {
    return this.variables.values();
  }

  /** The block this one is inside of, if any. */
  enclosing(): Scope | null {
    return this.parent;
  }

  /** Every name visible from this block, this block's own first. */
  names(): string[] {
    return [...this.variables.keys(), ...(this.parent?.names() ?? [])];
  }

  find(name: string): Binding | undefined {
    return this.variables.get(name) ?? this.parent?.find(name);
  }

  /** A sibling scope with its own copy of the same variables (a fresh scope for each loop round). */
  clone(): Scope {
    const copy = new Scope(this.parent);
    for (const [name, binding] of this.variables) copy.variables.set(name, { ...binding });
    return copy;
  }
}
