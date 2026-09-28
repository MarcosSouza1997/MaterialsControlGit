import { esc, toast, emptyState, openModal, formatDate, formatDateTime, formatMoney, statusBadge, paginate } from '../ui.js';

/**
 * Returns Material Symbol icon for category
 * @param {string} category
 * @returns {string}
 */
function getCategoryIcon(category) {
  const cat = (category || '').toUpperCase();
  switch (cat) {
    case 'PAPELARIA': return 'description';
    case 'INFORMATICA': return 'devices';
    case 'LIMPEZA': return 'cleaning_services';
    case 'IMPRESSAO': return 'print';
    case 'OUTROS':
    default: return 'inventory_2';
  }
}

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
 * Renders Controle de Estoque view (T-008)
 * @param {HTMLElement} container
 * @param {Object} ctx
 * @param {Object} ctx.supabase
 * @param {Object} [ctx.profile]
 */
export async function render(container, ctx) {
  const userRole = ctx.profile?.role;
  const isManager = userRole === 'almoxarife' || userRole === 'gestor_ti';

  let allItems = [];
  let currentSearch = '';
  let currentCategory = '';
  let currentStatus = '';
  let currentPage = 1;

  container.innerHTML = `
    <div class="estoque-page flex flex-col gap-lg">
      <!-- Header Bar -->
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-md card">
        <div>
          <h1 class="text-title">Controle de Estoque</h1>
          <p class="text-body-sm text-muted mt-2xs">Visão geral do inventário, controle de saldos e cadastro de itens.</p>
        </div>
        ${isManager ? `
          <div class="flex flex-wrap items-center gap-sm">
            <button type="button" id="btn-receive-stock" class="btn btn-secondary">
              <span class="material-symbols-outlined">add_circle</span>
              + Registrar entrada
            </button>
            <button type="button" id="btn-adjust-stock" class="btn btn-secondary">
              <span class="material-symbols-outlined">tune</span>
              Ajuste de inventário
            </button>
            <button type="button" id="btn-new-item" class="btn btn-primary">
              <span class="material-symbols-outlined">add_box</span>
              + Novo item
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Metrics Cards -->
      <div class="estoque-metrics-grid" id="estoque-metrics">
        <div class="card card-metric">
          <span class="metric-label text-overline text-muted">Total de SKUs Ativos</span>
          <span class="metric-value" id="metric-total-skus">-</span>
          <span class="text-body-sm text-muted">Itens catalogados</span>
        </div>

        <div class="card card-metric">
          <span class="metric-label text-overline text-muted">Valor do Estoque</span>
          <span class="metric-value text-primary" id="metric-total-value">-</span>
          <span class="text-body-sm text-muted">Patrimônio em saldo físico</span>
        </div>

        <div class="card card-metric">
          <span class="metric-label text-overline text-muted">Abaixo do Ponto de Reposição</span>
          <span class="metric-value text-danger" id="metric-reorder-count">-</span>
          <span class="text-body-sm text-muted">Necessitam reposição</span>
        </div>

        <div class="card card-metric">
          <span class="metric-label text-overline text-muted">Lotes em Risco</span>
          <span class="metric-value text-danger" id="metric-at-risk">-</span>
          <span class="text-body-sm text-muted">Vencidos, a vencer ou parados</span>
        </div>
      </div>

      <!-- Filters & Search Bar -->
      <div class="card flex flex-col gap-md">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-md">
          <!-- Search Input -->
          <div class="catalog-search-wrapper flex-1">
            <span class="material-symbols-outlined catalog-search-icon">search</span>
            <input
              type="search"
              id="estoque-search"
              class="form-input catalog-search-input"
              placeholder="Buscar por nome ou SKU..."
              aria-label="Buscar por nome ou SKU"
            />
          </div>

          <!-- Select Filters & Actions -->
          <div class="flex flex-wrap items-center gap-sm">
            <div class="flex items-center gap-xs">
              <select id="estoque-filter-category" class="form-select" aria-label="Filtrar por Categoria">
                <option value="">Todas Categorias</option>
                <option value="PAPELARIA">Papelaria</option>
                <option value="INFORMATICA">Informática</option>
                <option value="LIMPEZA">Limpeza</option>
                <option value="IMPRESSAO">Impressão</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>

            <div class="flex items-center gap-xs">
              <select id="estoque-filter-status" class="form-select" aria-label="Filtrar por Status">
                <option value="">Todos Status</option>
                <option value="NORMAL">Normal</option>
                <option value="ABAIXO_MINIMO">Abaixo do Mínimo</option>
                <option value="SEM_ESTOQUE">Sem Estoque</option>
              </select>
            </div>

            <button type="button" id="btn-clear-filters" class="btn btn-secondary btn-sm" title="Limpar Filtros">
              <span class="material-symbols-outlined">filter_alt_off</span>
              Limpar
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-body-sm text-muted">
          <span id="estoque-counter">Carregando itens...</span>
        </div>
      </div>

      <!-- Main Table Container -->
      <div id="estoque-table-container" class="table-container">
        <div class="p-2xl text-center text-muted text-body">
          Carregando controle de estoque...
        </div>
      </div>

      <!-- Pagination Container -->
      <div id="estoque-pagination" class="flex items-center justify-between mt-sm"></div>

      <!-- Recent Movements Section (T-009) -->
      <div class="card flex flex-col gap-md mt-lg">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
          <div>
            <h2 class="text-title-sm flex items-center gap-xs">
              <span class="material-symbols-outlined text-primary">history_edu</span>
              Histórico de Movimentações Recentes
            </h2>
            <p class="text-body-sm text-muted mt-2xs">Últimas 20 movimentações de entrada, saída, ajuste e descarte no estoque.</p>
          </div>
        </div>

        <div id="movements-table-container" class="table-container">
          <div class="p-lg text-center text-muted">Carregando histórico...</div>
        </div>
      </div>
    </div>
  `;

  // Attach Header & Filter Listeners
  const btnNewItem = container.querySelector('#btn-new-item');
  if (btnNewItem) {
    btnNewItem.addEventListener('click', () => openItemModal());
  }

  const btnReceiveStock = container.querySelector('#btn-receive-stock');
  if (btnReceiveStock) {
    btnReceiveStock.addEventListener('click', () => openReceiveStockModal());
  }

  const btnAdjustStock = container.querySelector('#btn-adjust-stock');
  if (btnAdjustStock) {
    btnAdjustStock.addEventListener('click', () => openAdjustStockModal());
  }

  const searchInput = container.querySelector('#estoque-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const catSelect = container.querySelector('#estoque-filter-category');
  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      currentCategory = e.target.value;
      currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const statusSelect = container.querySelector('#estoque-filter-status');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      currentStatus = e.target.value;
      currentPage = 1;
      applyFiltersAndRender();
    });
  }

  const btnClear = container.querySelector('#btn-clear-filters');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      currentSearch = '';
      currentCategory = '';
      currentStatus = '';
      currentPage = 1;
      if (searchInput) searchInput.value = '';
      if (catSelect) catSelect.value = '';
      if (statusSelect) statusSelect.value = '';
      applyFiltersAndRender();
    });
  }

  // Initial Data Fetch
  await Promise.all([loadStockData(), loadMovementsData()]);

  /**
   * Fetches data from vw_stock_overview for active items
   */
  async function loadStockData() {
    try {
      const { data, error } = await ctx.supabase
        .from('vw_stock_overview')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) {
        if (error.code === '42501') {
          toast('Você não tem permissão para esta ação.', 'error');
        } else {
          toast(error.message || 'Erro ao carregar dados do estoque.', 'error');
        }
        renderErrorState('Não foi possível carregar o controle de estoque.');
        return;
      }

      allItems = data || [];
      renderMetrics();
      applyFiltersAndRender();
    } catch (err) {
      console.error('Erro ao consultar vw_stock_overview:', err);
      toast('Erro de conexão ao carregar estoque.', 'error');
      renderErrorState('Erro de conexão ao carregar estoque.');
    }
  }

  /**
   * Renders metrics cards
   */
  function renderMetrics() {
    const elSkus = container.querySelector('#metric-total-skus');
    const elVal = container.querySelector('#metric-total-value');
    const elReorder = container.querySelector('#metric-reorder-count');
    const elAtRisk = container.querySelector('#metric-at-risk');

    const totalSkus = allItems.length;

    let totalVal = 0;
    let reorderCount = 0;
    let atRiskCount = 0;

    allItems.forEach(item => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      totalVal += qty * price;

      if (item.stock_status === 'ABAIXO_MINIMO' || item.stock_status === 'SEM_ESTOQUE') {
        reorderCount++;
      }

      atRiskCount += Number(item.at_risk_batches) || 0;
    });

    if (elSkus) elSkus.textContent = String(totalSkus);
    if (elVal) elVal.textContent = formatMoney(totalVal);
    if (elReorder) elReorder.textContent = String(reorderCount);
    if (elAtRisk) elAtRisk.textContent = String(atRiskCount);
  }

  /**
   * Renders error state
   */
  function renderErrorState(msg) {
    const tableContainer = container.querySelector('#estoque-table-container');
    const counterEl = container.querySelector('#estoque-counter');
    const paginationEl = container.querySelector('#estoque-pagination');

    if (tableContainer) tableContainer.innerHTML = emptyState(msg);
    if (counterEl) counterEl.textContent = '0 itens encontrados';
    if (paginationEl) paginationEl.innerHTML = '';
  }

  /**
   * Filters allItems by search, category, and status, and renders the paginated table
   */
  function applyFiltersAndRender() {
    const q = currentSearch.trim().toLowerCase();

    const filtered = allItems.filter(item => {
      // Category filter
      if (currentCategory && (item.category || '').toUpperCase() !== currentCategory) {
        return false;
      }

      // Status filter
      if (currentStatus && (item.stock_status || '').toUpperCase() !== currentStatus) {
        return false;
      }

      // Search filter
      if (q) {
        const nameMatch = (item.name || '').toLowerCase().includes(q);
        const skuMatch = (item.sku || '').toLowerCase().includes(q);
        if (!nameMatch && !skuMatch) return false;
      }

      return true;
    });

    const counterEl = container.querySelector('#estoque-counter');
    if (counterEl) {
      counterEl.textContent = `Exibindo ${filtered.length} de ${allItems.length} itens registrados`;
    }

    const paginated = paginate(filtered, currentPage, 25);
    renderTable(paginated.data);
    renderPaginationControls(paginated);
  }

  /**
   * Renders stock table
   * @param {Array} items
   */
  function renderTable(items) {
    const tableContainer = container.querySelector('#estoque-table-container');
    if (!tableContainer) return;

    if (items.length === 0) {
      tableContainer.innerHTML = emptyState('Nenhum item encontrado com os filtros selecionados.');
      return;
    }

    tableContainer.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Localização</th>
            <th class="text-center">Quantidade</th>
            <th class="text-center">Ponto Mínimo</th>
            <th>Próx. Validade</th>
            <th>Status</th>
            ${isManager ? '<th class="text-right">Ações</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const qty = Number(item.quantity) || 0;
            const availQty = Number(item.available_quantity) || 0;
            const expiredQty = Math.max(0, qty - availQty);
            const isNormal = item.stock_status === 'NORMAL';
            const isZero = qty === 0;

            const iconName = getCategoryIcon(item.category);
            const categoryLabel = formatCategoryLabel(item.category);

            let qtyDisplay = '';
            if (isZero) {
              qtyDisplay = `<span class="text-danger font-semibold tabular-nums">0 ${esc(item.unit || 'un')}</span>`;
            } else {
              const colorClass = isNormal ? 'text-body font-semibold tabular-nums' : 'text-danger font-semibold tabular-nums';
              qtyDisplay = `<span class="${colorClass}">${qty} ${esc(item.unit || 'un')}</span>`;
            }

            if (expiredQty > 0) {
              qtyDisplay += ` <span class="text-danger text-body-sm font-normal">(${expiredQty} vencidas)</span>`;
            }

            return `
              <tr>
                <td class="code-text font-semibold text-primary">
                  ${esc(item.sku)}
                </td>
                <td>
                  <div class="flex items-center gap-sm">
                    <span class="material-symbols-outlined text-muted" style="font-size: 20px;">
                      ${esc(iconName)}
                    </span>
                    <div class="flex flex-col">
                      <span class="font-semibold text-body">${esc(item.name)}</span>
                      ${item.description ? `<span class="text-body-sm text-muted">${esc(item.description)}</span>` : ''}
                    </div>
                  </div>
                </td>
                <td>
                  <span class="text-body-sm">${esc(categoryLabel)}</span>
                </td>
                <td>
                  <span class="text-body-sm text-muted">${esc(item.location || '-')}</span>
                </td>
                <td class="text-center">
                  ${qtyDisplay}
                </td>
                <td class="text-center code-text text-muted">
                  ${item.reorder_point || 0} ${esc(item.unit || 'un')}
                </td>
                <td class="text-body-sm text-muted">
                  ${formatDate(item.next_expiry)}
                </td>
                <td>
                  ${statusBadge(item.stock_status)}
                </td>
                ${isManager ? `
                  <td class="text-right">
                    <div class="flex items-center justify-end gap-xs">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm btn-item-batches"
                        data-id="${esc(item.id)}"
                        title="Ver Lotes / Descarte"
                      >
                        <span class="material-symbols-outlined">inventory_2</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm btn-edit-item"
                        data-id="${esc(item.id)}"
                        title="Editar item"
                      >
                        <span class="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-danger btn-sm btn-deactivate-item"
                        data-id="${esc(item.id)}"
                        title="Desativar item"
                      >
                        <span class="material-symbols-outlined">block</span>
                      </button>
                    </div>
                  </td>
                ` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Bind action buttons if manager
    if (isManager) {
      tableContainer.querySelectorAll('.btn-item-batches').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const item = allItems.find(i => i.id === id);
          if (item) openItemBatchesModal(item);
        });
      });

      tableContainer.querySelectorAll('.btn-edit-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const item = allItems.find(i => i.id === id);
          if (item) openItemModal(item);
        });
      });

      tableContainer.querySelectorAll('.btn-deactivate-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const item = allItems.find(i => i.id === id);
          if (item) confirmDeactivateItem(item);
        });
      });
    }
  }

  /**
   * Renders pagination controls
   * @param {Object} paginated
   */
  function renderPaginationControls(paginated) {
    const paginationEl = container.querySelector('#estoque-pagination');
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
   * Opens Modal to create or edit an item
   * @param {Object} [existingItem]
   */
  function openItemModal(existingItem = null) {
    const isEdit = !!existingItem;
    const title = isEdit ? 'Editar Item de Estoque' : 'Novo Item de Estoque';

    const formEl = document.createElement('form');
    formEl.className = 'flex flex-col gap-sm';
    formEl.innerHTML = `
      <div class="form-group mb-xs">
        <label class="form-label" for="item-name">Nome do Produto *</label>
        <input
          type="text"
          id="item-name"
          class="form-input"
          value="${esc(existingItem?.name || '')}"
          placeholder="Ex: Resma de Papel A4"
          required
          minlength="2"
          maxlength="120"
        />
      </div>

      <div class="form-group mb-xs">
        <label class="form-label" for="item-sku">Código SKU *</label>
        <input
          type="text"
          id="item-sku"
          class="form-input code-text"
          value="${esc(existingItem?.sku || '')}"
          placeholder="Ex: PAP-A4-75G"
          required
          minlength="2"
          maxlength="40"
        />
      </div>

      <div class="form-group mb-xs">
        <label class="form-label" for="item-description">Descrição</label>
        <textarea
          id="item-description"
          class="form-textarea"
          rows="2"
          placeholder="Especificações técnicas ou detalhes do material..."
        >${esc(existingItem?.description || '')}</textarea>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        <div class="form-group mb-xs">
          <label class="form-label" for="item-category">Categoria *</label>
          <select id="item-category" class="form-select" required>
            <option value="PAPELARIA" ${existingItem?.category === 'PAPELARIA' ? 'selected' : ''}>Papelaria</option>
            <option value="INFORMATICA" ${existingItem?.category === 'INFORMATICA' ? 'selected' : ''}>Informática</option>
            <option value="LIMPEZA" ${existingItem?.category === 'LIMPEZA' ? 'selected' : ''}>Limpeza</option>
            <option value="IMPRESSAO" ${existingItem?.category === 'IMPRESSAO' ? 'selected' : ''}>Impressão</option>
            <option value="OUTROS" ${!existingItem?.category || existingItem?.category === 'OUTROS' ? 'selected' : ''}>Outros</option>
          </select>
        </div>

        <div class="form-group mb-xs">
          <label class="form-label" for="item-unit">Unidade de Medida *</label>
          <select id="item-unit" class="form-select" required>
            <option value="un" ${!existingItem?.unit || existingItem?.unit === 'un' ? 'selected' : ''}>Unidade (un)</option>
            <option value="cx" ${existingItem?.unit === 'cx' ? 'selected' : ''}>Caixa (cx)</option>
            <option value="pct" ${existingItem?.unit === 'pct' ? 'selected' : ''}>Pacote (pct)</option>
            <option value="rl" ${existingItem?.unit === 'rl' ? 'selected' : ''}>Rolo (rl)</option>
            <option value="lt" ${existingItem?.unit === 'lt' ? 'selected' : ''}>Litro (lt)</option>
            <option value="kg" ${existingItem?.unit === 'kg' ? 'selected' : ''}>Quilo (kg)</option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        <div class="form-group mb-xs">
          <label class="form-label" for="item-type">Tipo do Item *</label>
          <select id="item-type" class="form-select" required>
            <option value="consumivel" ${!existingItem?.type || existingItem?.type === 'consumivel' ? 'selected' : ''}>Consumível</option>
            <option value="permanente" ${existingItem?.type === 'permanente' ? 'selected' : ''}>Permanente</option>
          </select>
        </div>

        <div class="form-group mb-xs">
          <label class="form-label" for="item-unit-price">
            Preço Unitário (R$) <span id="price-required-indicator" class="text-danger">${existingItem?.type === 'permanente' ? '*' : ''}</span>
          </label>
          <input
            type="number"
            id="item-unit-price"
            class="form-input"
            step="0.01"
            min="0"
            value="${existingItem?.unit_price !== null && existingItem?.unit_price !== undefined ? existingItem.unit_price : ''}"
            placeholder="0.00"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        <div class="form-group mb-xs">
          <label class="form-label" for="item-location">Localização</label>
          <input
            type="text"
            id="item-location"
            class="form-input"
            value="${esc(existingItem?.location || '')}"
            placeholder="Ex: Prateleira B-02"
          />
        </div>

        <div class="form-group mb-xs">
          <label class="form-label" for="item-reorder-point">Ponto de Reposição *</label>
          <input
            type="number"
            id="item-reorder-point"
            class="form-input"
            min="0"
            value="${existingItem?.reorder_point ?? 0}"
            required
          />
        </div>
      </div>

      <div class="form-group mb-xs">
        <label class="form-label" for="item-image-url">URL da Imagem</label>
        <input
          type="url"
          id="item-image-url"
          class="form-input"
          value="${esc(existingItem?.image_url || '')}"
          placeholder="https://exemplo.com/imagem.jpg"
        />
      </div>

      <div class="flex items-center gap-xs mt-xs">
        <input
          type="checkbox"
          id="item-requires-expiry"
          style="width: 18px; height: 18px; cursor: pointer;"
          ${existingItem?.requires_expiry ? 'checked' : ''}
        />
        <label for="item-requires-expiry" class="form-label" style="cursor: pointer; margin-bottom: 0;">
          Exige controle de validade nos lotes
        </label>
      </div>
    `;

    // Dynamic price indicator update on item type change
    const typeSelect = formEl.querySelector('#item-type');
    const priceIndicator = formEl.querySelector('#price-required-indicator');
    if (typeSelect && priceIndicator) {
      typeSelect.addEventListener('change', (e) => {
        priceIndicator.textContent = e.target.value === 'permanente' ? '*' : '';
      });
    }

    openModal({
      title,
      body: formEl,
      actions: [
        {
          text: 'Cancelar',
          class: 'btn btn-secondary',
          onClick: (closeModal) => closeModal()
        },
        {
          text: isEdit ? 'Salvar alterações' : 'Cadastrar item',
          class: 'btn btn-primary',
          onClick: async (closeModal) => {
            const name = (formEl.querySelector('#item-name')?.value || '').trim();
            const sku = (formEl.querySelector('#item-sku')?.value || '').trim();
            const description = (formEl.querySelector('#item-description')?.value || '').trim() || null;
            const category = formEl.querySelector('#item-category')?.value;
            const unit = formEl.querySelector('#item-unit')?.value;
            const type = formEl.querySelector('#item-type')?.value;
            const rawPrice = formEl.querySelector('#item-unit-price')?.value;
            const location = (formEl.querySelector('#item-location')?.value || '').trim() || null;
            const reorderPointVal = parseInt(formEl.querySelector('#item-reorder-point')?.value, 10);
            const requiresExpiry = formEl.querySelector('#item-requires-expiry')?.checked || false;
            const imageUrl = (formEl.querySelector('#item-image-url')?.value || '').trim() || null;

            if (name.length < 2 || name.length > 120) {
              toast('O nome do produto deve ter entre 2 e 120 caracteres.', 'warning');
              return;
            }

            if (sku.length < 2 || sku.length > 40) {
              toast('O SKU deve ter entre 2 e 40 caracteres.', 'warning');
              return;
            }

            let unitPrice = null;
            if (rawPrice !== '' && rawPrice !== null && rawPrice !== undefined) {
              unitPrice = parseFloat(rawPrice);
              if (isNaN(unitPrice) || unitPrice < 0) {
                toast('Informe um preço unitário válido.', 'warning');
                return;
              }
            }

            if (type === 'permanente' && (unitPrice === null || isNaN(unitPrice))) {
              toast('Preço unitário é obrigatório para itens permanentes.', 'warning');
              return;
            }

            if (isNaN(reorderPointVal) || reorderPointVal < 0) {
              toast('Informe um ponto de reposição válido (mínimo 0).', 'warning');
              return;
            }

            const itemData = {
              name,
              sku,
              description,
              category,
              unit,
              type,
              location,
              reorder_point: reorderPointVal,
              requires_expiry: requiresExpiry,
              unit_price: unitPrice,
              image_url: imageUrl
            };

            try {
              if (isEdit) {
                const { error } = await ctx.supabase
                  .from('items')
                  .update(itemData)
                  .eq('id', existingItem.id);

                if (error) {
                  if (error.code === '23505') {
                    toast('Nome ou SKU já cadastrado.', 'error');
                  } else if (error.code === '42501') {
                    toast('Você não tem permissão para esta ação.', 'error');
                  } else {
                    toast(error.message || 'Erro ao atualizar item.', 'error');
                  }
                  return;
                }

                toast('Item atualizado com sucesso!', 'success');
              } else {
                const { error } = await ctx.supabase
                  .from('items')
                  .insert({
                    ...itemData,
                    active: true
                  });

                if (error) {
                  if (error.code === '23505') {
                    toast('Nome ou SKU já cadastrado.', 'error');
                  } else if (error.code === '42501') {
                    toast('Você não tem permissão para esta ação.', 'error');
                  } else {
                    toast(error.message || 'Erro ao cadastrar item.', 'error');
                  }
                  return;
                }

                toast('Item cadastrado com sucesso!', 'success');
              }

              closeModal();
              await loadStockData();
            } catch (err) {
              console.error('Erro ao salvar item:', err);
              toast('Erro de conexão ao salvar item.', 'error');
            }
          }
        }
      ]
    });
  }

  /**
   * Fetches and renders top 20 recent stock movements
   */
  async function loadMovementsData() {
    const tableContainer = container.querySelector('#movements-table-container');
    if (!tableContainer) return;

    try {
      const { data, error } = await ctx.supabase
        .from('vw_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        if (error.code === '42501') {
          tableContainer.innerHTML = emptyState('Você não tem permissão para visualizar o histórico de movimentações.');
        } else {
          tableContainer.innerHTML = emptyState('Erro ao carregar histórico de movimentações.');
        }
        return;
      }

      renderMovementsTable(data || []);
    } catch (err) {
      console.error('Erro ao carregar movimentações:', err);
      if (tableContainer) {
        tableContainer.innerHTML = emptyState('Erro de conexão ao carregar histórico de movimentações.');
      }
    }
  }

  /**
   * Renders recent movements table
   * @param {Array} movements
   */
  function renderMovementsTable(movements) {
    const tableContainer = container.querySelector('#movements-table-container');
    if (!tableContainer) return;

    if (movements.length === 0) {
      tableContainer.innerHTML = emptyState('Nenhuma movimentação registrada até o momento.');
      return;
    }

    tableContainer.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Data / Hora</th>
            <th>Tipo</th>
            <th>Item / SKU</th>
            <th>Lote</th>
            <th class="text-center">Quantidade</th>
            <th>Observação</th>
            <th>Responsável</th>
          </tr>
        </thead>
        <tbody>
          ${movements.map(mov => {
            const rawType = (mov.type || '').toUpperCase();
            let typeBadge = '';
            let qtyStr = '';

            const qtyVal = Number(mov.quantity) || 0;

            switch (rawType) {
              case 'ENTRADA':
                typeBadge = `
                  <span class="inline-flex items-center gap-2xs font-semibold text-primary">
                    <span class="material-symbols-outlined" style="font-size: 16px;">add_circle</span>
                    Entrada
                  </span>
                `;
                qtyStr = `<span class="text-primary font-semibold tabular-nums">+${qtyVal}</span>`;
                break;
              case 'SAIDA':
                typeBadge = `
                  <span class="inline-flex items-center gap-2xs font-semibold text-body">
                    <span class="material-symbols-outlined" style="font-size: 16px;">remove_circle_outline</span>
                    Saída
                  </span>
                `;
                qtyStr = `<span class="text-body font-semibold tabular-nums">-${Math.abs(qtyVal)}</span>`;
                break;
              case 'AJUSTE':
                typeBadge = `
                  <span class="inline-flex items-center gap-2xs font-semibold text-warning">
                    <span class="material-symbols-outlined" style="font-size: 16px;">tune</span>
                    Ajuste
                  </span>
                `;
                const sign = qtyVal > 0 ? '+' : '';
                const colorClass = qtyVal > 0 ? 'text-primary' : 'text-danger';
                qtyStr = `<span class="${colorClass} font-semibold tabular-nums">${sign}${qtyVal}</span>`;
                break;
              case 'DESCARTE':
                typeBadge = `
                  <span class="inline-flex items-center gap-2xs font-semibold text-danger">
                    <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
                    Descarte
                  </span>
                `;
                qtyStr = `<span class="text-danger font-semibold tabular-nums">-${Math.abs(qtyVal)}</span>`;
                break;
              default:
                typeBadge = `<span class="text-muted">${esc(mov.type)}</span>`;
                qtyStr = `<span class="tabular-nums">${qtyVal}</span>`;
            }

            const performer = mov.performer_name ? esc(mov.performer_name) : 'Sistema';

            return `
              <tr>
                <td class="code-text text-body-sm text-muted">
                  ${formatDateTime(mov.created_at)}
                </td>
                <td>
                  ${typeBadge}
                </td>
                <td>
                  <div class="flex flex-col">
                    <span class="font-semibold text-body">${esc(mov.item_name || 'Item')}</span>
                    <span class="code-text text-body-sm text-muted">${esc(mov.sku || '-')}</span>
                  </div>
                </td>
                <td>
                  <span class="code-text text-body-sm text-muted">${esc(mov.lot_number || '-')}</span>
                </td>
                <td class="text-center">
                  ${qtyStr}
                </td>
                <td class="text-body-sm text-muted">
                  ${esc(mov.note || '-')}
                </td>
                <td class="text-body-sm">
                  ${performer}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Opens Modal to register stock arrival (+ Registrar entrada)
   */
  function openReceiveStockModal() {
    if (allItems.length === 0) {
      toast('Nenhum item cadastrado no estoque.', 'warning');
      return;
    }

    const formEl = document.createElement('form');
    formEl.className = 'flex flex-col gap-sm';

    const itemOptionsHtml = allItems.map(i => `
      <option value="${esc(i.id)}" data-requires-expiry="${i.requires_expiry ? 'true' : 'false'}">
        ${esc(i.name)} (${esc(i.sku)}) ${i.requires_expiry ? '[Exige Validade]' : ''}
      </option>
    `).join('');

    formEl.innerHTML = `
      <div class="form-group mb-xs">
        <label class="form-label" for="receive-item-id">Item *</label>
        <select id="receive-item-id" class="form-select" required>
          ${itemOptionsHtml}
        </select>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        <div class="form-group mb-xs">
          <label class="form-label" for="receive-quantity">Quantidade Recebida *</label>
          <input
            type="number"
            id="receive-quantity"
            class="form-input"
            min="1"
            step="1"
            placeholder="Ex: 10"
            required
          />
        </div>

        <div class="form-group mb-xs">
          <label class="form-label" for="receive-lot">Número do Lote</label>
          <input
            type="text"
            id="receive-lot"
            class="form-input code-text"
            placeholder="Ex: LOT-2024-001"
          />
        </div>
      </div>

      <div class="form-group mb-xs">
        <label class="form-label" for="receive-expires-on">
          Data de Validade <span id="expiry-required-indicator" class="text-danger"></span>
        </label>
        <input
          type="date"
          id="receive-expires-on"
          class="form-input"
        />
        <span id="expiry-help-text" class="text-body-sm text-muted mt-2xs block"></span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
        <div class="form-group mb-xs">
          <label class="form-label" for="receive-supplier">Fornecedor</label>
          <input
            type="text"
            id="receive-supplier"
            class="form-input"
            placeholder="Ex: Kalunga Comércio S.A."
          />
        </div>

        <div class="form-group mb-xs">
          <label class="form-label" for="receive-invoice">Número da Nota Fiscal</label>
          <input
            type="text"
            id="receive-invoice"
            class="form-input code-text"
            placeholder="Ex: NF-e 048.291"
          />
        </div>
      </div>
    `;

    const selectItem = formEl.querySelector('#receive-item-id');
    const expiryIndicator = formEl.querySelector('#expiry-required-indicator');
    const expiryHelp = formEl.querySelector('#expiry-help-text');
    const expiryInput = formEl.querySelector('#receive-expires-on');

    const updateExpiryValidationUI = () => {
      const selectedOption = selectItem.options[selectItem.selectedIndex];
      const requiresExpiry = selectedOption?.getAttribute('data-requires-expiry') === 'true';

      if (requiresExpiry) {
        expiryIndicator.textContent = '*';
        expiryHelp.textContent = 'Este item exige controle de validade obrigatório.';
        expiryInput.setAttribute('required', 'required');
      } else {
        expiryIndicator.textContent = '';
        expiryHelp.textContent = 'Opcional para este item.';
        expiryInput.removeAttribute('required');
      }
    };

    selectItem.addEventListener('change', updateExpiryValidationUI);
    updateExpiryValidationUI();

    openModal({
      title: 'Registrar Entrada de Estoque',
      body: formEl,
      actions: [
        {
          text: 'Cancelar',
          class: 'btn btn-secondary',
          onClick: (closeModal) => closeModal()
        },
        {
          text: 'Registrar Entrada',
          class: 'btn btn-primary',
          onClick: async (closeModal) => {
            const itemId = selectItem.value;
            const selectedItem = allItems.find(i => i.id === itemId);
            const qtyVal = parseInt(formEl.querySelector('#receive-quantity')?.value, 10);
            const lotVal = (formEl.querySelector('#receive-lot')?.value || '').trim() || null;
            const expiresOnVal = formEl.querySelector('#receive-expires-on')?.value || null;
            const supplierVal = (formEl.querySelector('#receive-supplier')?.value || '').trim() || null;
            const invoiceVal = (formEl.querySelector('#receive-invoice')?.value || '').trim() || null;

            if (!itemId) {
              toast('Selecione um item.', 'warning');
              return;
            }

            if (isNaN(qtyVal) || qtyVal <= 0) {
              toast('A quantidade deve ser um número inteiro maior que zero.', 'warning');
              return;
            }

            if (selectedItem?.requires_expiry && !expiresOnVal) {
              toast('Data de validade é obrigatória para este item.', 'warning');
              return;
            }

            try {
              const { error } = await ctx.supabase.rpc('receive_stock', {
                p_item_id: itemId,
                p_quantity: qtyVal,
                p_lot: lotVal,
                p_expires_on: expiresOnVal,
                p_supplier: supplierVal,
                p_invoice: invoiceVal
              });

              if (error) {
                if (error.code === '42501') {
                  toast('Você não tem permissão para esta ação.', 'error');
                } else {
                  toast(error.message || 'Erro ao registrar entrada de estoque.', 'error');
                }
                return;
              }

              toast('Entrada de estoque registrada com sucesso!', 'success');
              closeModal();
              await Promise.all([loadStockData(), loadMovementsData()]);
            } catch (err) {
              console.error('Erro ao chamar receive_stock:', err);
              toast('Erro de conexão ao registrar entrada.', 'error');
            }
          }
        }
      ]
    });
  }

  /**
   * Opens Modal to adjust stock (Ajuste de inventário)
   */
  function openAdjustStockModal() {
    if (allItems.length === 0) {
      toast('Nenhum item cadastrado no estoque.', 'warning');
      return;
    }

    const formEl = document.createElement('form');
    formEl.className = 'flex flex-col gap-sm';

    const itemOptionsHtml = allItems.map(i => `
      <option value="${esc(i.id)}" data-requires-expiry="${i.requires_expiry ? 'true' : 'false'}">
        ${esc(i.name)} (${esc(i.sku)}) - Saldo Atual: ${i.quantity || 0}
      </option>
    `).join('');

    formEl.innerHTML = `
      <div class="form-group mb-xs">
        <label class="form-label" for="adjust-item-id">Item *</label>
        <select id="adjust-item-id" class="form-select" required>
          ${itemOptionsHtml}
        </select>
      </div>

      <div class="form-group mb-xs">
        <label class="form-label" for="adjust-quantity">Ajuste de Quantidade (+ ou -) *</label>
        <input
          type="number"
          id="adjust-quantity"
          class="form-input"
          step="1"
          placeholder="Ex: -2 ou +5"
          required
        />
        <span class="text-body-sm text-muted mt-2xs block">
          Insira valor positivo para adicionar ou negativo para retirar.
        </span>
      </div>

      <div id="adjust-expiry-warning" class="card bg-warning-light text-warning-dark text-body-sm p-sm hidden">
        <span class="font-semibold">Atenção:</span> Este item exige controle de validade. Entradas com validade devem ser feitas através do botão <strong>"Registrar entrada"</strong>. O ajuste positivo não é permitido para este item.
      </div>

      <div class="form-group mb-xs">
        <label class="form-label" for="adjust-note">Motivo / Justificativa *</label>
        <textarea
          id="adjust-note"
          class="form-textarea"
          rows="3"
          placeholder="Descreva o motivo do ajuste físico no inventário..."
          required
          minlength="3"
        ></textarea>
      </div>
    `;

    const selectItem = formEl.querySelector('#adjust-item-id');
    const warningEl = formEl.querySelector('#adjust-expiry-warning');
    const qtyInput = formEl.querySelector('#adjust-quantity');

    const updateWarningUI = () => {
      const selectedOption = selectItem.options[selectItem.selectedIndex];
      const requiresExpiry = selectedOption?.getAttribute('data-requires-expiry') === 'true';
      const val = parseInt(qtyInput.value, 10);

      if (requiresExpiry && !isNaN(val) && val > 0) {
        warningEl.classList.remove('hidden');
      } else if (requiresExpiry) {
        warningEl.classList.remove('hidden');
      } else {
        warningEl.classList.add('hidden');
      }
    };

    selectItem.addEventListener('change', updateWarningUI);
    qtyInput.addEventListener('input', updateWarningUI);
    updateWarningUI();

    openModal({
      title: 'Ajuste de Inventário Físico',
      body: formEl,
      actions: [
        {
          text: 'Cancelar',
          class: 'btn btn-secondary',
          onClick: (closeModal) => closeModal()
        },
        {
          text: 'Confirmar Ajuste',
          class: 'btn btn-primary',
          onClick: async (closeModal) => {
            const itemId = selectItem.value;
            const selectedItem = allItems.find(i => i.id === itemId);
            const qtyVal = parseInt(qtyInput.value, 10);
            const noteVal = (formEl.querySelector('#adjust-note')?.value || '').trim();

            if (!itemId) {
              toast('Selecione um item.', 'warning');
              return;
            }

            if (isNaN(qtyVal) || qtyVal === 0) {
              toast('Informe uma quantidade de ajuste válida (diferente de zero).', 'warning');
              return;
            }

            if (!noteVal || noteVal.length < 3) {
              toast('Informe um motivo/justificativa para o ajuste (mínimo 3 caracteres).', 'warning');
              return;
            }

            if (selectedItem?.requires_expiry && qtyVal > 0) {
              toast('Itens com controle de validade não aceitam ajuste positivo. Utilize "Registrar entrada".', 'warning');
              return;
            }

            try {
              const { error } = await ctx.supabase.rpc('adjust_stock', {
                p_item_id: itemId,
                p_quantity: qtyVal,
                p_note: noteVal
              });

              if (error) {
                if (error.code === '42501') {
                  toast('Você não tem permissão para esta ação.', 'error');
                } else {
                  toast(error.message || 'Erro ao realizar ajuste de estoque.', 'error');
                }
                return;
              }

              toast('Ajuste de estoque realizado com sucesso!', 'success');
              closeModal();
              await Promise.all([loadStockData(), loadMovementsData()]);
            } catch (err) {
              console.error('Erro ao chamar adjust_stock:', err);
              toast('Erro de conexão ao realizar ajuste.', 'error');
            }
          }
        }
      ]
    });
  }

  /**
   * Opens Modal displaying active batches for an item with option to discard
   * @param {Object} item
   */
  async function openItemBatchesModal(item) {
    const containerEl = document.createElement('div');
    containerEl.className = 'flex flex-col gap-md';
    containerEl.innerHTML = `
      <div class="text-body-sm text-muted">
        Item: <strong>${esc(item.name)}</strong> (${esc(item.sku)})
      </div>
      <div id="batches-list-wrapper">
        <div class="p-md text-center text-muted">Carregando lotes...</div>
      </div>
    `;

    const closeModal = openModal({
      title: 'Lotes do Item / Descarte',
      body: containerEl,
      actions: [
        {
          text: 'Fechar',
          class: 'btn btn-secondary',
          onClick: (closeFn) => closeFn()
        }
      ]
    });

    await loadAndRenderBatches();

    async function loadAndRenderBatches() {
      const listWrapper = containerEl.querySelector('#batches-list-wrapper');
      if (!listWrapper) return;

      try {
        const { data: batches, error } = await ctx.supabase
          .from('batches')
          .select('*')
          .eq('item_id', item.id)
          .gt('quantity_remaining', 0)
          .order('expires_on', { ascending: true, nullsFirst: false });

        if (error) {
          listWrapper.innerHTML = emptyState('Erro ao carregar lotes do item.');
          return;
        }

        if (!batches || batches.length === 0) {
          listWrapper.innerHTML = emptyState('Nenhum lote ativo com saldo disponível para este item.');
          return;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        listWrapper.innerHTML = `
          <table class="table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Recebido em</th>
                <th>Validade</th>
                <th class="text-center">Saldo Restante</th>
                <th class="text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${batches.map(b => {
                const isExpired = b.expires_on && b.expires_on < todayStr;
                const expiresDisplay = formatDate(b.expires_on);
                const expiresHtml = isExpired
                  ? `<span class="text-danger font-bold flex items-center gap-2xs"><span class="material-symbols-outlined text-body-sm">warning</span>${expiresDisplay} (Vencido)</span>`
                  : expiresDisplay;

                return `
                  <tr class="${isExpired ? 'bg-danger-light' : ''}">
                    <td class="code-text font-semibold">${esc(b.lot_number || 'Sem lote')}</td>
                    <td class="text-body-sm text-muted">${formatDate(b.received_at)}</td>
                    <td class="text-body-sm">${expiresHtml}</td>
                    <td class="text-center font-semibold tabular-nums">${b.quantity_remaining} ${esc(item.unit || 'un')}</td>
                    <td class="text-right">
                      <button
                        type="button"
                        class="btn btn-danger btn-sm btn-discard-batch"
                        data-batch-id="${esc(b.id)}"
                        data-batch-lot="${esc(b.lot_number || 'Sem lote')}"
                        data-batch-rem="${b.quantity_remaining}"
                      >
                        <span class="material-symbols-outlined">delete</span>
                        Descartar
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;

        listWrapper.querySelectorAll('.btn-discard-batch').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const batchId = e.currentTarget.getAttribute('data-batch-id');
            const batchLot = e.currentTarget.getAttribute('data-batch-lot');
            const batchRem = parseInt(e.currentTarget.getAttribute('data-batch-rem'), 10);

            const selectedBatch = batches.find(b => b.id === batchId) || {
              id: batchId,
              lot_number: batchLot,
              quantity_remaining: batchRem
            };

            openDiscardBatchModal(selectedBatch, item, async () => {
              await loadAndRenderBatches();
              await Promise.all([loadStockData(), loadMovementsData()]);
            });
          });
        });

      } catch (err) {
        console.error('Erro ao carregar lotes:', err);
        listWrapper.innerHTML = emptyState('Erro de conexão ao carregar lotes.');
      }
    }
  }

  /**
   * Opens Modal to discard quantity from a batch
   * @param {Object} batch
   * @param {Object} item
   * @param {Function} onSuccess
   */
  function openDiscardBatchModal(batch, item, onSuccess) {
    const formEl = document.createElement('form');
    formEl.className = 'flex flex-col gap-sm';

    formEl.innerHTML = `
      <div class="text-body-sm text-muted">
        Lote: <strong>${esc(batch.lot_number || 'Sem lote')}</strong> — Item: <strong>${esc(item.name)}</strong><br>
        Saldo restante no lote: <strong>${batch.quantity_remaining} ${esc(item.unit || 'un')}</strong>
      </div>

      <div class="form-group mb-xs">
        <label class="form-label" for="discard-quantity">Quantidade para Descarte *</label>
        <input
          type="number"
          id="discard-quantity"
          class="form-input"
          min="1"
          max="${batch.quantity_remaining}"
          step="1"
          value="${batch.quantity_remaining}"
          required
        />
      </div>

      <div class="form-group mb-xs">
        <label class="form-label" for="discard-reason">Motivo do Descarte *</label>
        <textarea
          id="discard-reason"
          class="form-textarea"
          rows="3"
          placeholder="Ex: Material vencido, danificado no manuseio ou impróprio para uso..."
          required
          minlength="3"
        ></textarea>
      </div>
    `;

    openModal({
      title: 'Descarte de Lote',
      body: formEl,
      actions: [
        {
          text: 'Cancelar',
          class: 'btn btn-secondary',
          onClick: (closeModal) => closeModal()
        },
        {
          text: 'Confirmar Descarte',
          class: 'btn btn-danger',
          onClick: async (closeModal) => {
            const qtyVal = parseInt(formEl.querySelector('#discard-quantity')?.value, 10);
            const reasonVal = (formEl.querySelector('#discard-reason')?.value || '').trim();

            if (isNaN(qtyVal) || qtyVal <= 0 || qtyVal > batch.quantity_remaining) {
              toast(`A quantidade deve ser entre 1 e ${batch.quantity_remaining}.`, 'warning');
              return;
            }

            if (!reasonVal || reasonVal.length < 3) {
              toast('Informe um motivo para o descarte (mínimo 3 caracteres).', 'warning');
              return;
            }

            try {
              const { error } = await ctx.supabase.rpc('discard_batch', {
                p_batch_id: batch.id,
                p_quantity: qtyVal,
                p_reason: reasonVal
              });

              if (error) {
                if (error.code === '42501') {
                  toast('Você não tem permissão para esta ação.', 'error');
                } else {
                  toast(error.message || 'Erro ao efetuar descarte de lote.', 'error');
                }
                return;
              }

              toast('Descarte de lote efetuado com sucesso!', 'success');
              closeModal();
              if (onSuccess) await onSuccess();
            } catch (err) {
              console.error('Erro ao chamar discard_batch:', err);
              toast('Erro de conexão ao efetuar descarte.', 'error');
            }
          }
        }
      ]
    });
  }

  /**
   * Confirms deactivation of an item
   * @param {Object} item
   */
  function confirmDeactivateItem(item) {
    const bodyHtml = `
      <div class="flex flex-col gap-sm">
        <p class="text-body">
          Deseja desativar o item <strong>"${esc(item.name)}"</strong> (${esc(item.sku)})?
        </p>
        <p class="text-body-sm text-muted">
          O item deixará de ser exibido no catálogo de requisições, mas seu histórico e saldo permanecerão preservados no banco de dados.
        </p>
      </div>
    `;

    openModal({
      title: 'Desativar Item',
      body: bodyHtml,
      actions: [
        {
          text: 'Cancelar',
          class: 'btn btn-secondary',
          onClick: (closeModal) => closeModal()
        },
        {
          text: 'Desativar',
          class: 'btn btn-danger',
          onClick: async (closeModal) => {
            try {
              const { error } = await ctx.supabase
                .from('items')
                .update({ active: false })
                .eq('id', item.id);

              if (error) {
                if (error.code === '42501') {
                  toast('Você não tem permissão para esta ação.', 'error');
                } else {
                  toast(error.message || 'Erro ao desativar item.', 'error');
                }
                return;
              }

              toast('Item desativado com sucesso!', 'success');
              closeModal();
              await loadStockData();
            } catch (err) {
              console.error('Erro ao desativar item:', err);
              toast('Erro de conexão ao desativar item.', 'error');
            }
          }
        }
      ]
    });
  }
}
