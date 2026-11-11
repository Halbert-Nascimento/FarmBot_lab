/** Example scripts the prototype plays. They are ordinary player scripts: the view has no say in what they do. */

/** For the 3x2 field: grass in a row, hay harvested from it, then wheat (which costs hay) next to more grass. */
export const GARDEN = `
// Plant a row of grass.
for (let x = 0; x < 3; x++) {
  plant(Plant.GRASS);
  if (x < 2) {
    move(Dir.EAST);
  }
}

// Wait for it to ripen, then harvest it on the way back. Grass gives hay.
wait(125);
for (let x = 0; x < 3; x++) {
  harvest();
  if (x < 2) {
    move(Dir.WEST);
  }
}

// Wheat grows only on tilled soil and costs 2 hay.
move(Dir.SOUTH);
till();
plant(Plant.WHEAT);
move(Dir.EAST);
plant(Plant.GRASS);
move(Dir.EAST);
plant(Plant.GRASS);

// Go back to the wheat and wait until it is ripe.
move(Dir.WEST);
move(Dir.WEST);
while (!isReady()) {
  wait(5);
}
harvest();
`;

/** For any field: plants the whole field in a snake pattern, tilling every other cell. */
export const SWEEP = `
const size = getSize();
let dir = Dir.EAST;
for (let y = 0; y < size.height; y++) {
  for (let x = 0; x < size.width; x++) {
    if ((x + y) % 2 === 0) {
      till();
    }
    plant(Plant.GRASS);
    if (x < size.width - 1) {
      move(dir);
    }
  }
  if (y < size.height - 1) {
    move(Dir.SOUTH);
  }
  if (dir === Dir.EAST) {
    dir = Dir.WEST;
  } else {
    dir = Dir.EAST;
  }
}
`;

export const DEMOS: Readonly<Record<string, string>> = { garden: GARDEN, sweep: SWEEP };
