const storageKey = "smart-budget-transactions";
const form = document.getElementById("transaction-form");
const typeField = document.getElementById("type");
const categoryField = document.getElementById("category");
const amountField = document.getElementById("amount");
const dateField = document.getElementById("date");
const noteField = document.getElementById("note");
const tbody = document.getElementById("transaction-body");
const template = document.getElementById("transaction-row-template");
const balanceAmount = document.getElementById("balance-amount");
const balanceTrend = document.getElementById("balance-trend");
const incomeAmount = document.getElementById("income-amount");
const expenseAmount = document.getElementById("expense-amount");
const transactionCount = document.getElementById("transaction-count");
const filterTypeField = document.getElementById("filter-type");
const filterMonthField = document.getElementById("filter-month");
const searchField = document.getElementById("search");
const resetFiltersBtn = document.getElementById("reset-filters");
const editDialog = document.getElementById("edit-dialog");
const editForm = document.getElementById("edit-form");
const editTypeField = document.getElementById("edit-type");
const editCategoryField = document.getElementById("edit-category");
const editAmountField = document.getElementById("edit-amount");
const editDateField = document.getElementById("edit-date");
const editNoteField = document.getElementById("edit-note");

let transactions = loadTransactions();
let filters = {
  type: "all",
  month: "",
  search: ""
};
let editingId = null;

const generateId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

initialize();

function initialize() {
  dateField.value = new Date().toISOString().slice(0, 10);
  render();
  form.addEventListener("submit", handleFormSubmit);
  filterTypeField.addEventListener("change", handleFilterChange);
  filterMonthField.addEventListener("change", handleFilterChange);
  searchField.addEventListener("input", handleFilterChange);
  resetFiltersBtn.addEventListener("click", resetFilters);
  tbody.addEventListener("click", handleRowAction);
  editDialog.addEventListener("close", handleEditDialogClose);
  editForm.addEventListener("submit", handleEditSubmit);
  if (editDialog && typeof editDialog.showModal !== "function") {
    editDialog.dataset.unusable = "true";
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Please enter a valid positive amount.");
    return;
  }
  const transaction = {
    id: generateId(),
    type: formData.get("type"),
    category: formData.get("category").trim(),
    amount,
    date: formData.get("date"),
    note: (formData.get("note") || "").trim(),
    createdAt: new Date().toISOString()
  };
  transactions.push(transaction);
  persistTransactions();
  form.reset();
  dateField.value = transaction.date;
  typeField.value = "income";
  render();
}

function handleRowAction(event) {
  const actionButton = event.target.closest("button[data-action]");
  if (!actionButton) {
    return;
  }
  const row = actionButton.closest("tr");
  const id = row?.dataset.id;
  if (!id) {
    return;
  }
  if (actionButton.dataset.action === "delete") {
    const label = row.querySelector('[data-col="category"]').textContent;
    if (confirm(`Delete the transaction "${label}"?`)) {
      transactions = transactions.filter((item) => item.id !== id);
      persistTransactions();
      render();
    }
  }
  if (actionButton.dataset.action === "edit") {
    openEditDialog(id);
  }
}

function handleFilterChange() {
  filters = {
    type: filterTypeField.value,
    month: filterMonthField.value,
    search: searchField.value.trim().toLowerCase()
  };
  renderTransactions();
  updateCount();
}

function resetFilters() {
  filterTypeField.value = "all";
  filterMonthField.value = "";
  searchField.value = "";
  filters = {
    type: "all",
    month: "",
    search: ""
  };
  renderTransactions();
  updateCount();
}

function openEditDialog(id) {
  const transaction = transactions.find((item) => item.id === id);
  if (!transaction) {
    return;
  }
  editingId = id;
  editTypeField.value = transaction.type;
  editCategoryField.value = transaction.category;
  editAmountField.value = transaction.amount;
  editDateField.value = transaction.date;
  editNoteField.value = transaction.note;
  if (editDialog.dataset.unusable === "true") {
    alert("Your browser does not support the edit dialog. Please delete and recreate the transaction instead.");
    editingId = null;
    return;
  }
  editDialog.returnValue = "cancel";
  editDialog.showModal();
}

function handleEditSubmit(event) {
  event.preventDefault();
  if (!editingId) {
    editDialog.close();
    return;
  }
  const amount = Number(editAmountField.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Please enter a valid positive amount.");
    return;
  }
  transactions = transactions.map((item) => {
    if (item.id !== editingId) {
      return item;
    }
    return {
      ...item,
      type: editTypeField.value,
      category: editCategoryField.value.trim(),
      amount,
      date: editDateField.value,
      note: editNoteField.value.trim()
    };
  });
  persistTransactions();
  editingId = null;
  editDialog.close("confirm");
}

function handleEditDialogClose() {
  editingId = null;
  render();
}

function render() {
  renderSummary();
  renderTransactions();
  updateCount();
}

function renderSummary() {
  const totals = transactions.reduce(
    (acc, item) => {
      if (item.type === "income") {
        acc.income += item.amount;
      } else {
        acc.expense += item.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const balance = totals.income - totals.expense;
  incomeAmount.textContent = formatCurrency(totals.income);
  expenseAmount.textContent = formatCurrency(totals.expense);
  balanceAmount.textContent = formatCurrency(balance);
  balanceTrend.textContent = buildTrendMessage();
}

function renderTransactions() {
  tbody.innerHTML = "";
  const filtered = applyFilters();
  if (!filtered.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "empty-row";
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 6;
    emptyCell.textContent = "No transactions match the current filters.";
    emptyRow.appendChild(emptyCell);
    tbody.appendChild(emptyRow);
    return;
  }
  filtered.forEach((item) => {
    const row = template.content.firstElementChild.cloneNode(true);
    row.dataset.id = item.id;
    row.classList.add(`${item.type}-row`);
    row.querySelector('[data-col="date"]').textContent = formatDate(item.date);
    row.querySelector('[data-col="type"]').textContent = item.type === "income" ? "Income" : "Expense";
    row.querySelector('[data-col="category"]').textContent = item.category;
    row.querySelector('[data-col="note"]').textContent = item.note || "—";
    row.querySelector('[data-col="amount"]').textContent = formatCurrency(item.amount);
    tbody.appendChild(row);
  });
}

function updateCount() {
  const count = applyFilters().length;
  if (!count) {
    transactionCount.textContent = "";
    return;
  }
  transactionCount.textContent = `${count} transaction${count === 1 ? "" : "s"}`;
}

function applyFilters() {
  return transactions
    .slice()
    .sort((a, b) => {
      if (a.date === b.date) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      return new Date(b.date) - new Date(a.date);
    })
    .filter((item) => {
      if (filters.type !== "all" && item.type !== filters.type) {
        return false;
      }
      if (filters.month) {
        const monthKey = item.date.slice(0, 7);
        if (monthKey !== filters.month) {
          return false;
        }
      }
      if (filters.search) {
        const haystack = `${item.category} ${item.note}`.toLowerCase();
        if (!haystack.includes(filters.search)) {
          return false;
        }
      }
      return true;
    });
}

function buildTrendMessage() {
  if (!transactions.length) {
    return "Add your first transaction to see balance trends.";
  }
  const monthlyTotals = transactions.reduce((acc, item) => {
    const key = item.date.slice(0, 7);
    if (!acc[key]) {
      acc[key] = { income: 0, expense: 0 };
    }
    if (item.type === "income") {
      acc[key].income += item.amount;
    } else {
      acc[key].expense += item.amount;
    }
    return acc;
  }, {});
  const months = Object.keys(monthlyTotals).sort();
  if (!months.length) {
    return "";
  }
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
  const current = monthlyTotals[currentKey] || { income: 0, expense: 0 };
  const prev = monthlyTotals[previousKey] || { income: 0, expense: 0 };
  const currentBalance = current.income - current.expense;
  const prevBalance = prev.income - prev.expense;
  const delta = currentBalance - prevBalance;
  if (delta === 0) {
    return "Balance matches last month.";
  }
  const direction = delta > 0 ? "up" : "down";
  return `Balance is ${direction} ${formatCurrency(Math.abs(delta))} vs last month.`;
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.filter(validateTransaction);
  } catch (_) {
    return [];
  }
}

function persistTransactions() {
  localStorage.setItem(storageKey, JSON.stringify(transactions));
}

function validateTransaction(item) {
  return (
    item &&
    typeof item.id === "string" &&
    (item.type === "income" || item.type === "expense") &&
    typeof item.category === "string" &&
    typeof item.note === "string" &&
    typeof item.date === "string" &&
    typeof item.amount === "number" &&
    Number.isFinite(item.amount) &&
    item.amount >= 0
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatDate(value) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  return formatter.format(new Date(value));
}
