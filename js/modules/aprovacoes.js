import { esc, toast, openModal, formatDate, formatDateTime, formatMoney, statusBadge, emptyState } from '../ui.js';

/**
 * Renders Central de Aprovações view (T-007)
 * @param {HTMLElement} container
 * @param {Object} ctx
 * @param {Object} ctx.profile
 * @param {Object} ctx.supabase
 */
export async function render(container, ctx) {
  const { supabase, profile } = ctx;

  // Initial State
  let activeTab = 'pendentes'; // 'todas', 'pendentes', 'duplicidade', 'aprovadas', 'rejeitadas', 'entregues'
  let searchQuery = '';
  let expandedHistories = new Set(); // set of request IDs with expanded delivery history

  // Data state
  let approvalQueue = [];
  let allRequests = [];
  let deliveryHistories = [];
  let loading = true;

  // Render initial frame with loading state
  renderSkeleton();

  // Load initial data
  await loadData();

  async function loadData() {
    loading = true;
    renderSkeleton();

    try {
      // 1. Fetch approval queue for current user (alçada applied via my_turn = true)
      const { data: queueData, error: queueError } = await supabase
        .from('vw_approval_queue')
        .select('*')
        .eq('my_turn', true)
        .order('created_at', { ascending: false });

      if (queueError) throw queueError;
      approvalQueue = queueData || [];

      // 2. Fetch all requests for staff
      const { data: reqData, error: reqError } = await supabase
        .from('vw_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (reqError) throw reqError;
      allRequests = reqData || [];

      // 3. Fetch delivery history for duplication alerts
      const { data: histData, error: histError } = await supabase
        .from('vw_delivery_history')
        .select('*')
        .order('delivered_at', { ascending: false });

      if (histError) throw histError;
      deliveryHistories = histData || [];

    } catch (err) {
      console.error('Erro ao carregar dados da Central de Aprovações:', err);
      toast(err.message || 'Erro ao carregar dados de aprovação', 'error');
    } finally {
      loading = false;
      renderMain();
    }
  }

  function renderSkeleton() {
    container.innerHTML = `
      <div class="mb-lg">
        <h1 class="text-title">Central de Aprovações</h1>
        <p class="text-body text-muted">Análise de solicitações, verificação de duplicidades e liberação controlada de suprimentos.</p>
      </div>
      <div class="card p-lg text-center">
        <p class="text-body text-muted">Carregando solicitações...</p>
      </div>
    `;
  }

  function calculateMetrics() {
    // 1. Pendentes de análise (na fila do perfil)
    const pendentesCount = approvalQueue.length;

    // 2. Alertas de duplicidade
    const alertasCount = approvalQueue.filter(r => r.recent_delivery_days !== null && r.recent_delivery_days !== undefined).length;

    // 3. Aprovadas hoje (aprovações manuais: auto_approved = false e aprovado hoje em SP)
    const todayStr = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const aprovadasHoje = allRequests.filter(r => {
      if (r.auto_approved) return false;
      if (!['APROVADO', 'EM_SEPARACAO', 'ENTREGUE'].includes(r.status)) return false;
      if (!r.approved_at) return false;
      const appDateStr = new Date(r.approved_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return appDateStr === todayStr;
    });

    const aprovadasHojeCount = aprovadasHoje.length;
    const aprovadasHojeValor = aprovadasHoje.reduce((acc, r) => acc + (Number(r.total_value) || 0), 0);

    // 4. Rejeitadas no mês
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const rejeitadasNoMes = allRequests.filter(r => {
      if (r.status !== 'REJEITADO') return false;
      const refDate = new Date(r.approved_at || r.updated_at || r.created_at);
      return refDate.getMonth() === currentMonth && refDate.getFullYear() === currentYear;
    });

    const rejeitadasNoMesCount = rejeitadasNoMes.length;

    return {
      pendentesCount,
      alertasCount,
      aprovadasHojeCount,
      aprovadasHojeValor,
      rejeitadasNoMesCount
    };
  }

  function getFilteredRequests() {
    let list = [];

    if (activeTab === 'pendentes') {
      list = approvalQueue;
    } else if (activeTab === 'duplicidade') {
      list = approvalQueue.filter(r => r.recent_delivery_days !== null && r.recent_delivery_days !== undefined);
    } else if (activeTab === 'aprovadas') {
      list = allRequests.filter(r => r.status === 'APROVADO' || r.status === 'EM_SEPARACAO');
    } else if (activeTab === 'rejeitadas') {
      list = allRequests.filter(r => r.status === 'REJEITADO');
    } else if (activeTab === 'entregues') {
      list = allRequests.filter(r => r.status === 'ENTREGUE');
    } else if (activeTab === 'todas') {
      list = allRequests;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(r => {
        const reqId = `#req-${r.id.slice(0, 6)}`.toLowerCase();
        const shortId = `#${r.id.slice(0, 6)}`.toLowerCase();
        const requester = (r.requester_name || '').toLowerCase();
        const item = (r.item_name || '').toLowerCase();
        const sku = (r.item_sku || '').toLowerCase();
        const costCenter = (r.cost_center || r.requester_cost_center || '').toLowerCase();

        return reqId.includes(q) ||
               shortId.includes(q) ||
               requester.includes(q) ||
               item.includes(q) ||
               sku.includes(q) ||
               costCenter.includes(q);
      });
    }

    return list;
  }

  function getTabCounts() {
    return {
      todas: allRequests.length,
      pendentes: approvalQueue.length,
      duplicidade: approvalQueue.filter(r => r.recent_delivery_days !== null && r.recent_delivery_days !== undefined).length,
      aprovadas: allRequests.filter(r => r.status === 'APROVADO' || r.status === 'EM_SEPARACAO').length,
      rejeitadas: allRequests.filter(r => r.status === 'REJEITADO').length,
      entregues: allRequests.filter(r => r.status === 'ENTREGUE').length
    };
  }

  function renderMain() {
    const metrics = calculateMetrics();
    const tabCounts = getTabCounts();
    const filteredRequests = getFilteredRequests();

    container.innerHTML = `
      <div class="mb-lg">
        <h1 class="text-title">Central de Aprovações</h1>
        <p class="text-body text-muted">Auditoria de solicitações, verificação de duplicidades e liberação controlada de suprimentos de TI.</p>
      </div>

      <!-- Metric Cards -->
      <div class="metrics-grid mb-xl">
        <div class="card metric-card">
          <div class="metric-header">
            <span class="text-label text-muted">PENDENTES DE ANÁLISE</span>
            <span class="material-symbols-outlined text-brand-primary">pending_actions</span>
          </div>
          <div class="metric-value text-display">${metrics.pendentesCount}</div>
          <p class="text-body-sm text-muted">Solicitações na sua alçada</p>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="text-label text-muted">ALERTAS DE DUPLICIDADE</span>
            <span class="material-symbols-outlined text-warning">warning</span>
          </div>
          <div class="metric-value text-display text-warning">${metrics.alertasCount}</div>
          <p class="text-body-sm text-muted">Reincidência nos últimos 180 dias</p>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="text-label text-muted">APROVADAS HOJE</span>
            <span class="material-symbols-outlined text-success">check_circle</span>
          </div>
          <div class="metric-value text-display text-success">${metrics.aprovadasHojeCount}</div>
          <p class="text-body-sm text-muted">Total: ${formatMoney(metrics.aprovadasHojeValor)}</p>
        </div>

        <div class="card metric-card">
          <div class="metric-header">
            <span class="text-label text-muted">REJEITADAS NO MÊS</span>
            <span class="material-symbols-outlined text-danger">cancel</span>
          </div>
          <div class="metric-value text-display text-danger">${metrics.rejeitadasNoMesCount}</div>
          <p class="text-body-sm text-muted">Análises do período atual</p>
        </div>
      </div>

      <!-- Filter Tabs & Search -->
      <div class="catalog-category-chips mb-lg" id="status-tabs">
        <button type="button" class="category-chip ${activeTab === 'todas' ? 'active' : ''}" data-tab="todas">
          Todas <span class="badge-count">${tabCounts.todas}</span>
        </button>
        <button type="button" class="category-chip ${activeTab === 'pendentes' ? 'active' : ''}" data-tab="pendentes">
          Pendentes <span class="badge-count">${tabCounts.pendentes}</span>
        </button>
        <button type="button" class="category-chip ${activeTab === 'duplicidade' ? 'active' : ''}" data-tab="duplicidade">
          Com Alerta de Duplicidade <span class="badge-count">${tabCounts.duplicidade}</span>
        </button>
        <button type="button" class="category-chip ${activeTab === 'aprovadas' ? 'active' : ''}" data-tab="aprovadas">
          Aprovadas <span class="badge-count">${tabCounts.aprovadas}</span>
        </button>
        <button type="button" class="category-chip ${activeTab === 'rejeitadas' ? 'active' : ''}" data-tab="rejeitadas">
          Rejeitadas <span class="badge-count">${tabCounts.rejeitadas}</span>
        </button>
        <button type="button" class="category-chip ${activeTab === 'entregues' ? 'active' : ''}" data-tab="entregues">
          Entregues <span class="badge-count">${tabCounts.entregues}</span>
        </button>
      </div>

      <div class="catalog-search-wrapper mb-lg">
        <span class="material-symbols-outlined catalog-search-icon">search</span>
        <input type="search" id="input-search" class="form-input catalog-search-input" placeholder="Filtrar por solicitante, ID #REQ ou item..." value="${esc(searchQuery)}">
      </div>

      <!-- Requests Table -->
      <div class="card overflow-hidden">
        ${renderRequestsTable(filteredRequests)}
      </div>
    `;

    attachEventListeners();
  }

  function renderRequestsTable(requests) {
    if (!requests || requests.length === 0) {
      return emptyState('Nenhuma solicitação encontrada para este filtro.');
    }

    return `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>ID & HORÁRIO</th>
              <th>SOLICITANTE & SETOR</th>
              <th>ITEM & SALDO</th>
              <th>JUSTIFICATIVA</th>
              <th>AUDITORIA & ALERTA</th>
              <th>STATUS / AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(r => renderRequestRow(r)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderRequestRow(r) {
    const shortId = `#REQ-${r.id.slice(0, 6).toUpperCase()}`;
    const formattedDate = formatDateTime(r.created_at);
    const requesterName = r.requester_name || 'Solicitante';
    const costCenter = r.cost_center || r.requester_cost_center || '-';

    // Stock quantity (if available from approval queue view, or default to '-')
    const stockQty = r.stock_quantity !== undefined && r.stock_quantity !== null
      ? `${r.stock_quantity} ${esc(r.item_unit || 'un')}`
      : '-';

    const hasDuplicateAlert = r.recent_delivery_days !== undefined && r.recent_delivery_days !== null;
    const isExpanded = expandedHistories.has(r.id);

    // Can approve/reject if status is PENDENTE and my_turn is true
    const isPending = r.status === 'PENDENTE';
    const canDecide = isPending && (r.my_turn === true || (r.my_turn === undefined && profile.role === 'gestor_ti'));

    return `
      <tr>
        <td>
          <div class="font-mono text-bold text-brand-primary">${esc(shortId)}</div>
          <div class="text-body-sm text-muted">${esc(formattedDate)}</div>
        </td>
        <td>
          <div class="text-bold text-main">${esc(requesterName)}</div>
          <div class="text-body-sm text-muted"><span class="badge-tag">${esc(costCenter)}</span></div>
        </td>
        <td>
          <div class="text-bold">${r.quantity}x ${esc(r.item_name)}</div>
          <div class="text-body-sm text-muted">SKU: <span class="font-mono">${esc(r.item_sku)}</span></div>
          <div class="text-body-sm text-muted">Estoque: ${esc(stockQty)}</div>
        </td>
        <td>
          <div class="text-body-sm text-main" title="${esc(r.justification)}">
            "${esc(r.justification)}"
          </div>
          ${r.reject_reason ? `<div class="text-body-sm text-danger mt-xs"><strong>Motivo Rejeição:</strong> ${esc(r.reject_reason)}</div>` : ''}
        </td>
        <td>
          ${hasDuplicateAlert ? `
            <div class="status-badge status-pendente mb-xs">
              <span class="material-symbols-outlined text-sm">warning</span>
              Duplicidade Detectada
            </div>
            <div class="text-body-sm text-danger">Solicitou o item há ${r.recent_delivery_days} dias</div>
          ` : `
            <div class="status-badge status-entregue mb-xs">
              <span class="material-symbols-outlined text-sm">check_circle</span>
              Sem Alertas
            </div>
            <div class="text-body-sm text-muted">Consumo regular</div>
          `}
        </td>
        <td>
          <div class="actions-cell">
            <div class="mb-xs">${statusBadge(r.status)}</div>
            <div class="btn-group">
              <button type="button" class="btn btn-secondary btn-sm btn-history" data-id="${r.id}" data-requester="${r.requester_id}" data-item="${r.item_id}">
                <span class="material-symbols-outlined">history</span>
                ${isExpanded ? 'Ocultar' : 'Histórico'}
              </button>
              ${canDecide ? `
                <button type="button" class="btn btn-primary btn-sm btn-approve" data-id="${r.id}" title="Aprovar Solicitação">
                  <span class="material-symbols-outlined">check</span>
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-reject" data-id="${r.id}" title="Rejeitar Solicitação">
                  <span class="material-symbols-outlined">close</span>
                </button>
              ` : ''}
              ${r.status === 'APROVADO' && (profile.role === 'almoxarife' || profile.role === 'gestor_ti') ? `
                <button type="button" class="btn btn-primary btn-sm btn-start-separation" data-id="${r.id}" title="Iniciar Separação">
                  <span class="material-symbols-outlined">inventory_2</span>
                  Separar
                </button>
              ` : ''}
              ${r.status === 'EM_SEPARACAO' && (profile.role === 'almoxarife' || profile.role === 'gestor_ti') ? `
                <button type="button" class="btn btn-success btn-sm btn-deliver" data-id="${r.id}" title="Registrar Entrega">
                  <span class="material-symbols-outlined">local_shipping</span>
                  Entregar
                </button>
              ` : ''}
            </div>
          </div>
        </td>
      </tr>
      ${isExpanded ? renderExpandedHistoryRow(r) : ''}
    `;
  }

  function renderExpandedHistoryRow(r) {
    // Filter history for this requester and item
    const userItemHistory = deliveryHistories.filter(h => h.requester_id === r.requester_id && h.item_id === r.item_id);

    return `
      <tr class="expanded-row">
        <td colspan="6">
          <div class="p-md card bg-main">
            <div class="text-subheading mb-sm text-brand-dark">
              <span class="material-symbols-outlined">history</span>
              Histórico de Entregas Anteriores (${esc(r.requester_name || 'Solicitante')} - ${esc(r.item_name)})
            </div>
            ${userItemHistory.length === 0 ? `
              <p class="text-body-sm text-muted">Nenhuma entrega anterior registrada para este item para este solicitante.</p>
            ` : `
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>DATA DA ENTREGA</th>
                    <th>ITEM ENTREGUE</th>
                    <th>SKU</th>
                    <th>TEMPO DECORRIDO</th>
                  </tr>
                </thead>
                <tbody>
                  ${userItemHistory.map(h => `
                    <tr>
                      <td>${formatDate(h.delivered_at)}</td>
                      <td>${esc(h.item_name)}</td>
                      <td class="font-mono">${esc(h.item_sku)}</td>
                      <td>${h.days_ago !== null && h.days_ago !== undefined ? `${h.days_ago} dias atrás` : '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>
        </td>
      </tr>
    `;
  }

  function attachEventListeners() {
    // Search input
    const inputSearch = container.querySelector('#input-search');
    if (inputSearch) {
      inputSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        const filteredRequests = getFilteredRequests();
        const tableCard = container.querySelector('.card.overflow-hidden');
        if (tableCard) {
          tableCard.innerHTML = renderRequestsTable(filteredRequests);
          attachTableListeners();
        }
      });
    }

    // Tabs
    const tabBtns = container.querySelectorAll('.category-chip');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        renderMain();
      });
    });

    attachTableListeners();
  }

  function attachTableListeners() {
    // History Toggle Buttons
    const historyBtns = container.querySelectorAll('.btn-history');
    historyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (expandedHistories.has(id)) {
          expandedHistories.delete(id);
        } else {
          expandedHistories.add(id);
        }
        renderMain();
      });
    });

    // Approve buttons
    const approveBtns = container.querySelectorAll('.btn-approve');
    approveBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await handleApprove(id);
      });
    });

    // Reject buttons
    const rejectBtns = container.querySelectorAll('.btn-reject');
    rejectBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        handleRejectModal(id);
      });
    });

    // Start separation buttons
    const startBtns = container.querySelectorAll('.btn-start-separation');
    startBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        await handleStartSeparation(id);
      });
    });

    // Deliver buttons
    const deliverBtns = container.querySelectorAll('.btn-deliver');
    deliverBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        handleDeliverModal(id);
      });
    });
  }

  async function handleStartSeparation(requestId) {
    try {
      const { error } = await supabase.rpc('start_separation', { p_request_id: requestId });
      if (error) throw error;

      toast('Separação iniciada com sucesso!', 'success');
      await loadData();
    } catch (err) {
      console.error('Erro ao iniciar separação:', err);
      toast(err.message || 'Erro ao iniciar separação', 'error');
    }
  }

  function handleDeliverModal(requestId) {
    openModal({
      title: 'Confirmar Entrega',
      body: '<p class="text-body">Deseja confirmar a entrega deste pedido ao solicitante? O saldo em estoque será baixado utilizando o lote com vencimento mais próximo (FEFO).</p>',
      actions: [
        {
          text: 'Cancelar',
          class: 'btn btn-secondary',
          onClick: (closeModal) => closeModal()
        },
        {
          text: 'Confirmar Entrega',
          class: 'btn btn-success',
          onClick: async (closeModal) => {
            try {
              const { error } = await supabase.rpc('deliver_request', { p_request_id: requestId });
              if (error) throw error;

              toast('Entrega registrada com sucesso!', 'success');
              closeModal();
              await loadData();
            } catch (err) {
              console.error('Erro ao registrar entrega:', err);
              toast(err.message || 'Erro ao registrar entrega', 'error');
            }
          }
        }
      ]
    });
  }

  async function handleApprove(requestId) {
    try {
      const { error } = await supabase.rpc('approve_request', { p_request_id: requestId });
      if (error) throw error;

      toast('Solicitação aprovada com sucesso!', 'success');
      await loadData();
    } catch (err) {
      console.error('Erro ao aprovar solicitação:', err);
      toast(err.message || 'Erro ao aprovar solicitação', 'error');
    }
  }

  function handleRejectModal(requestId) {
    const modalBody = document.createElement('div');
    modalBody.innerHTML = `
      <div class="form-group">
        <label for="reject-reason-input" class="form-label">Motivo da Rejeição *</label>
        <textarea id="reject-reason-input" class="form-textarea" rows="3" placeholder="Informe obrigatoriamente o motivo do indeferimento..."></textarea>
      </div>
    `;

    openModal({
      title: 'Rejeitar Solicitação',
      body: modalBody,
      actions: [
        {
          text: 'Cancelar',
          class: 'btn btn-secondary',
          onClick: (closeModal) => closeModal()
        },
        {
          text: 'Confirmar Rejeição',
          class: 'btn btn-danger',
          onClick: async (closeModal) => {
            const textarea = modalBody.querySelector('#reject-reason-input');
            const reason = textarea ? textarea.value.trim() : '';

            if (!reason) {
              toast('Informe o motivo da rejeição', 'warning');
              return;
            }

            try {
              const { error } = await supabase.rpc('reject_request', {
                p_request_id: requestId,
                p_reason: reason
              });
              if (error) throw error;

              toast('Solicitação rejeitada com sucesso.', 'info');
              closeModal();
              await loadData();
            } catch (err) {
              console.error('Erro ao rejeitar solicitação:', err);
              toast(err.message || 'Erro ao rejeitar solicitação', 'error');
            }
          }
        }
      ]
    });
  }
}
