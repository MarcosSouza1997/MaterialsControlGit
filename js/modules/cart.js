/**
 * Cart Module - In-memory shopping cart management for Materials Control
 */

import { toast } from '../ui.js';

let cartItems = [];
const listeners = new Set();

/**
 * Notifies registered listeners when cart changes
 */
function notify() {
  listeners.forEach(fn => fn(cartItems));
}

/**
 * Subscribes a listener function to cart changes
 * @param {Function} fn
 * @returns {Function} Unsubscribe function
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Returns current cart items
 * @returns {Array} Copy of cart items
 */
export function getItems() {
  return [...cartItems];
}

/**
 * Adds an item to the cart or increments quantity
 * @param {Object} item - Item object from vw_stock_overview
 * @param {number} [quantity=1]
 */
export function addItem(item, quantity = 1) {
  if (!item || !item.id) return;

  const available = item.available_quantity || 0;
  if (available <= 0) {
    toast('Item sem estoque disponível.', 'warning');
    return;
  }

  const existingIndex = cartItems.findIndex(i => i.id === item.id);

  if (existingIndex >= 0) {
    const newQty = cartItems[existingIndex].quantity + quantity;
    if (newQty > available) {
      toast(`Quantidade máxima disponível (${available}) atingida.`, 'warning');
      cartItems[existingIndex].quantity = available;
    } else {
      cartItems[existingIndex].quantity = newQty;
      toast(`Quantidade de "${item.name}" atualizada no carrinho.`, 'info');
    }
  } else {
    const initialQty = Math.min(quantity, available);
    cartItems.push({
      ...item,
      quantity: initialQty
    });
    toast(`"${item.name}" adicionado à requisição.`, 'success');
  }

  notify();
}

/**
 * Updates the quantity of an item in the cart
 * @param {string} itemId
 * @param {number} quantity
 */
export function setQuantity(itemId, quantity) {
  const index = cartItems.findIndex(i => i.id === itemId);
  if (index < 0) return;

  const available = cartItems[index].available_quantity || 0;
  let newQty = parseInt(quantity, 10) || 1;

  if (newQty <= 0) {
    removeItem(itemId);
    return;
  }

  if (newQty > available) {
    newQty = available;
    toast(`Quantidade limitada ao estoque disponível (${available}).`, 'warning');
  }

  cartItems[index].quantity = newQty;
  notify();
}

/**
 * Removes an item from the cart
 * @param {string} itemId
 */
export function removeItem(itemId) {
  const index = cartItems.findIndex(i => i.id === itemId);
  if (index >= 0) {
    const removed = cartItems[index];
    cartItems.splice(index, 1);
    toast(`"${removed.name}" removido da requisição.`, 'info');
    notify();
  }
}

/**
 * Clears all items from the cart
 */
export function clear() {
  cartItems = [];
  notify();
}
