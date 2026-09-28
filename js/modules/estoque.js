import { emptyState } from '../ui.js';

/**
 * Renders Controle de Estoque view placeholder
 * @param {HTMLElement} container
 * @param {Object} ctx
 */
export function render(container, ctx) {
  container.innerHTML = `
    <div class="mb-lg">
      <h1 class="text-title">Controle de Estoque</h1>
    </div>
    ${emptyState("Disponível em breve")}
  `;
}
