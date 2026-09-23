import { supabase } from '../supabase.js';

let currentPage = 1;
const PAGE_SIZE = 25;
let cachedItems = [];

export async function fetchItemsWithStock() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('items')
    .select(`
      id,
      name,
      category,
      unit,
      type,
      reorder_point,
      active,
      stock ( quantity )
    `)
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Erro ao buscar itens:', error);
    return [];
  }

  cachedItems = data.map(item => ({
    ...item,
    quantity: item.stock ? (Array.isArray(item.stock) ? (item.stock[0]?.quantity || 0) : item.stock.quantity) : 0
  }));

  return cachedItems;
}

export function renderItemsTable(containerId, items, page = 1) {
  const container = document.getElementById(containerId);
  if (!container) return;

  currentPage = page;
  const start = (currentPage - 1) * PAGE_SIZE;
  const paginatedItems = items.slice(start, start + PAGE_SIZE);
  const totalPages = Math.ceil(items.length / PAGE_SIZE) || 1;

  let html = `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Nome do Item</th>
            <th>Categoria</th>
            <th>Unidade</th>
            <th>Saldo em Estoque</th>
            <th>Ponto de Reposição</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (paginatedItems.length === 0) {
    html += `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--color-text-muted); padding: var(--space-xl);">
          Nenhum item encontrado no catálogo.
        </td>
      </tr>
    `;
  } else {
    paginatedItems.forEach(item => {
      const isLowStock = item.quantity <= item.reorder_point;
      const statusBadge = isLowStock
        ? `<span class="badge badge-pending">Estoque baixo</span>`
        : `<span class="badge badge-delivered">OK</span>`;

      html += `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td>${item.category}</td>
          <td>${item.unit}</td>
          <td><strong>${item.quantity}</strong></td>
          <td>${item.reorder_point}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });
  }

  html += `
        </tbody>
      </table>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-lg);">
      <span style="font-size: 0.875rem; color: var(--color-text-muted);">
        Página ${currentPage} de ${totalPages} (${items.length} itens no total)
      </span>
      <div style="display: flex; gap: var(--space-sm);">
        <button id="prev-page-btn" class="btn btn-secondary" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
        <button id="next-page-btn" class="btn btn-secondary" ${currentPage >= totalPages ? 'disabled' : ''}>Próxima</button>
      </div>
    </div>
  `;

  container.innerHTML = html;

  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        renderItemsTable(containerId, items, currentPage - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentPage < totalPages) {
        renderItemsTable(containerId, items, currentPage + 1);
      }
    });
  }
}
