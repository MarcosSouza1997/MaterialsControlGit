import { supabase } from './supabase.js';
import { toast } from './ui.js';

/**
 * Gets the current active Supabase session.
 * @returns {Promise<Object|null>}
 */
export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Erro ao obter sessão:', error);
    return null;
  }
  return data.session;
}

/**
 * Loads profile for given user ID from profiles table.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function loadProfile(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar perfil:', error);
    toast('Erro ao carregar dados do perfil.', 'error');
    return null;
  }
  return data;
}

/**
 * Logs in with email and password.
 * Checks if profile is active. If inactive, logs out and shows activation message.
 * If active, redirects to app.html.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export async function login(email, password) {
  if (!supabase) return { success: false, message: 'Erro de conexão com o banco.' };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const errorMsg = mapAuthError(error);
    return { success: false, message: errorMsg };
  }

  const profile = await loadProfile(data.user.id);

  if (!profile || profile.active === false) {
    await supabase.auth.signOut();
    return {
      success: false,
      message: 'Conta aguardando ativação pelo gestor de TI.'
    };
  }

  window.location.href = 'app.html';
  return { success: true };
}

/**
 * Signs up a new user with full name, email and password.
 * @param {string} email
 * @param {string} password
 * @param {string} fullName
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function signUp(email, password, fullName) {
  if (!supabase) return { success: false, message: 'Erro de conexão com o banco.' };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });

  if (error) {
    const errorMsg = mapAuthError(error);
    return { success: false, message: errorMsg };
  }

  // Ensure session is closed so user doesn't log in automatically before activation
  if (data?.session) {
    await supabase.auth.signOut();
  }

  return {
    success: true,
    message: 'Conta criada. Aguarde a ativação pelo gestor de TI.'
  };
}

/**
 * Logs out current user and redirects to index.html.
 */
export async function logout() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  window.location.href = 'index.html';
}

/**
 * Maps Supabase auth error messages to friendly Portuguese strings.
 * @param {Object} error
 * @returns {string}
 */
function mapAuthError(error) {
  if (!error) return 'Ocorreu um erro inesperado.';
  const msg = error.message || '';

  if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (msg.includes('User already registered') || msg.includes('user_already_exists')) {
    return 'Este e-mail já está cadastrado.';
  }
  if (msg.includes('Password should be at least 6 characters')) {
    return 'A senha deve ter no mínimo 6 caracteres.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'E-mail não confirmado.';
  }
  if (error.status === 429) {
    return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  }

  return error.message || 'Ocorreu um erro na autenticação.';
}

/**
 * UI initialization for index.html auth page
 */
function initAuthPage() {
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');
  const alertEl = document.getElementById('auth-alert');

  if (!tabLogin || !tabSignup || !formLogin || !formSignup) {
    return; // Not on index.html or missing elements
  }

  function showAlert(msg, type = 'danger') {
    if (!alertEl) return;
    alertEl.className = `alert alert-${type}`;
    alertEl.style.display = 'flex';
    const msgEl = alertEl.querySelector('.alert-message');
    if (msgEl) msgEl.textContent = msg;
  }

  function hideAlert() {
    if (!alertEl) return;
    alertEl.style.display = 'none';
  }

  // Tab switching
  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabLogin.setAttribute('aria-selected', 'true');
    tabSignup.classList.remove('active');
    tabSignup.setAttribute('aria-selected', 'false');

    formLogin.classList.add('active');
    formSignup.classList.remove('active');
    hideAlert();
  });

  tabSignup.addEventListener('click', () => {
    tabSignup.classList.add('active');
    tabSignup.setAttribute('aria-selected', 'true');
    tabLogin.classList.remove('active');
    tabLogin.setAttribute('aria-selected', 'false');

    formSignup.classList.add('active');
    formLogin.classList.remove('active');
    hideAlert();
  });

  // Login submission
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const submitBtn = document.getElementById('btn-login-submit');

    if (!email || !password) {
      showAlert('Preencha todos os campos.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';

    const result = await login(email, password);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar';

    if (!result.success) {
      const isWarning = result.message.includes('aguardando ativação');
      showAlert(result.message, isWarning ? 'warning' : 'danger');
    }
  });

  // SignUp submission
  formSignup.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const fullName = document.getElementById('signup-fullname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const submitBtn = document.getElementById('btn-signup-submit');

    if (!fullName || !email || !password || !confirmPassword) {
      showAlert('Preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      showAlert('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      showAlert('As senhas não coincidem.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando conta...';

    const result = await signUp(email, password, fullName);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Criar Conta';

    if (result.success) {
      showAlert(result.message, 'info');
      formSignup.reset();
      toast(result.message, 'info');
    } else {
      showAlert(result.message, 'danger');
    }
  });

  // Check if session already active on opening index.html
  checkExistingSession();
}

async function checkExistingSession() {
  const session = await getSession();
  if (session && session.user) {
    const profile = await loadProfile(session.user.id);
    if (profile && profile.active) {
      window.location.href = 'app.html';
    } else if (profile && !profile.active) {
      await supabase.auth.signOut();
      const alertEl = document.getElementById('auth-alert');
      if (alertEl) {
        alertEl.className = 'alert alert-warning';
        alertEl.style.display = 'flex';
        const msgEl = alertEl.querySelector('.alert-message');
        if (msgEl) msgEl.textContent = 'Conta aguardando ativação pelo gestor de TI.';
      }
    }
  }
}

// Auto-init on DOMContentLoaded if running in index.html
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
  initAuthPage();
}
