import { supabase } from './supabase.js';
import { getCurrentSession, logout } from './auth.js';

export const state = {
  session: null,
  profile: null,
};

export async function loadUserProfile() {
  if (!supabase) return null;

  const session = await getCurrentSession();
  if (!session) return null;

  state.session = session;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    console.error('Erro ao carregar perfil:', error);
    return null;
  }

  if (profile.active === false) {
    alert('Sua conta está desativada. Entre em contato com o Gestor de TI.');
    await logout();
    return null;
  }

  state.profile = profile;
  return profile;
}

export async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }

  const profile = await loadUserProfile();
  if (!profile) {
    window.location.href = 'index.html';
    return null;
  }

  return profile;
}

export function requireRole(...allowedRoles) {
  if (!state.profile) {
    console.warn('Perfil não carregado no estado global.');
    return false;
  }

  if (!allowedRoles.includes(state.profile.role)) {
    return false;
  }

  return true;
}
