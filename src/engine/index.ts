export type Terrain = 'grass' | 'tilled';

export interface Cell {
  readonly terrain: Terrain;
}

export interface FarmConfig {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
}

export interface FarmState {
  readonly tick: number;
  readonly field: {
    readonly width: number;
    readonly height: number;
    readonly cells: readonly Cell[];
  };
}

export interface Farm {
  getState(): FarmState;
}

export function createFarm(config: FarmConfig): Farm {
  const cells: Cell[] = Array.from({ length: config.width * config.height }, () => ({
    terrain: 'grass',
  }));

  return {
    getState: () => ({
      tick: 0,
      field: { width: config.width, height: config.height, cells },
    }),
  };
}
