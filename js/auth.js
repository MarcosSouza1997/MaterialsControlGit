import { supabase } from './supabase.js';

const ERROR_MESSAGES_PT_BR = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'E-mail não confirmado. Verifique sua caixa de entrada.',
  'User not found': 'Usuário não encontrado.',
  'Invalid Refresh Token': 'Sessão expirada. Por favor, faça login novamente.',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
};

export function translateErrorMessage(error) {
  if (!error) return 'Ocorreu um erro desconhecido.';
  const msg = error.message || error;
  return ERROR_MESSAGES_PT_BR[msg] || `Erro na autenticação: ${msg}`;
}

export async function login(email, password) {
  if (!supabase) {
    throw new Error('Cliente Supabase não inicializado.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(translateErrorMessage(error));
  }

  return data;
}

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function logout() {
  if (!supabase) return;
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}
