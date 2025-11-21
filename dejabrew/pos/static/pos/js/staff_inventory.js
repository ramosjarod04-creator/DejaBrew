// staff_inventory.js - View inventory and update status via API

let allIngredients = [];

// --- INITIALIZATION ---
async function init() {
    await loadIngredients();
    populateCategoryFilter();
    renderTable();
    setupEventListeners();
}

document.addEventListener('DOMContentLoaded', init);

// --- DATA HANDLING (API) ---
async function loadIngredients() {
    try {
        const response = await fetch('/api/ingredients/');
        if (!response.ok) throw new Error('Failed to fetch ingredients');
        const data = await response.json();
        // Handle DRF pagination if present
        allIngredients = data.results || data;
        console.log(`✅ Loaded ${allIngredients.length} ingredients from database.`);
    } catch (error) {
        console.error("Error loading ingredients:", error);
        showNotification("Could not load ingredients from the server.", "error");
    }
}

function getCSRFToken() {
    // Function to get CSRF token from cookies
    return document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || '';
}

// --- UI RENDERING ---
function renderTable() {
    const tbody = document.querySelector("#inventoryTable tbody");
    if (!tbody) {
        console.error("Table body not found!");
        return;
    }
    tbody.innerHTML = ''; // Clear previous rows

    const q = (document.getElementById("searchInput")?.value || '').trim().toLowerCase();
    const catFilter = document.getElementById("categoryFilter")?.value || 'all';

    if (allIngredients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">No ingredients found.</td></tr>`;
        return;
    }

    allIngredients.forEach((ing) => {
        const matchesQ = q === '' || ing.name.toLowerCase().includes(q);
        const matchesCat = catFilter === 'all' || ing.category === catFilter;
        if (!matchesQ || !matchesCat) return;

        let currentStatus = ing.status || 'In Stock';
        if (!['In Stock', 'Low Stock', 'Out of Stock'].includes(currentStatus)) {
             currentStatus = 'In Stock'; // Default if invalid value from DB
        }

        const tr = document.createElement('tr');
        // Simplified table row for staff
        tr.innerHTML = `
            <td>${escapeHtml(ing.name)}</td>
            <td><span class="badge-cat ${catClass(ing.category)}">${escapeHtml(ing.category)}</span></td>
            <td>${Number(ing.mainStock)}</td>
            <td>${Number(ing.stockRoom)}</td>
            <td>${escapeHtml(ing.unit)}</td>
            <td><span class="pill ${statusClass(currentStatus)}">${escapeHtml(currentStatus)}</span></td>
            <td class="status-actions" data-ingredient-id="${ing.id}">
                <button class="btn-instock ${currentStatus === 'In Stock' ? 'active' : ''}" data-status="In Stock">In Stock</button>
                <button class="btn-lowstock ${currentStatus === 'Low Stock' ? 'active' : ''}" data-status="Low Stock">Low</button>
                <button class="btn-outofstock ${currentStatus === 'Out of Stock' ? 'active' : ''}" data-status="Out of Stock">Out</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function populateCategoryFilter() {
    const categoryFilter = document.getElementById("categoryFilter");
    if (!categoryFilter) return;
    const cats = [...new Set(allIngredients.map(i => i.category).filter(Boolean))].sort(); // Filter out null/empty categories
    // Keep existing 'All Categories' option, clear others
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    cats.forEach(c => {
        const opt = new Option(c, c);
        categoryFilter.appendChild(opt);
    });
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    const refreshBtn = document.getElementById('refreshBtn');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const tableBody = document.querySelector("#inventoryTable tbody");

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            await loadIngredients(); // Reload data
            renderTable(); // Re-render table
        });
    }
    if (searchInput) {
        searchInput.addEventListener('input', renderTable);
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderTable);
    }

    // Event delegation for status buttons within the table body
    if (tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const button = e.target.closest('button[data-status]');
            if (button) {
                const statusCell = button.closest('.status-actions');
                const ingredientId = statusCell.dataset.ingredientId;
                const newStatus = button.dataset.status;

                // Prevent redundant updates if already active
                if (button.classList.contains('active')) return;

                await updateIngredientStatus(ingredientId, newStatus, statusCell);
            }
        });
    }

    // --- THIS IS THE FIX ---
    // Listen for changes from other tabs (like stock-room.js)
    window.addEventListener('storage', (event) => {
        if (event.key === 'inventoryUpdate') {
            showNotification('Stock was updated from another tab. Refreshing list...', 'info');
            // Re-run the init function to get all fresh data
            init(); 
        }
    });
    // --- END FIX ---
}

// --- API Interaction ---
async function updateIngredientStatus(id, status, statusCell) {
    if (!id || !status) return;

    try {
        const response = await fetch(`/api/ingredients/${id}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken() // Make sure you have getCSRFToken function
            },
            body: JSON.stringify({ status: status }) // Send only the status field
        });

        if (!response.ok) {
            const errorData = await response.json();
            // Try to extract a meaningful error message
            let errorMessage = "Failed to update status.";
            if (errorData.detail) {
                errorMessage = errorData.detail;
            } else if (typeof errorData === 'object' && errorData !== null) {
                 errorMessage = JSON.stringify(errorData); // Show raw error if detail is missing
            }
            throw new Error(errorMessage);
        }

        // --- NEW ---
        // Notify other tabs (like admin) that a status changed
        localStorage.setItem('inventoryUpdate', Date.now().toString());
        // --- END NEW ---

        // Update UI immediately on success
        const buttons = statusCell.querySelectorAll('button');
        buttons.forEach(btn => btn.classList.remove('active'));
        statusCell.querySelector(`button[data-status="${status}"]`).classList.add('active');

        // Update the main status pill in the table row
        const row = statusCell.closest('tr');
        const statusPill = row.querySelector('.pill');
        if (statusPill) {
             statusPill.textContent = status;
             statusPill.className = `pill ${statusClass(status)}`;
        }

        // Update the ingredient in the local array to keep state consistent
        const index = allIngredients.findIndex(ing => ing.id == id);
        if (index > -1) {
            allIngredients[index].status = status;
        }

        showNotification(`Ingredient status updated to ${status}. Admin notified via Audit Log.`, 'success');

    } catch (error) {
        console.error('Failed to update status:', error);
        showNotification(`Failed to update status: ${error.message}`, 'error');
    }
}

// --- UTILITY FUNCTIONS ---
function escapeHtml(s) { if (s === undefined || s === null) return ''; return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function catClass(cat) { const c = (cat || '').toLowerCase(); if (c.includes('base')) return 'base'; if (c.includes('dairy')) return 'dairy'; if (c.includes('syrup')) return 'syrup'; if (c.includes('topping')) return 'topping'; return 'other'; }
function statusClass(status) { const s = (status || '').toLowerCase(); if (s.includes('in stock')) return 'instock'; if (s.includes('low')) return 'lowstock'; if (s.includes('out')) return 'out'; return ''; }

// Simple notification function (replace with a styled one if you have it)
function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`); // Log to console as a fallback
    // You can replace this with a more visible UI notification
    const notificationArea = document.querySelector('.main-header'); // Example area
    if (notificationArea) {
        const note = document.createElement('div');
        note.textContent = message;
        note.style.padding = '10px';
        note.style.marginTop = '10px';
        note.style.borderRadius = '4px';
        note.style.backgroundColor = type === 'error' ? '#f8d7da' : (type === 'success' ? '#d4edda' : '#d1ecf1');
        note.style.color = type === 'error' ? '#721c24' : (type === 'success' ? '#155724' : '#0c5460');
        note.style.border = `1px solid ${type === 'error' ? '#f5c6cb' : (type === 'success' ? '#c3e6cb' : '#bee5eb')}`;
        notificationArea.parentNode.insertBefore(note, notificationArea.nextSibling);
        setTimeout(() => note.remove(), 5000); // Auto-remove after 5 seconds
    }
}

