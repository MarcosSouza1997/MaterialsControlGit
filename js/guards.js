import { getSession, loadProfile } from './auth.js';

/**
 * Route protection guard for authenticated pages (e.g. app.html).
 * Verifies if user has a valid active session and active profile.
 * If user is not authenticated or profile is inactive, redirects to index.html.
 * @returns {Promise<Object>} Profile object of authenticated active user.
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session || !session.user) {
    window.location.href = 'index.html';
    return null;
  }

  const profile = await loadProfile(session.user.id);

  if (!profile || profile.active === false) {
    window.location.href = 'index.html';
    return null;
  }

  return profile;
}
