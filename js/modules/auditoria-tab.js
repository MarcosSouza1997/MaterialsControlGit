import { esc, toast, emptyState, formatDate, formatDateTime, formatMoney, statusBadge } from '../ui.js';

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
  const techDetailsExpanded = new Set();

  // Lookup maps for Foreign Keys (in-memory per page)
  let itemMap = new Map();     // id -> { name, unit }
  let profileMap = new Map();  // id -> full_name
  let batchMap = new Map();    // id -> lot_number

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

      // Bulk fetch names for foreign keys in auditLogs page
      await fetchLookupsForPage();

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
   * Bulk fetches items, profiles, and batches names for the current page
   */
  async function fetchLookupsForPage() {
    itemMap.clear();
    profileMap.clear();
    batchMap.clear();

    const itemIds = new Set();
    const profileIds = new Set();
    const batchIds = new Set();

    auditLogs.forEach(log => {
      if (log.changed_by) profileIds.add(log.changed_by);

      if (log.table_name === 'items' && log.record_id) itemIds.add(log.record_id);
      if (log.table_name === 'profiles' && log.record_id) profileIds.add(log.record_id);
      if (log.table_name === 'batches' && log.record_id) batchIds.add(log.record_id);

      [log.old_data, log.new_data].forEach(data => {
        if (!data) return;
        if (data.item_id) itemIds.add(data.item_id);
        if (data.requester_id) profileIds.add(data.requester_id);
        if (data.approved_by) profileIds.add(data.approved_by);
        if (data.performed_by) profileIds.add(data.performed_by);
        if (data.changed_by) profileIds.add(data.changed_by);
        if (data.received_by) profileIds.add(data.received_by);
        if (data.batch_id) batchIds.add(data.batch_id);
      });
    });

    const promises = [];

    if (itemIds.size > 0) {
      promises.push(
        ctx.supabase
          .from('items')
          .select('id, name, unit')
          .in('id', Array.from(itemIds))
          .then(({ data }) => {
            if (data) {
              data.forEach(item => itemMap.set(item.id, { name: item.name, unit: item.unit || 'un' }));
            }
          })
      );
    }

    if (profileIds.size > 0) {
      promises.push(
        ctx.supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(profileIds))
          .then(({ data }) => {
            if (data) {
              data.forEach(p => profileMap.set(p.id, p.full_name));
            }
          })
      );
    }

    if (batchIds.size > 0) {
      promises.push(
        ctx.supabase
          .from('batches')
          .select('id, lot_number')
          .in('id', Array.from(batchIds))
          .then(({ data }) => {
            if (data) {
              data.forEach(b => batchMap.set(b.id, b.lot_number || 'Sem nº'));
            }
          })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Helper to resolve item name or short code
   */
  function getItemName(id) {
    if (!id) return '—';
    const item = itemMap.get(id);
    if (item) return item.name;
    return typeof id === 'string' ? id.substring(0, 8) : String(id);
  }

  /**
   * Helper to resolve item unit or 'un'
   */
  function getItemUnit(id) {
    if (!id) return 'un';
    const item = itemMap.get(id);
    return item ? (item.unit || 'un') : 'un';
  }

  /**
   * Helper to resolve profile name or short code
   */
  function getProfileName(id) {
    if (!id) return '—';
    const name = profileMap.get(id);
    if (name) return name;
    return typeof id === 'string' ? id.substring(0, 8) : String(id);
  }

  /**
   * Helper to resolve batch number or short code
   */
  function getBatchNumber(id) {
    if (!id) return '—';
    const lot = batchMap.get(id);
    if (lot) return lot;
    return typeof id === 'string' ? id.substring(0, 8) : String(id);
  }

  /**
   * Maps user roles to readable Portuguese string
   */
  function formatRole(role) {
    switch (role) {
      case 'solicitante': return 'Solicitante';
      case 'almoxarife': return 'Almoxarife';
      case 'gestor_ti': return 'Gestor de TI';
      case 'diretoria': return 'Diretoria';
      default: return role || '—';
    }
  }

  /**
   * Maps status string to readable title-case status
   */
  function formatStatusReadable(status) {
    switch (status) {
      case 'PENDENTE': return 'Pendente';
      case 'APROVADO': return 'Aprovado';
      case 'EM_SEPARACAO': return 'Em separação';
      case 'ENTREGUE': return 'Entregue';
      case 'REJEITADO': return 'Rejeitado';
      case 'CANCELADO': return 'Cancelado';
      default: return status || '—';
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
   * Generates Portuguese non-technical summary string for main table row
   */
  function generateSummary(log) {
    const table = log.table_name;
    const action = (log.action || '').toUpperCase();
    const oldD = log.old_data || {};
    const newD = log.new_data || {};

    if (table === 'requests') {
      const itemId = newD.item_id || oldD.item_id;
      const itemName = getItemName(itemId);
      const qty = newD.quantity || oldD.quantity || 1;
      const unit = getItemUnit(itemId);

      if (action === 'INSERT') {
        return `Novo pedido de ${itemName} (${qty} ${unit})`;
      }
      if (action === 'UPDATE') {
        if (oldD.status && newD.status && oldD.status !== newD.status) {
          return `Pedido de ${itemName}: ${formatStatusReadable(oldD.status)} → ${formatStatusReadable(newD.status)}`;
        }
        return `Pedido de ${itemName}: Alterado`;
      }
      if (action === 'DELETE') {
        return `Pedido de ${itemName}: Excluído`;
      }
    }

    if (table === 'profiles') {
      const personName = newD.full_name || oldD.full_name || getProfileName(log.record_id);
      if (action === 'INSERT') {
        return `Novo perfil de ${personName}`;
      }
      if (action === 'UPDATE') {
        if (oldD.cost_center !== newD.cost_center && oldD.cost_center !== undefined) {
          return `Perfil de ${personName}: Setor alterado`;
        }
        if (oldD.role !== newD.role && oldD.role !== undefined) {
          return `Perfil de ${personName}: Perfil alterado`;
        }
        if (oldD.active !== newD.active && oldD.active !== undefined) {
          return `Perfil de ${personName}: ${newD.active ? 'Ativado' : 'Desativado'}`;
        }
        return `Perfil de ${personName}: Dados alterados`;
      }
      if (action === 'DELETE') {
        return `Perfil de ${personName}: Excluído`;
      }
    }

    if (table === 'stock_movements') {
      const itemId = newD.item_id || oldD.item_id;
      const itemName = getItemName(itemId);
      const rawQty = newD.quantity !== undefined ? newD.quantity : oldD.quantity;
      const qty = Math.abs(rawQty || 0);
      const unit = getItemUnit(itemId);
      const type = (newD.type || oldD.type || '').toUpperCase();

      if (type === 'ENTRADA') return `Entrada de ${qty} ${unit} de ${itemName}`;
      if (type === 'SAIDA') return `Saída de ${qty} ${unit} de ${itemName}`;
      if (type === 'AJUSTE') return `Ajuste de ${qty} ${unit} de ${itemName}`;
      if (type === 'DESCARTE') return `Descarte de ${qty} ${unit} de ${itemName}`;
      return `Movimentação de ${itemName}`;
    }

    if (table === 'items') {
      const itemName = newD.name || oldD.name || getItemName(log.record_id);
      if (action === 'INSERT') return `Novo item: ${itemName}`;
      if (action === 'UPDATE') {
        if (oldD.active !== newD.active && oldD.active !== undefined) {
          return `Item ${itemName}: ${newD.active ? 'Reativado' : 'Desativado'}`;
        }
        return `Item ${itemName}: Dados alterados`;
      }
      if (action === 'DELETE') return `Item ${itemName}: Excluído`;
    }

    return `${formatTableName(table)}: ${action}`;
  }

  /**
   * Field label translations per table
   */
  function getFieldLabel(table, field) {
    if (table === 'requests') {
      switch (field) {
        case 'status': return 'Status';
        case 'quantity': return 'Quantidade';
        case 'justification': return 'Justificativa';
        case 'cost_center': return 'Setor';
        case 'item_id': return 'Item';
        case 'requester_id': return 'Solicitante';
        case 'auto_approved': return 'Aprovação automática';
        case 'approved_by': return 'Aprovado por';
        case 'approved_at': return 'Aprovado em';
        case 'reject_reason': return 'Motivo da rejeição';
        case 'delivered_at': return 'Entregue em';
        case 'created_at': return 'Criado em';
      }
    }

    if (table === 'profiles') {
      switch (field) {
        case 'full_name': return 'Nome';
        case 'role': return 'Perfil';
        case 'cost_center': return 'Setor';
        case 'active': return 'Ativo';
        case 'created_at': return 'Criado em';
      }
    }

    if (table === 'items') {
      switch (field) {
        case 'name': return 'Nome do Produto';
        case 'sku': return 'Código SKU';
        case 'description': return 'Descrição';
        case 'category': return 'Categoria';
        case 'unit': return 'Unidade de Medida';
        case 'type': return 'Tipo do Item';
        case 'location': return 'Localização';
        case 'reorder_point': return 'Ponto de Reposição';
        case 'requires_expiry': return 'Exige Validade';
        case 'unit_price': return 'Preço Unitário';
        case 'active': return 'Ativo';
        case 'created_at': return 'Criado em';
        case 'image_url': return 'URL da Imagem';
      }
    }

    if (table === 'stock_movements') {
      switch (field) {
        case 'item_id': return 'Item';
        case 'batch_id': return 'Lote';
        case 'type': return 'Tipo de Movimentação';
        case 'quantity': return 'Quantidade';
        case 'request_id': return 'Pedido';
        case 'note': return 'Motivo / Observação';
        case 'performed_by': return 'Responsável';
        case 'created_at': return 'Criado em';
      }
    }

    return field;
  }

  /**
   * Formats field values to readable strings or badges
   */
  function formatFieldValue(table, key, val) {
    if (val === null || val === undefined || val === '') return '—';

    // Booleans
    if (typeof val === 'boolean') {
      return val ? 'Sim' : 'Não';
    }

    // Role enum
    if (key === 'role') {
      return formatRole(val);
    }

    // Status enum (requests)
    if (key === 'status') {
      return statusBadge(val);
    }

    // Foreign keys
    if (key === 'item_id') return esc(getItemName(val));
    if (key === 'requester_id' || key === 'approved_by' || key === 'performed_by' || key === 'changed_by' || key === 'received_by') {
      return esc(getProfileName(val));
    }
    if (key === 'batch_id') return esc(getBatchNumber(val));

    // Currency
    if (key === 'unit_price') {
      return formatMoney(val);
    }

    // Dates
    if (key === 'expires_on') {
      return formatDate(val);
    }
    if (key === 'created_at' || key === 'updated_at' || key === 'approved_at' || key === 'delivered_at' || key === 'received_at') {
      return formatDateTime(val);
    }

    if (typeof val === 'object') {
      return esc(JSON.stringify(val));
    }

    return esc(String(val));
  }

  /**
   * Renders expanded row details
   */
  function renderDetailsContent(log) {
    const action = (log.action || '').toUpperCase();
    const table = log.table_name;
    const isTechExpanded = techDetailsExpanded.has(log.id);

    let mainDetailsHtml = '';

    if (action === 'UPDATE' && log.old_data && log.new_data) {
      const oldData = log.old_data;
      const newData = log.new_data;

      // Filter out 'id' and 'updated_at' from change inspection (Rule 5)
      const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
        .filter(k => k !== 'id' && k !== 'updated_at');

      const changedKeys = allKeys.filter(k => JSON.stringify(oldData[k]) !== JSON.stringify(newData[k]));

      if (changedKeys.length === 0) {
        mainDetailsHtml = `<div class="text-body-sm text-muted">Nenhum campo com alteração de valor detectado.</div>`;
      } else {
        mainDetailsHtml = `
          <div class="flex flex-col gap-xs mb-sm">
            <h4 class="text-subheading mb-xs">O que mudou</h4>
            <table class="diff-table">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Antes</th>
                  <th>Depois</th>
                </tr>
              </thead>
              <tbody>
                ${changedKeys.map(k => {
                  const oldValFormatted = formatFieldValue(table, k, oldData[k]);
                  const newValFormatted = formatFieldValue(table, k, newData[k]);
                  const label = getFieldLabel(table, k);
                  return `
                    <tr class="changed-row">
                      <td class="font-semibold text-body">${esc(label)}</td>
                      <td class="text-danger text-body">${oldValFormatted}</td>
                      <td class="text-primary text-body font-semibold">${newValFormatted}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } else {
      // INSERT or DELETE or fallback
      const dataObj = action === 'DELETE' ? (log.old_data || {}) : (log.new_data || log.old_data || {});
      const keys = Object.keys(dataObj).filter(k => k !== 'id' && k !== 'updated_at');

      mainDetailsHtml = `
        <div class="flex flex-col gap-xs mb-sm">
          <h4 class="text-subheading mb-xs">Dados do registro</h4>
          <table class="diff-table">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              ${keys.map(k => {
                const valFormatted = formatFieldValue(table, k, dataObj[k]);
                const label = getFieldLabel(table, k);
                return `
                  <tr>
                    <td class="font-semibold text-body">${esc(label)}</td>
                    <td class="text-body">${valFormatted}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const techSectionHtml = `
      <div class="mt-md pt-md border-t border-subtle">
        <button type="button" class="btn btn-secondary btn-sm btn-toggle-tech-details" data-id="${log.id}">
          <span class="material-symbols-outlined">${isTechExpanded ? 'terminal' : 'code'}</span>
          ${isTechExpanded ? 'Ocultar dados técnicos' : 'Ver dados técnicos'}
        </button>

        ${isTechExpanded ? `
          <div class="json-grid mt-md">
            <div class="json-box">
              <span class="text-label text-muted">ID do Registro (UUID)</span>
              <div class="code-text text-body mt-xs mb-xs">${esc(log.record_id || '—')}</div>
            </div>
            <div class="json-box">
              <span class="text-label text-muted">Tabela / Ação</span>
              <div class="code-text text-body mt-xs mb-xs">${esc(log.table_name)} (${esc(log.action)})</div>
            </div>
            <div class="json-box">
              <span class="text-label text-muted">Dados Anteriores (old_data)</span>
              <pre class="code-json" id="old-json-${log.id}"></pre>
            </div>
            <div class="json-box">
              <span class="text-label text-muted">Dados Novos (new_data)</span>
              <pre class="code-json" id="new-json-${log.id}"></pre>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    return `
      <div class="audit-diff-container">
        ${mainDetailsHtml}
        ${techSectionHtml}
      </div>
    `;
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
            <th>Resumo</th>
            <th class="text-right">Detalhes</th>
          </tr>
        </thead>
        <tbody>
          ${auditLogs.map(item => {
            const isExpanded = expandedRows.has(item.id);
            const summaryText = generateSummary(item);
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
                <td class="text-body font-semibold text-dark">
                  ${esc(summaryText)}
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
                  ${renderDetailsContent(item)}
                </td>
              </tr>
            `;

            return detailRow;
          }).join('')}
        </tbody>
      </table>
    `;

    // Safely set JSON content via textContent (R5) for expanded tech details
    auditLogs.forEach(item => {
      if (expandedRows.has(item.id) && techDetailsExpanded.has(item.id)) {
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
   * Binds table expand row buttons and tech details buttons
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

    const techBtns = container.querySelectorAll('.btn-toggle-tech-details');
    techBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rawId = e.currentTarget.getAttribute('data-id');
        const id = isNaN(Number(rawId)) ? rawId : Number(rawId);
        if (techDetailsExpanded.has(id)) {
          techDetailsExpanded.delete(id);
        } else {
          techDetailsExpanded.add(id);
        }
        renderAuditTable();
      });
    });
  }
}
