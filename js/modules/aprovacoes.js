import { emptyState } from '../ui.js';

/**
 * Renders Central de Aprovações view placeholder
 * @param {HTMLElement} container
 * @param {Object} ctx
 */
export function render(container, ctx) {
  container.innerHTML = `
    <div class="mb-lg">
      <h1 class="text-title">Central de Aprovações</h1>
    </div>
    ${emptyState("Disponível em breve")}
  `;
}
