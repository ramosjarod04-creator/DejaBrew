// stock-room.js - Manages the stock room page and stock transfers via API

// --- GLOBAL STATE ---
let allIngredients = [];
let editingIngredientId = null; // Store ID for transfers
let currentEditingIngredientId = null; // Store ID for add/edit

// --- NEW: Declare DOM vars with let ---
let tbody, searchInput, categoryFilter, transferModal, closeModalBtn, cancelModalBtn, transferForm, statValueEl, statIngredientsEl, statLowEl, ingredientModal, ingredientForm, closeIngredientModalBtn, cancelIngredientBtn, addIngredientBtn;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof USER_ROLE === 'undefined') {
         console.error("USER_ROLE was not defined globally. Check script tag in stock-room.html.");
         USER_ROLE = 'staff'; // Fallback to least privileged
    }
    console.log("Initializing Stock Room. Role:", USER_ROLE);
    
    // --- NEW: Assign DOM vars here, inside DOMContentLoaded ---
    tbody = document.querySelector("#inventoryTable tbody");
    searchInput = document.getElementById("searchInput");
    categoryFilter = document.getElementById("categoryFilter");
    transferModal = document.getElementById("transferModal");
    closeModalBtn = document.getElementById("closeModal");
    cancelModalBtn = document.getElementById("cancelModal");
    transferForm = document.getElementById("transferForm");
    statValueEl = document.getElementById("statValue");
    statIngredientsEl = document.getElementById("statIngredients");
    statLowEl = document.getElementById("statLow");
    ingredientModal = document.getElementById("ingredientModal");
    ingredientForm = document.getElementById("ingredientForm");
    closeIngredientModalBtn = document.getElementById("closeIngredientModal");
    cancelIngredientBtn = document.getElementById("cancelIngredient");
    addIngredientBtn = document.getElementById("addIngredientBtn");
    
    await loadIngredients(); // Load from API
    renderTable();
    updateStats();
    populateCategoryFilter();
    setupEventListeners(); // Now this will work
    applyRolePermissions(); // Apply admin/staff view
});


// --- DATA HANDLING (API) ---
async function loadIngredients() {
    try {
        const response = await fetch('/api/ingredients/');
        if (!response.ok) throw new Error('Failed to fetch ingredients');
        const data = await response.json();
        allIngredients = data.results || data; // Handle DRF pagination
        console.log(`✅ Loaded ${allIngredients.length} ingredients for Stock Room.`);
    } catch (error) {
        console.error("Error loading ingredients:", error);
        showNotification("Could not load ingredients from the server.", "error");
    }
}

function getCSRFToken() {
    return document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || '';
}

// --- UI RENDERING & STATS ---
function renderTable() {
    if (!tbody) return;
    tbody.innerHTML = '';
    const searchTerm = searchInput?.value.toLowerCase() || '';
    const category = categoryFilter?.value || 'all';
    
    // Determine colspan based on role
    const headerCells = document.querySelectorAll("#inventoryTable thead th");
    let colCount = headerCells.length;

    if (allIngredients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 20px; color: #999;">No ingredients found in stock room.</td></tr>`;
        return;
    }

    allIngredients.forEach((ing) => {
        const matchesSearch = searchTerm === '' || ing.name.toLowerCase().includes(searchTerm);
        const matchesCategory = category === 'all' || ing.category === category;
        if (!matchesSearch || !matchesCategory) return;

        // Status based on stockRoom level
        let status = 'In Stock';
        if ((ing.stockRoom || 0) <= 0) status = 'Out of Stock';
        else if ((ing.stockRoom || 0) < (ing.reorder || 0)) status = 'Low Stock';


        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHtml(ing.name)}</td>
            <td><span class="badge-cat ${catClass(ing.category)}">${escapeHtml(ing.category)}</span></td>
            <td class="font-bold">${Number(ing.stockRoom || 0)}</td>
            <td>${Number(ing.mainStock || 0)}</td>
            <td>${escapeHtml(ing.unit)}</td>
            <td><span class="pill ${statusClass(status)}">${status}</span></td>
            <td class="actions">
                <button class="btn btn-sm" data-action="transfer" data-id="${ing.id}">
                    <i class="fa fa-exchange-alt"></i> Transfer
                </button>
                <!-- Add admin edit/delete buttons -->
                <button class="btn-icon admin-only" data-action="edit" data-id="${ing.id}" title="Edit"><i class="fa fa-pen"></i></button>
                <button class="btn-icon btn-danger admin-only" data-action="delete" data-id="${ing.id}" title="Delete"><i class="fa fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Re-apply admin visibility after rendering
    applyRolePermissions();
}

function updateStats() {
    const stockRoomValue = allIngredients.reduce((sum, ing) => sum + (Number(ing.stockRoom) || 0) * (Number(ing.cost) || 0), 0);
    const lowStockCount = allIngredients.filter(ing => (Number(ing.stockRoom) || 0) < (Number(ing.reorder) || 0) && (Number(ing.stockRoom) || 0) > 0).length;

    if(statValueEl) statValueEl.textContent = formatPHP(stockRoomValue);
    if(statIngredientsEl) statIngredientsEl.textContent = allIngredients.length;
    if(statLowEl) statLowEl.textContent = lowStockCount;
}

function populateCategoryFilter() {
    if (!categoryFilter) return;
    const categories = [...new Set(allIngredients.map(ing => ing.category).filter(Boolean))].sort();
    
    const ingCategorySelect = document.getElementById("ingCategory");
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    if (ingCategorySelect) ingCategorySelect.innerHTML = '';
    
    categories.forEach(cat => {
        const option = new Option(cat, cat);
        categoryFilter.appendChild(option);
        if (ingCategorySelect) ingCategorySelect.appendChild(option.cloneNode(true));
    });
    
    if (!categories.includes('other')) {
         const otherOption = new Option('other', 'other');
         categoryFilter.appendChild(otherOption);
         if (ingCategorySelect) ingCategorySelect.appendChild(otherOption.cloneNode(true));
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    if(searchInput) searchInput.addEventListener('input', renderTable);
    if(categoryFilter) categoryFilter.addEventListener('change', renderTable);

    // Transfer Modal
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeTransferModal);
    if(cancelModalBtn) cancelModalBtn.addEventListener('click', closeTransferModal);
    if(transferModal) transferModal.addEventListener('click', (e) => {
        if (e.target === transferModal) closeTransferModal();
    });
    if(transferForm) transferForm.addEventListener('submit', handleTransferSubmit);

    // Ingredient Modal (Add/Edit)
    if(addIngredientBtn) addIngredientBtn.addEventListener('click', () => openIngredientModal(null));
    if(closeIngredientModalBtn) closeIngredientModalBtn.addEventListener('click', closeIngredientModal);
    if(cancelIngredientBtn) cancelIngredientBtn.addEventListener('click', closeIngredientModal);
    if(ingredientModal) ingredientModal.addEventListener('click', (e) => {
        if (e.target === ingredientModal) closeIngredientModal();
    });
    if(ingredientForm) ingredientForm.addEventListener('submit', handleIngredientFormSubmit);

    // Table action buttons
    if(tbody) {
        tbody.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const ingredientId = parseInt(button.dataset.id, 10);
            
            if (action === 'transfer') {
                openTransferModal(ingredientId);
            }
            // Admin-only actions
            if (USER_ROLE === 'admin') {
                if (action === 'edit') {
                    openIngredientModal(ingredientId);
                }
                if (action === 'delete') {
                    confirmDelete(ingredientId);
                }
            }
        });
    }

    // Listen for changes from other tabs (like inventory.js)
    window.addEventListener('storage', (event) => {
        if (event.key === 'inventoryUpdate') {
            showNotification('Stock updated from another tab. Refreshing...', 'info');
            // Re-run initialization to get fresh data
            loadIngredients().then(() => {
                renderTable();
                updateStats();
            });
        }
    });
}

// --- PERMISSIONS ---
function applyRolePermissions() {
    const adminElements = document.querySelectorAll('.admin-only');
    if (!adminElements) return;
    
    adminElements.forEach(el => {
        if (USER_ROLE === 'admin') {
            // --- THIS IS THE FIX ---
            // If the element is a modal, DO NOTHING to its display.
            // Let the open/close functions handle its visibility.
            if (el.classList.contains('modal')) {
                // Do nothing.
            } else if (el.tagName === 'BUTTON' || el.classList.contains('btn-icon')) {
                 el.style.display = 'inline-block';
            } else {
                 el.style.display = 'block';
            }
            // --- END FIX ---
        } else {
            // If not admin, hide all admin-only elements
            el.style.display = 'none';
        }
    });
}


// --- MODAL & TRANSFER LOGIC (API Based) ---
function openTransferModal(ingredientId) {
    const ingredient = allIngredients.find(ing => ing.id === ingredientId);
    if (!ingredient) {
        showNotification("Ingredient not found.", "error");
        return;
    }
    editingIngredientId = ingredientId; // Store the ID for transfer

    document.getElementById('modalTitle').textContent = `Transfer ${ingredient.name}`;
    document.getElementById('ingredientName').textContent = ingredient.name;
    document.getElementById('currentStockRoom').textContent = `${Number(ingredient.stockRoom || 0)} ${ingredient.unit}`;
    document.getElementById('currentMainStock').textContent = `${Number(ingredient.mainStock || 0)} ${ingredient.unit}`;
    
    const qtyInput = document.getElementById('transferQty');
    qtyInput.value = 1;
    qtyInput.max = Number(ingredient.stockRoom || 0);
    qtyInput.min = 1; // Can only transfer positive amounts

    if(transferModal) transferModal.classList.add('visible'); // Use class to show
}

function closeTransferModal() {
    if(transferModal) transferModal.classList.remove('visible'); // Use class to hide
    if(transferForm) transferForm.reset();
    editingIngredientId = null; // Clear the ID
}

async function handleTransferSubmit(e) {
    e.preventDefault();
    if (!editingIngredientId) return; // Should have an ID if modal is open

    const quantity = parseFloat(document.getElementById('transferQty').value);
    const ingredient = allIngredients.find(ing => ing.id === editingIngredientId);

    if (!ingredient) {
        showNotification("Ingredient data missing.", "error");
        return;
    }

    const currentStockRoom = Number(ingredient.stockRoom || 0);
    const currentMainStock = Number(ingredient.mainStock || 0);

    if (isNaN(quantity) || quantity <= 0) {
        showNotification('Please enter a valid quantity greater than zero.', 'error');
        return;
    }
    if (quantity > currentStockRoom) {
        showNotification('Transfer quantity cannot exceed the amount in the stock room.', 'error');
        return;
    }

    // Prepare data for PATCH request
    const updatedData = {
        stockRoom: currentStockRoom - quantity,
        mainStock: currentMainStock + quantity
    };
    
    // Auto-update status based on new mainStock
    if (updatedData.mainStock > (ingredient.reorder || 0)) {
        updatedData.status = 'In Stock';
    } else if (updatedData.mainStock > 0) {
        updatedData.status = 'Low Stock';
    } else {
        // Only set to Out of Stock if both are zero
        if (updatedData.stockRoom <= 0) {
            updatedData.status = 'Out of Stock';
        } else {
            updatedData.status = 'Low Stock';
        }
    }

    try {
        const response = await fetch(`/api/ingredients/${editingIngredientId}/`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(updatedData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || JSON.stringify(errorData));
        }

        // Notify other tabs that inventory has changed
        localStorage.setItem('inventoryUpdate', Date.now().toString());

        // Update successful, reload data and UI
        await loadIngredients(); // Fetch updated list from server
        renderTable();
        updateStats();
        closeTransferModal();
        showNotification(`${quantity} ${ingredient.unit} of ${ingredient.name} transferred successfully!`, 'success');

    } catch (error) {
        console.error('Failed to transfer stock:', error);
        showNotification(`Failed to transfer stock: ${error.message}`, 'error');
    }
}


// --- ADD/EDIT INGREDIENT LOGIC ---
function openIngredientModal(id = null) {
    if (USER_ROLE !== 'admin' || !ingredientModal || !ingredientForm) return;

    if (id) {
        const ingredient = allIngredients.find(ing => ing.id === id);
        if (!ingredient) return;
        
        currentEditingIngredientId = id;
        document.getElementById('ingredientModalTitle').textContent = 'Edit Ingredient';
        document.getElementById('ingId').value = ingredient.id;
        document.getElementById('ingName').value = ingredient.name;
        document.getElementById('ingCategory').value = ingredient.category;
        document.getElementById('ingMainStock').value = ingredient.mainStock;
        document.getElementById('ingStockRoom').value = ingredient.stockRoom;
        document.getElementById('ingUnit').value = ingredient.unit;
        // document.getElementById('ingReorder').value = ingredient.reorder; // Your modal HTML doesn't have reorder
        document.getElementById('ingCost').value = ingredient.cost;
    } else {
        currentEditingIngredientId = null;
        document.getElementById('ingredientModalTitle').textContent = 'Add New Ingredient';
        ingredientForm.reset();
        document.getElementById('ingId').value = '';
    }
    ingredientModal.classList.add('visible');
}

function closeIngredientModal() {
    if(ingredientModal) ingredientModal.classList.remove('visible');
    if(ingredientForm) ingredientForm.reset();
    currentEditingIngredientId = null;
}

async function handleIngredientFormSubmit(e) {
    e.preventDefault();
    if (USER_ROLE !== 'admin') return;

    const data = {
        name: document.getElementById('ingName').value.trim(),
        category: document.getElementById('ingCategory').value,
        mainStock: parseFloat(document.getElementById('ingMainStock').value || 0),
        stockRoom: parseFloat(document.getElementById('ingStockRoom').value || 0),
        unit: document.getElementById('ingUnit').value.trim(),
        cost: parseFloat(document.getElementById('ingCost').value || 0),
        // reorder: parseFloat(document.getElementById('ingReorder').value || 0) // Add reorder if input exists
    };

    if (!data.name || !data.unit) {
        showNotification('Name and Unit are required.', 'error');
        return;
    }
    
    // Auto-set status based on mainStock
    // Use a reorder value of 0 if not present
    const reorderPoint = data.reorder || 0; 
    if (data.mainStock > reorderPoint) {
        data.status = 'In Stock';
    } else if (data.mainStock > 0) {
        data.status = 'Low Stock';
    } else {
         if (data.stockRoom <= 0) {
            data.status = 'Out of Stock';
         } else {
            data.status = 'Low Stock'; // Still low, but not out
         }
    }
    
    const url = currentEditingIngredientId ? `/api/ingredients/${currentEditingIngredientId}/` : '/api/ingredients/';
    const method = currentEditingIngredientId ? 'PATCH' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
            body: JSON.stringify(data)
        });
        if (!response.ok) { const errorData = await response.json(); throw new Error(JSON.stringify(errorData)); }
        
        localStorage.setItem('inventoryUpdate', Date.now().toString()); // Notify other tabs
        
        closeIngredientModal();
        await loadIngredients(); // Reload data
        renderTable();
        updateStats();
        populateCategoryFilter(); // Repopulate in case of new category
        showNotification(`Ingredient ${currentEditingIngredientId ? 'updated' : 'added'}.`, 'success');
    } catch (error) {
        console.error('Failed to save ingredient:', error);
        showNotification(`Failed to save ingredient: ${error.message}`, 'error');
    }
}

async function confirmDelete(id) {
    if (USER_ROLE !== 'admin') return;
    if (confirm('Are you sure you want to delete this ingredient? This cannot be undone.')) {
        try {
            const response = await fetch(`/api/ingredients/${id}/`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCSRFToken() }
            });
            if (!response.ok) { throw new Error('Failed to delete.'); }
            
            localStorage.setItem('inventoryUpdate', Date.now().toString()); // Notify other tabs
            
            showNotification('Ingredient deleted.', 'success');
            await loadIngredients(); // Reload data
            renderTable();
            updateStats();
            populateCategoryFilter();
        } catch (error) {
            console.error('Error deleting ingredient:', error);
            showNotification(error.message, 'error');
        }
    }
}


// --- UTILITY FUNCTIONS ---
function formatPHP(n) { return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapeHtml(s) { if (s === undefined || s === null) return ''; return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function catClass(cat) { const c = (cat || '').toLowerCase(); if (c.includes('base')) return 'base'; if (c.includes('dairy')) return 'dairy'; if (c.includes('syrup')) return 'syrup'; if (c.includes('topping')) return 'topping'; return 'other'; }
function statusClass(status) { const s = (status || '').toLowerCase(); if (s.includes('in stock')) return 'instock'; if (s.includes('low')) return 'lowstock'; if (s.includes('out')) return 'out'; return ''; }

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    Object.assign(notification.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        padding: '20px 32px',
        borderRadius: '12px',
        zIndex: '10000',
        fontWeight: '600',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        animation: 'fadeInScale 0.3s ease',
        minWidth: '300px',
        maxWidth: '500px',
        fontSize: '16px',
        background: '#fff',
        textAlign: 'center'
    });
    const colors = {
        success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
        error: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
        info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
    };
    const color = colors[type] || colors.info;
    notification.style.background = color.bg;
    notification.style.color = color.color;
    notification.style.border = `2px solid ${color.border}`;
    const styleId = 'notification-keyframes-stock';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = `
            @keyframes fadeInScale {
                from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            @keyframes fadeOutScale {
                from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                to { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
            }
        `;
        document.head.appendChild(styleElement);
    }
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'fadeOutScale 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

