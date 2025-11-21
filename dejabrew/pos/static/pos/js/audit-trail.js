// audit-trail.js – Fetches real data from Django API, supports filters, modal, etc.

const API_URL = "/audit/api/logs/";

// DOM refs
const tableBody = document.getElementById("tableBody");
const categoryFilter = document.getElementById("categoryFilter");
const severityFilter = document.getElementById("severityFilter");
const userFilter = document.getElementById("userFilter");
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const applyBtn = document.getElementById("applyBtn");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const shownCount = document.getElementById("shownCount");
const totalCount = document.getElementById("totalCount");
const countHigh = document.getElementById("countHigh");
const countMedium = document.getElementById("countMedium");
const countLow = document.getElementById("countLow");
const modal = document.getElementById("detailModal");
const modalContent = document.getElementById("modalContent");
const modalClose = document.getElementById("modalClose");

// Receipt Modal refs
const receiptModal = document.getElementById('receiptModal');
const receiptModalClose = document.getElementById('receiptModalClose');
const receiptContent = document.getElementById('receiptContent');

let logsData = [];

// Utility: Date formatting
function formatDateTime(ts) {
  const date = new Date(ts);
  if (isNaN(date.getTime())) return ts;
  
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: 'Asia/Manila'
  });
}

// Extract order ID from description
function extractOrderId(description) {
  const match = description.match(/Order #(\d+)/);
  return match ? match[1] : null;
}

// Map log to renderable format
function mapLogToRow(log, index) {
  const username = log.user || "Unknown";
  return {
    id: log.id || index,
    timestamp: log.timestamp,
    user: {
      initial: username.charAt(0).toUpperCase(),
      name: username,
      role: "User",
    },
    category: log.category || "System",
    action: log.action,
    description: log.description || "",
    severity: log.severity || "low",
    ip_address: log.ip_address || "N/A",
  };
}

// Populate dropdowns dynamically
function populateFilters(data) {
  const cats = [...new Set(data.map((d) => d.category))].sort();
  const users = [...new Set(data.map((d) => d.user.name))].sort();
  const severities = ["low", "medium", "high"];

  categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  cats.forEach((c) =>
    categoryFilter.insertAdjacentHTML("beforeend", `<option value="${c}">${c}</option>`)
  );

  severityFilter.innerHTML = `<option value="all">All Severities</option>`;
  severities.forEach((s) =>
    severityFilter.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`)
  );

  userFilter.innerHTML = `<option value="all">All Users</option>`;
  users.forEach((u) =>
    userFilter.insertAdjacentHTML("beforeend", `<option value="${u}">${u}</option>`)
  );
}

// Render table
function renderTable(data) {
  tableBody.innerHTML = "";
  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7">No audit logs found.</td></tr>`;
    shownCount.textContent = 0;
    totalCount.textContent = logsData.length;
    return;
  }

  data.forEach((rowData) => {
    const tr = document.createElement("tr");
    
    // Check if this is a sales-related action
    const isSalesAction = rowData.category === "sales" && rowData.action === "Process Order";
    const orderId = isSalesAction ? extractOrderId(rowData.description) : null;
    
    // Create the details button based on action type
    let detailsButton;
    if (orderId) {
      detailsButton = `<button class="view-order-btn" data-order-id="${orderId}" title="View order details">View Order</button>`;
    } else {
      detailsButton = `<button class="details-btn" data-id="${rowData.id}" title="View details"><i class="fa-regular fa-eye"></i></button>`;
    }
    
    tr.innerHTML = `
      <td>${formatDateTime(rowData.timestamp)}</td>
      <td>
        <div class="user-cell">
          <div class="user-avatar" title="${rowData.user.name}">${rowData.user.initial}</div>
          <div class="user-meta">
            <div class="uname">${rowData.user.name}</div>
            <div class="urole">${rowData.user.role}</div>
          </div>
        </div>
      </td>
      <td>${rowData.category}</td>
      <td><span class="action-tag">${rowData.action}</span></td>
      <td>${rowData.description}</td>
      <td><span class="sev ${rowData.severity}">${
      rowData.severity.charAt(0).toUpperCase() + rowData.severity.slice(1)
    }</span></td>
      <td>${detailsButton}</td>
    `;
    tableBody.appendChild(tr);
  });

  // Event listeners for regular details buttons
  document.querySelectorAll(".details-btn").forEach((btn) =>
    btn.addEventListener("click", () => openModal(btn.dataset.id))
  );
  
  // Event listeners for view order buttons
  document.querySelectorAll(".view-order-btn").forEach((btn) =>
    btn.addEventListener("click", () => openReceiptModal(btn.dataset.orderId))
  );

  shownCount.textContent = data.length;
  totalCount.textContent = logsData.length;
}

// Compute severity counts
function refreshSeverityCounts() {
  const counts = { high: 0, medium: 0, low: 0 };
  logsData.forEach((log) => {
    const sev = log.severity || "low";
    counts[sev] = (counts[sev] || 0) + 1;
  });
  countHigh.textContent = counts.high;
  countMedium.textContent = counts.medium;
  countLow.textContent = counts.low;
}

// Apply filters
function applyFilters() {
  const q = (searchInput.value || "").trim().toLowerCase();
  const cat = categoryFilter.value;
  const sev = severityFilter.value;
  const userVal = userFilter.value;
  const sDate = startDate.value ? new Date(startDate.value + "T00:00:00") : null;
  const eDate = endDate.value ? new Date(endDate.value + "T23:59:59") : null;

  const filtered = logsData.filter((row) => {
    const matchesQ =
      !q || (row.action + " " + row.description).toLowerCase().includes(q);
    const matchesCat = cat === "all" || row.category === cat;
    const matchesSev = sev === "all" || row.severity === sev;
    const matchesUser = userVal === "all" || row.user.name === userVal;

    let matchesDate = true;
    if (sDate || eDate) {
      const rowDate = new Date(row.timestamp);
      if (sDate && rowDate < sDate) matchesDate = false;
      if (eDate && rowDate > eDate) matchesDate = false;
    }

    return matchesQ && matchesCat && matchesSev && matchesUser && matchesDate;
  });

  renderTable(filtered);
}

// Clear filters
function clearFilters() {
  searchInput.value = "";
  categoryFilter.value = "all";
  severityFilter.value = "all";
  userFilter.value = "all";
  startDate.value = "";
  endDate.value = "";
  renderTable(logsData);
}

// Modal for audit details
function openModal(id) {
  const entry = logsData.find((a) => a.id == id);
  if (!entry) return;

  modalContent.innerHTML = `
    <p><strong>Timestamp:</strong> ${formatDateTime(entry.timestamp)}</p>
    <p><strong>User:</strong> ${entry.user.name}</p>
    <p><strong>Category:</strong> ${entry.category}</p>
    <p><strong>Action:</strong> ${entry.action}</p>
    <p><strong>Description:</strong> ${entry.description}</p>
    <hr/>
    <p><strong>IP Address:</strong> ${entry.ip_address}</p>
  `;
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.setAttribute("aria-hidden", "true");
  modalContent.innerHTML = "";
}

// Receipt Modal Functions
function closeReceiptModal() {
  if (receiptModal) {
    receiptModal.classList.remove('visible');
    setTimeout(() => {
      if (!receiptModal.classList.contains('visible')) {
        receiptModal.style.display = 'none';
      }
    }, 300);
  }
}

async function openReceiptModal(orderId) {
  if (!orderId) return;

  // Reset and show loading
  receiptContent.innerHTML = '<div class="receipt-header"><p>Loading order details...</p></div>';
  
  if (receiptModal) {
    receiptModal.style.display = 'flex';
    receiptModal.offsetHeight;
    receiptModal.classList.add('visible');
  }

  try {
    const response = await fetch(`/api/order/${orderId}/`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const order = await response.json();
    populateReceiptModal(order);
  } catch (error) {
    console.error('Error fetching receipt:', error);
    receiptContent.innerHTML = '<div class="receipt-header"><p style="color: red;">Could not load order details.</p></div>';
  }
}

function populateReceiptModal(order) {
  // Calculate totals
  let subtotal = 0;
  order.items.forEach(item => {
    subtotal += (item.qty * parseFloat(item.price_at_order));
  });
  
  const discountPercent = parseFloat(order.discount || 0);
  let discountAmount = 0;
  let total = subtotal;
  let vatAmount = 0;
  let vatableAmount = 0;
  let isSeniorPwd = false;
  let discountHtml = '';
  
  // --- SMART DETECTION LOGIC ---
  // Check if the saved total matches the Senior/PWD formula: (Subtotal / 1.12) * 0.8
  // This handles cases where 'discount_type' might be missing in older records
  const seniorFormulaTotal = (subtotal / 1.12) * 0.80;
  const isSeniorMath = Math.abs(order.total - seniorFormulaTotal) < 1.0;

  let discountType = order.discount_type || 'regular';
  if (discountType === 'regular' && isSeniorMath && discountPercent > 0) {
      discountType = 'senior'; // Force senior if the math matches
  }
  
  if(discountType === 'senior' || discountType === 'pwd') {
       isSeniorPwd = true;
       const vatRate = 0.12;
       vatableAmount = subtotal / (1 + vatRate);
       vatAmount = subtotal - vatableAmount;
       discountAmount = vatableAmount * 0.20;
       total = subtotal - discountAmount - vatAmount;
       
       discountHtml = `
       <div class="totals-row highlight">
          <span>
              ${discountType === 'senior' ? 'Senior Citizen' : 'PWD'} (20%)
              <span class="discount-badge">${discountType.toUpperCase()}</span>
          </span>
          <span>-₱${discountAmount.toFixed(2)}</span>
       </div>
       <div class="totals-row highlight">
          <span>VAT Exempt:</span>
          <span>-₱${vatAmount.toFixed(2)}</span>
       </div>
       ${order.discount_id ? `<div class="totals-row" style="font-size: 10px;"><span>ID: ${order.discount_id}</span><span></span></div>` : ''}
       `;
  } else {
       discountAmount = subtotal * (discountPercent / 100);
       total = subtotal - discountAmount;
       
       if (discountPercent > 0 || discountAmount > 0) {
          discountHtml = `
          <div class="totals-row">
              <span>Discount (${discountPercent}%):</span>
              <span>-₱${discountAmount.toFixed(2)}</span>
          </div>`;
       }
  }

  // Force display to match Backend Total exactly if there's a small rounding difference
  if (Math.abs(total - order.total) > 0.05) {
       total = order.total;
  }

  // Format date
  const orderDate = new Date(order.created_at);
  const formattedDate = orderDate.toLocaleString('en-US', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
  }).replace(',', '');

  // Items HTML
  const itemsHtml = order.items.map(item => `
    <div class="receipt-item">
      <span class="item-name">${item.item.name}</span>
      <span class="item-qty">${item.qty}x</span>
      <span class="item-price">₱${parseFloat(item.price_at_order).toFixed(2)}</span>
    </div>
  `).join('');

  // Render Full Template
  receiptContent.innerHTML = `
      <div class="receipt-header">
          <h3>Deja Brew Café</h3>
          <p>95 National Road Cut-cot, Pulilan, Bulacan</p>
          <p>VAT REG TIN: 000-000-000-000</p>
          <p style="font-weight: bold; margin-top: 5px;">OFFICIAL RECEIPT</p>
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-info">
          <p><strong>Order #:</strong> ${order.id}</p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Cashier:</strong> ${order.cashier_username || 'Unknown'}</p>
          ${order.customer_name && order.customer_name !== 'Walk-in' ? `<p><strong>Customer:</strong> ${order.customer_name}</p>` : ''}
      </div>

      <div class="receipt-divider"></div>

      <div class="receipt-items">
          <div class="receipt-item header" style="font-weight: bold; border-bottom: 1px solid #000; margin-bottom: 8px; padding-bottom: 3px;">
              <span class="item-name">Item</span>
              <span class="item-qty" style="text-align: center;">Qty</span>
              <span class="item-price" style="text-align: right;">Price</span>
          </div>
          ${itemsHtml}
      </div>

      <div class="receipt-totals" style="border-top: 1px solid #000; padding-top: 10px; margin-top: 15px;">
          <div class="totals-row">
              <span>Subtotal:</span>
              <span>₱${subtotal.toFixed(2)}</span>
          </div>
          
          ${isSeniorPwd ? `
          <div class="totals-row">
              <span>Vatable Amount:</span>
              <span>₱${vatableAmount.toFixed(2)}</span>
          </div>
          <div class="totals-row">
              <span>VAT (12%):</span>
              <span>₱${vatAmount.toFixed(2)}</span>
          </div>
          ` : ''}
          
          ${discountHtml}
          
          <div class="totals-row total" style="border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; font-weight: bold; font-size: 14px;">
              <span>TOTAL:</span>
              <span>₱${total.toFixed(2)}</span>
          </div>
          
          <div class="totals-row" style="margin-top: 10px;">
              <span>Payment Method:</span>
              <span>${order.payment_method || 'Cash'}</span>
          </div>
      </div>

      <div class="receipt-footer" style="border-top: 2px solid #000; margin-top: 20px; padding-top: 15px;">
          <p style="font-weight: bold;">Thank you for your purchase!</p>
          <p>Please come again.</p>
          ${isSeniorPwd ? `<p style="margin-top: 10px; font-size: 10px; font-style: italic;">"This ${discountType.toUpperCase()} discount is granted as per RA 9994/RA 10754"</p>` : ''}
      </div>
  `;
}

// Fetch logs from API
async function loadLogs() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Failed to load logs");
    const data = await res.json();

    logsData = (data.logs || []).map((log, i) => mapLogToRow(log, i));
    populateFilters(logsData);
    renderTable(logsData);
    refreshSeverityCounts();
  } catch (err) {
    console.error("Error loading audit logs:", err);
    tableBody.innerHTML = `<tr><td colspan="7">Failed to load audit logs.</td></tr>`;
  }
}

// Init
function init() {
  loadLogs();

  applyBtn.addEventListener("click", applyFilters);
  clearBtn.addEventListener("click", clearFilters);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyFilters();
  });
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  
  // Receipt modal close handlers
  if (receiptModalClose) {
    receiptModalClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeReceiptModal();
    });
  }
  
  if (receiptModal) {
    receiptModal.addEventListener('click', (e) => {
      if (e.target === receiptModal) {
        closeReceiptModal();
      }
    });
  }
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (modal.getAttribute("aria-hidden") === "false") {
        closeModal();
      }
      if (receiptModal && receiptModal.classList.contains('visible')) {
        closeReceiptModal();
      }
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}