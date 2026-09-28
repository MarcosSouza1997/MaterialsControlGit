import { esc, toast, emptyState, openModal, formatDate, formatMoney, statusBadge, paginate } from '../ui.js';

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
          <div>
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
    </div>
  `;

  // Attach Header & Filter Listeners
  const btnNewItem = container.querySelector('#btn-new-item');
  if (btnNewItem) {
    btnNewItem.addEventListener('click', () => openItemModal());
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
  await loadStockData();

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
