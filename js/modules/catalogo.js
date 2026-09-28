import { esc, toast, emptyState } from '../ui.js';
import { getItems, addItem, removeItem, setQuantity, clear, subscribe } from './cart.js';

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
 * Formats quantity and unit string
 * @param {number} qty
 * @param {string} unit
 * @returns {string}
 */
function formatAvailableStock(qty, unit) {
  const amount = Number(qty) || 0;
  const u = (unit || 'un').toLowerCase();
  if (u === 'un' || u === 'unidade') {
    const unitStr = amount === 1 ? 'unidade' : 'unidades';
    return `${amount} ${unitStr}`;
  }
  return `${amount} ${u}`;
}

/**
 * Renders Catálogo & Requisição view
 * @param {HTMLElement} container
 * @param {Object} ctx
 * @param {Object} ctx.supabase
 * @param {Object} [ctx.profile]
 */
export async function render(container, ctx) {
  let currentCostCenter = (ctx.profile && ctx.profile.cost_center) ? ctx.profile.cost_center : '';
  let currentJustification = '';

  // Render main layout structure
  container.innerHTML = `
    <div class="catalog-page">
      <!-- Page Header -->
      <div class="catalog-header mb-lg">
        <div>
          <h1 class="text-title">Catálogo & Requisição</h1>
          <p class="text-body-sm text-muted mt-xs">Selecione os materiais necessários para compor sua requisição.</p>
        </div>
      </div>

      <!-- Main Layout: Catalog (Left) + Cart Panel (Right) -->
      <div class="catalog-layout">
        <!-- Left Column: Catalog -->
        <div class="catalog-main">
          <!-- Filters Section -->
          <div class="catalog-filters mb-lg">
            <div class="catalog-search-wrapper mb-md">
              <span class="material-symbols-outlined catalog-search-icon">search</span>
              <input
                type="search"
                id="catalog-search"
                class="form-input catalog-search-input"
                placeholder="Buscar por nome, SKU ou descrição..."
                aria-label="Buscar materiais"
              />
            </div>

            <div class="catalog-category-chips" id="catalog-category-chips">
              <button type="button" class="category-chip active" data-category="ALL">Todos</button>
              <button type="button" class="category-chip" data-category="PAPELARIA">Papelaria</button>
              <button type="button" class="category-chip" data-category="INFORMATICA">Informática</button>
              <button type="button" class="category-chip" data-category="LIMPEZA">Limpeza</button>
              <button type="button" class="category-chip" data-category="IMPRESSAO">Impressão</button>
              <button type="button" class="category-chip" data-category="OUTROS">Outros</button>
            </div>
          </div>

          <!-- Counter Bar -->
          <div class="catalog-counter-bar mb-md">
            <span id="catalog-item-count" class="text-body-sm font-semibold text-muted">Carregando itens...</span>
          </div>

          <!-- Catalog Grid / Empty / Loading -->
          <div id="catalog-content">
            <div class="p-2xl text-center text-muted text-body">
              Carregando catálogo de materiais...
            </div>
          </div>
        </div>

        <!-- Right Column: Cart Panel -->
        <aside class="cart-panel card" id="cart-panel">
          <div class="p-lg text-center text-muted text-body-sm">
            Carregando carrinho...
          </div>
        </aside>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#catalog-search');
  const chipsContainer = container.querySelector('#catalog-category-chips');
  const itemCountEl = container.querySelector('#catalog-item-count');
  const contentEl = container.querySelector('#catalog-content');
  const cartPanelEl = container.querySelector('#cart-panel');

  let allItems = [];
  let currentSearch = '';
  let currentCategory = 'ALL';

  // Render initial cart
  await renderCart();

  // Subscribe to cart updates
  const unsubscribeCart = subscribe(() => {
    renderCart();
  });

  // Fetch active items from vw_stock_overview
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
        toast(error.message || 'Erro ao carregar catálogo.', 'error');
      }
      contentEl.innerHTML = emptyState('Não foi possível carregar os materiais.');
      if (itemCountEl) itemCountEl.textContent = '0 itens encontrados';
      return;
    }

    allItems = data || [];
    filterAndRender();
  } catch (err) {
    console.error('Erro ao consultar vw_stock_overview:', err);
    toast('Erro de conexão ao carregar catálogo.', 'error');
    contentEl.innerHTML = emptyState('Erro de conexão ao carregar catálogo.');
    if (itemCountEl) itemCountEl.textContent = '0 itens encontrados';
    return;
  }

  /**
   * Filters allItems by current search and category and renders grid
   */
  function filterAndRender() {
    const query = currentSearch.trim().toLowerCase();

    const filtered = allItems.filter(item => {
      // Category filter
      if (currentCategory !== 'ALL') {
        const itemCat = (item.category || '').toUpperCase();
        if (itemCat !== currentCategory) return false;
      }

      // Search query filter (name, sku, description)
      if (query) {
        const nameMatch = (item.name || '').toLowerCase().includes(query);
        const skuMatch = (item.sku || '').toLowerCase().includes(query);
        const descMatch = (item.description || '').toLowerCase().includes(query);
        if (!nameMatch && !skuMatch && !descMatch) return false;
      }

      return true;
    });

    // Update count text
    const count = filtered.length;
    const countText = count === 1 ? '1 item encontrado' : `${count} itens encontrados`;
    if (itemCountEl) itemCountEl.textContent = countText;

    if (filtered.length === 0) {
      contentEl.innerHTML = emptyState('Nenhum item encontrado com os filtros aplicados.');
      return;
    }

    // Render grid
    contentEl.innerHTML = `
      <div class="catalog-grid">
        ${filtered.map(item => renderCardHtml(item)).join('')}
      </div>
    `;

    // Bind event listeners for card action buttons
    contentEl.querySelectorAll('.btn-add-request').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.currentTarget.getAttribute('data-item-id');
        const item = allItems.find(i => i.id === itemId);
        if (item) {
          addItem(item, 1);
        }
      });
    });
  }

  /**
   * Generates HTML for a single item card
   * @param {Object} item
   * @returns {string}
   */
  function renderCardHtml(item) {
    const availableQty = Number(item.available_quantity) || 0;
    const isOutOfStock = availableQty <= 0;
    const iconName = getCategoryIcon(item.category);
    const categoryLabel = formatCategoryLabel(item.category);
    const stockText = formatAvailableStock(availableQty, item.unit);

    let imageMediaHtml = '';
    if (item.image_url) {
      imageMediaHtml = `
        <div class="catalog-card-image-wrapper">
          <img
            src="${esc(item.image_url)}"
            alt="${esc(item.name)}"
            class="catalog-card-image"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="catalog-card-icon-fallback" style="display: none;">
            <span class="material-symbols-outlined">${esc(iconName)}</span>
          </div>
        </div>
      `;
    } else {
      imageMediaHtml = `
        <div class="catalog-card-image-wrapper">
          <div class="catalog-card-icon-fallback">
            <span class="material-symbols-outlined">${esc(iconName)}</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="catalog-card card">
        ${imageMediaHtml}

        <div class="catalog-card-header mt-sm">
          <span class="catalog-sku-tag code-text">${esc(item.sku)}</span>
          <span class="catalog-category-tag text-overline">${esc(categoryLabel)}</span>
        </div>

        <h3 class="catalog-card-title text-subheading mt-xs" title="${esc(item.name)}">
          ${esc(item.name)}
        </h3>

        <p class="catalog-card-desc text-body-sm text-muted mt-xs">
          ${esc(item.description || 'Sem descrição informada.')}
        </p>

        <div class="catalog-card-stock mt-md">
          <span class="text-body-sm font-semibold">
            Estoque disponível: <strong class="${isOutOfStock ? 'text-danger' : 'text-primary'}">${esc(stockText)}</strong>
          </span>
        </div>

        <div class="catalog-card-footer mt-md">
          <button
            type="button"
            class="btn btn-primary w-full btn-add-request"
            data-item-id="${esc(item.id)}"
            ${isOutOfStock ? 'disabled' : ''}
          >
            <span class="material-symbols-outlined">add_shopping_cart</span>
            ${isOutOfStock ? 'Sem estoque' : 'Adicionar à requisição'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Renders Right Column Cart Panel
   */
  async function renderCart() {
    if (!cartPanelEl) return;

    const cartItems = getItems();
    const totalItemsCount = cartItems.reduce((acc, curr) => acc + curr.quantity, 0);

    // Save existing user input if fields exist in DOM
    const existingCcInput = container.querySelector('#cart-cost-center');
    if (existingCcInput) {
      currentCostCenter = existingCcInput.value;
    }
    const existingJInput = container.querySelector('#cart-justification');
    if (existingJInput) {
      currentJustification = existingJInput.value;
    }

    // Check preventive duplicate warning for permanent items in cart
    const permanentItems = cartItems.filter(i => (i.type || '').toLowerCase() === 'permanente');
    let duplicateWarnings = [];

    if (permanentItems.length > 0 && ctx.profile && ctx.profile.id && ctx.supabase) {
      const permIds = permanentItems.map(i => i.id);
      try {
        const { data, error } = await ctx.supabase
          .from('vw_delivery_history')
          .select('*')
          .eq('requester_id', ctx.profile.id)
          .in('item_id', permIds);

        if (!error && data) {
          duplicateWarnings = data.filter(d => d.days_ago !== null && d.days_ago !== undefined && Number(d.days_ago) <= 180);
        }
      } catch (err) {
        console.error('Erro ao consultar vw_delivery_history:', err);
      }
    }

    // Build Cart HTML
    let itemsListHtml = '';
    if (cartItems.length === 0) {
      itemsListHtml = `
        <div class="p-lg text-center text-muted text-body-sm">
          Sua requisição está vazia. Selecione itens no catálogo.
        </div>
      `;
    } else {
      itemsListHtml = `
        <div class="cart-items-list">
          ${cartItems.map(item => {
            const avail = Number(item.available_quantity) || 0;
            const categoryLabel = formatCategoryLabel(item.category);
            return `
              <div class="cart-item-card">
                <div class="cart-item-header">
                  <div>
                    <div class="cart-item-title">${esc(item.name)}</div>
                    <div class="text-body-sm text-muted mt-2xs">
                      <span class="code-text">${esc(item.sku)}</span> • ${esc(categoryLabel)}
                    </div>
                  </div>
                  <button type="button" class="btn-icon-danger btn-remove-item" data-id="${esc(item.id)}" title="Remover item">
                    <span class="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div class="cart-item-footer">
                  <span class="text-body-sm text-muted">Qtd. Solicitada:</span>
                  <div class="cart-qty-control">
                    <button type="button" class="btn-qty btn-dec-qty" data-id="${esc(item.id)}" ${item.quantity <= 1 ? 'disabled' : ''}>
                      <span class="material-symbols-outlined">remove</span>
                    </button>
                    <span class="cart-qty-value">${item.quantity}</span>
                    <button type="button" class="btn-qty btn-inc-qty" data-id="${esc(item.id)}" ${item.quantity >= avail ? 'disabled' : ''}>
                      <span class="material-symbols-outlined">add</span>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // Build Duplicate Warning HTML
    let duplicateAlertHtml = '';
    if (duplicateWarnings.length > 0) {
      duplicateAlertHtml = `
        <div class="cart-duplicate-alert mb-sm">
          <div class="cart-duplicate-alert-header">
            <span class="material-symbols-outlined">warning</span>
            <span>Aviso Preventivo de Duplicidade</span>
          </div>
          ${duplicateWarnings.map(w => `
            <p class="text-body-sm">
              Você recebeu <strong>"${esc(w.item_name)}"</strong> há <strong>${esc(w.days_ago)} dias</strong>. Explique na justificativa o motivo de um novo pedido.
            </p>
          `).join('')}
        </div>
      `;
    }

    const itemCountLabel = totalItemsCount === 1 ? '1 item adicionado' : `${totalItemsCount} itens adicionados`;

    cartPanelEl.innerHTML = `
      <div class="cart-header">
        <div class="cart-header-title">
          <span class="material-symbols-outlined">assignment_turned_in</span>
          <div>
            <h2 class="text-subheading">Sua Requisição Atual</h2>
            <p class="text-body-sm text-muted mt-2xs" id="cart-item-count-label">${esc(itemCountLabel)}</p>
          </div>
        </div>
        ${cartItems.length > 0 ? `
          <button type="button" class="btn btn-secondary btn-sm" id="btn-clear-cart">
            <span class="material-symbols-outlined">delete_sweep</span>
            Limpar
          </button>
        ` : ''}
      </div>

      ${itemsListHtml}

      ${duplicateAlertHtml}

      <div class="cart-form mt-sm">
        <div class="form-group mb-sm">
          <label class="form-label" for="cart-cost-center">Centro de Custo / Departamento *</label>
          <input
            type="text"
            id="cart-cost-center"
            class="form-input"
            value="${esc(currentCostCenter)}"
            placeholder="Ex: Tecnologia da Informação"
            required
          />
        </div>

        <div class="form-group mb-sm">
          <div class="flex items-center justify-between mb-xs">
            <label class="form-label" for="cart-justification">Justificativa da Necessidade *</label>
            <span id="cart-char-counter" class="code-text text-muted">${currentJustification.length}/500</span>
          </div>
          <textarea
            id="cart-justification"
            class="form-textarea"
            maxlength="500"
            placeholder="Descreva a necessidade do insumo (mínimo 10 caracteres)..."
            rows="3"
            required
          >${esc(currentJustification)}</textarea>
        </div>

        <button
          type="button"
          id="cart-submit-btn"
          class="btn btn-primary w-full btn-lg mt-md"
          ${cartItems.length === 0 ? 'disabled' : ''}
        >
          <span class="material-symbols-outlined">send</span>
          Enviar requisição
        </button>
      </div>
    `;

    // Bind event listeners on cart panel controls
    const clearBtn = cartPanelEl.querySelector('#btn-clear-cart');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        clear();
      });
    }

    cartPanelEl.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (id) removeItem(id);
      });
    });

    cartPanelEl.querySelectorAll('.btn-dec-qty').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const item = cartItems.find(i => i.id === id);
        if (item) setQuantity(id, item.quantity - 1);
      });
    });

    cartPanelEl.querySelectorAll('.btn-inc-qty').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const item = cartItems.find(i => i.id === id);
        if (item) setQuantity(id, item.quantity + 1);
      });
    });

    const ccInput = cartPanelEl.querySelector('#cart-cost-center');
    if (ccInput) {
      ccInput.addEventListener('input', (e) => {
        currentCostCenter = e.target.value;
      });
    }

    const jTextarea = cartPanelEl.querySelector('#cart-justification');
    const counterSpan = cartPanelEl.querySelector('#cart-char-counter');
    if (jTextarea) {
      jTextarea.addEventListener('input', (e) => {
        currentJustification = e.target.value;
        if (counterSpan) {
          counterSpan.textContent = `${currentJustification.length}/500`;
        }
      });
    }

    const submitBtn = cartPanelEl.querySelector('#cart-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', handleSubmit);
    }
  }

  /**
   * Handles submission of the request
   */
  async function handleSubmit() {
    const cartItems = getItems();
    if (cartItems.length === 0) {
      toast('Adicione pelo menos um item à requisição.', 'warning');
      return;
    }

    const costCenter = (currentCostCenter || '').trim();
    if (!costCenter) {
      toast('Informe o centro de custo.', 'warning');
      const ccInput = container.querySelector('#cart-cost-center');
      if (ccInput) ccInput.focus();
      return;
    }

    const justification = (currentJustification || '').trim();
    if (justification.length < 10) {
      toast('A justificativa deve ter no mínimo 10 caracteres.', 'warning');
      const jInput = container.querySelector('#cart-justification');
      if (jInput) jInput.focus();
      return;
    }

    const submitBtn = container.querySelector('#cart-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
    }

    try {
      const p_items = cartItems.map(i => ({
        item_id: i.id,
        quantity: i.quantity
      }));

      const { data, error } = await ctx.supabase.rpc('create_requests', {
        p_items,
        p_justification: justification,
        p_cost_center: costCenter
      });

      if (error) {
        if (error.code === '23505') {
          toast('Você já possui um pedido ativo deste item.', 'error');
        } else if (error.code === '42501') {
          toast('Você não tem permissão para esta ação.', 'error');
        } else {
          toast(error.message || 'Erro ao enviar requisição.', 'error');
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span class="material-symbols-outlined">send</span> Enviar requisição';
        }
        return;
      }

      toast('Requisição enviada com sucesso!', 'success');
      clear();
      currentJustification = '';
      window.location.hash = '#meus-pedidos';
    } catch (err) {
      console.error('Erro ao chamar create_requests:', err);
      toast('Erro de conexão ao enviar requisição.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-symbols-outlined">send</span> Enviar requisição';
      }
    }
  }

  // Event handlers for search and filters
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      filterAndRender();
    });
  }

  if (chipsContainer) {
    chipsContainer.addEventListener('click', (e) => {
      const chip = e.target.closest('.category-chip');
      if (!chip) return;

      chipsContainer.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      currentCategory = chip.getAttribute('data-category') || 'ALL';
      filterAndRender();
    });
  }
}
