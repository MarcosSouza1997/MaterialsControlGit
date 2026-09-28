import { esc, formatDate, formatDateTime, formatMoney, statusBadge, emptyState, toast } from '../ui.js';

/**
 * Renders the role-based Dashboard view
 * @param {HTMLElement} container
 * @param {Object} ctx
 * @param {Object} ctx.profile
 * @param {Object} ctx.supabase
 */
export async function render(container, ctx) {
  const { profile, supabase } = ctx;
  const userRole = profile?.role || 'solicitante';
  const isSolicitante = userRole === 'solicitante';

  container.innerHTML = `
    <div class="flex items-center justify-between p-2xl">
      <p class="text-body text-muted">Carregando dashboard...</p>
    </div>
  `;

  try {
    if (isSolicitante) {
      await renderSolicitanteDashboard(container, ctx);
    } else {
      await renderGestaoDashboard(container, ctx);
    }
  } catch (err) {
    console.error('Erro ao renderizar dashboard:', err);
    toast(err.message || 'Erro ao carregar dados do dashboard', 'error');
    container.innerHTML = emptyState('Erro ao carregar o dashboard.');
  }
}

/**
 * Renders Solicitante specific dashboard
 */
async function renderSolicitanteDashboard(container, ctx) {
  const { profile, supabase } = ctx;

  const { data: requests, error } = await supabase
    .from('vw_requests')
    .select('*')
    .eq('requester_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    toast(error.message || 'Erro ao consultar solicitações', 'error');
    container.innerHTML = emptyState('Erro ao carregar solicitações.');
    return;
  }

  const allRequests = requests || [];

  // Metrics
  const pendentes = allRequests.filter(r => r.status === 'PENDENTE').length;
  const emAndamento = allRequests.filter(r => r.status === 'APROVADO' || r.status === 'EM_SEPARACAO').length;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const entreguesNoMes = allRequests.filter(r => {
    if (r.status !== 'ENTREGUE' || !r.delivered_at) return false;
    const d = new Date(r.delivered_at);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  }).length;

  const recentRequests = allRequests.slice(0, 5);

  container.innerHTML = `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div>
          <h1 class="text-title">Visão Geral do Solicitante</h1>
          <p class="text-body-sm mt-xs">Acompanhe suas solicitações de materiais e suprimentos em tempo real</p>
        </div>
        <div>
          <a href="#catalogo" class="btn btn-primary">
            <span class="material-symbols-outlined">add_circle</span>
            Nova Requisição
          </a>
        </div>
      </header>

      <!-- KPI Cards -->
      <section class="dashboard-kpi-grid solicitante">
        <article class="kpi-card">
          <div class="kpi-card-header">
            <div>
              <span class="kpi-title">Pendentes</span>
              <div class="kpi-value primary">${pendentes}</div>
              <span class="kpi-subtext">Aguardando aprovação</span>
            </div>
            <div class="kpi-icon-box warning">
              <span class="material-symbols-outlined">hourglass_empty</span>
            </div>
          </div>
        </article>

        <article class="kpi-card">
          <div class="kpi-card-header">
            <div>
              <span class="kpi-title">Em Andamento</span>
              <div class="kpi-value">${emAndamento}</div>
              <span class="kpi-subtext">Aprovados ou em separação</span>
            </div>
            <div class="kpi-icon-box">
              <span class="material-symbols-outlined">local_shipping</span>
            </div>
          </div>
        </article>

        <article class="kpi-card">
          <div class="kpi-card-header">
            <div>
              <span class="kpi-title">Entregues no Mês</span>
              <div class="kpi-value">${entreguesNoMes}</div>
              <span class="kpi-subtext">Concluídos este mês</span>
            </div>
            <div class="kpi-icon-box">
              <span class="material-symbols-outlined">check_circle</span>
            </div>
          </div>
        </article>
      </section>

      <!-- Recent Requests Table -->
      <section class="dashboard-table-card">
        <div class="dashboard-table-header">
          <div>
            <h2 class="text-heading">Suas Últimas Requisições</h2>
            <p class="text-body-sm">Últimos 5 pedidos de materiais efetuados</p>
          </div>
          <a href="#meus-pedidos" class="btn btn-secondary btn-sm">Ver Todos</a>
        </div>

        ${recentRequests.length === 0 ? emptyState('Você ainda não fez nenhuma requisição.') : `
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Item</th>
                  <th>Quantidade</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${recentRequests.map(r => `
                  <tr>
                    <td class="font-code text-primary">#${esc(r.id.substring(0, 6))}</td>
                    <td>
                      <div>
                        <strong>${esc(r.item_name)}</strong>
                        <div class="text-body-sm">${esc(r.item_sku)}</div>
                      </div>
                    </td>
                    <td class="tabular-nums">${r.quantity} ${esc(r.item_unit || 'un')}</td>
                    <td class="text-body-sm">${formatDateTime(r.created_at)}</td>
                    <td>${statusBadge(r.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </section>
    </div>
  `;
}

/**
 * Renders Gestão (Almoxarife, Gestor TI, Diretoria) dashboard
 */
async function renderGestaoDashboard(container, ctx) {
  const { supabase } = ctx;

  // Fetch parallel data from views
  const [stockRes, alertsRes, approvalRes, movementsRes, consumptionRes] = await Promise.all([
    supabase.from('vw_stock_overview').select('*'),
    supabase.from('vw_alerts').select('*'),
    supabase.from('vw_approval_queue').select('*'),
    supabase.from('vw_movements').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('vw_consumption').select('*')
  ]);

  if (stockRes.error) toast(stockRes.error.message, 'error');
  if (alertsRes.error) toast(alertsRes.error.message, 'error');
  if (approvalRes.error) toast(approvalRes.error.message, 'error');
  if (movementsRes.error) toast(movementsRes.error.message, 'error');
  if (consumptionRes.error) toast(consumptionRes.error.message, 'error');

  const stockOverview = stockRes.data || [];
  const alertsList = alertsRes.data || [];
  const approvalQueue = (approvalRes.data || []).filter(q => q.my_turn);
  const movementsList = movementsRes.data || [];
  const consumptionList = consumptionRes.data || [];

  // KPIs
  const totalStockQty = stockOverview.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const criticalItems = stockOverview.filter(item => item.stock_status !== 'NORMAL');
  const criticalCount = criticalItems.length;
  const criticalNames = criticalItems.map(i => i.name).slice(0, 2).join(', ');

  const atRiskBatchesCount = alertsList.length;
  const pendingApprovalCount = approvalQueue.length;

  // Prepare Consumption Chart Data for last 6 months
  const monthlyChartData = prepareMonthlyConsumptionData(consumptionList);

  container.innerHTML = `
    <div class="dashboard-container">
      <header class="dashboard-header">
        <div>
          <h1 class="text-title">Visão Geral do Almoxarifado</h1>
          <p class="text-body-sm mt-xs">Monitoramento em tempo real de suprimentos, estoque e requisições</p>
        </div>
      </header>

      <!-- KPI Grid -->
      <section class="dashboard-kpi-grid gestao">
        <!-- KPI 1: Total em Estoque -->
        <article class="kpi-card">
          <div class="kpi-card-header">
            <div>
              <span class="kpi-title">Total em Estoque</span>
              <div class="kpi-value">${totalStockQty.toLocaleString('pt-BR')}</div>
              <span class="kpi-subtext">Unidades físicas registradas</span>
            </div>
            <div class="kpi-icon-box">
              <span class="material-symbols-outlined">inventory_2</span>
            </div>
          </div>
          <div class="kpi-footer-box">
            <span>SKUs cadastrados</span>
            <strong>${stockOverview.length} SKUs</strong>
          </div>
        </article>

        <!-- KPI 2: SKUs Críticos -->
        <article class="kpi-card">
          <div class="kpi-card-header">
            <div>
              <span class="kpi-title ${criticalCount > 0 ? 'danger' : ''}">Nível Crítico</span>
              <div class="kpi-value ${criticalCount > 0 ? 'danger' : ''}">${criticalCount} SKUs</div>
              <span class="kpi-subtext">Abaixo da margem mínima</span>
            </div>
            <div class="kpi-icon-box ${criticalCount > 0 ? 'danger' : ''}">
              <span class="material-symbols-outlined">warning</span>
            </div>
          </div>
          <div class="kpi-footer-box">
            <span class="text-body-sm text-muted text-ellipsis" title="${esc(criticalNames)}">
              ${criticalCount > 0 ? esc(criticalNames) + (criticalCount > 2 ? '...' : '') : 'Nenhum SKU crítico'}
            </span>
          </div>
        </article>

        <!-- KPI 3: Lotes em Risco -->
        <article class="kpi-card">
          <div class="kpi-card-header">
            <div>
              <span class="kpi-title">Lotes em Risco</span>
              <div class="kpi-value">${atRiskBatchesCount} Lotes</div>
              <span class="kpi-subtext">Vencidos, a vencer ou parados</span>
            </div>
            <div class="kpi-icon-box warning">
              <span class="material-symbols-outlined">timelapse</span>
            </div>
          </div>
          <div class="kpi-footer-box">
            <span>Atenção necessária</span>
            <strong>${atRiskBatchesCount} alertas</strong>
          </div>
        </article>

        <!-- KPI 4: Fila de Aprovação -->
        <article class="kpi-card">
          <div class="kpi-card-header">
            <div>
              <span class="kpi-title">Fila de Aprovação</span>
              <div class="kpi-value primary">${pendingApprovalCount} Pedidos</div>
              <span class="kpi-subtext">Aguardando sua análise</span>
            </div>
            <div class="kpi-icon-box">
              <span class="material-symbols-outlined">pending_actions</span>
            </div>
          </div>
          <div class="kpi-footer-box">
            <a href="#aprovacoes" class="text-primary font-semibold">Ir para aprovações &rarr;</a>
          </div>
        </article>
      </section>

      <!-- Middle Section: Chart and Alerts Panel -->
      <section class="dashboard-main-grid">
        <!-- SVG Monthly Chart -->
        <article class="chart-card">
          <div class="chart-header">
            <div>
              <h2 class="text-heading">Consumo Mensal de Insumos</h2>
              <p class="text-body-sm">Histórico dos últimos 6 meses agrupado por categoria</p>
            </div>
            <div class="chart-legend">
              <div class="legend-item">
                <span class="legend-color-dot" style="background-color: #007EA7;"></span>
                <span>Papelaria</span>
              </div>
              <div class="legend-item">
                <span class="legend-color-dot" style="background-color: #003459;"></span>
                <span>Informática</span>
              </div>
              <div class="legend-item">
                <span class="legend-color-dot" style="background-color: #00A8E8;"></span>
                <span>Limpeza</span>
              </div>
              <div class="legend-item">
                <span class="legend-color-dot" style="background-color: #1E40AF;"></span>
                <span>Impressão / Outros</span>
              </div>
            </div>
          </div>

          <div class="chart-wrapper">
            ${renderConsumptionSVGChart(monthlyChartData)}
          </div>

          <div class="chart-footer">
            <div>
              <span class="text-body-sm">Valor Consumido este mês:</span>
              <strong class="text-heading text-primary ml-xs">${formatMoney(monthlyChartData.currentMonthValue)}</strong>
            </div>
            <div>
              <span class="text-body-sm">Volume Consumido este mês:</span>
              <strong class="text-heading ml-xs">${monthlyChartData.currentMonthQty} un</strong>
            </div>
          </div>
        </article>

        <!-- Alerts Panel -->
        <article class="alerts-card">
          <div class="alerts-header">
            <h2 class="text-heading">Painel de Alertas</h2>
            <p class="text-body-sm">Itens com estoque baixo ou lotes em risco</p>
          </div>

          ${alertsList.length === 0 ? emptyState('Nenhum alerta pendente.') : `
            <div class="alerts-list">
              ${alertsList.map(a => renderAlertItem(a)).join('')}
            </div>
          `}
        </article>
      </section>

      <!-- Movements Table -->
      <section class="dashboard-table-card">
        <div class="dashboard-table-header">
          <div>
            <h2 class="text-heading">Últimas Movimentações no Almoxarifado</h2>
            <p class="text-body-sm">Histórico de entradas, saídas e ajustes mais recentes</p>
          </div>
          <a href="#estoque" class="btn btn-secondary btn-sm">Ver Estoque</a>
        </div>

        ${movementsList.length === 0 ? emptyState('Nenhuma movimentação registrada.') : `
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Insumo & SKU</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Responsável</th>
                  <th>Data/Hora</th>
                </tr>
              </thead>
              <tbody>
                ${movementsList.map(m => `
                  <tr>
                    <td>
                      <div>
                        <strong>${esc(m.item_name)}</strong>
                        <div class="text-body-sm font-code">${esc(m.sku)}</div>
                      </div>
                    </td>
                    <td>
                      <span class="status-badge status-${m.type.toLowerCase()}">${esc(m.type)}</span>
                    </td>
                    <td class="tabular-nums ${m.type === 'SAIDA' || m.type === 'DESCARTE' ? 'text-danger' : 'text-primary'}">
                      ${m.type === 'SAIDA' || m.type === 'DESCARTE' ? '-' : '+'}${m.quantity}
                    </td>
                    <td>${esc(m.performer_name || 'Sistema')}</td>
                    <td class="text-body-sm">${formatDateTime(m.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </section>
    </div>
  `;
}

/**
 * Prepares data structure for monthly consumption chart over the last 6 months
 */
function prepareMonthlyConsumptionData(consumptionList) {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    months.push({
      key: yearMonth,
      label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      papelaria: 0,
      informatica: 0,
      limpeza: 0,
      outros: 0,
      totalQty: 0,
      totalVal: 0
    });
  }

  let currentMonthValue = 0;
  let currentMonthQty = 0;
  const currentKey = months[months.length - 1].key;

  consumptionList.forEach(c => {
    if (!c.moved_at) return;
    const dateObj = new Date(c.moved_at);
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const m = months.find(item => item.key === key);

    if (m) {
      const qty = Number(c.quantity || 0);
      const val = Number(c.value || 0);
      const cat = (c.category || '').toUpperCase();

      m.totalQty += qty;
      m.totalVal += val;

      if (cat === 'PAPELARIA') m.papelaria += qty;
      else if (cat === 'INFORMATICA') m.informatica += qty;
      else if (cat === 'LIMPEZA') m.limpeza += qty;
      else m.outros += qty;
    }

    if (key === currentKey) {
      currentMonthValue += Number(c.value || 0);
      currentMonthQty += Number(c.quantity || 0);
    }
  });

  return {
    months,
    currentMonthValue,
    currentMonthQty
  };
}

/**
 * Renders SVG bar chart for monthly consumption
 */
function renderConsumptionSVGChart(chartData) {
  const { months } = chartData;
  const maxVal = Math.max(...months.map(m => m.totalQty), 10);

  const svgWidth = 600;
  const svgHeight = 220;
  const chartHeight = 160;

  return `
    <svg class="chart-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
      <!-- Grid lines -->
      <line x1="0" y1="30" x2="${svgWidth}" y2="30" stroke="#E2E8F0" stroke-dasharray="4" stroke-width="1" />
      <line x1="0" y1="80" x2="${svgWidth}" y2="80" stroke="#E2E8F0" stroke-dasharray="4" stroke-width="1" />
      <line x1="0" y1="130" x2="${svgWidth}" y2="130" stroke="#E2E8F0" stroke-dasharray="4" stroke-width="1" />
      <line x1="0" y1="180" x2="${svgWidth}" y2="180" stroke="#E2E8F0" stroke-width="1" />

      ${months.map((m, idx) => {
        const groupX = 30 + idx * 95;

        const hPapel = (m.papelaria / maxVal) * chartHeight;
        const hInfo = (m.informatica / maxVal) * chartHeight;
        const hLimp = (m.limpeza / maxVal) * chartHeight;
        const hOut = (m.outros / maxVal) * chartHeight;

        const yPapel = 180 - hPapel;
        const yInfo = 180 - hInfo;
        const yLimp = 180 - hLimp;
        const yOut = 180 - hOut;

        const isCurrent = idx === months.length - 1;

        return `
          <g transform="translate(${groupX}, 0)">
            <rect x="0" y="${yPapel}" width="14" height="${hPapel}" rx="2" fill="#007EA7" />
            <rect x="18" y="${yInfo}" width="14" height="${hInfo}" rx="2" fill="#003459" />
            <rect x="36" y="${yLimp}" width="14" height="${hLimp}" rx="2" fill="#00A8E8" />
            <rect x="54" y="${yOut}" width="14" height="${hOut}" rx="2" fill="#1E40AF" />
            <text x="34" y="202" font-family="Inter" font-size="12" font-weight="${isCurrent ? '700' : '400'}" fill="${isCurrent ? '#007EA7' : '#3F4E58'}" text-anchor="middle">
              ${m.label}${isCurrent ? ' (Atual)' : ''}
            </text>
          </g>
        `;
      }).join('')}
    </svg>
  `;
}

/**
 * Renders individual alert item card
 */
function renderAlertItem(alert) {
  let badgeClass = 'status-rejeitado';
  let badgeLabel = alert.alert_type;

  if (alert.alert_type === 'ESTOQUE_BAIXO') {
    badgeClass = 'status-abaixo-minimo';
    badgeLabel = 'Estoque Baixo';
  } else if (alert.alert_type === 'VALIDADE_PROXIMA') {
    badgeClass = 'status-pendente';
    badgeLabel = 'Validade Próxima';
  } else if (alert.alert_type === 'VENCIDO') {
    badgeClass = 'status-rejeitado';
    badgeLabel = 'Vencido';
  } else if (alert.alert_type === 'LOTE_PARADO') {
    badgeClass = 'status-em-separacao';
    badgeLabel = 'Lote Parado';
  }

  let detailMsg = '';
  if (alert.alert_type === 'ESTOQUE_BAIXO') {
    detailMsg = `Saldo atual: ${alert.quantity} (mínimo: ${alert.threshold})`;
  } else if (alert.alert_type === 'VALIDADE_PROXIMA') {
    detailMsg = `Lote ${alert.lot_number || '-'} vence em ${alert.days} dias (${formatDate(alert.expires_on)})`;
  } else if (alert.alert_type === 'VENCIDO') {
    detailMsg = `Lote ${alert.lot_number || '-'} venceu há ${alert.days} dias (${formatDate(alert.expires_on)})`;
  } else if (alert.alert_type === 'LOTE_PARADO') {
    detailMsg = `Lote ${alert.lot_number || '-'} está sem saída há ${alert.days} dias`;
  }

  return `
    <div class="alert-item">
      <div class="alert-item-header">
        <strong class="text-body">${esc(alert.item_name)}</strong>
        <span class="status-badge ${badgeClass}">${esc(badgeLabel)}</span>
      </div>
      <div class="text-body-sm font-code text-muted">SKU: ${esc(alert.sku)}</div>
      <div class="text-body-sm text-muted">${esc(detailMsg)}</div>
    </div>
  `;
}
