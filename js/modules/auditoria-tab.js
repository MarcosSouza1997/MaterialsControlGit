import { esc, toast, emptyState, formatDateTime } from '../ui.js';

/**
 * Renders the Auditoria tab view inside the provided container
 * @param {HTMLElement} container
 * @param {Object} ctx
 * @param {Object} ctx.supabase
 */
export async function renderAuditoriaTab(container, ctx) {
  let auditLogs = [];
  let totalCount = 0;
  let filterStartDate = '';
  let filterEndDate = '';
  let filterTable = '';
  let filterUser = '';
  let currentPage = 1;
  const pageSize = 25;
  const expandedRows = new Set();

  container.innerHTML = `
    <div class="flex flex-col gap-lg">
      <!-- Filters Section -->
      <div class="card flex flex-col gap-md">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
          <h2 class="text-heading flex items-center gap-xs">
            <span class="material-symbols-outlined text-primary">filter_alt</span>
            Filtros da Auditoria
          </h2>
          <button type="button" id="btn-clear-audit-filters" class="btn btn-secondary btn-sm">
            <span class="material-symbols-outlined">filter_alt_off</span>
            Limpar Filtros
          </button>
        </div>

        <div class="relatorios-filters-grid">
          <!-- Date Start -->
          <div class="form-group">
            <label class="form-label" for="filter-audit-start-date">Período (Início)</label>
            <input type="date" id="filter-audit-start-date" class="form-input" />
          </div>

          <!-- Date End -->
          <div class="form-group">
            <label class="form-label" for="filter-audit-end-date">Período (Fim)</label>
            <input type="date" id="filter-audit-end-date" class="form-input" />
          </div>

          <!-- Table Filter -->
          <div class="form-group">
            <label class="form-label" for="filter-audit-table">Tabela / Entidade</label>
            <select id="filter-audit-table" class="form-select">
              <option value="">Todas as tabelas</option>
              <option value="items">Itens do Catálogo (items)</option>
              <option value="requests">Pedidos / Requisições (requests)</option>
              <option value="stock_movements">Movimentações de Estoque (stock_movements)</option>
              <option value="profiles">Usuários e Perfis (profiles)</option>
            </select>
          </div>

          <!-- User Filter -->
          <div class="form-group">
            <label class="form-label" for="filter-audit-user">Usuário</label>
            <select id="filter-audit-user" class="form-select">
              <option value="">Todos os usuários</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Summary Metric Card -->
      <div class="report-metric-card">
        <span class="text-overline text-muted">Total de Registros Auditados</span>
        <span class="text-display text-primary" id="metric-audit-count">0</span>
        <span class="text-body-sm text-muted">Registros encontrados no log de auditoria</span>
      </div>

      <!-- Table Container -->
      <div id="audit-table-container" class="table-container">
        <div class="p-2xl text-center text-muted text-body">
          Carregando histórico de auditoria...
        </div>
      </div>

      <!-- Pagination Controls -->
      <div id="audit-pagination" class="flex items-center justify-between mt-xs"></div>
    </div>
  `;

  bindAuditEvents();

  // Populate user filter options and fetch initial audit log data
  await Promise.all([
    fetchUserProfiles(),
    fetchAuditData()
  ]);

  /**
   * Fetches profile options for the audit user filter
   */
  async function fetchUserProfiles() {
    try {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name', { ascending: true });

      if (!error && data) {
        const selectEl = container.querySelector('#filter-audit-user');
        if (selectEl) {
          selectEl.innerHTML = `
            <option value="">Todos os usuários</option>
            ${data.map(p => `<option value="${esc(p.id)}">${esc(p.full_name)}</option>`).join('')}
          `;
        }
      }
    } catch (err) {
      console.error('Erro ao buscar usuários para filtro de auditoria:', err);
    }
  }

  /**
   * Fetches paginated audit logs from vw_audit with active filters
   */
  async function fetchAuditData() {
    const tableContainer = container.querySelector('#audit-table-container');
    if (!tableContainer) return;

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    try {
      let query = ctx.supabase
        .from('vw_audit')
        .select('*', { count: 'exact' })
        .order('changed_at', { ascending: false });

      if (filterTable) {
        query = query.eq('table_name', filterTable);
      }

      if (filterUser) {
        query = query.eq('changed_by', filterUser);
      }

      if (filterStartDate) {
        query = query.gte('changed_at', `${filterStartDate}T00:00:00`);
      }

      if (filterEndDate) {
        query = query.lte('changed_at', `${filterEndDate}T23:59:59`);
      }

      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        if (error.code === '42501') {
          toast('Você não tem permissão para esta ação.', 'error');
        } else {
          toast(error.message || 'Erro ao carregar auditoria.', 'error');
        }
        tableContainer.innerHTML = emptyState('Não foi possível carregar os registros de auditoria.');
        return;
      }

      auditLogs = data || [];
      totalCount = count || 0;

      renderAuditMetrics();
      renderAuditTable();
      renderAuditPagination();
    } catch (err) {
      console.error('Erro ao consultar vw_audit:', err);
      toast('Erro de conexão ao carregar auditoria.', 'error');
      tableContainer.innerHTML = emptyState('Erro de conexão ao carregar auditoria.');
    }
  }

  /**
   * Updates metric card
   */
  function renderAuditMetrics() {
    const countEl = container.querySelector('#metric-audit-count');
    if (countEl) {
      countEl.textContent = totalCount.toLocaleString('pt-BR');
    }
  }

  /**
   * Formats database table name to human readable string
   * @param {string} table
   * @returns {string}
   */
  function formatTableName(table) {
    switch (table) {
      case 'items': return 'Itens (Catálogo)';
      case 'requests': return 'Pedidos';
      case 'stock_movements': return 'Movimentações';
      case 'profiles': return 'Perfis / Usuários';
      default: return table || '-';
    }
  }

  /**
   * Generates badge for action
   * @param {string} action
   * @returns {string}
   */
  function formatActionBadge(action) {
    const act = (action || '').toUpperCase();
    if (act === 'INSERT') {
      return `<span class="status-badge status-entregue">INCLUSÃO</span>`;
    } else if (act === 'UPDATE') {
      return `<span class="status-badge status-aprovado">ALTERAÇÃO</span>`;
    } else if (act === 'DELETE') {
      return `<span class="status-badge status-rejeitado">EXCLUSÃO</span>`;
    }
    return `<span class="status-badge">${esc(action)}</span>`;
  }

  /**
   * Renders diff presentation for expanded row
   * @param {Object} item
   * @returns {string}
   */
  function renderDiffContent(item) {
    const action = (item.action || '').toUpperCase();

    if (action === 'INSERT') {
      return `<div class="text-body-sm text-primary font-semibold">Novo registro incluído no sistema.</div>`;
    }
    if (action === 'DELETE') {
      return `<div class="text-body-sm text-danger font-semibold">Registro excluído do sistema.</div>`;
    }

    if (action === 'UPDATE' && item.old_data && item.new_data) {
      const oldData = item.old_data;
      const newData = item.new_data;

      const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
      const changedKeys = allKeys.filter(k => JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]));

      if (changedKeys.length === 0) {
        return `<div class="text-body-sm text-muted">Nenhum campo com alteração de valor detectado.</div>`;
      }

      return `
        <div class="flex flex-col gap-xs mb-sm">
          <div class="flex flex-wrap items-center gap-xs mb-xs">
            <span class="text-label text-muted">Campos alterados (${changedKeys.length}):</span>
            ${changedKeys.map(k => `<span class="changed-badge">${esc(k)}</span>`).join('')}
          </div>

          <table class="diff-table">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Valor Antigo</th>
                <th>Valor Novo</th>
              </tr>
            </thead>
            <tbody>
              ${changedKeys.map(k => {
                const oldVal = oldData[k] !== undefined ? (typeof oldData[k] === 'object' ? JSON.stringify(oldData[k]) : String(oldData[k])) : '-';
                const newVal = newData[k] !== undefined ? (typeof newData[k] === 'object' ? JSON.stringify(newData[k]) : String(newData[k])) : '-';
                return `
                  <tr class="changed-row">
                    <td class="font-semibold code-text">${esc(k)}</td>
                    <td class="text-danger code-text">${esc(oldVal)}</td>
                    <td class="text-primary code-text font-semibold">${esc(newVal)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return '';
  }

  /**
   * Renders audit logs table
   */
  function renderAuditTable() {
    const tableContainer = container.querySelector('#audit-table-container');
    if (!tableContainer) return;

    if (auditLogs.length === 0) {
      tableContainer.innerHTML = emptyState('Nenhum registro de auditoria encontrado para os filtros selecionados.');
      return;
    }

    tableContainer.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Data / Hora</th>
            <th>Usuário</th>
            <th>Tabela</th>
            <th>Ação</th>
            <th>ID do Registro</th>
            <th class="text-right">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          ${auditLogs.map(item => {
            const isExpanded = expandedRows.has(item.id);
            const mainRow = `
              <tr>
                <td class="tabular-nums text-body font-semibold">
                  ${formatDateTime(item.changed_at)}
                </td>
                <td>
                  <span class="font-semibold text-body">${esc(item.user_name || 'Sistema')}</span>
                </td>
                <td>
                  <span class="text-body-sm text-primary font-semibold">${esc(formatTableName(item.table_name))}</span>
                </td>
                <td>
                  ${formatActionBadge(item.action)}
                </td>
                <td class="code-text text-muted" title="${esc(item.record_id || '')}">
                  ${item.record_id ? esc(item.record_id.substring(0, 8)) : '-'}
                </td>
                <td class="text-right">
                  <button type="button" class="btn btn-secondary btn-sm btn-toggle-audit-detail" data-id="${item.id}">
                    <span class="material-symbols-outlined">${isExpanded ? 'expand_less' : 'expand_more'}</span>
                    ${isExpanded ? 'Ocultar' : 'Detalhes'}
                  </button>
                </td>
              </tr>
            `;

            if (!isExpanded) {
              return mainRow;
            }

            const detailRow = `
              ${mainRow}
              <tr class="audit-details-row">
                <td colspan="6" class="audit-details-cell">
                  <div class="audit-diff-container">
                    ${renderDiffContent(item)}
                    <div class="json-grid">
                      <div class="json-box">
                        <span class="text-label text-muted">Dados Anteriores (old_data)</span>
                        <pre class="code-json" id="old-json-${item.id}"></pre>
                      </div>
                      <div class="json-box">
                        <span class="text-label text-muted">Dados Novos (new_data)</span>
                        <pre class="code-json" id="new-json-${item.id}"></pre>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            `;

            return detailRow;
          }).join('')}
        </tbody>
      </table>
    `;

    // Safely set JSON content via textContent (R5)
    auditLogs.forEach(item => {
      if (expandedRows.has(item.id)) {
        const oldPre = container.querySelector(`#old-json-${item.id}`);
        const newPre = container.querySelector(`#new-json-${item.id}`);
        if (oldPre) {
          oldPre.textContent = item.old_data ? JSON.stringify(item.old_data, null, 2) : 'null';
        }
        if (newPre) {
          newPre.textContent = item.new_data ? JSON.stringify(item.new_data, null, 2) : 'null';
        }
      }
    });

    bindTableEvents();
  }

  /**
   * Renders audit pagination controls
   */
  function renderAuditPagination() {
    const paginationEl = container.querySelector('#audit-pagination');
    if (!paginationEl) return;

    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    paginationEl.innerHTML = `
      <span class="text-body-sm text-muted">
        Página <strong>${currentPage}</strong> de <strong>${totalPages}</strong> (${totalCount} registros)
      </span>
      <div class="flex items-center gap-xs">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          id="btn-audit-prev-page"
          ${currentPage <= 1 ? 'disabled' : ''}
        >
          <span class="material-symbols-outlined">chevron_left</span>
          Anterior
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          id="btn-audit-next-page"
          ${currentPage >= totalPages ? 'disabled' : ''}
        >
          Próxima
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    `;

    const prevBtn = paginationEl.querySelector('#btn-audit-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          fetchAuditData();
        }
      });
    }

    const nextBtn = paginationEl.querySelector('#btn-audit-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          fetchAuditData();
        }
      });
    }
  }

  /**
   * Binds UI controls event handlers
   */
  function bindAuditEvents() {
    const startDateInput = container.querySelector('#filter-audit-start-date');
    if (startDateInput) {
      startDateInput.addEventListener('change', (e) => {
        filterStartDate = e.target.value;
        currentPage = 1;
        fetchAuditData();
      });
    }

    const endDateInput = container.querySelector('#filter-audit-end-date');
    if (endDateInput) {
      endDateInput.addEventListener('change', (e) => {
        filterEndDate = e.target.value;
        currentPage = 1;
        fetchAuditData();
      });
    }

    const tableSelect = container.querySelector('#filter-audit-table');
    if (tableSelect) {
      tableSelect.addEventListener('change', (e) => {
        filterTable = e.target.value;
        currentPage = 1;
        fetchAuditData();
      });
    }

    const userSelect = container.querySelector('#filter-audit-user');
    if (userSelect) {
      userSelect.addEventListener('change', (e) => {
        filterUser = e.target.value;
        currentPage = 1;
        fetchAuditData();
      });
    }

    const btnClear = container.querySelector('#btn-clear-audit-filters');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        filterStartDate = '';
        filterEndDate = '';
        filterTable = '';
        filterUser = '';
        currentPage = 1;

        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        if (tableSelect) tableSelect.value = '';
        if (userSelect) userSelect.value = '';

        fetchAuditData();
      });
    }
  }

  /**
   * Binds table expand row buttons
   */
  function bindTableEvents() {
    const toggleBtns = container.querySelectorAll('.btn-toggle-audit-detail');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rawId = e.currentTarget.getAttribute('data-id');
        const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
        if (expandedRows.has(id)) {
          expandedRows.delete(id);
        } else {
          expandedRows.add(id);
        }
        renderAuditTable();
      });
    });
  }
}
