import { emptyState } from './ui.js';

/**
 * Route definitions and access permissions per role.
 */
const ROUTES = {
  '#dashboard': {
    title: 'Dashboard',
    module: './modules/dashboard.js',
    roles: ['solicitante', 'almoxarife', 'gestor_ti', 'diretoria']
  },
  '#catalogo': {
    title: 'Catálogo & Requisição',
    module: './modules/catalogo.js',
    roles: ['solicitante', 'almoxarife', 'gestor_ti']
  },
  '#meus-pedidos': {
    title: 'Meus Pedidos',
    module: './modules/meus-pedidos.js',
    roles: ['solicitante', 'almoxarife', 'gestor_ti']
  },
  '#aprovacoes': {
    title: 'Central de Aprovações',
    module: './modules/aprovacoes.js',
    roles: ['almoxarife', 'gestor_ti']
  },
  '#estoque': {
    title: 'Controle de Estoque',
    module: './modules/estoque.js',
    roles: ['almoxarife', 'gestor_ti', 'diretoria']
  },
  '#relatorios': {
    title: 'Relatórios & Auditoria',
    module: './modules/relatorios.js',
    roles: ['gestor_ti', 'diretoria']
  },
  '#usuarios': {
    title: 'Usuários',
    module: './modules/usuarios.js',
    roles: ['gestor_ti']
  }
};

/**
 * Initializes and handles routing for the application.
 * @param {Object} ctx - Context containing profile and supabase client.
 * @param {Object} ctx.profile - Active user profile object.
 * @param {Object} ctx.supabase - Supabase client instance.
 */
export function initRouter(ctx) {
  const container = document.getElementById('view-root');
  const breadcrumbEl = document.getElementById('topbar-breadcrumb');

  async function handleHashChange() {
    let hash = window.location.hash || '#dashboard';

    // Normalize hash if missing or unknown
    if (!ROUTES[hash]) {
      hash = '#dashboard';
    }

    const routeConfig = ROUTES[hash];
    const userRole = ctx?.profile?.role || 'solicitante';

    // Update active nav item in sidebar
    document.querySelectorAll('.sidebar-link').forEach(link => {
      const linkHash = link.getAttribute('href');
      if (linkHash === hash) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });

    // Update topbar breadcrumb
    if (breadcrumbEl) {
      breadcrumbEl.textContent = `Materiais e Suprimentos / ${routeConfig.title}`;
    }

    // Check permissions
    if (!routeConfig.roles.includes(userRole)) {
      if (container) {
        container.innerHTML = `
          <div class="card text-center restricted-card">
            <div class="alert alert-danger mb-md">
              <span class="material-symbols-outlined">block</span>
              <div>
                <strong>Acesso restrito</strong>
                <p class="text-body-sm mt-xs">Seu perfil (${userRole}) não tem permissão para acessar esta página.</p>
              </div>
            </div>
            <a href="#dashboard" class="btn btn-primary">Voltar ao Dashboard</a>
          </div>
        `;
      }
      return;
    }

    // Load and render module
    if (container) {
      container.innerHTML = `
        <div class="flex items-center justify-between p-2xl">
          <p class="text-body text-muted">Carregando...</p>
        </div>
      `;

      try {
        const module = await import(routeConfig.module);
        if (module && typeof module.render === 'function') {
          module.render(container, ctx);
        } else {
          container.innerHTML = emptyState('Erro ao carregar o módulo.');
        }
      } catch (err) {
        console.error('Erro ao importar módulo da rota:', hash, err);
        container.innerHTML = emptyState('Erro ao carregar página.');
      }
    }
  }

  // Listen to hash changes and handle initial route
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}
