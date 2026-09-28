import { emptyState } from '../ui.js';

/**
 * Renders Catálogo & Requisição view placeholder
 * @param {HTMLElement} container
 * @param {Object} ctx
 */
export function render(container, ctx) {
  container.innerHTML = `
    <div class="mb-lg">
      <h1 class="text-title">Catálogo & Requisição</h1>
    </div>
    ${emptyState("Disponível em breve")}
  `;
}
