import { createFarm } from '../engine';

const farm = createFarm({ width: 3, height: 2, seed: 1 });
const { field } = farm.getState();

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.textContent = `FarmBot Lab: campo ${field.width}×${field.height}`;
}
