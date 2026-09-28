/**
 * UI Helper functions for Materials Control
 */

/**
 * Escapes HTML characters to prevent XSS.
 * @param {string|number|null|undefined} str
 * @returns {string}
 */
export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Shows a toast message on the bottom-right corner.
 * @param {string} msg
 * @param {'info'|'success'|'warning'|'error'} [tipo='info']
 * @param {number} [duration=4000]
 */
export function toast(msg, tipo = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${tipo}`;
  toastEl.textContent = msg;

  container.appendChild(toastEl);

  setTimeout(() => {
    toastEl.remove();
    if (container.children.length === 0) {
      container.remove();
    }
  }, duration);
}

/**
 * Opens a accessible modal dialog.
 * @param {Object} options
 * @param {string} options.title
 * @param {string|HTMLElement} options.body
 * @param {Array<{text: string, class?: string, onClick: (closeModal: () => void) => void}>} [options.actions]
 */
export function openModal({ title, body, actions = [] }) {
  const existingModal = document.querySelector('.modal-backdrop');
  if (existingModal) existingModal.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('h3');
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-secondary btn-sm';
  closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  closeBtn.setAttribute('aria-label', 'Fechar');

  const closeModal = () => {
    backdrop.classList.remove('active');
    setTimeout(() => backdrop.remove(), 200);
    document.removeEventListener('keydown', handleKeydown);
  };

  closeBtn.addEventListener('click', closeModal);
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  } else if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  }

  modal.appendChild(header);
  modal.appendChild(bodyEl);

  if (actions && actions.length > 0) {
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = action.class || 'btn btn-secondary';
      btn.textContent = action.text;
      btn.addEventListener('click', () => {
        if (action.onClick) {
          action.onClick(closeModal);
        } else {
          closeModal();
        }
      });
      footer.appendChild(btn);
    });

    modal.appendChild(footer);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Trigger animation
  requestAnimationFrame(() => {
    backdrop.classList.add('active');
  });

  const handleKeydown = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', handleKeydown);

  return closeModal;
}

/**
 * Formats date string to dd/mm/aaaa
 * @param {string|Date} dateVal
 * @returns {string}
 */
export function formatDate(dateVal) {
  if (!dateVal) return '-';
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
    const [year, month, day] = dateVal.trim().split('-');
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Formats date string to dd/mm/aaaa hh:mm
 * @param {string|Date} dateVal
 * @returns {string}
 */
export function formatDateTime(dateVal) {
  if (!dateVal) return '-';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formats number to Portuguese real currency format (R$ 1.234,56)
 * @param {number} val
 * @returns {string}
 */
export function formatMoney(val) {
  if (val === null || val === undefined || isNaN(val)) return 'R$ 0,00';
  return Number(val).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

/**
 * Generates status badge HTML with appropriate class and safe text
 * @param {string} status
 * @returns {string}
 */
export function statusBadge(status) {
  if (!status) return '';
  const normalized = String(status).toLowerCase().replace(/_/g, '-');
  return `<span class="status-badge status-${esc(normalized)}">${esc(status)}</span>`;
}

/**
 * Generates empty state HTML component
 * @param {string} msg
 * @returns {string}
 */
export function emptyState(msg) {
  return `
    <div class="empty-state">
      <span class="material-symbols-outlined empty-icon">inbox</span>
      <p class="text-body">${esc(msg)}</p>
    </div>
  `;
}

/**
 * Paginates an array list
 * @param {Array} lista
 * @param {number} pagina - 1-indexed
 * @param {number} [tamanho=25]
 * @returns {{ data: Array, total: number, page: number, totalPages: number }}
 */
export function paginate(lista = [], pagina = 1, tamanho = 25) {
  const total = lista.length;
  const totalPages = Math.ceil(total / tamanho) || 1;
  const currPage = Math.max(1, Math.min(pagina, totalPages));
  const start = (currPage - 1) * tamanho;
  const data = lista.slice(start, start + tamanho);

  return {
    data,
    total,
    page: currPage,
    totalPages
  };
}
