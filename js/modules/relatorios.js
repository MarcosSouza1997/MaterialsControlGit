import { emptyState } from '../ui.js';

/**
 * Renders Relatórios & Auditoria view placeholder
 * @param {HTMLElement} container
 * @param {Object} ctx
 */
export function render(container, ctx) {
  container.innerHTML = `
    <div class="mb-lg">
      <h1 class="text-title">Relatórios & Auditoria</h1>
    </div>
    ${emptyState("Disponível em breve")}
  `;
}
