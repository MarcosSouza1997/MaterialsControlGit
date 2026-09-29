import { esc, toast, emptyState, formatDate, formatMoney, paginate } from '../ui.js';
import { renderAuditoriaTab } from './auditoria-tab.js';

/**
 * Returns formatted label for category
 * @param {string} category
 * @returns {string}
 */
function formatCategoryLabel(category) {
  const cat = (category || '').toUpperCase();
  switch (cat) {
    case 'PAPELARIA': return 'Papelaria';
    case 'INFORMATICA': return 'Informática';
    case 'LIMPEZA': return 'Limpeza';
    case 'IMPRESSAO': return 'Impressão';
    case 'OUTROS': return 'Outros';
    default: return category || 'Outros';
  }
}

/**
 * Renders Relatórios & Auditoria view (T-012: Relatório de Consumo)
 * @param {HTMLElement} container
 * @param {Object} ctx
 * @param {Object} ctx.supabase
 * @param {Object} [ctx.profile]
 */
export async function render(container, ctx) {
  let consumptionData = [];
  let costCentersList = [];
  let itemsList = [];
  let requestersList = [];

  // Filter & Grouping state
  let filterStartDate = '';
  let filterEndDate = '';
  let filterItemId = '';
  let filterRequesterId = '';
  let filterCostCenter = '';
  let currentGrouping = 'item'; // 'item' | 'solicitante' | 'centro_custo'
  let currentPage = 1;

  // Main layout template
  container.innerHTML = `
    <div class="relatorios-container flex flex-col gap-lg">
      <!-- Page Header & Tab Navigation -->
      <div class="card flex flex-col gap-md">
        <div>
          <h1 class="text-title">Relatórios & Auditoria</h1>
          <p class="text-body-sm text-muted mt-2xs">Análise de consumo de materiais e registros de movimentação.</p>
        </div>

        <!-- Tab Navigation Bar -->
        <div class="tab-nav">
          <button type="button" class="tab-btn active" id="tab-consumo" data-tab="consumo">
            <span class="material-symbols-outlined">pie_chart</span>
            Consumo de Materiais
          </button>
          <button type="button" class="tab-btn" id="tab-auditoria" data-tab="auditoria">
            <span class="material-symbols-outlined">history</span>
            Auditoria do Sistema
          </button>
        </div>
      </div>

      <!-- Content Container for Consumo Tab -->
      <div id="tab-content-consumo" class="flex flex-col gap-lg">
        <!-- Filters Section -->
        <div class="card flex flex-col gap-md">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
          <h2 class="text-heading flex items-center gap-xs">
            <span class="material-symbols-outlined text-primary">filter_alt</span>
            Filtros do Relatório
          </h2>
          <button type="button" id="btn-clear-filters" class="btn btn-secondary btn-sm">
            <span class="material-symbols-outlined">filter_alt_off</span>
            Limpar Filtros
          </button>
        </div>

        <div class="relatorios-filters-grid">
          <!-- Date Start -->
          <div class="form-group">
            <label class="form-label" for="filter-start-date">Período (Início)</label>
            <input type="date" id="filter-start-date" class="form-input" />
          </div>

          <!-- Date End -->
          <div class="form-group">
            <label class="form-label" for="filter-end-date">Período (Fim)</label>
            <input type="date" id="filter-end-date" class="form-input" />
          </div>

          <!-- Item Filter -->
          <div class="form-group">
            <label class="form-label" for="filter-item">Material / Item</label>
            <select id="filter-item" class="form-select">
              <option value="">Todos os itens</option>
            </select>
          </div>

          <!-- Requester Filter -->
          <div class="form-group">
            <label class="form-label" for="filter-requester">Solicitante</label>
            <select id="filter-requester" class="form-select">
              <option value="">Todos os solicitantes</option>
            </select>
          </div>

          <!-- Cost Center Filter (DB cost_centers table) -->
          <div class="form-group">
            <label class="form-label" for="filter-cost-center">Setor</label>
            <select id="filter-cost-center" class="form-select">
              <option value="">Todos os setores</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Grouping & Export Bar -->
      <div class="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md">
        <div class="flex flex-wrap items-center gap-sm">
          <span class="text-label text-muted">Agrupar por:</span>
          <div class="grouping-pills">
            <button type="button" class="grouping-pill active" data-grouping="item">
              Item / Material
            </button>
            <button type="button" class="grouping-pill" data-grouping="solicitante">
              Solicitante
            </button>
            <button type="button" class="grouping-pill" data-grouping="centro_custo">
              Setor
            </button>
          </div>
        </div>

        <button type="button" id="btn-export-csv" class="btn btn-secondary">
          <span class="material-symbols-outlined">download</span>
          Exportar CSV
        </button>
      </div>

      <!-- Summary Metrics Cards -->
      <div class="report-metrics-grid">
        <div class="report-metric-card">
          <span class="text-overline text-muted">Total de Saídas</span>
          <span class="text-display text-primary" id="metric-total-quantity">0</span>
          <span class="text-body-sm text-muted">Unidades entregues no período</span>
        </div>

        <div class="report-metric-card">
          <span class="text-overline text-muted">Valor Total Consumido</span>
          <span class="text-display text-primary" id="metric-total-value">R$ 0,00</span>
          <span class="text-body-sm text-muted">Custo total dos materiais</span>
        </div>

        <div class="report-metric-card">
          <span class="text-overline text-muted">Registros de Saída</span>
          <span class="text-display" id="metric-records-count">0</span>
          <span class="text-body-sm text-muted">Movimentações consolidadas</span>
        </div>
      </div>

      <!-- Main Data Table Container -->
      <div id="report-table-container" class="table-container">
        <div class="p-2xl text-center text-muted text-body">
          Carregando relatório de consumo...
        </div>
      </div>

      <!-- Pagination Container -->
      <div id="report-pagination" class="flex items-center justify-between mt-xs"></div>
      </div> <!-- End #tab-content-consumo -->

      <!-- Content Container for Auditoria Tab -->
      <div id="tab-content-auditoria" class="flex flex-col gap-lg hidden"></div>
    </div>
  `;

  let auditoriaInitialized = false;

  // Bind Tab Switching Events
  bindTabEvents();

  // Fetch Auxiliary Data (cost_centers, items, profiles) & Consumption View
  await Promise.all([
    fetchCostCenters(),
    fetchAuxiliaryFilters(),
    fetchConsumptionData()
  ]);

  // Bind Event Listeners for Consumo
  bindEvents();

  /**
   * Binds tab switching navigation events
   */
  function bindTabEvents() {
    const tabConsumo = container.querySelector('#tab-consumo');
    const tabAuditoria = container.querySelector('#tab-auditoria');
    const contentConsumo = container.querySelector('#tab-content-consumo');
    const contentAuditoria = container.querySelector('#tab-content-auditoria');

    if (tabConsumo && tabAuditoria) {
      tabConsumo.addEventListener('click', () => {
        tabConsumo.classList.add('active');
        tabAuditoria.classList.remove('active');
        if (contentConsumo) contentConsumo.classList.remove('hidden');
        if (contentAuditoria) contentAuditoria.classList.add('hidden');
      });

      tabAuditoria.addEventListener('click', async () => {
        tabAuditoria.classList.add('active');
        tabConsumo.classList.remove('active');
        if (contentConsumo) contentConsumo.classList.add('hidden');
        if (contentAuditoria) contentAuditoria.classList.remove('hidden');

        if (!auditoriaInitialized) {
          auditoriaInitialized = true;
          await renderAuditoriaTab(contentAuditoria, ctx);
        }
      });
    }
  }

  /**
   * Fetches cost_centers from database
   */
  async function fetchCostCenters() {
    try {
      const { data, error } = await ctx.supabase
        .from('cost_centers')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        costCentersList = data;
      }
    } catch (err) {
      console.error('Erro ao buscar cost_centers:', err);
    }
    populateCostCenterFilter();
  }

  /**
   * Populates Cost Center select options dynamically from database table
   */
  function populateCostCenterFilter() {
    const selectEl = container.querySelector('#filter-cost-center');
    if (!selectEl) return;

    if (costCentersList.length > 0) {
      selectEl.innerHTML = `
        <option value="">Todos os setores</option>
        ${costCentersList.map(cc => {
          const name = typeof cc === 'object' ? (cc.name || cc.code || '') : String(cc);
          return `<option value="${esc(name)}">${esc(name)}</option>`;
        }).join('')}
      `;
    }
  }

  /**
   * Fetches items and profiles for filters dropdown
   */
  async function fetchAuxiliaryFilters() {
    try {
      const [itemsRes, profilesRes] = await Promise.all([
        ctx.supabase.from('items').select('id, name, sku').order('name', { ascending: true }),
        ctx.supabase.from('profiles').select('id, full_name').order('full_name', { ascending: true })
      ]);

      if (!itemsRes.error && itemsRes.data) {
        itemsList = itemsRes.data;
        populateItemsFilter();
      }

      if (!profilesRes.error && profilesRes.data) {
        requestersList = profilesRes.data;
        populateRequestersFilter();
      }
    } catch (err) {
      console.error('Erro ao buscar dados auxiliares para filtros:', err);
    }
  }

  function populateItemsFilter() {
    const selectEl = container.querySelector('#filter-item');
    if (!selectEl) return;
    selectEl.innerHTML = `
      <option value="">Todos os itens</option>
      ${itemsList.map(i => `<option value="${esc(i.id)}">${esc(i.name)} (${esc(i.sku)})</option>`).join('')}
    `;
  }

  function populateRequestersFilter() {
    const selectEl = container.querySelector('#filter-requester');
    if (!selectEl) return;
    selectEl.innerHTML = `
      <option value="">Todos os solicitantes</option>
      ${requestersList.map(r => `<option value="${esc(r.id)}">${esc(r.full_name)}</option>`).join('')}
    `;
  }

  /**
   * Fetches consumption data from vw_consumption
   */
  async function fetchConsumptionData() {
    const tableContainer = container.querySelector('#report-table-container');
    try {
      const { data, error } = await ctx.supabase
        .from('vw_consumption')
        .select('*')
        .order('moved_at', { ascending: false });

      if (error) {
        if (error.code === '42501') {
          toast('Você não tem permissão para esta ação.', 'error');
        } else {
          toast(error.message || 'Erro ao carregar dados de consumo.', 'error');
        }
        if (tableContainer) tableContainer.innerHTML = emptyState('Não foi possível carregar os dados do relatório.');
        return;
      }

      consumptionData = data || [];
      applyFiltersAndRender();
    } catch (err) {
      console.error('Erro ao consultar vw_consumption:', err);
      toast('Erro de conexão ao carregar relatório.', 'error');
      if (tableContainer) tableContainer.innerHTML = emptyState('Erro de conexão ao carregar relatório.');
    }
  }

  /**
   * Binds UI controls event listeners
   */
  function bindEvents() {
    const startDateInput = container.querySelector('#filter-start-date');
    if (startDateInput) {
      startDateInput.addEventListener('change', (e) => {
        filterStartDate = e.target.value;
        currentPage = 1;
        applyFiltersAndRender();
      });
    }

    const endDateInput = container.querySelector('#filter-end-date');
    if (endDateInput) {
      endDateInput.addEventListener('change', (e) => {
        filterEndDate = e.target.value;
        currentPage = 1;
        applyFiltersAndRender();
      });
    }

    const itemSelect = container.querySelector('#filter-item');
    if (itemSelect) {
      itemSelect.addEventListener('change', (e) => {
        filterItemId = e.target.value;
        currentPage = 1;
        applyFiltersAndRender();
      });
    }

    const requesterSelect = container.querySelector('#filter-requester');
    if (requesterSelect) {
      requesterSelect.addEventListener('change', (e) => {
        filterRequesterId = e.target.value;
        currentPage = 1;
        applyFiltersAndRender();
      });
    }

    const ccSelect = container.querySelector('#filter-cost-center');
    if (ccSelect) {
      ccSelect.addEventListener('change', (e) => {
        filterCostCenter = e.target.value;
        currentPage = 1;
        applyFiltersAndRender();
      });
    }

    const btnClear = container.querySelector('#btn-clear-filters');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        filterStartDate = '';
        filterEndDate = '';
        filterItemId = '';
        filterRequesterId = '';
        filterCostCenter = '';
        currentPage = 1;

        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        if (itemSelect) itemSelect.value = '';
        if (requesterSelect) requesterSelect.value = '';
        if (ccSelect) ccSelect.value = '';

        applyFiltersAndRender();
      });
    }

    // Grouping pills click handler
    const groupingPills = container.querySelectorAll('.grouping-pill');
    groupingPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        groupingPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentGrouping = e.currentTarget.getAttribute('data-grouping') || 'item';
        currentPage = 1;
        applyFiltersAndRender();
      });
    });

    // Export CSV button click handler
    const btnExport = container.querySelector('#btn-export-csv');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        exportToCSV();
      });
    }
  }

  /**
   * Filters raw consumption data based on current active filters
   * @returns {Array}
   */
  function getFilteredRows() {
    return consumptionData.filter(row => {
      // Date start filter
      if (filterStartDate) {
        const movedDateStr = row.moved_at ? row.moved_at.substring(0, 10) : '';
        if (movedDateStr < filterStartDate) return false;
      }

      // Date end filter
      if (filterEndDate) {
        const movedDateStr = row.moved_at ? row.moved_at.substring(0, 10) : '';
        if (movedDateStr > filterEndDate) return false;
      }

      // Item filter
      if (filterItemId && row.item_id !== filterItemId) {
        return false;
      }

      // Requester filter
      if (filterRequesterId && row.requester_id !== filterRequesterId) {
        return false;
      }

      // Cost Center filter
      if (filterCostCenter && (row.cost_center || '').toLowerCase() !== filterCostCenter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }

  /**
   * Groups filtered rows according to current grouping option
   * @param {Array} filteredRows
   * @returns {Array}
   */
  function getGroupedData(filteredRows) {
    const groupsMap = new Map();

    filteredRows.forEach(row => {
      let key = '';
      let meta = {};

      if (currentGrouping === 'item') {
        key = row.item_id || row.item_name || 'outros';
        meta = {
          id: row.item_id,
          name: row.item_name || 'Sem nome',
          sku: row.sku || '-',
          category: row.category || 'OUTROS'
        };
      } else if (currentGrouping === 'solicitante') {
        key = row.requester_id || row.requester_name || 'desconhecido';
        meta = {
          id: row.requester_id,
          name: row.requester_name || 'Usuário Não Identificado',
          cost_center: row.cost_center || '-'
        };
      } else if (currentGrouping === 'centro_custo') {
        key = (row.cost_center || 'Sem Setor Defined').trim().toUpperCase();
        meta = {
          cost_center: row.cost_center || 'Sem Setor Definido'
        };
      }

      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          meta,
          totalQuantity: 0,
          totalValue: 0,
          recordsCount: 0
        });
      }

      const group = groupsMap.get(key);
      group.totalQuantity += Number(row.quantity) || 0;
      group.totalValue += Number(row.value) || 0;
      group.recordsCount += 1;
    });

    return Array.from(groupsMap.values());
  }

  /**
   * Applies filters, calculates metrics, and renders the table and pagination
   */
  function applyFiltersAndRender() {
    const filteredRows = getFilteredRows();
    const groupedData = getGroupedData(filteredRows);

    renderMetrics(filteredRows, groupedData);

    const paginated = paginate(groupedData, currentPage, 25);
    renderTable(paginated.data, groupedData);
    renderPaginationControls(paginated);
  }

  /**
   * Renders metric summary cards
   * @param {Array} filteredRows
   * @param {Array} groupedData
   */
  function renderMetrics(filteredRows, groupedData) {
    const qtyEl = container.querySelector('#metric-total-quantity');
    const valEl = container.querySelector('#metric-total-value');
    const recEl = container.querySelector('#metric-records-count');

    let totalQty = 0;
    let totalVal = 0;

    filteredRows.forEach(r => {
      totalQty += Number(r.quantity) || 0;
      totalVal += Number(r.value) || 0;
    });

    if (qtyEl) qtyEl.textContent = totalQty.toLocaleString('pt-BR');
    if (valEl) valEl.textContent = formatMoney(totalVal);
    if (recEl) recEl.textContent = filteredRows.length.toLocaleString('pt-BR');
  }

  /**
   * Renders the grouped consumption data table
   * @param {Array} rows - Paginated rows
   * @param {Array} allGrouped - All grouped data (to calculate Total Geral)
   */
  function renderTable(rows, allGrouped = []) {
    const tableContainer = container.querySelector('#report-table-container');
    if (!tableContainer) return;

    if (rows.length === 0) {
      tableContainer.innerHTML = emptyState('Nenhum dado de consumo encontrado para os filtros selecionados.');
      return;
    }

    let overallQty = 0;
    let overallVal = 0;
    allGrouped.forEach(g => {
      overallQty += g.totalQuantity || 0;
      overallVal += g.totalValue || 0;
    });

    let headersHtml = '';

    if (currentGrouping === 'item') {
      headersHtml = `
        <th>Material / Produto</th>
        <th>SKU</th>
        <th>Categoria</th>
        <th class="text-center">Qtd. Total Saída</th>
        <th class="text-right">Valor Total (R$)</th>
      `;
    } else if (currentGrouping === 'solicitante') {
      headersHtml = `
        <th>Solicitante</th>
        <th>Setor</th>
        <th class="text-center">Total de Pedidos/Saídas</th>
        <th class="text-center">Qtd. Total Itens</th>
        <th class="text-right">Valor Total (R$)</th>
      `;
    } else if (currentGrouping === 'centro_custo') {
      headersHtml = `
        <th>Setor</th>
        <th class="text-center">Registros de Saída</th>
        <th class="text-center">Qtd. Total Itens</th>
        <th class="text-right">Valor Total Consumido (R$)</th>
      `;
    }

    const tfootHtml = `
      <tfoot>
        <tr class="table-footer-row">
          ${currentGrouping === 'centro_custo'
            ? `<td colspan="2" class="font-bold text-body">Total Geral</td>`
            : `<td colspan="3" class="font-bold text-body">Total Geral</td>`
          }
          <td class="text-center font-bold tabular-nums text-body">
            ${overallQty.toLocaleString('pt-BR')}
          </td>
          <td class="text-right font-bold tabular-nums text-primary">
            ${formatMoney(overallVal)}
          </td>
        </tr>
      </tfoot>
    `;

    tableContainer.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            ${headersHtml}
          </tr>
        </thead>
        <tbody>
          ${rows.map(group => {
            if (currentGrouping === 'item') {
              return `
                <tr>
                  <td>
                    <span class="font-semibold text-body">${esc(group.meta.name)}</span>
                  </td>
                  <td class="code-text font-semibold text-primary">
                    ${esc(group.meta.sku)}
                  </td>
                  <td>
                    <span class="text-body-sm">${esc(formatCategoryLabel(group.meta.category))}</span>
                  </td>
                  <td class="text-center font-semibold tabular-nums text-body">
                    ${group.totalQuantity.toLocaleString('pt-BR')}
                  </td>
                  <td class="text-right font-semibold tabular-nums text-primary">
                    ${formatMoney(group.totalValue)}
                  </td>
                </tr>
              `;
            } else if (currentGrouping === 'solicitante') {
              return `
                <tr>
                  <td>
                    <span class="font-semibold text-body">${esc(group.meta.name)}</span>
                  </td>
                  <td>
                    <span class="text-body-sm text-muted">${esc(group.meta.cost_center)}</span>
                  </td>
                  <td class="text-center code-text text-muted">
                    ${group.recordsCount}
                  </td>
                  <td class="text-center font-semibold tabular-nums text-body">
                    ${group.totalQuantity.toLocaleString('pt-BR')}
                  </td>
                  <td class="text-right font-semibold tabular-nums text-primary">
                    ${formatMoney(group.totalValue)}
                  </td>
                </tr>
              `;
            } else if (currentGrouping === 'centro_custo') {
              return `
                <tr>
                  <td>
                    <span class="font-semibold text-body">${esc(group.meta.cost_center)}</span>
                  </td>
                  <td class="text-center code-text text-muted">
                    ${group.recordsCount}
                  </td>
                  <td class="text-center font-semibold tabular-nums text-body">
                    ${group.totalQuantity.toLocaleString('pt-BR')}
                  </td>
                  <td class="text-right font-semibold tabular-nums text-primary">
                    ${formatMoney(group.totalValue)}
                  </td>
                </tr>
              `;
            }
            return '';
          }).join('')}
        </tbody>
        ${tfootHtml}
      </table>
    `;
  }

  /**
   * Renders pagination controls
   * @param {Object} paginated
   */
  function renderPaginationControls(paginated) {
    const paginationEl = container.querySelector('#report-pagination');
    if (!paginationEl) return;

    if (paginated.totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    paginationEl.innerHTML = `
      <span class="text-body-sm text-muted">
        Página <strong>${paginated.page}</strong> de <strong>${paginated.totalPages}</strong>
      </span>
      <div class="flex items-center gap-xs">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          id="btn-prev-page"
          ${paginated.page <= 1 ? 'disabled' : ''}
        >
          <span class="material-symbols-outlined">chevron_left</span>
          Anterior
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          id="btn-next-page"
          ${paginated.page >= paginated.totalPages ? 'disabled' : ''}
        >
          Próxima
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
      </div>
    `;

    const prevBtn = paginationEl.querySelector('#btn-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          applyFiltersAndRender();
        }
      });
    }

    const nextBtn = paginationEl.querySelector('#btn-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < paginated.totalPages) {
          currentPage++;
          applyFiltersAndRender();
        }
      });
    }
  }

  /**
   * Exports current grouped data to browser-native CSV format (UTF-8 BOM, ';' separator)
   */
  function exportToCSV() {
    const filteredRows = getFilteredRows();
    const groupedData = getGroupedData(filteredRows);

    if (groupedData.length === 0) {
      toast('Não há dados para exportar com os filtros selecionados.', 'warning');
      return;
    }

    const separator = ';';
    let headers = [];
    let csvRows = [];

    if (currentGrouping === 'item') {
      headers = ['Material', 'SKU', 'Categoria', 'Quantidade Total Saída', 'Valor Total (R$)'];
      csvRows = groupedData.map(g => [
        `"${(g.meta.name || '').replace(/"/g, '""')}"`,
        `"${(g.meta.sku || '').replace(/"/g, '""')}"`,
        `"${formatCategoryLabel(g.meta.category)}"`,
        g.totalQuantity,
        g.totalValue.toFixed(2).replace('.', ',')
      ]);
    } else if (currentGrouping === 'solicitante') {
      headers = ['Solicitante', 'Setor', 'Registros de Saída', 'Quantidade Total', 'Valor Total (R$)'];
      csvRows = groupedData.map(g => [
        `"${(g.meta.name || '').replace(/"/g, '""')}"`,
        `"${(g.meta.cost_center || '').replace(/"/g, '""')}"`,
        g.recordsCount,
        g.totalQuantity,
        g.totalValue.toFixed(2).replace('.', ',')
      ]);
    } else if (currentGrouping === 'centro_custo') {
      headers = ['Setor', 'Registros de Saída', 'Quantidade Total', 'Valor Total Consumido (R$)'];
      csvRows = groupedData.map(g => [
        `"${(g.meta.cost_center || '').replace(/"/g, '""')}"`,
        g.recordsCount,
        g.totalQuantity,
        g.totalValue.toFixed(2).replace('.', ',')
      ]);
    }

    const csvContent = '\uFEFF' + [
      headers.join(separator),
      ...csvRows.map(row => row.join(separator))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const todayStr = new Date().toISOString().substring(0, 10);
    const filename = `relatorio_consumo_${currentGrouping}_${todayStr}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    toast('Relatório exportado em CSV com sucesso!', 'success');
  }
}
