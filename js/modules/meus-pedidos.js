import { emptyState } from '../ui.js';

/**
 * Renders Meus Pedidos view placeholder
 * @param {HTMLElement} container
 * @param {Object} ctx
 */
export function render(container, ctx) {
  container.innerHTML = `
    <div class="mb-lg">
      <h1 class="text-title">Meus Pedidos</h1>
    </div>
    ${emptyState("Disponível em breve")}
  `;
}
