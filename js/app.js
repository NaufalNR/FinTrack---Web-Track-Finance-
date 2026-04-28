/* =========================================
   FINTRACK — MAIN APP
   Core logic: CRUD, UI, routing, export
   ========================================= */

// ─── CONSTANTS ───────────────────────────
const CATEGORIES = {
  expense: [
    { id: "makan", label: "🍜 Makan & Minum" },
    { id: "transport", label: "🚗 Transport" },
    { id: "belanja", label: "🛍️ Belanja" },
    { id: "tagihan", label: "💡 Tagihan" },
    { id: "hiburan", label: "🎬 Hiburan" },
    { id: "kesehatan", label: "💊 Kesehatan" },
    { id: "pendidikan", label: "📚 Pendidikan" },
    { id: "lainnya", label: "📦 Lainnya" },
  ],
  income: [
    { id: "gaji", label: "💼 Gaji" },
    { id: "freelance", label: "💻 Freelance" },
    { id: "bisnis", label: "📈 Bisnis" },
    { id: "investasi", label: "💰 Investasi" },
    { id: "bonus", label: "🎁 Bonus" },
    { id: "lainnya", label: "📦 Lainnya" },
  ],
};

const CAT_EMOJI = Object.fromEntries(
  [...CATEGORIES.expense, ...CATEGORIES.income].map((c) => [
    c.id,
    c.label.split(" ")[0],
  ]),
);

// ─── STATE ───────────────────────────────
let state = {
  transactions: [],
  currentType: "expense",
  activeSection: "dashboard",
  deleteId: null,
  deleteMode: "single", // 'single' | 'bulk'
  selectedIds: new Set(),
  filterMonth: "all",
  filterCategory: "all",
  filterType: "all",
  searchQuery: "",
};

// ─── DOM REFS ────────────────────────────
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── INIT ────────────────────────────────
function init() {
  state.transactions = Storage.load();
  setupDate();
  setupNav();
  setupForm();
  setupFilters();
  setupExport();
  setupMobile();
  setupModal();
  setupBulkDelete();
  populateMonthFilter();
  render();
}

// ─── DATE ────────────────────────────────
function setupDate() {
  const today = new Date();
  $("dateDisplay").textContent = today.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Default date input to today
  const iso = today.toISOString().slice(0, 10);
  $("dateInput").value = iso;
  $("dateInput").max = iso;
}

// ─── NAVIGATION ──────────────────────────
function setupNav() {
  $$(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      navigateTo(section);
      closeSidebar();
    });
  });

  document.querySelectorAll(".see-all").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(e.target.dataset.section);
    });
  });
}

function navigateTo(section) {
  state.activeSection = section;

  $$(".section").forEach((s) => s.classList.remove("active"));
  $$(".nav-item").forEach((n) => n.classList.remove("active"));

  $(`section-${section}`)?.classList.add("active");
  document
    .querySelector(`.nav-item[data-section="${section}"]`)
    ?.classList.add("active");

  if (section === "analytics") {
    // Use double rAF so the section is fully painted before Chart.js reads canvas size
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ChartManager.updateAll(getFilteredTransactions());
      });
    });
  }
}

// ─── FORM ────────────────────────────────
function setupForm() {
  // Type toggle
  $$(".type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentType = btn.dataset.type;
      $$(".type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      updateCategoryOptions();
      updateSubmitBtn();
    });
  });

  // Form submit
  $("transactionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addTransaction();
  });

  updateCategoryOptions();
}

function updateCategoryOptions() {
  const cats = CATEGORIES[state.currentType];
  const sel = $("categoryInput");
  sel.innerHTML =
    `<option value="">Pilih kategori...</option>` +
    cats.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
}

function updateSubmitBtn() {
  const btn = $("submitBtn");
  if (state.currentType === "income") {
    btn.textContent = "+ Tambah Pemasukan";
    btn.classList.add("income-mode");
  } else {
    btn.textContent = "+ Tambah Pengeluaran";
    btn.classList.remove("income-mode");
  }
}

function addTransaction() {
  const desc = $("descInput").value.trim();
  const amount = parseFloat($("amountInput").value);
  const cat = $("categoryInput").value;
  const date = $("dateInput").value;

  if (!desc || !amount || amount <= 0 || !cat || !date) {
    showToast("Mohon lengkapi semua field!", "error");
    return;
  }

  const tx = {
    id: crypto.randomUUID(),
    desc,
    amount,
    category: cat,
    type: state.currentType,
    date,
    createdAt: Date.now(),
  };

  state.transactions = Storage.add(tx);
  populateMonthFilter();
  render();

  // Reset form (keep type & date)
  $("descInput").value = "";
  $("amountInput").value = "";
  $("categoryInput").value = "";

  showToast(
    `${state.currentType === "income" ? "Pemasukan" : "Pengeluaran"} ditambahkan!`,
    "success",
  );
}

// ─── FILTERS ─────────────────────────────
function setupFilters() {
  $("searchInput").addEventListener("input", (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    renderTransactionList();
  });

  $("categoryFilter").addEventListener("change", (e) => {
    state.filterCategory = e.target.value;
    renderTransactionList();
  });

  $("typeFilter").addEventListener("change", (e) => {
    state.filterType = e.target.value;
    renderTransactionList();
  });

  $("monthFilter").addEventListener("change", (e) => {
    state.filterMonth = e.target.value;
    $("monthFilterMobile").value = e.target.value;
    render();
  });

  $("monthFilterMobile").addEventListener("change", (e) => {
    state.filterMonth = e.target.value;
    $("monthFilter").value = e.target.value;
    render();
  });
}

function populateMonthFilter() {
  const months = new Set();
  state.transactions.forEach((t) => months.add(t.date.slice(0, 7)));

  const sorted = [...months].sort().reverse();
  const baseOpt = `<option value="all">Semua Waktu</option>`;
  const opts = sorted
    .map((m) => {
      const [y, mo] = m.split("-");
      const label = new Date(+y, +mo - 1).toLocaleString("id-ID", {
        month: "long",
        year: "numeric",
      });
      return `<option value="${m}" ${state.filterMonth === m ? "selected" : ""}>${label}</option>`;
    })
    .join("");

  [$("monthFilter"), $("monthFilterMobile")].forEach((el) => {
    el.innerHTML = baseOpt + opts;
    el.value = state.filterMonth;
  });

  // Category filter
  const cats = new Set(state.transactions.map((t) => t.category));
  const allCats = [...CATEGORIES.expense, ...CATEGORIES.income];
  $("categoryFilter").innerHTML =
    `<option value="all">Semua Kategori</option>` +
    allCats
      .filter((c) => cats.has(c.id))
      .map((c) => `<option value="${c.id}">${c.label}</option>`)
      .join("");
}

function getFilteredTransactions() {
  return state.transactions.filter((t) => {
    const monthOk =
      state.filterMonth === "all" || t.date.startsWith(state.filterMonth);
    return monthOk;
  });
}

function getSearchFilteredTransactions() {
  return getFilteredTransactions().filter((t) => {
    const q = state.searchQuery;
    const typeOk = state.filterType === "all" || t.type === state.filterType;
    const catOk =
      state.filterCategory === "all" || t.category === state.filterCategory;
    const searchOk =
      !q || t.desc.toLowerCase().includes(q) || t.category.includes(q);
    return typeOk && catOk && searchOk;
  });
}

// ─── RENDER ──────────────────────────────
function render() {
  const filtered = getFilteredTransactions();
  renderSummary();
  renderRecentList();
  renderTransactionList();
  renderBreakdown(filtered); // always update breakdown independently

  if (state.activeSection === "analytics") {
    ChartManager.updateAll(filtered);
  }
}

function renderSummary() {
  const txs = getFilteredTransactions();

  const income = txs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = txs
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const ratio =
    income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  animateValue($("incomeDisplay"), income);
  animateValue($("expenseDisplay"), expense);
  animateValue($("balanceDisplay"), balance);

  $("savingRatio").textContent = Math.max(0, ratio) + "%";
  $("savingProgress").style.width = Math.min(100, Math.max(0, ratio)) + "%";

  // Balance trend color
  const balEl = $("balanceDisplay").closest(".card");
  if (balance > 0) {
    balEl.classList.add("balance-positive");
    $("balanceTrend").textContent = `↑ Saldo positif`;
    $("balanceTrend").style.color = "var(--green)";
  } else if (balance < 0) {
    balEl.classList.remove("balance-positive");
    $("balanceTrend").textContent =
      `↓ Defisit ${formatRupiah(Math.abs(balance))}`;
    $("balanceTrend").style.color = "var(--red)";
  } else {
    balEl.classList.remove("balance-positive");
    $("balanceTrend").textContent = `— Impas`;
    $("balanceTrend").style.color = "var(--text-3)";
  }
}

function renderRecentList() {
  const txs = getFilteredTransactions().slice(0, 5);
  const el = $("recentList");
  const empty = $("emptyRecent");

  if (!txs.length) {
    empty.style.display = "block";
    el.querySelectorAll(".transaction-item").forEach((e) => e.remove());
    return;
  }
  empty.style.display = "none";

  el.querySelectorAll(".transaction-item").forEach((e) => e.remove());
  txs.forEach((t) => el.appendChild(createTxElement(t)));
}

function renderTransactionList() {
  const txs = getSearchFilteredTransactions();
  const el = $("fullList");
  const empty = $("emptyFull");

  el.querySelectorAll(".transaction-item").forEach((e) => e.remove());

  // Show/hide list header
  const listHeader = $("listHeader");
  if (txs.length) {
    listHeader.classList.add("visible");
    $("listHeaderCount").textContent = `${txs.length} transaksi`;
  } else {
    listHeader.classList.remove("visible");
  }

  // Selection mode class on fullList
  if (state.selectedIds.size > 0) {
    el.classList.add("selection-mode");
  } else {
    el.classList.remove("selection-mode");
  }

  if (!txs.length) {
    empty.style.display = "block";
    updateBulkBar();
    return;
  }
  empty.style.display = "none";
  txs.forEach((t) => el.appendChild(createTxElement(t, true)));
  updateBulkBar();
  updateSelectAllState();
}

function renderBreakdown(txs) {
  const expenses = txs.filter((t) => t.type === "expense");
  const total = expenses.reduce((s, t) => s + t.amount, 0);

  const catMap = {};
  expenses.forEach((t) => {
    catMap[t.category] = (catMap[t.category] || 0) + t.amount;
  });

  const colors = [
    "#e8c97d",
    "#4ade80",
    "#f87171",
    "#60a5fa",
    "#a78bfa",
    "#fb923c",
    "#34d399",
    "#f472b6",
  ];
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  const el = $("breakdownList");
  if (!el) return;

  el.innerHTML = sorted
    .map(([cat, amt], i) => {
      const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
      const emoji = CAT_EMOJI[cat] || "📦";
      const color = colors[i % colors.length];
      return `
      <div class="breakdown-item">
        <div class="breakdown-dot" style="background:${color}"></div>
        <div class="breakdown-label">${emoji} ${capitalize(cat)}</div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="breakdown-pct">${pct}%</div>
        <div class="breakdown-amt">${formatRupiah(amt)}</div>
      </div>
    `;
    })
    .join("");
}

// ─── TRANSACTION ELEMENT ─────────────────
function createTxElement(tx, showCheckbox = false) {
  const div = document.createElement("div");
  div.className =
    "transaction-item" + (state.selectedIds.has(tx.id) ? " selected" : "");
  div.dataset.id = tx.id;

  const emoji = CAT_EMOJI[tx.category] || "📦";
  const sign = tx.type === "income" ? "+" : "-";
  const dateStr = new Date(tx.date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const checkboxHtml = showCheckbox
    ? `
    <div class="tx-checkbox-wrap">
      <input type="checkbox" class="tx-checkbox" id="chk-${tx.id}" data-id="${tx.id}"
             ${state.selectedIds.has(tx.id) ? "checked" : ""} />
      <label for="chk-${tx.id}" class="tx-checkbox-label"></label>
    </div>
  `
    : "";

  div.innerHTML = `
    ${checkboxHtml}
    <div class="tx-icon ${tx.type}">${emoji}</div>
    <div class="tx-info">
      <div class="tx-desc">${escapeHtml(tx.desc)}</div>
      <div class="tx-meta">
        <span>${dateStr}</span>
        <span class="tx-cat">${capitalize(tx.category)}</span>
      </div>
    </div>
    <div class="tx-amount ${tx.type}">${sign}${formatRupiah(tx.amount)}</div>
    <button class="tx-delete" data-id="${tx.id}" title="Hapus">✕</button>
  `;

  // Single delete button
  div.querySelector(".tx-delete").addEventListener("click", (e) => {
    e.stopPropagation();
    confirmDelete(tx.id, "single");
  });

  // Checkbox change
  if (showCheckbox) {
    const chk = div.querySelector(".tx-checkbox");
    chk.addEventListener("change", () => {
      toggleSelection(tx.id, chk.checked);
    });

    // Clicking the row (not button) toggles checkbox
    div.addEventListener("click", (e) => {
      if (
        e.target.closest(".tx-delete") ||
        e.target.closest(".tx-checkbox-wrap")
      )
        return;
      const isChecked = !chk.checked;
      chk.checked = isChecked;
      toggleSelection(tx.id, isChecked);
    });
    div.style.cursor = "pointer";
  }

  return div;
}

// ─── DELETE ──────────────────────────────
function confirmDelete(id, mode = "single") {
  state.deleteMode = mode;
  state.deleteId = id;

  if (mode === "bulk") {
    const count = state.selectedIds.size;
    $("modalIcon").textContent = "🗑";
    $("modalTitle").textContent = `Hapus ${count} Transaksi?`;
    $("modalDesc").textContent =
      `${count} transaksi yang dipilih akan dihapus permanen.`;
  } else {
    $("modalIcon").textContent = "⚠";
    $("modalTitle").textContent = "Hapus Transaksi?";
    $("modalDesc").textContent = "Tindakan ini tidak dapat dibatalkan.";
  }

  $("modalOverlay").classList.add("show");
}

function setupModal() {
  $("modalCancel").addEventListener("click", () => {
    $("modalOverlay").classList.remove("show");
    state.deleteId = null;
    state.deleteMode = "single";
  });

  $("modalConfirm").addEventListener("click", () => {
    if (state.deleteMode === "bulk") {
      executeBulkDelete();
    } else {
      executeSingleDelete();
    }
    $("modalOverlay").classList.remove("show");
  });

  $("modalOverlay").addEventListener("click", (e) => {
    if (e.target === $("modalOverlay")) {
      $("modalOverlay").classList.remove("show");
      state.deleteId = null;
      state.deleteMode = "single";
    }
  });
}

function executeSingleDelete() {
  if (!state.deleteId) return;
  const el = document.querySelector(
    `.transaction-item[data-id="${state.deleteId}"]`,
  );
  if (el) {
    el.classList.add("removing");
    setTimeout(() => el.remove(), 250);
  }
  // Remove from selection if selected
  state.selectedIds.delete(state.deleteId);
  state.transactions = Storage.remove(state.deleteId);
  state.deleteId = null;
  populateMonthFilter();
  render();
  showToast("Transaksi dihapus", "error");
}

function executeBulkDelete() {
  const ids = [...state.selectedIds];
  const count = ids.length;

  // Animate out all selected items
  ids.forEach((id) => {
    const el = document.querySelector(`.transaction-item[data-id="${id}"]`);
    if (el) {
      el.classList.add("removing");
      setTimeout(() => el.remove(), 250);
    }
  });

  // Delete from storage
  ids.forEach((id) => {
    state.transactions = Storage.remove(id);
  });

  // Clear selection
  state.selectedIds.clear();
  state.deleteId = null;

  setTimeout(() => {
    populateMonthFilter();
    render();
  }, 260);

  showToast(`${count} transaksi berhasil dihapus`, "error");
}

// ─── BULK DELETE SETUP ───────────────────
function setupBulkDelete() {
  // Select All (in bulk bar)
  $("selectAll").addEventListener("change", (e) => {
    const txs = getSearchFilteredTransactions();
    if (e.target.checked) {
      txs.forEach((t) => state.selectedIds.add(t.id));
    } else {
      state.selectedIds.clear();
    }
    renderTransactionList();
  });

  // Select All (inline list header)
  $("selectAllInline").addEventListener("change", (e) => {
    const txs = getSearchFilteredTransactions();
    if (e.target.checked) {
      txs.forEach((t) => state.selectedIds.add(t.id));
    } else {
      state.selectedIds.clear();
    }
    renderTransactionList();
  });

  // Deselect all button
  $("deselectAllBtn").addEventListener("click", () => {
    state.selectedIds.clear();
    renderTransactionList();
  });

  // Bulk delete button
  $("bulkDeleteBtn").addEventListener("click", () => {
    if (state.selectedIds.size === 0) return;
    confirmDelete(null, "bulk");
  });
}

function toggleSelection(id, selected) {
  if (selected) {
    state.selectedIds.add(id);
  } else {
    state.selectedIds.delete(id);
  }
  updateBulkBar();
  updateSelectAllState();

  // Update item class without full re-render
  const el = document.querySelector(`.transaction-item[data-id="${id}"]`);
  if (el) {
    el.classList.toggle("selected", selected);
  }
  const fullList = $("fullList");
  if (state.selectedIds.size > 0) {
    fullList.classList.add("selection-mode");
  } else {
    fullList.classList.remove("selection-mode");
  }
}

function updateBulkBar() {
  const count = state.selectedIds.size;
  const bar = $("bulkBar");

  if (count > 0) {
    bar.classList.add("visible");
    $("bulkCount").textContent = `${count} dipilih`;
  } else {
    bar.classList.remove("visible");
  }
}

function updateSelectAllState() {
  const txs = getSearchFilteredTransactions();
  const total = txs.length;
  const selected = txs.filter((t) => state.selectedIds.has(t.id)).length;

  [$("selectAll"), $("selectAllInline")].forEach((chk) => {
    if (!chk) return;
    if (selected === 0) {
      chk.checked = false;
      chk.indeterminate = false;
    } else if (selected === total) {
      chk.checked = true;
      chk.indeterminate = false;
    } else {
      chk.checked = false;
      chk.indeterminate = true;
    }
  });
}
function setupExport() {
  $("exportBtn").addEventListener("click", exportCSV);
}

function exportCSV() {
  const txs = getFilteredTransactions();
  if (!txs.length) {
    showToast("Tidak ada data untuk diexport", "error");
    return;
  }

  const header = ["Tanggal", "Deskripsi", "Tipe", "Kategori", "Jumlah (Rp)"];
  const rows = txs.map((t) => [
    t.date,
    `"${t.desc.replace(/"/g, '""')}"`,
    t.type === "income" ? "Pemasukan" : "Pengeluaran",
    capitalize(t.category),
    t.amount,
  ]);

  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `fintrack_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast(`${txs.length} transaksi berhasil diexport!`, "success");
}

// ─── MOBILE SIDEBAR ──────────────────────
function setupMobile() {
  // Create backdrop
  const backdrop = document.createElement("div");
  backdrop.className = "sidebar-backdrop";
  backdrop.id = "sidebarBackdrop";
  document.body.appendChild(backdrop);

  $("hamburger").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
    backdrop.classList.toggle("show");
  });

  backdrop.addEventListener("click", closeSidebar);
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebarBackdrop")?.classList.remove("show");
}

// ─── HELPERS ─────────────────────────────
function formatRupiah(n) {
  return "Rp " + Number(n).toLocaleString("id-ID");
}

function animateValue(el, value) {
  el.textContent = formatRupiah(value);
  el.classList.remove("updated");
  void el.offsetWidth; // reflow
  el.classList.add("updated");
}

function showToast(msg, type = "success") {
  const toast = $("toast");
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── SAMPLE DATA (first run) ─────────────
function seedSampleData() {
  if (state.transactions.length > 0) return;

  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const ago = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return fmt(d);
  };

  const samples = [
    {
      desc: "Gaji Bulan Ini",
      amount: 5000000,
      type: "income",
      category: "gaji",
      date: ago(20),
    },
    {
      desc: "Makan Siang Warteg",
      amount: 25000,
      type: "expense",
      category: "makan",
      date: ago(1),
    },
    {
      desc: "Freelance Project",
      amount: 1500000,
      type: "income",
      category: "freelance",
      date: ago(5),
    },
    {
      desc: "Grab Ke Kantor",
      amount: 35000,
      type: "expense",
      category: "transport",
      date: ago(2),
    },
    {
      desc: "Netflix",
      amount: 54000,
      type: "expense",
      category: "hiburan",
      date: ago(3),
    },
    {
      desc: "Belanja Bulanan",
      amount: 450000,
      type: "expense",
      category: "belanja",
      date: ago(7),
    },
    {
      desc: "Tagihan Listrik",
      amount: 180000,
      type: "expense",
      category: "tagihan",
      date: ago(10),
    },
    {
      desc: "Kopi Kenangan",
      amount: 32000,
      type: "expense",
      category: "makan",
      date: ago(1),
    },
    {
      desc: "Investasi Reksadana",
      amount: 500000,
      type: "expense",
      category: "lainnya",
      date: ago(15),
    },
    {
      desc: "Bonus Proyek",
      amount: 800000,
      type: "income",
      category: "bonus",
      date: ago(12),
    },
  ];

  samples.forEach((s) => {
    state.transactions = Storage.add({
      ...s,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    });
  });
}

// ─── BOOTSTRAP ───────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  seedSampleData();
  init();
});
