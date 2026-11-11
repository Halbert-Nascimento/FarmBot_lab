export interface Binding {
  value: unknown;
  /** False between the start of a block and the line that declares the variable. */
  readonly initialized: boolean;
  readonly constant: boolean;
}

/** A block of variables. Looking a name up walks outwards through the enclosing scopes. */
export class Scope {
  private readonly bindings = new Map<string, Binding>();

  constructor(private readonly parent: Scope | null = null) {}

  /** Makes a name exist in this block before its declaration runs, but not usable yet. */
  reserve(name: string, constant: boolean): void {
    this.bindings.set(name, { value: undefined, initialized: false, constant });
  }

  declare(name: string, value: unknown, constant: boolean): void {
    this.bindings.set(name, { value, initialized: true, constant });
  }

  find(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.find(name);
  }

  /** A sibling scope with its own copy of the same variables (a fresh scope for each loop round). */
  clone(): Scope {
    const copy = new Scope(this.parent);
    for (const [name, binding] of this.bindings) copy.bindings.set(name, { ...binding });
    return copy;
  }
}
