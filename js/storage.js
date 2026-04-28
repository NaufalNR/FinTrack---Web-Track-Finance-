/* =========================================
   FINTRACK — STORAGE MODULE
   Handles all localStorage operations
   ========================================= */

const Storage = (() => {
  const KEY = "fintrack_transactions";

  /** Load all transactions from localStorage */
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  }

  /** Save full array to localStorage */
  function save(transactions) {
    localStorage.setItem(KEY, JSON.stringify(transactions));
  }

  /** Add a new transaction */
  function add(tx) {
    const list = load();
    list.unshift(tx); // newest first
    save(list);
    return list;
  }

  /** Delete transaction by ID */
  function remove(id) {
    const list = load().filter((t) => t.id !== id);
    save(list);
    return list;
  }

  /** Get a single transaction by ID */
  function getById(id) {
    return load().find((t) => t.id === id);
  }

  /** Clear all data */
  function clear() {
    localStorage.removeItem(KEY);
  }

  return { load, save, add, remove, getById, clear };
})();
