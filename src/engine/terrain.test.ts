import { describe, expect, it } from 'vitest';
import { createFarm } from './index';

const config = { width: 3, height: 2, seed: 1 };

/** Collects two hay: grass planted, ripened (120 ticks) and harvested twice on the first cell. */
const GET_TWO_HAY = `plant(Plant.GRASS);
wait(120);
harvest();
plant(Plant.GRASS);
wait(120);
harvest();
`;

function run(source: string) {
  const farm = createFarm(config);
  const r = farm.run(source);
  r.step(10_000);
  return { farm, run: r };
}

const firstCell = (farm: ReturnType<typeof createFarm>) => farm.getState().field.cells[0];

describe('tilling', () => {
  it('toggles the cell between grass and tilled, spending 4 ticks', () => {
    const once = run('till();');
    expect(firstCell(once.farm)?.terrain).toBe('tilled');
    expect(once.run.getMeter().ticks).toBe(4);
    expect(once.farm.drainEvents()).toEqual([
      { type: 'tilled', timeDeciticks: 40, at: { x: 0, y: 0 }, terrain: 'tilled' },
    ]);

    const twice = run('till();\ntill();');
    expect(firstCell(twice.farm)?.terrain).toBe('grass');
  });

  it('refuses to till a cell that has a plant, warning with an event and still spending the ticks', () => {
    const { farm, run: r } = run('plant(Plant.GRASS);\ntill();');

    expect(firstCell(farm)?.terrain).toBe('grass');
    expect(r.getMeter().ticks).toBe(10);
    expect(farm.drainEvents().at(-1)).toEqual({
      type: 'rejected',
      timeDeciticks: 100,
      at: { x: 0, y: 0 },
      action: 'till',
      reason: 'occupied',
    });
  });
});

describe('planting wheat', () => {
  it('is refused on grass terrain, with a warning', () => {
    const { farm, run: r } = run('plant(Plant.WHEAT);');

    expect(firstCell(farm)?.plant).toBeNull();
    expect(r.getMeter().ticks).toBe(6);
    expect(farm.drainEvents()).toEqual([
      { type: 'rejected', timeDeciticks: 60, at: { x: 0, y: 0 }, action: 'plant', reason: 'needs-tilled-terrain' },
    ]);
  });

  it('is refused without 2 hay in stock, with a warning', () => {
    const { farm } = run('till();\nplant(Plant.WHEAT);');

    expect(firstCell(farm)?.plant).toBeNull();
    expect(farm.drainEvents().at(-1)).toEqual({
      type: 'rejected',
      timeDeciticks: 100,
      at: { x: 0, y: 0 },
      action: 'plant',
      reason: 'not-enough-hay',
    });
  });

  it('spends 2 hay when it succeeds on tilled terrain', () => {
    const { farm } = run(`${GET_TWO_HAY}till();\nplant(Plant.WHEAT);`);

    expect(farm.getState().stock).toEqual({ hay: 0, wheat: 0 });
    expect(firstCell(farm)?.plant).toEqual({ species: 'wheat', stage: 'sprout', progress: 0 });
    expect(farm.drainEvents().at(-1)).toMatchObject({ type: 'planted', species: 'wheat' });
  });

  it('ripens in 160 ticks and rewards one wheat', () => {
    const early = run(`${GET_TWO_HAY}till();\nplant(Plant.WHEAT);\nwait(159);\nharvest();`);
    expect(early.farm.getState().stock.wheat).toBe(0);
    expect(early.farm.drainEvents().at(-1)).toMatchObject({ type: 'destroyed', species: 'wheat' });

    const ripe = run(`${GET_TWO_HAY}till();\nplant(Plant.WHEAT);\nwait(160);\nharvest();`);
    expect(ripe.farm.getState().stock.wheat).toBe(1);
    expect(ripe.farm.drainEvents().at(-1)).toMatchObject({
      type: 'harvested',
      species: 'wheat',
      item: 'wheat',
      quantity: 1,
    });
  });
});

describe('planting on an occupied cell', () => {
  it('is refused, with a warning', () => {
    const { farm } = run('plant(Plant.GRASS);\nplant(Plant.GRASS);');

    expect(farm.drainEvents().map((event) => event.type)).toEqual(['planted', 'rejected']);
  });
});
