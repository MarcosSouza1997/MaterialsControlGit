import { esc, toast, emptyState } from '../ui.js';
import { addItem } from './cart.js';

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
 */
export async function render(container, ctx) {
  // Render structure
  container.innerHTML = `
    <div class="catalog-page">
      <!-- Page Header -->
      <div class="catalog-header mb-lg">
        <div>
          <h1 class="text-title">Catálogo & Requisição</h1>
          <p class="text-body-sm text-muted mt-xs">Selecione os materiais necessários para compor sua requisição.</p>
        </div>
      </div>

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
  `;

  const searchInput = container.querySelector('#catalog-search');
  const chipsContainer = container.querySelector('#catalog-category-chips');
  const itemCountEl = container.querySelector('#catalog-item-count');
  const contentEl = container.querySelector('#catalog-content');

  let allItems = [];
  let currentSearch = '';
  let currentCategory = 'ALL';

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
