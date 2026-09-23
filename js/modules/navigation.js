/**
 * Módulo de Navegação e Menu por Papel
 */

export function setupNavigation(userRole) {
  const menuItems = document.querySelectorAll('#main-menu li[data-roles]');

  menuItems.forEach((item) => {
    const allowedRoles = item.getAttribute('data-roles').split(',').map((r) => r.trim());

    if (allowedRoles.includes(userRole)) {
      item.hidden = false;
      item.style.display = 'block';
    } else {
      item.hidden = true;
      item.style.display = 'none';
    }
  });
}
