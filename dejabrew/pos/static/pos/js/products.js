// Product Management JavaScript - With Ingredient Recipe System & File Uploads

const categoryOrder = [
    'Add Ons',
    'Cheese Macchiato Series',
    'Croffles',
    'Float Series',
    'Food',
    'Frappuccino',
    'Fruit Tea Series',
    'Holiday Specials',
    'Hot Coffee',
    'Iced Coffee',
    'Matcha Series',
    'Non - Coffee Over Iced'
];

let allProducts = [];
let filteredProducts = [];
let editingProductId = null;
let allIngredients = [];
let currentPage = 1;
const itemsPerPage = 10; // Show at least 10 items per page
// --- NEW: Define placeholder URL as inline SVG data URL ---
const placeholderImageUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23e0e0e0' width='200' height='200'/%3E%3Ctext fill='%23999' font-family='Arial' font-size='20' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";

function getCSRFToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
           document.cookie.split('; ')
               .find(row => row.startsWith('csrftoken='))
               ?.split('=')[1] || '';
}

// --- PAGINATION FUNCTIONS ---
function getTotalPages() {
    return Math.ceil(filteredProducts.length / itemsPerPage);
}

function getPaginatedProducts() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredProducts.slice(start, end);
}

function updatePaginationControls() {
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');
    const currentPageDisplay = document.getElementById('currentPageDisplay');
    const totalPagesDisplay = document.getElementById('totalPagesDisplay');

    if (!firstPageBtn || !prevPageBtn || !nextPageBtn || !lastPageBtn) return;

    const totalPages = getTotalPages();

    // Update page numbers
    if (currentPageDisplay) currentPageDisplay.textContent = currentPage;
    if (totalPagesDisplay) totalPagesDisplay.textContent = totalPages;

    // Enable/disable buttons
    firstPageBtn.disabled = currentPage === 1;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage >= totalPages || totalPages === 0;
    lastPageBtn.disabled = currentPage >= totalPages || totalPages === 0;

    // Visual feedback
    [firstPageBtn, prevPageBtn, nextPageBtn, lastPageBtn].forEach(btn => {
        if (btn.disabled) {
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Product Management System Initialized');
    
    const ingredientsPromise = loadIngredients();
    const productsPromise = loadProducts();
    
    await Promise.all([ingredientsPromise, productsPromise]);
    
    console.log('✅ Ingredients and Products loaded.');
    console.log('Available ingredients:', allIngredients.length);
    
    setupEventListeners();
});

function setupEventListeners() {
    const addBtn = document.getElementById('addProductBtn');
    const closeBtn = document.getElementById('closeModal');
    const form = document.getElementById('productForm');
    // --- FIX: Use ID to find cancel button ---
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    // --- NEW: Get file input ---
    const productImageFile = document.getElementById('productImageFile');

    console.log('🔧 Setting up event listeners...');
    console.log('Add button found:', !!addBtn);
    console.log('Close button found:', !!closeBtn);
    console.log('Form found:', !!form);

    if (addBtn) {
        addBtn.addEventListener('click', openAddModal);
        console.log('✅ Add button listener attached');
    } else {
        console.error('❌ Add button not found!');
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal); // Add listener
    if (form) form.addEventListener('submit', handleFormSubmit);
    // --- NEW: Add listener for file preview ---
    if (productImageFile) productImageFile.addEventListener('change', previewImage);

    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');
    const clearBtn = document.getElementById('clearFilters');

    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);

    // --- NEW: Set up event delegation for edit/delete buttons on the table ---
    const productTable = document.getElementById('productTable');
    if (productTable) {
        productTable.addEventListener('click', function(e) {
            const editBtn = e.target.closest('.edit-product-btn');
            const deleteBtn = e.target.closest('.delete-product-btn');

            if (editBtn) {
                const productId = parseInt(editBtn.dataset.productId);
                console.log('✏️ Edit button clicked for product ID:', productId);
                openEditModal(productId);
            } else if (deleteBtn) {
                const productId = parseInt(deleteBtn.dataset.productId);
                const productName = deleteBtn.dataset.productName;
                console.log('🗑️ Delete button clicked for product:', productName);
                confirmDeleteProduct(productId, productName);
            }
        });
        console.log('✅ Table event delegation attached');
    }

    const modal = document.getElementById('productModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target.id === 'productModal') {
                closeModal();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });

    // Pagination event listeners
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');

    if (firstPageBtn) firstPageBtn.addEventListener('click', () => {
        if (currentPage !== 1) {
            currentPage = 1;
            renderProducts(filteredProducts);
        }
    });

    if (prevPageBtn) prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderProducts(filteredProducts);
        }
    });

    if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
        const totalPages = getTotalPages();
        if (currentPage < totalPages) {
            currentPage++;
            renderProducts(filteredProducts);
        }
    });

    if (lastPageBtn) lastPageBtn.addEventListener('click', () => {
        const totalPages = getTotalPages();
        if (currentPage !== totalPages && totalPages > 0) {
            currentPage = totalPages;
            renderProducts(filteredProducts);
        }
    });
}

// --- NEW FUNCTION: To preview the selected image ---
function previewImage() {
    const fileInput = document.getElementById('productImageFile');
    const preview = document.getElementById('imagePreview');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
        }
        reader.readAsDataURL(file);
    } else {
        // If no file is selected, show the placeholder
        preview.src = placeholderImageUrl;
    }
}

async function loadIngredients() {
    try {
        console.log('Fetching ingredients from API...');
        const response = await fetch('/api/ingredients/'); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (Array.isArray(data)) {
            allIngredients = data;
        } else if (data.results && Array.isArray(data.results)) {
            allIngredients = data.results;
        } else {
            allIngredients = [];
            console.warn('Unexpected API response format:', data);
        }
        console.log(`✅ Loaded ${allIngredients.length} ingredients for recipes from API.`);
        
        if (allIngredients.length === 0) {
            console.warn('⚠️ No ingredients found. Recipe feature may not work properly.');
        }
    } catch (error) {
        console.error('❌ Error loading ingredients from API:', error);
        allIngredients = []; 
        showNotification('Could not load ingredients. Recipe features disabled.', 'error');
    }
}

async function loadProducts() {
    try {
        console.log('📦 Loading products...');
        // Add cache-busting query parameter
        const response = await fetch(`/api/products/?t=${new Date().getTime()}`);
        const data = await response.json();

        if (data.success) {
            allProducts = data.products;
            allProducts.sort((a, b) => {
                const indexA = categoryOrder.indexOf(a.category);
                const indexB = categoryOrder.indexOf(b.category);
                const orderA = indexA === -1 ? Infinity : indexA;
                const orderB = indexB === -1 ? Infinity : indexB;
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name);
            });
            
            filteredProducts = [...allProducts];
            console.log(`✅ Loaded and sorted ${allProducts.length} products`);
            
            updateStats(data.stats);
            populateCategoryFilter(allProducts); 
            renderProducts(filteredProducts);

        } else {
            console.error('❌ Failed to load products:', data.error);
            showNotification('Failed to load products', 'error');
        }
    } catch (error) {
        console.error('❌ Error loading products:', error);
        showNotification('Error loading products. Please refresh the page.', 'error');
    }
}

function notifyProductUpdate() {
    // This tells other tabs (like the POS) to reload products
    localStorage.setItem('productUpdate', Date.now().toString());
}

function updateStats(stats) {
    document.getElementById('totalProducts').textContent = stats.total_products;
    document.getElementById('inStockCount').textContent = stats.in_stock;
    document.getElementById('lowStockCount').textContent = stats.low_stock;
    document.getElementById('totalValue').textContent = `₱${stats.total_value.toFixed(2)}`;
}

function populateCategoryFilter(products) {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.toLowerCase();
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

function renderProducts(products) {
    const tbody = document.querySelector('#productTable tbody');
    if (!tbody) {
        console.error('❌ Table body not found');
        return;
    }
    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;"><i class="fa fa-inbox" style="font-size: 48px; margin-bottom: 15px; display: block;"></i>No products found</td></tr>`;
        updatePaginationControls();
        return;
    }

    const paginatedProducts = getPaginatedProducts();
    tbody.innerHTML = paginatedProducts.map(product => {
        // --- FIX: This is where the status badges are created ---
        const statusClass = product.status.replace(' ', '-');
        const statusBadge = `<span class="badge badge-${statusClass}">${product.status}</span>`;
        // --- END OF FIX ---

        const recipeInfo = product.recipe && product.recipe.length > 0 ?
            `<br><small style="color: #666;">🧪 ${product.recipe.length} ingredient(s)</small>` : '';

        const promoBadge = product.is_buy1take1 ?
            `<br><span style="display: inline-block; margin-top: 4px; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;">🎁 BUY 1 TAKE 1</span>` : '';

        return `
            <tr data-product-id="${product.id}">
                <td>
                    <div class="product-info">
                        ${product.image_url ?
                            `<img src="${product.image_url}" alt="${product.name}" class="product-thumb" onerror="this.src='${placeholderImageUrl}'; this.nextElementSibling.style.display='none';" />
                             <div class="product-thumb-placeholder" style="display:none;">No Image</div>` :
                            `<div class="product-thumb-placeholder">No Image</div>`
                        }
                        <div>
                            <strong>${escapeHtml(product.name)}</strong>
                            ${product.description ? `<br><small style="color: #666;">${escapeHtml(product.description)}</small>` : ''}
                            ${recipeInfo}
                            ${promoBadge}
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(product.category)}</td>
                <td style="font-weight: 600;">₱${parseFloat(product.price).toFixed(2)}</td>
                <td>${product.stock}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon edit-product-btn" data-product-id="${product.id}" title="Edit Product"><i class="fa fa-edit"></i></button>
                        <button class="btn-icon btn-danger delete-product-btn" data-product-id="${product.id}" data-product-name="${escapeHtml(product.name)}" title="Delete Product"><i class="fa fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updatePaginationControls();
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function applyFilters() {
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    filteredProducts = allProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) || (product.description || '').toLowerCase().includes(searchTerm);
        const matchesCategory = categoryFilter === 'all' || product.category.toLowerCase() === categoryFilter.toLowerCase();
        const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
        return matchesSearch && matchesCategory && matchesStatus;
    });
    currentPage = 1; // Reset to first page when filters change
    renderProducts(filteredProducts);
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('statusFilter').value = 'all';
    filteredProducts = [...allProducts];
    renderProducts(filteredProducts);
    showNotification('Filters cleared', 'info');
}

function openAddModal() {
    console.log('🚀 openAddModal called!');
    editingProductId = null;

    const modalTitle = document.getElementById('modalTitle');
    const productForm = document.getElementById('productForm');
    const productCategory = document.getElementById('productCategory');
    const imagePreview = document.getElementById('imagePreview');
    const productImageFile = document.getElementById('productImageFile');
    const productImageUrl = document.getElementById('productImageUrl');
    const modal = document.getElementById('productModal');

    console.log('Elements check:', {
        modalTitle: !!modalTitle,
        productForm: !!productForm,
        productCategory: !!productCategory,
        imagePreview: !!imagePreview,
        productImageFile: !!productImageFile,
        productImageUrl: !!productImageUrl,
        modal: !!modal
    });

    if (modalTitle) modalTitle.textContent = 'Add New Product';
    if (productForm) productForm.reset();
    if (productCategory) productCategory.value = '';

    // --- NEW: Reset image preview ---
    if (imagePreview) imagePreview.src = placeholderImageUrl;
    if (productImageFile) productImageFile.value = null;
    if (productImageUrl) productImageUrl.value = '';
    // --- END NEW ---

    ensureRecipeSectionExists();

    const recipeIngredients = document.getElementById('recipeIngredients');
    if (recipeIngredients) recipeIngredients.innerHTML = '';
    addIngredientRow();

    console.log('Modal element found:', !!modal);
    if (modal) {
        console.log('Current modal display:', modal.style.display);
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        console.log('✅ Modal display set to:', modal.style.display);
        // Force a reflow to ensure the style is applied
        modal.offsetHeight;
    } else {
        console.error('❌ Modal element not found!');
    }
    setTimeout(() => document.getElementById('productName')?.focus(), 100);
}

function ensureRecipeSectionExists() {
    let recipeSection = document.getElementById('recipeSection');
    if (!recipeSection) {
        createRecipeSection();
    }
}

function createRecipeSection() {
    const recipePlaceholder = document.getElementById('recipeSectionPlaceholder');
    if (!recipePlaceholder) {
        console.error('❌ Recipe section placeholder not found in HTML');
        return;
    }
    
    const recipeHTML = `
        <div id="recipeSection" style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
            <label style="font-weight: 600;">Recipe / Ingredients (Optional)</label>
            <p style="font-size: 12px; color: #666; margin-top: -5px; margin-bottom: 15px;">If a recipe is set, stock will be based on ingredient availability.</p>
            <div id="recipeIngredients"></div>
            <button type="button" class="btn btn-ghost" id="addIngredientBtn" style="margin-top: 10px;">
                <i class="fa fa-plus"></i> Add Ingredient
            </button>
        </div>
    `;
    
    recipePlaceholder.innerHTML = recipeHTML;
    
    const addBtn = document.getElementById('addIngredientBtn');
    if (addBtn) {
        addBtn.addEventListener('click', addIngredientRow);
    }
}

function addIngredientRow() {
    console.log('Adding ingredient row. Available ingredients:', allIngredients.length);
    
    const container = document.getElementById('recipeIngredients');
    if (!container) {
        console.error('❌ Recipe ingredients container not found');
        return;
    }
    
    const rowDiv = document.createElement('div');
    rowDiv.className = 'ingredient-row';
    rowDiv.style.cssText = 'display: flex; gap: 10px; margin-bottom: 10px; align-items: center;';
    
    let ingredientOptions = '<option value="">Select ingredient...</option>';
    
    if (allIngredients && allIngredients.length > 0) {
        ingredientOptions += allIngredients.map(ing => 
            `<option value="${escapeHtml(ing.name)}">${escapeHtml(ing.name)} (${escapeHtml(ing.unit)})</option>`
        ).join('');
    } else {
        console.warn('⚠️ No ingredients available for dropdown');
        ingredientOptions += '<option value="" disabled>No ingredients available</option>';
    }
    
    rowDiv.innerHTML = `
        <select class="recipe-ingredient" style="flex: 3;">
            ${ingredientOptions}
        </select>
        <input type="number" class="recipe-quantity" placeholder="Qty" step="0.01" min="0" style="flex: 1;">
        <button type="button" class="btn-icon btn-danger remove-ingredient" title="Remove">
            <i class="fa fa-times"></i>
        </button>
    `;
    
    const removeBtn = rowDiv.querySelector('.remove-ingredient');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => rowDiv.remove());
    }
    
    container.appendChild(rowDiv);
}

function openEditModal(productId) {
    console.log('📝 openEditModal called for product ID:', productId);
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        console.error('❌ Product not found:', productId);
        showNotification('Product not found', 'error');
        return;
    }
    console.log('✅ Product found:', product.name);

    editingProductId = productId;
    document.getElementById('modalTitle').textContent = 'Edit Product';
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productBuy1Take1').checked = product.is_buy1take1 || false;

    // --- UPDATED: Set image preview and hidden URL input ---
    document.getElementById('imagePreview').src = product.image_url || placeholderImageUrl;
    document.getElementById('productImageUrl').value = product.image_url || '';
    document.getElementById('productImageFile').value = null; // Clear file input
    // --- END UPDATED ---

    ensureRecipeSectionExists();

    const recipeContainer = document.getElementById('recipeIngredients');
    recipeContainer.innerHTML = '';

    if (product.recipe && product.recipe.length > 0) {
        product.recipe.forEach(item => {
            addIngredientRow();
            const rows = recipeContainer.querySelectorAll('.ingredient-row');
            const lastRow = rows[rows.length - 1];
            const select = lastRow.querySelector('.recipe-ingredient');
            const input = lastRow.querySelector('.recipe-quantity');

            if (select && input) {
                select.value = item.ingredient;
                input.value = item.quantity;
            }
        });
    } else {
        addIngredientRow();
    }

    const modal = document.getElementById('productModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
    }
    setTimeout(() => document.getElementById('productName')?.focus(), 100);
}

function closeModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
    }
    const form = document.getElementById('productForm');
    if (form) form.reset();
    editingProductId = null;

    // --- NEW: Reset image preview on close ---
    document.getElementById('imagePreview').src = placeholderImageUrl;
    document.getElementById('productImageFile').value = null;
    document.getElementById('productImageUrl').value = '';
    // --- END NEW ---

    const recipePlaceholder = document.getElementById('recipeSectionPlaceholder');
    if (recipePlaceholder) recipePlaceholder.innerHTML = '';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // --- UPDATED TO USE FORMDATA ---
    const formData = new FormData();
    const isEditing = !!editingProductId;

    // 1. Append text data
    formData.append('name', document.getElementById('productName').value.trim());
    formData.append('category', document.getElementById('productCategory').value.trim() || 'General');
    formData.append('price', parseFloat(document.getElementById('productPrice').value) || 0);
    formData.append('stock', parseInt(document.getElementById('productStock').value) || 0);
    formData.append('is_buy1take1', document.getElementById('productBuy1Take1').checked ? 'true' : 'false');

    // 2. Append recipe data (as a JSON string)
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const recipe = [];
    ingredientRows.forEach(row => {
        const ingredient = row.querySelector('.recipe-ingredient').value;
        const quantity = parseFloat(row.querySelector('.recipe-quantity').value);
        if (ingredient && quantity > 0) {
            recipe.push({ ingredient, quantity });
        }
    });
    formData.append('recipe', JSON.stringify(recipe));

    // 3. Append image data
    const imageFile = document.getElementById('productImageFile').files[0];
    if (imageFile) {
        // If a new file is selected, append it
        formData.append('image_file', imageFile);
    } else if (isEditing) {
        // If editing and no new file, append the *existing* URL
        formData.append('image_url', document.getElementById('productImageUrl').value);
    }
    // If creating and no file, append nothing (backend will handle)

    // 4. Validation
    if (!formData.get('name') || parseFloat(formData.get('price')) < 0 || parseInt(formData.get('stock')) < 0) {
        showNotification('Please fill all required fields with valid values.', 'error');
        return;
    }

    const url = isEditing ? `/api/products/${editingProductId}/update/` : '/api/products/create/';
    const method = 'POST'; // MUST be POST for file uploads, even for update

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 
                // DO NOT set 'Content-Type': 'application/json'
                // The browser will automatically set 'multipart/form-data'
                'X-CSRFToken': getCSRFToken() 
            },
            body: formData // Send the FormData object directly
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showNotification(data.message, 'success');
            closeModal();
            loadProducts();
            notifyProductUpdate(); // Tell POS pages to update
        } else {
            showNotification(data.error || 'Failed to save product', 'error');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        showNotification('Error saving product. Please try again.', 'error');
    }
}

function confirmDeleteProduct(productId, productName) {
    console.log('🗑️ confirmDeleteProduct called for:', productName, 'ID:', productId);
    if (confirm(`⚠️ Are you sure you want to delete "${productName}"?\n\nThis will set its stock to 0 and hide it from the POS.`)) {
        deleteProduct(productId);
    }
}

async function deleteProduct(productId) {
    try {
        const response = await fetch(`/api/products/${productId}/delete/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCSRFToken() }
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showNotification(data.message, 'success');
            loadProducts();
            notifyProductUpdate(); // Tell POS pages to update
        } else {
            showNotification(data.error || 'Failed to delete product', 'error');
        }
    } catch (error) {
        showNotification('Error deleting product. Please try again.', 'error');
    }
}

function showNotification(message, type = 'info') {
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
        info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' },
        warning: { bg: '#fff3cd', color: '#856404', border: '#ffeeba' }
    };
    const color = colors[type] || colors.info;
    notification.style.background = color.bg;
    notification.style.color = color.color;
    notification.style.border = `2px solid ${color.border}`;

    const styleId = 'notification-keyframes-products';
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

const style = document.createElement('style');
style.textContent = `
    .ingredient-row select, .ingredient-row input { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    .btn-icon.btn-danger { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; padding: 6px 10px; border-radius: 50%; cursor: pointer; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; }
    .btn-icon.btn-danger:hover { background-color: #f1c1c6; }
`;
document.head.appendChild(style);

console.log('✅ Product Management System Ready');

