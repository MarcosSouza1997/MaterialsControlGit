import { esc, toast, statusBadge, emptyState, formatDate, formatDateTime, openModal } from '../ui.js';

/**
 * Truncates string if longer than maxLen
 * @param {string} str
 * @param {number} [maxLen=50]
 * @returns {string}
 */
function truncate(str, maxLen = 50) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '...';
}

/**
 * Formats item quantity and unit
 * @param {number} qty
 * @param {string} unit
 * @returns {string}
 */
function formatQty(qty, unit) {
  const amount = Number(qty) || 0;
  const u = (unit || 'un').toLowerCase();
  return `${amount} ${u}`;
}

/**
 * Renders Meus Pedidos view
 * @param {HTMLElement} container
 * @param {Object} ctx
 * @param {Object} ctx.supabase
 * @param {Object} ctx.profile
 */
export async function render(container, ctx) {
  if (!ctx.profile || !ctx.profile.id) {
    container.innerHTML = emptyState('Usuário não autenticado.');
    return;
  }

  container.innerHTML = `
    <div class="meus-pedidos-page">
      <!-- Header -->
      <div class="mb-lg flex items-center justify-between flex-wrap gap-md">
        <div>
          <h1 class="text-title">Meus Pedidos</h1>
          <p class="text-body-sm text-muted mt-xs">Acompanhe e gerencie o histórico das suas solicitações de materiais.</p>
        </div>
        <div>
          <a href="#catalogo" class="btn btn-primary">
            <span class="material-symbols-outlined">add</span>
            Nova requisição
          </a>
        </div>
      </div>

      <!-- Tabs Bar -->
      <div class="catalog-category-chips mb-lg" id="status-tabs">
        <button type="button" class="category-chip active" data-status="ALL">
          Todos <span class="badge-count" id="count-ALL">0</span>
        </button>
        <button type="button" class="category-chip" data-status="PENDENTE">
          Pendentes <span class="badge-count" id="count-PENDENTE">0</span>
        </button>
        <button type="button" class="category-chip" data-status="APROVADO">
          Aprovados <span class="badge-count" id="count-APROVADO">0</span>
        </button>
        <button type="button" class="category-chip" data-status="EM_SEPARACAO">
          Em separação <span class="badge-count" id="count-EM_SEPARACAO">0</span>
        </button>
        <button type="button" class="category-chip" data-status="ENTREGUE">
          Entregues <span class="badge-count" id="count-ENTREGUE">0</span>
        </button>
        <button type="button" class="category-chip" data-status="REJEITADO">
          Rejeitados <span class="badge-count" id="count-REJEITADO">0</span>
        </button>
        <button type="button" class="category-chip" data-status="CANCELADO">
          Cancelados <span class="badge-count" id="count-CANCELADO">0</span>
        </button>
      </div>

      <!-- Main Content Card -->
      <div class="card p-0" id="requests-card">
        <div class="p-2xl text-center text-muted text-body" id="requests-loading">
          Carregando seus pedidos...
        </div>
      </div>
    </div>
  `;

  const tabsContainer = container.querySelector('#status-tabs');
  const cardContainer = container.querySelector('#requests-card');

  let requests = [];
  let currentStatusFilter = 'ALL';
  let currentPage = 1;
  const pageSize = 25;

  // Fetch requests for current user
  try {
    const { data, error } = await ctx.supabase
      .from('vw_requests')
      .select('*')
      .eq('requester_id', ctx.profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42501') {
        toast('Você não tem permissão para esta ação.', 'error');
      } else {
        toast(error.message || 'Erro ao carregar seus pedidos.', 'error');
      }
      cardContainer.innerHTML = `
        <div class="p-lg">
          ${emptyState('Não foi possível carregar os seus pedidos.')}
        </div>
      `;
      return;
    }

    requests = data || [];
    updateTabCounts();
    renderFilteredTable();

  } catch (err) {
    console.error('Erro ao consultar vw_requests:', err);
    toast('Erro de conexão ao carregar pedidos.', 'error');
    cardContainer.innerHTML = `
      <div class="p-lg">
        ${emptyState('Erro de conexão ao carregar pedidos.')}
      </div>
    `;
    return;
  }

  /**
   * Updates count badges on tab buttons
   */
  function updateTabCounts() {
    const counts = {
      ALL: requests.length,
      PENDENTE: 0,
      APROVADO: 0,
      EM_SEPARACAO: 0,
      ENTREGUE: 0,
      REJEITADO: 0,
      CANCELADO: 0
    };

    requests.forEach(r => {
      const st = r.status ? String(r.status).toUpperCase() : '';
      if (counts[st] !== undefined) {
        counts[st]++;
      }
    });

    Object.keys(counts).forEach(key => {
      const el = container.querySelector(`#count-${key}`);
      if (el) {
        el.textContent = counts[key];
      }
    });
  }

  /**
   * Filters requests array and renders table & pagination
   */
  function renderFilteredTable() {
    const filtered = requests.filter(r => {
      if (currentStatusFilter === 'ALL') return true;
      return (r.status || '').toUpperCase() === currentStatusFilter;
    });

    if (filtered.length === 0) {
      cardContainer.innerHTML = `
        <div class="p-2xl text-center">
          ${emptyState('Nenhum pedido encontrado nesta categoria.')}
          <div class="mt-lg">
            <a href="#catalogo" class="btn btn-primary">
              <span class="material-symbols-outlined">shopping_bag</span>
              Fazer novo pedido no catálogo
            </a>
          </div>
        </div>
      `;
      return;
    }

    const totalPages = Math.ceil(filtered.length / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * pageSize;
    const pageItems = filtered.slice(startIdx, startIdx + pageSize);

    cardContainer.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Data / Hora</th>
              <th scope="col">Item / SKU</th>
              <th scope="col" class="text-center">Qtd.</th>
              <th scope="col">Status</th>
              <th scope="col">Justificativa / Motivo Rejeição</th>
              <th scope="col" class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map(r => renderRowHtml(r)).join('')}
          </tbody>
        </table>
      </div>

      ${totalPages > 1 ? `
        <div class="p-md flex items-center justify-between border-t border-subtle flex-wrap gap-sm">
          <span class="text-body-sm text-muted">
            Mostrando ${startIdx + 1} a ${Math.min(startIdx + pageSize, filtered.length)} de ${filtered.length} pedidos
          </span>
          <div class="flex items-center gap-xs">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-prev-page" ${currentPage === 1 ? 'disabled' : ''}>
              <span class="material-symbols-outlined">chevron_left</span> Anterior
            </button>
            <span class="text-body-sm text-muted font-semibold px-sm">Página ${currentPage} de ${totalPages}</span>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-next-page" ${currentPage === totalPages ? 'disabled' : ''}>
              Próxima <span class="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      ` : ''}
    `;

    // Bind Pagination Events
    const prevBtn = cardContainer.querySelector('#btn-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderFilteredTable();
        }
      });
    }

    const nextBtn = cardContainer.querySelector('#btn-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderFilteredTable();
        }
      });
    }

    // Bind Cancel Action Buttons
    cardContainer.querySelectorAll('.btn-cancel-request').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const req = requests.find(r => r.id === id);
        if (req) {
          handleCancelRequest(req);
        }
      });
    });
  }

  /**
   * Generates single row HTML for a request
   * @param {Object} r
   * @returns {string}
   */
  function renderRowHtml(r) {
    const shortId = '#' + (r.id ? r.id.substring(0, 6) : '------');
    const isRejected = (r.status || '').toUpperCase() === 'REJEITADO';
    const isPending = (r.status || '').toUpperCase() === 'PENDENTE';

    let detailHtml = '';
    const truncatedJustification = truncate(r.justification, 40);
    const fullJustification = esc(r.justification || '');

    if (isRejected && r.reject_reason) {
      detailHtml = `
        <div class="text-body-sm mb-2xs" title="${fullJustification}">
          <strong>Justificativa:</strong> ${esc(truncatedJustification)}
        </div>
        <div class="text-body-sm text-danger font-semibold p-xs border-radius-sm" style="background-color: var(--color-danger-bg); border: 1px solid var(--color-danger-border);" title="${esc(r.reject_reason)}">
          <strong>Motivo da Rejeição:</strong> ${esc(r.reject_reason)}
        </div>
      `;
    } else {
      detailHtml = `
        <span class="text-body-sm" title="${fullJustification}">
          ${esc(truncatedJustification || '-')}
        </span>
      `;
    }

    return `
      <tr>
        <td>
          <span class="code-text font-semibold text-brand-dark">${esc(shortId)}</span>
        </td>
        <td>
          <span class="text-body-sm text-muted">${esc(formatDateTime(r.created_at))}</span>
        </td>
        <td>
          <div class="font-semibold text-body-sm text-main">${esc(r.item_name || '-')}</div>
          <div class="text-body-sm text-muted">SKU: <span class="code-text">${esc(r.item_sku || '-')}</span></div>
        </td>
        <td class="text-center font-semibold text-body-sm">
          ${esc(formatQty(r.quantity, r.item_unit))}
        </td>
        <td>
          ${statusBadge(r.status)}
        </td>
        <td style="max-width: 320px;">
          ${detailHtml}
        </td>
        <td class="text-right">
          ${isPending ? `
            <button
              type="button"
              class="btn btn-secondary btn-sm btn-cancel-request"
              data-id="${esc(r.id)}"
              title="Cancelar pedido"
            >
              <span class="material-symbols-outlined">cancel</span>
              Cancelar
            </button>
          ` : '<span class="text-body-sm text-muted">-</span>'}
        </td>
      </tr>
    `;
  }

  /**
   * Prompts confirmation and calls cancel_request RPC
   * @param {Object} req
   */
  function handleCancelRequest(req) {
    const shortId = '#' + (req.id ? req.id.substring(0, 6) : '');
    openModal({
      title: 'Cancelar Pedido',
      body: `
        <p class="text-body">
          Tem certeza que deseja cancelar o pedido <strong>${esc(shortId)}</strong> de
          <strong>${esc(req.quantity)}x ${esc(req.item_name)}</strong>?
        </p>
        <p class="text-body-sm text-muted mt-sm">
          Esta ação não poderá ser desfeita.
        </p>
      `,
      actions: [
        {
          text: 'Voltar',
          class: 'btn btn-secondary',
          onClick: (close) => close()
        },
        {
          text: 'Sim, cancelar pedido',
          class: 'btn btn-danger',
          onClick: async (close) => {
            close();
            try {
              const { error } = await ctx.supabase.rpc('cancel_request', {
                p_request_id: req.id
              });

              if (error) {
                if (error.code === '42501') {
                  toast('Você não tem permissão para cancelar este pedido.', 'error');
                } else {
                  toast(error.message || 'Erro ao cancelar pedido.', 'error');
                }
                return;
              }

              toast('Pedido cancelado com sucesso.', 'success');

              // Re-fetch data and re-render
              const { data: updatedData } = await ctx.supabase
                .from('vw_requests')
                .select('*')
                .eq('requester_id', ctx.profile.id)
                .order('created_at', { ascending: false });

              if (updatedData) {
                requests = updatedData;
                updateTabCounts();
                renderFilteredTable();
              }
            } catch (err) {
              console.error('Erro ao cancelar pedido:', err);
              toast('Erro de conexão ao cancelar pedido.', 'error');
            }
          }
        }
      ]
    });
  }

  // Bind Status Tabs Handler
  if (tabsContainer) {
    tabsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;

      tabsContainer.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      currentStatusFilter = chip.getAttribute('data-status') || 'ALL';
      currentPage = 1;
      renderFilteredTable();
    });
  }
}
