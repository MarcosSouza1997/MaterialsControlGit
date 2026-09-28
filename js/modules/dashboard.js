import { emptyState, esc } from '../ui.js';

/**
 * Renders Dashboard view placeholder
 * @param {HTMLElement} container
 * @param {Object} ctx
 */
export function render(container, ctx) {
  container.innerHTML = `
    <div class="mb-lg">
      <h1 class="text-title">Dashboard</h1>
    </div>
    ${emptyState("Disponível em breve")}
  `;
}
