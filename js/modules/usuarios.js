import { esc, toast, openModal, formatDate, emptyState, paginate } from '../ui.js';

/**
 * Returns user-friendly Portuguese label for role
 * @param {string} role
 * @returns {string}
 */
function formatRoleLabel(role) {
  switch (role) {
    case 'gestor_ti': return 'Gestor de TI';
    case 'almoxarife': return 'Almoxarife';
    case 'diretoria': return 'Diretoria';
    case 'solicitante':
    default: return 'Solicitante';
  }
}

/**
 * Renders Administration of Users view (T-014)
 * @param {HTMLElement} container
 * @param {Object} ctx - Context object with profile and supabase client
 */
export async function render(container, ctx) {
  let usersList = [];
  let costCentersList = [];
  let currentSearch = '';
  let currentRoleFilter = 'ALL';
  let currentStatusFilter = 'ALL';
  let currentPage = 1;

  // Render main layout frame
  container.innerHTML = `
    <div class="usuarios-container">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-title">Administração de Usuários</h1>
          <p class="text-body-sm text-muted mt-xs">
            Gerencie permissões, ative novas contas e atribua setores aos colaboradores.
          </p>
        </div>
      </div>

      <!-- Informational Banner -->
      <div class="usuarios-info-banner card">
        <span class="material-symbols-outlined">info</span>
        <div>
          <strong>Cadastro e Ativação de Contas:</strong>
          <span> Novas contas são criadas pelo próprio colaborador na tela de login ("Criar conta") e entram automaticamente como inativas, aguardando ativação nesta tela.</span>
        </div>
      </div>

      <!-- Summary Metrics Cards -->
      <div class="usuarios-metrics-grid" id="usuarios-metrics">
        <div class="card card-metric">
          <span class="metric-label text-overline">Total de Usuários</span>
          <span class="metric-value" id="metric-total">--</span>
        </div>
        <div class="card card-metric" style="border-left: 4px solid var(--color-warning);">
          <span class="metric-label text-overline">Aguardando Ativação</span>
          <span class="metric-value text-danger" id="metric-pending">--</span>
        </div>
        <div class="card card-metric">
          <span class="metric-label text-overline">Contas Ativas</span>
          <span class="metric-value" id="metric-active">--</span>
        </div>
        <div class="card card-metric">
          <span class="metric-label text-overline">Gestores de TI</span>
          <span class="metric-value" id="metric-gestores">--</span>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="card">
        <div class="usuarios-toolbar">
          <div class="usuarios-search-box">
            <span class="material-symbols-outlined">search</span>
            <input
              type="search"
              id="user-search-input"
              class="form-input usuarios-search-input"
              placeholder="Buscar por nome, e-mail ou setor..."
              aria-label="Buscar usuários"
            />
          </div>

          <div class="usuarios-filter-group">
            <div class="flex items-center gap-xs">
              <label for="user-role-filter" class="form-label text-body-sm mb-0">Perfil:</label>
              <select id="user-role-filter" class="form-select" style="width: auto; min-width: 140px;">
                <option value="ALL">Todos os perfis</option>
                <option value="solicitante">Solicitante</option>
                <option value="almoxarife">Almoxarife</option>
                <option value="gestor_ti">Gestor de TI</option>
                <option value="diretoria">Diretoria</option>
              </select>
            </div>

            <div class="flex items-center gap-xs">
              <label for="user-status-filter" class="form-label text-body-sm mb-0">Situação:</label>
              <select id="user-status-filter" class="form-select" style="width: auto; min-width: 160px;">
                <option value="ALL">Todas as situações</option>
                <option value="PENDING">Aguardando ativação</option>
                <option value="ACTIVE">Ativo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Users Table Container -->
      <div id="users-table-container">
        <div class="card text-center p-2xl text-muted text-body">
          Carregando lista de usuários...
        </div>
      </div>
    </div>
  `;

  // Bind DOM element references
  const searchInput = container.querySelector('#user-search-input');
  const roleFilterSelect = container.querySelector('#user-role-filter');
  const statusFilterSelect = container.querySelector('#user-status-filter');
  const tableContainer = container.querySelector('#users-table-container');

  // Load auxiliary data (cost_centers) and users list
  await fetchCostCenters();
  await loadUsersData();

  /**
   * Fetches cost_centers from database table
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
      console.error('Erro ao carregar centros de custo:', err);
    }
  }

  /**
   * Loads user profile records via admin_list_users RPC
   */
  async function loadUsersData() {
    try {
      const { data, error } = await ctx.supabase.rpc('admin_list_users');

      if (error) {
        if (error.code === '42501') {
          toast('Você não tem permissão para esta ação.', 'error');
        } else {
          toast(error.message || 'Erro ao listar usuários.', 'error');
        }
        tableContainer.innerHTML = emptyState('Não foi possível carregar a lista de usuários.');
        return;
      }

      usersList = data || [];
      updateMetrics();
      filterAndRenderTable();
    } catch (err) {
      console.error('Erro ao chamar admin_list_users:', err);
      toast('Erro de conexão ao carregar usuários.', 'error');
      tableContainer.innerHTML = emptyState('Erro de conexão ao carregar usuários.');
    }
  }

  /**
   * Calculates metrics overview
   */
  function updateMetrics() {
    const total = usersList.length;
    const pending = usersList.filter(u => !u.active).length;
    const active = usersList.filter(u => u.active).length;
    const gestores = usersList.filter(u => u.role === 'gestor_ti').length;

    const elTotal = container.querySelector('#metric-total');
    const elPending = container.querySelector('#metric-pending');
    const elActive = container.querySelector('#metric-active');
    const elGestores = container.querySelector('#metric-gestores');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elActive) elActive.textContent = active;
    if (elGestores) elGestores.textContent = gestores;
  }

  /**
   * Filters user records by current search and filters, then renders table
   */
  function filterAndRenderTable() {
    const query = currentSearch.trim().toLowerCase();

    const filtered = usersList.filter(user => {
      // Role filter
      if (currentRoleFilter !== 'ALL' && user.role !== currentRoleFilter) {
        return false;
      }

      // Status filter
      if (currentStatusFilter === 'PENDING' && user.active) return false;
      if (currentStatusFilter === 'ACTIVE' && !user.active) return false;

      // Search query (name, email, cost_center)
      if (query) {
        const nameMatch = (user.full_name || '').toLowerCase().includes(query);
        const emailMatch = (user.email || '').toLowerCase().includes(query);
        const ccMatch = (user.cost_center || '').toLowerCase().includes(query);
        if (!nameMatch && !emailMatch && !ccMatch) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      tableContainer.innerHTML = emptyState('Nenhum usuário encontrado com os filtros aplicados.');
      return;
    }

    // Paginate results (25 per page)
    const paginated = paginate(filtered, currentPage, 25);

    // Build Table HTML
    tableContainer.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Nome Completo</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Setor / Centro de Custo</th>
              <th>Situação</th>
              <th>Cadastrado em</th>
              <th class="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${paginated.data.map(user => {
              const isSelf = ctx.profile && ctx.profile.id === user.id;
              const isPending = !user.active;
              const rowClass = isPending ? 'row-pending' : '';
              const roleLabel = formatRoleLabel(user.role);
              const costCenterText = user.cost_center ? esc(user.cost_center) : '<span class="text-muted">Sem setor</span>';

              let statusBadgeHtml = '';
              if (isPending) {
                statusBadgeHtml = `<span class="status-badge status-aguardando">Aguardando ativação</span>`;
              } else {
                statusBadgeHtml = `<span class="status-badge status-ativo">Ativo</span>`;
              }

              return `
                <tr class="${rowClass}">
                  <td>
                    <div class="font-semibold text-subheading" style="font-size: 0.875rem;">
                      ${esc(user.full_name)}
                      ${isSelf ? '<span class="text-body-sm text-primary font-semibold ml-xs">(Você)</span>' : ''}
                    </div>
                  </td>
                  <td class="font-code">${esc(user.email)}</td>
                  <td>
                    <span class="status-badge status-aprovado">${esc(roleLabel)}</span>
                  </td>
                  <td>${costCenterText}</td>
                  <td>${statusBadgeHtml}</td>
                  <td class="tabular-nums">${formatDate(user.created_at)}</td>
                  <td class="text-right">
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm btn-edit-user"
                      data-id="${esc(user.id)}"
                      title="Alterar perfil e permissões"
                    >
                      <span class="material-symbols-outlined">edit</span>
                      Editar
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      ${paginated.totalPages > 1 ? `
        <div class="flex items-center justify-between mt-md card p-md">
          <span class="text-body-sm text-muted">
            Exibindo ${paginated.data.length} de ${paginated.total} usuários (Página ${paginated.page} de ${paginated.totalPages})
          </span>
          <div class="flex items-center gap-xs">
            <button
              type="button"
              class="btn btn-secondary btn-sm btn-page-prev"
              ${paginated.page <= 1 ? 'disabled' : ''}
            >
              Anterior
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm btn-page-next"
              ${paginated.page >= paginated.totalPages ? 'disabled' : ''}
            >
              Próxima
            </button>
          </div>
        </div>
      ` : ''}
    `;

    // Bind event listeners for Edit buttons
    tableContainer.querySelectorAll('.btn-edit-user').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.currentTarget.getAttribute('data-id');
        const targetUser = usersList.find(u => u.id === userId);
        if (targetUser) {
          openEditUserModal(targetUser);
        }
      });
    });

    // Pagination handlers
    const prevBtn = tableContainer.querySelector('.btn-page-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          filterAndRenderTable();
        }
      });
    }

    const nextBtn = tableContainer.querySelector('.btn-page-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentPage < paginated.totalPages) {
          currentPage++;
          filterAndRenderTable();
        }
      });
    }
  }

  /**
   * Opens modal to edit user profile, role, status and cost center
   * @param {Object} targetUser
   */
  function openEditUserModal(targetUser) {
    const isSelf = ctx.profile && ctx.profile.id === targetUser.id;

    // Create modal body container
    const bodyEl = document.createElement('div');
    bodyEl.className = 'user-edit-form';

    bodyEl.innerHTML = `
      <div class="user-modal-header-info mb-sm">
        <div>
          <strong class="text-subheading">${esc(targetUser.full_name)}</strong>
          ${isSelf ? '<span class="status-badge status-aprovado ml-xs">Você</span>' : ''}
        </div>
        <p class="text-body-sm code-text text-muted">${esc(targetUser.email)}</p>
      </div>

      <div class="user-status-toggle form-group mb-sm">
        <div>
          <label class="form-label mb-0" for="edit-user-active-toggle">Situação da Conta</label>
          <p class="text-body-sm text-muted mt-2xs" id="status-toggle-help">
            ${targetUser.active ? 'Conta ativa com acesso ao sistema' : 'Conta inativa (aguardando ativação)'}
          </p>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            id="edit-user-active-toggle"
            ${targetUser.active ? 'checked' : ''}
          />
          <span class="slider"></span>
        </label>
      </div>

      <div class="form-group mb-sm">
        <label class="form-label" for="edit-user-role">Perfil de Acesso *</label>
        <select id="edit-user-role" class="form-select" required>
          <option value="solicitante" ${targetUser.role === 'solicitante' ? 'selected' : ''}>Solicitante</option>
          <option value="almoxarife" ${targetUser.role === 'almoxarife' ? 'selected' : ''}>Almoxarife</option>
          <option value="gestor_ti" ${targetUser.role === 'gestor_ti' ? 'selected' : ''}>Gestor de TI</option>
          <option value="diretoria" ${targetUser.role === 'diretoria' ? 'selected' : ''}>Diretoria</option>
        </select>
      </div>

      <div class="form-group mb-sm">
        <label class="form-label" for="edit-user-cost-center">Setor / Centro de Custo</label>
        <select id="edit-user-cost-center" class="form-select">
          <option value="" ${!targetUser.cost_center ? 'selected' : ''}>Sem setor</option>
          ${costCentersList.map(cc => {
            const ccName = typeof cc === 'object' ? (cc.name || cc.code || '') : String(cc);
            const isSelected = targetUser.cost_center && targetUser.cost_center.toLowerCase() === ccName.toLowerCase();
            return `<option value="${esc(ccName)}" ${isSelected ? 'selected' : ''}>${esc(ccName)}</option>`;
          }).join('')}
        </select>
        <p class="text-body-sm text-muted mt-2xs">Pré-preenche o setor nas requisições do colaborador.</p>
      </div>
    `;

    const toggleInput = bodyEl.querySelector('#edit-user-active-toggle');
    const toggleHelp = bodyEl.querySelector('#status-toggle-help');
    if (toggleInput && toggleHelp) {
      toggleInput.addEventListener('change', (e) => {
        if (e.target.checked) {
          toggleHelp.textContent = 'Conta ativa com acesso ao sistema';
        } else {
          toggleHelp.textContent = 'Conta inativa (aguardando ativação)';
        }
      });
    }

    openModal({
      title: 'Editar Perfil do Usuário',
      body: bodyEl,
      actions: [
        {
          text: 'Cancelar',
          class: 'btn btn-secondary',
          onClick: (closeModal) => closeModal()
        },
        {
          text: 'Salvar alterações',
          class: 'btn btn-primary',
          onClick: async (closeModal) => {
            const roleInput = bodyEl.querySelector('#edit-user-role');
            const ccInput = bodyEl.querySelector('#edit-user-cost-center');

            const p_role = roleInput ? roleInput.value : targetUser.role;
            const p_cost_center = ccInput ? ccInput.value : '';
            const p_active = toggleInput ? toggleInput.checked : targetUser.active;

            try {
              const { error } = await ctx.supabase.rpc('admin_update_profile', {
                p_user_id: targetUser.id,
                p_role,
                p_cost_center,
                p_active
              });

              if (error) {
                if (error.code === '42501') {
                  toast('Você não tem permissão para esta ação.', 'error');
                } else {
                  toast(error.message || 'Erro ao atualizar perfil do usuário.', 'error');
                }
                return;
              }

              toast('Perfil atualizado com sucesso!', 'success');
              closeModal();
              await loadUsersData();
            } catch (err) {
              console.error('Erro ao atualizar perfil:', err);
              toast('Erro de conexão ao atualizar perfil.', 'error');
            }
          }
        }
      ]
    });
  }

  // Bind Event Listeners for Toolbar Controls
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      currentPage = 1;
      filterAndRenderTable();
    });
  }

  if (roleFilterSelect) {
    roleFilterSelect.addEventListener('change', (e) => {
      currentRoleFilter = e.target.value;
      currentPage = 1;
      filterAndRenderTable();
    });
  }

  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', (e) => {
      currentStatusFilter = e.target.value;
      currentPage = 1;
      filterAndRenderTable();
    });
  }
}
