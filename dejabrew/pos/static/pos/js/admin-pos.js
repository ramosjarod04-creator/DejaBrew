// Admin POS JavaScript - With Ingredient Stock Validation & Deduction

let cart = [];
let allProducts = [];
let productsByCategory = {};
let allIngredients = [];

let mobileCartToggleBtn;
let mobileCartCloseBtn;
let cartCol;

// --- PAYMENT MODAL VARIABLES ---
let paymentModal;
let paymentModalTitle;
let paymentCustomerName;
let paymentRefNum;
let paymentModalCancel;
let paymentModalConfirm;
let paymentModalResolve = null;

// --- ADD-ONS MODAL VARIABLES ---
let addOnsModal;
let addOnsProductName;
let addOnsGrid;
let addOnsSkipBtn;
let addOnsContinueBtn;
let selectedAddOns = [];
let addOnsModalResolve = null;

// --- DISCOUNT MODAL VARIABLES ---
let discountModal;
let discountTypeSelect;
let discountIdInput;
let discountIdGroup;
let discountModalCancel;
let discountModalApply;
let discountModalResolve = null;

// --- RECEIPT PREVIEW MODAL VARIABLES ---
let receiptPreviewModal;
let receiptPreviewClose;
let receiptPreviewPrint;
let receiptPreviewContent;
// Store the current receipt HTML for printing
let currentReceiptHTML = ""; 


// --- UTILITY FUNCTIONS ---

function getCSRFToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
           document.cookie.split('; ')
               .find(row => row.startsWith('csrftoken='))
               ?.split('=')[1] || '';
}

function getParentCategory(specificCategory) {
    const categoryMap = {
        'Hot Coffee': 'Drinks', 'Iced Coffee': 'Drinks', 'Frappuccino': 'Drinks',
        'Fruit Tea Series': 'Drinks', 'Cheese Macchiato Series': 'Drinks',
        'Matcha Series': 'Drinks', 'Non - Coffee Over Iced': 'Drinks',
        'Float Series': 'Drinks', 'Holiday Specials': 'Drinks',
        'Croffles': 'Food'
    };
    return categoryMap[specificCategory] || specificCategory;
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeJs(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
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
        info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
    };
    const color = colors[type] || colors.info;
    notification.style.background = color.bg;
    notification.style.color = color.color;
    notification.style.border = `2px solid ${color.border}`;

    const styleId = 'notification-keyframes-admin';
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


// --- INITIALIZATION & EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', async function() {
    await loadIngredients();
    await loadProducts();
    await loadAndRenderCategories(); // NEW: Load and render dynamic category buttons

    // loadRecentOrders(); // REMOVED: Recent Orders panel no longer needed
    setupEventListeners();
    updateCartDisplay();
    createAddOnsModal();
    setupDiscountModal();
    setupReceiptPreviewModal();
    setupButtonControls(); // NEW: Setup button-based controls
    setupAdminPasswordModal(); // NEW: Setup admin authentication
});

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const processOrderBtn = document.getElementById('processOrderBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const discountInput = document.getElementById('discountInput');
    const applyDiscountBtn = document.getElementById('applyDiscountBtn');

    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (processOrderBtn) processOrderBtn.addEventListener('click', processOrder);
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    if (discountInput) discountInput.addEventListener('input', updateCartTotals);
    // Admin auth required for discount
    if (applyDiscountBtn) applyDiscountBtn.addEventListener('click', requireAdminForDiscount);

    // Storage event listener - ONLY fires when OTHER tabs/windows update localStorage
    // This allows cross-tab synchronization without creating infinite loops
    window.addEventListener('storage', (event) => {
        if (event.key === 'productUpdate') {
            console.log('Storage event: productUpdate detected from another tab');
            showNotification('Product list has been updated.', 'info');
            loadProducts();
        }
        // When another tab updates ingredients, sync without triggering another save
        if (event.key === 'dejabrew_ingredients_v1') {
            console.log('Storage event: ingredients updated from another tab');
            // Load directly from localStorage to avoid API call and prevent save loop
            try {
                const stored = localStorage.getItem('dejabrew_ingredients_v1');
                if (stored) {
                    allIngredients = JSON.parse(stored);
                    console.log(`📦 Synced ${allIngredients.length} ingredients from another tab`);
                    showNotification('Inventory has been updated.', 'info');
                    const currentCategory = document.getElementById('productsGrid').dataset.currentCategory || 'all';
                    showProductView(currentCategory);
                }
            } catch (error) {
                console.error('Error syncing ingredients from storage:', error);
            }
        }
    });

    mobileCartToggleBtn = document.getElementById('mobileCartToggle');
    mobileCartCloseBtn = document.getElementById('mobileCartClose');
    cartCol = document.querySelector('.cart-col');

    if (mobileCartToggleBtn) {
        mobileCartToggleBtn.addEventListener('click', toggleMobileCart);
    }
    if (mobileCartCloseBtn) {
        mobileCartCloseBtn.addEventListener('click', toggleMobileCart);
    }

    paymentModal = document.getElementById('paymentModal');
    paymentModalTitle = document.getElementById('paymentModalTitle');
    paymentCustomerName = document.getElementById('paymentCustomerName');
    paymentRefNum = document.getElementById('paymentRefNum');
    paymentModalCancel = document.getElementById('paymentModalCancel');
    paymentModalConfirm = document.getElementById('paymentModalConfirm');

    if (paymentModal && paymentModalCancel && paymentModalConfirm) {
        paymentModalCancel.addEventListener('click', closePaymentModal);
        paymentModalConfirm.addEventListener('click', confirmPaymentDetails);
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) closePaymentModal();
        });
    }
}


// --- DATA LOADING & SAVING ---

async function loadIngredients(skipSave = false) {
    try {
        const response = await fetch('/api/ingredients/');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        allIngredients = data.results || data;

        if (!Array.isArray(allIngredients)) {
             console.error("Fetched ingredients data is not an array:", data);
             allIngredients = [];
        }

        console.log(`📦 Loaded ${allIngredients.length} ingredients from server.`);
        // Only save to localStorage if not loading from storage event (prevents cross-tab loop)
        if (!skipSave) {
            saveIngredients();
        }
    } catch (error) {
        console.error("Error loading ingredients:", error);
        showNotification("Could not load ingredients. Trying local cache.", "error");
        const stored = localStorage.getItem('dejabrew_ingredients_v1');
        if (stored) {
            allIngredients = JSON.parse(stored);
            console.log(`📦 Loaded ${allIngredients.length} ingredients from local cache as fallback.`);
        } else {
            allIngredients = [];
        }
    }
}

function saveIngredients() {
    localStorage.setItem('dejabrew_ingredients_v1', JSON.stringify(allIngredients));
    localStorage.setItem('inventoryUpdate', Date.now().toString());
}

async function loadProducts() {
    try {
        const response = await fetch(`/api/products/?t=${new Date().getTime()}`);
        const data = await response.json();
        if (data.success) {
            allProducts = data.products;
            groupProductsByCategory();
            showCategoryView();
        } else {
            showNotification('Failed to load products', 'error');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Failed to load products', 'error');
    }
}

async function loadAndRenderCategories() {
    try {
        const response = await fetch('/api/product-categories/');
        const data = await response.json();

        if (data.success && data.categories) {
            renderCategoryButtons(data.categories);
        } else {
            console.error('Failed to load categories');
            // Fallback to basic categories
            renderCategoryButtons(['Food', 'Drinks', 'Frappuccino']);
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Fallback to basic categories
        renderCategoryButtons(['Food', 'Drinks', 'Frappuccino']);
    }
}

function renderCategoryButtons(categories) {
    const container = document.getElementById('categoryButtonsContainer');
    if (!container) return;

    // Clear existing buttons
    container.innerHTML = '';

    // Add "All Products" button first
    const allBtn = createCategoryButton('All Products', 'all', true);
    container.appendChild(allBtn);

    // Add category buttons from database
    categories.forEach(category => {
        const btn = createCategoryButton(category, category.toLowerCase(), false);
        container.appendChild(btn);
    });

    // Add "Best Selling" button last with special styling
    const bestSellingBtn = createCategoryButton('🔥 Best Selling', 'bestselling', false, true);
    container.appendChild(bestSellingBtn);

    // Re-setup button controls after rendering
    setupButtonControls();
}

function createCategoryButton(label, categoryValue, isActive, isBestSelling = false) {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (isActive ? ' active' : '');
    btn.dataset.category = categoryValue;

    // Base styling
    btn.style.cssText = `
        flex: 1;
        min-width: 120px;
        padding: 12px;
        border: 2px solid ${isActive ? '#8B4513' : (isBestSelling ? '#ffc107' : '#ddd')};
        background: ${isActive ? '#8B4513' : (isBestSelling ? '#ffc107' : 'white')};
        color: ${isActive ? 'white' : (isBestSelling ? '#333' : '#333')};
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s;
    `;

    btn.textContent = label;

    return btn;
}

async function loadRecentOrders() {
    try {
        const response = await fetch('/api/recent-orders/');
        const data = await response.json();
        const recentOrdersContainer = document.getElementById('recentOrders');
        if (data.orders && data.orders.length > 0) {
            recentOrdersContainer.innerHTML = data.orders.map(order => `
                <div class="recent-order-item">
                    <span>Order #${order.id} (${order.created_at}) - <em>${order.dining_option || 'Dine-In'}</em></span>
                    <strong>₱${parseFloat(order.total).toFixed(2)}</strong>
                </div>
            `).join('');
        } else {
            recentOrdersContainer.innerHTML = '<p class="muted">No recent orders to display.</p>';
        }
    } catch (error) {
        console.error('Error loading recent orders:', error);
    }
}


// --- RENDERING & UI ---

function groupProductsByCategory() {
    productsByCategory = { 'all': allProducts };
    allProducts.forEach(product => {
        const parentCategory = getParentCategory(product.category || 'General');
        if (!productsByCategory[parentCategory]) {
            productsByCategory[parentCategory] = [];
        }
        productsByCategory[parentCategory].push(product);
    });
}

function populateCategorySelect() {
    const categorySelect = document.getElementById('categorySelect');
    if (!categorySelect) return;
    
    const parentCategories = [...new Set(allProducts.map(p => getParentCategory(p.category || 'General')))].sort();

    categorySelect.innerHTML = '<option value="all">All Products</option>';
    parentCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    if (!products || products.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">No products found.</p>';
        return;
    }

    grid.innerHTML = products.map(product => {
        const hasStock = (product.stock || 0) > 0;
        const hasRecipe = product.recipe && product.recipe.length > 0;
        let isDisabled = false;
        let outOfStockReason = '';
        let stockStatusText = '';

        if (hasStock) {
            stockStatusText = `Stock: ${product.stock}`;
            isDisabled = false;
        } else if (hasRecipe) {
            const { maxCanMake, missingIngredient } = calculateMaxRecipeStock(product);
            if (maxCanMake > 0) {
                stockStatusText = `Can make: ${maxCanMake}`;
                isDisabled = false;
            } else {
                stockStatusText = 'Recipe Item';
                isDisabled = true;
                outOfStockReason = missingIngredient ? `No ${missingIngredient}` : 'Out of Stock';
            }
        } else {
            stockStatusText = `Stock: ${product.stock}`;
            isDisabled = true;
            outOfStockReason = 'Out of Stock';
        }
        
        return `
        <div class="product-card ${isDisabled ? 'disabled' : ''}">
            <div class="product-image" style="background-image: url('${product.image_url || '/static/pos/img/placeholder.jpg'}')"></div>
            <div class="product-info">
                <div class="title" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</div>
                <div class="desc">${stockStatusText}</div>
            </div>
            <div class="product-footer">
                <div class="price">₱${parseFloat(product.price).toFixed(2)}</div>
                ${isDisabled
                    ? `<span class="stock-badge" style="background-color: #e55353;">${outOfStockReason}</span>`
                    : `<button class="add-btn" onclick="addToCart(${product.id})" style="padding: 14px 20px; font-size: 16px; font-weight: 700; min-height: 48px;">Add</button>`
                }
            </div>
        </div>
    `;
    }).join('');
}


// --- INVENTORY & RECIPE LOGIC ---

function calculateMaxRecipeStock(product) {
    if (!product.recipe || product.recipe.length === 0) {
        return { maxCanMake: 0, missingIngredient: null };
    }
    
    let maxCanMake = Infinity;
    let bottleneck = null;

    for (const recipeItem of product.recipe) {
        const ingredient = allIngredients.find(ing => ing.name === recipeItem.ingredient);
        if (!ingredient) {
            console.warn(`Ingredient "${recipeItem.ingredient}" for product "${product.name}" not found in inventory.`);
            return { maxCanMake: 0, missingIngredient: recipeItem.ingredient };
        }
        
        const neededPerItem = parseFloat(recipeItem.quantity);
        if (neededPerItem <= 0) continue;

        const availableStock = parseFloat(ingredient.mainStock || 0);
        
        if (availableStock <= 0) {
            return { maxCanMake: 0, missingIngredient: recipeItem.ingredient };
        }

        const canMakeFromThis = availableStock / neededPerItem;
        
        if (canMakeFromThis < maxCanMake) {
            maxCanMake = canMakeFromThis;
            bottleneck = recipeItem.ingredient;
        }
    }

    if (maxCanMake === Infinity) {
        return { maxCanMake: 0, missingIngredient: null };
    }
    
    const finalAmount = Math.floor(maxCanMake);
    return { 
        maxCanMake: finalAmount, 
        missingIngredient: finalAmount > 0 ? null : bottleneck 
    };
}

function checkIfCanMakeProduct(product, quantity = 1) {
    const { maxCanMake, missingIngredient } = calculateMaxRecipeStock(product);
    if (quantity > maxCanMake) {
        return { canMake: false, missingIngredient: missingIngredient || 'Stock' };
    }
    return { canMake: true, missingIngredient: null };
}


// --- VIEW MANAGEMENT ---

function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase();

    const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(searchTerm));
    renderProducts(filteredProducts);
}

window.showProductView = (category) => {
    // Filter products by category (case-insensitive match)
    let products;

    if (category === 'all') {
        products = allProducts;
    } else {
        products = allProducts.filter(p =>
            p.category && p.category.toLowerCase() === category.toLowerCase()
        );
    }

    renderProducts(products);
    const grid = document.getElementById('productsGrid');
    if(grid) grid.dataset.currentCategory = category;
};

function showCategoryView() {
    renderProducts(productsByCategory['all'] || []);
}


// --- CART MANAGEMENT ---

window.addToCart = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return showNotification('Product not found', 'error');

    const existingItem = cart.find(item => item.id === productId);
    const quantityInCart = existingItem ? existingItem.quantity : 0;
    const newQuantity = quantityInCart + 1;

    const hasStock = (product.stock || 0) > 0;
    const hasRecipe = product.recipe && product.recipe.length > 0;

    if (hasStock) {
        if (newQuantity > product.stock) {
            return showNotification('Cannot add more than available stock', 'error');
        }
    } else if (hasRecipe) {
        const canMakeResult = checkIfCanMakeProduct(product, newQuantity);
        if (!canMakeResult.canMake) {
            return showNotification(`Not enough main stock of ${canMakeResult.missingIngredient} to add another ${product.name}.`, 'error');
        }
    } else {
        return showNotification('Product is out of stock', 'error');
    }
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id, 
            name: product.name, 
            price: parseFloat(product.price),
            quantity: 1, 
            stock: product.stock, 
            recipe: product.recipe || [],
            addOns: []
        });
    }
    updateCartDisplay();
    showNotification(`${product.name} added to cart`, 'success');
}

window.updateQuantity = function(productId, change) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    const newQuantity = item.quantity + change;

    if (newQuantity <= 0) {
        window.voidItem(productId);
        return;
    }

    const hasStock = (item.stock || 0) > 0;
    const hasRecipe = item.recipe && item.recipe.length > 0;

    if (hasStock) {
        if (newQuantity > item.stock) {
            showNotification('Cannot exceed available stock', 'error');
            return;
        }
    } else if (hasRecipe) {
        const product = allProducts.find(p => p.id === productId);
        const canMakeResult = checkIfCanMakeProduct(product, newQuantity);
        if (!canMakeResult.canMake) {
            showNotification(`Not enough main stock of ${canMakeResult.missingIngredient} for this quantity.`, 'error');
            return;
        }
    } else {
        showNotification('Cannot exceed available stock', 'error');
        return;
    }
    
    item.quantity = newQuantity;
    updateCartDisplay();
}

window.setQuantity = function(productId, value) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    let newQuantity = parseInt(value);

    // Validate input
    if (isNaN(newQuantity) || newQuantity < 1) {
        newQuantity = 1;
    } else if (newQuantity > 999) {
        newQuantity = 999;
    }

    const hasStock = (item.stock || 0) > 0;
    const hasRecipe = item.recipe && item.recipe.length > 0;

    if (hasStock) {
        if (newQuantity > item.stock) {
            showNotification(`Only ${item.stock} in stock available`, 'error');
            newQuantity = item.stock;
        }
    } else if (hasRecipe) {
        const product = allProducts.find(p => p.id === productId);
        const canMakeResult = checkIfCanMakeProduct(product, newQuantity);
        if (!canMakeResult.canMake) {
            showNotification(`Not enough main stock of ${canMakeResult.missingIngredient} for this quantity.`, 'error');
            // Keep current quantity
            updateCartDisplay();
            return;
        }
    } else {
        showNotification('Cannot exceed available stock', 'error');
        updateCartDisplay();
        return;
    }

    item.quantity = newQuantity;
    updateCartDisplay();
}

window.removeFromCart = function(productId) {
    const index = cart.findIndex(i => i.id === productId);
    if (index > -1) {
        const itemName = cart[index].name;
        cart.splice(index, 1);
        updateCartDisplay();
        showNotification(`${itemName} removed from cart`, 'info');
    }
}

function updateCartDisplay() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartEmptyMsg = document.getElementById('cartEmptyMsg');
    const mobileCartCount = document.getElementById('mobileCartCount');

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '';
        cartEmptyMsg.style.display = 'block';
    } else {
        cartEmptyMsg.style.display = 'none';
        cartItemsContainer.innerHTML = cart.map(item => {
            const addOnsText = item.addOns && item.addOns.length > 0
                ? `<br><small style="color: #666;">+ ${item.addOns.map(a => a.name).join(', ')}</small>`
                : '';

            return `
            <div class="cart-item">
                <div class="item-info">
                    <p class="item-name">${escapeHtml(item.name)}${addOnsText}</p>
                    <p class="item-price">₱${item.price.toFixed(2)}</p>
                    <button class="modify-btn" onclick="modifyProduct(${item.id})" style="margin-top: 5px; padding: 4px 12px; background: #ff9800; color: white; border: none; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">
                        <i class="fa-solid fa-pen-to-square"></i> Modify
                    </button>
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                    <input type="number" class="qty-input" value="${item.quantity}" min="1" max="999"
                           onchange="setQuantity(${item.id}, this.value)"
                           onkeypress="if(event.key==='Enter') this.blur()">
                    <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
                <div class="item-total">₱${(item.price * item.quantity).toFixed(2)}</div>
                <button class="remove-btn" onclick="voidItem(${item.id})" title="Void Item (Requires Admin)">&times;</button>
            </div>
        `;
        }).join('');
    }

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    if(mobileCartCount) {
        mobileCartCount.textContent = totalItems;
    }

    updateCartTotals();
}

function updateCartTotals() {
    let subtotal = 0;
    
    cart.forEach(item => {
        const itemPrice = (item.price || 0) * item.quantity;
        const addOnsPrice = (item.addOns || []).reduce((sum, addOn) => sum + addOn.price, 0) * item.quantity;
        subtotal += itemPrice + addOnsPrice;
    });
    
    const discountPercent = parseFloat(document.getElementById('discountInput').value) || 0;
    const discountType = window.currentDiscount?.type || 'regular';
    
    let total = subtotal;
    let vatAmount = 0;
    let discountAmount = 0;
    
    if (discountType === 'senior' || discountType === 'pwd') {
        // VAT-inclusive calculation
        const vatRate = 0.12;
        const vatableAmount = subtotal / (1 + vatRate);
        vatAmount = subtotal - vatableAmount;
        
        // 20% discount on vatable amount
        discountAmount = vatableAmount * 0.20;
        
        // Total = Subtotal - Discount - VAT
        total = subtotal - discountAmount - vatAmount;
    } else {
        // Regular discount
        discountAmount = subtotal * (discountPercent / 100);
        total = subtotal - discountAmount;
    }

    document.getElementById('subtotalDisplay').textContent = `₱${subtotal.toFixed(2)}`;
    document.getElementById('totalDisplay').textContent = `₱${total.toFixed(2)}`;
}

function clearCart() {
    cart = [];
    document.getElementById('discountInput').value = 0;
    document.getElementById('discountInput').disabled = false;
    window.currentDiscount = null;
    updateCartDisplay();
}

// --- ADD-ONS MODAL FUNCTIONS ---

function createAddOnsModal() {
    const modalHTML = `
        <div id="addOnsModal" class="payment-modal">
            <div class="payment-modal-card" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
                <h3>Add-ons for <span id="addOnsProductName"></span></h3>
                <p style="color: #666; margin-bottom: 20px;">Select any add-ons you'd like (optional)</p>
                
                <div id="addOnsGrid" class="add-ons-grid"></div>
                
                <div class="payment-modal-actions">
                    <button id="addOnsSkipBtn" class="btn secondary">No Add-ons</button>
                    <button id="addOnsContinueBtn" class="btn primary">Continue</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const style = document.createElement('style');
    style.textContent = `
        .add-ons-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .addon-card {
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
        }
        .addon-card:hover {
            border-color: #ff9800;
            transform: translateY(-2px);
        }
        .addon-card.selected {
            border-color: #ff9800;
            background-color: #fff3e0;
        }
        .addon-card img {
            width: 80px;
            height: 80px;
            object-fit: cover;
            border-radius: 6px;
            margin-bottom: 8px;
        }
        .addon-card .name {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 4px;
        }
        .addon-card .price {
            color: #ff9800;
            font-weight: 600;
        }
    `;
    document.head.appendChild(style);
    
    addOnsModal = document.getElementById('addOnsModal');
    addOnsProductName = document.getElementById('addOnsProductName');
    addOnsGrid = document.getElementById('addOnsGrid');
    addOnsSkipBtn = document.getElementById('addOnsSkipBtn');
    addOnsContinueBtn = document.getElementById('addOnsContinueBtn');
    
    addOnsSkipBtn.addEventListener('click', () => closeAddOnsModal([]));
    addOnsContinueBtn.addEventListener('click', () => closeAddOnsModal(selectedAddOns));
    addOnsModal.addEventListener('click', (e) => {
        if (e.target === addOnsModal) closeAddOnsModal([]);
    });
}

function showAddOnsModal(productName) {
    return new Promise((resolve) => {
        selectedAddOns = [];
        addOnsProductName.textContent = productName;
        
        const addOnsProducts = allProducts.filter(p => 
            p.category === 'Add Ons' && 
            (p.stock > 0 || (p.recipe && p.recipe.length > 0))
        );
        
        if (addOnsProducts.length === 0) {
            resolve([]);
            return;
        }
        
        addOnsGrid.innerHTML = addOnsProducts.map(product => `
            <div class="addon-card" data-id="${product.id}" onclick="toggleAddOn(${product.id}, '${escapeJs(product.name)}', ${product.price})">
                <img src="${product.image_url || '/static/pos/img/placeholder.jpg'}" alt="${escapeHtml(product.name)}">
                <div class="name">${escapeHtml(product.name)}</div>
                <div class="price">₱${parseFloat(product.price).toFixed(2)}</div>
            </div>
        `).join('');
        
        addOnsModal.classList.add('is-visible');
        addOnsModalResolve = resolve;
    });
}

function closeAddOnsModal(addOns) {
    addOnsModal.classList.remove('is-visible');
    if (addOnsModalResolve) {
        addOnsModalResolve(addOns);
        addOnsModalResolve = null;
    }
}

window.toggleAddOn = function(productId, productName, productPrice) {
    const card = document.querySelector(`.addon-card[data-id="${productId}"]`);
    const index = selectedAddOns.findIndex(a => a.id === productId);
    
    if (index > -1) {
        selectedAddOns.splice(index, 1);
        card.classList.remove('selected');
    } else {
        selectedAddOns.push({
            id: productId,
            name: productName,
            price: parseFloat(productPrice)
        });
        card.classList.add('selected');
    }
}

// --- DISCOUNT MODAL FUNCTIONS ---

function setupDiscountModal() {
    const modalHTML = `
        <div id="discountModal" class="payment-modal">
            <div class="payment-modal-card" style="max-width: 450px;">
                <h3>Apply Discount</h3>
                <p style="color: #666; margin-bottom: 20px;">Select discount type</p>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">Discount Type:</label>
                    <select id="discountTypeSelect" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                        <option value="regular">Regular Discount</option>
                        <option value="senior">Senior Citizen (20% + VAT Exempt)</option>
                        <option value="pwd">PWD (20% + VAT Exempt)</option>
                    </select>
                </div>
                
                <div id="discountIdGroup" style="margin-bottom: 20px; display: none;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600;">ID Number:</label>
                    <input type="text" id="discountIdInput" placeholder="Enter ID/OSCA Number" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                    <small style="color: #666; display: block; margin-top: 5px;">Required for Senior Citizen and PWD discounts</small>
                </div>
                
                <div class="payment-modal-actions">
                    <button id="discountModalCancel" class="btn secondary">Cancel</button>
                    <button id="discountModalApply" class="btn primary">Apply Discount</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    discountModal = document.getElementById('discountModal');
    discountTypeSelect = document.getElementById('discountTypeSelect');
    discountIdInput = document.getElementById('discountIdInput');
    discountIdGroup = document.getElementById('discountIdGroup');
    discountModalCancel = document.getElementById('discountModalCancel');
    discountModalApply = document.getElementById('discountModalApply');
    
    discountTypeSelect.addEventListener('change', () => {
        const type = discountTypeSelect.value;
        if (type === 'senior' || type === 'pwd') {
            discountIdGroup.style.display = 'block';
            discountIdInput.required = true;
        } else {
            discountIdGroup.style.display = 'none';
            discountIdInput.required = false;
            discountIdInput.value = '';
        }
    });
    
    discountModalCancel.addEventListener('click', closeDiscountModal);
    discountModalApply.addEventListener('click', applyDiscount);
    discountModal.addEventListener('click', (e) => {
        if (e.target === discountModal) closeDiscountModal();
    });
}

function showDiscountModal() {
    if (cart.length === 0) {
        showNotification('Please add items to cart first', 'error');
        return;
    }
    
    discountTypeSelect.value = 'regular';
    discountIdInput.value = '';
    discountIdGroup.style.display = 'none';
    discountModal.classList.add('is-visible');
}

function closeDiscountModal() {
    discountModal.classList.remove('is-visible');
}

function applyDiscount() {
    const discountType = discountTypeSelect.value;
    const discountId = discountIdInput.value.trim();
    
    if ((discountType === 'senior' || discountType === 'pwd') && !discountId) {
        showNotification('Please enter ID number for senior/PWD discount', 'error');
        return;
    }
    
    window.currentDiscount = {
        type: discountType,
        id: discountId
    };
    
    const discountInput = document.getElementById('discountInput');
    if (discountType === 'senior' || discountType === 'pwd') {
        discountInput.value = '20';
        discountInput.disabled = true;
    } else {
        discountInput.disabled = false;
    }
    
    updateCartTotals();
    closeDiscountModal();
    
    let message = 'Regular discount applied';
    if (discountType === 'senior') message = 'Senior Citizen discount applied (20% + VAT Exempt)';
    if (discountType === 'pwd') message = 'PWD discount applied (20% + VAT Exempt)';
    
    showNotification(message, 'success');
}

// --- PAYMENT MODAL FUNCTIONS ---

function showPaymentModal(paymentMethod) {
    return new Promise((resolve) => {
        paymentModalTitle.textContent = `${paymentMethod} Payment Details`;
        paymentCustomerName.value = '';
        paymentRefNum.value = '';
        paymentModal.classList.add('is-visible');
        paymentCustomerName.focus();
        
        paymentModalResolve = resolve;
    });
}

function closePaymentModal() {
    paymentModal.classList.remove('is-visible');
    if (paymentModalResolve) {
        paymentModalResolve(null);
        paymentModalResolve = null;
    }
}

function confirmPaymentDetails() {
    const details = {
        cust_name: paymentCustomerName.value.trim(),
        ref_num: paymentRefNum.value.trim()
    };

    if (!details.ref_num) {
        showNotification('Please enter a reference number.', 'error');
        return;
    }

    // Validate reference number: must be exactly 13 digits
    const refNumPattern = /^\d{13}$/;
    if (!refNumPattern.test(details.ref_num)) {
        showNotification('Reference number must be exactly 13 digits only (no letters or special characters).', 'error');
        return;
    }

    paymentModal.classList.remove('is-visible');
    if (paymentModalResolve) {
        paymentModalResolve(details);
        paymentModalResolve = null;
    }
}

// --- RECEIPT PREVIEW MODAL FUNCTIONS (Updated to fix styles & size) ---

function setupReceiptPreviewModal() {
    // Make modal exactly 300px + padding to simulate receipt width
    const modalHTML = `
        <div id="receiptPreviewModal" class="payment-modal" style="z-index: 10001;">
            <div class="payment-modal-card" style="width: 340px; padding: 0; border-radius: 8px; overflow: hidden;">
                <button class="receipt-modal-close" id="receiptPreviewClose" style="position: absolute; top: 10px; right: 10px; background: #eee; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 20px;">&times;</button>
                
                <div id="receiptPreviewContent" style="padding: 0; background: white; overflow-y: auto; max-height: 80vh;">
                    <!-- Receipt content will be inserted here -->
                </div>
                
                <div style="padding: 15px; background: #f9f9f9; border-top: 1px solid #eee; text-align: center;">
                    <button id="receiptPreviewPrint" class="btn primary" style="width: 100%; padding: 10px;">
                        <i class="fa-solid fa-print"></i> Print Receipt
                    </button>
                </div>
            </div>
        </div>
    `;
    
    if (!document.getElementById('receiptPreviewModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
    
    receiptPreviewModal = document.getElementById('receiptPreviewModal');
    receiptPreviewClose = document.getElementById('receiptPreviewClose');
    receiptPreviewPrint = document.getElementById('receiptPreviewPrint');
    receiptPreviewContent = document.getElementById('receiptPreviewContent');
    
    receiptPreviewClose.addEventListener('click', closeReceiptPreview);
    receiptPreviewPrint.addEventListener('click', printReceipt);
    receiptPreviewModal.addEventListener('click', (e) => {
        if (e.target === receiptPreviewModal) closeReceiptPreview();
    });
}

function showReceiptPreview(receiptHTML) {
    if (receiptPreviewContent && receiptHTML) {
        // Save for printing later
        currentReceiptHTML = receiptHTML;
        
        // Inject HTML - wrap in a div to ensure centering/sizing
        receiptPreviewContent.innerHTML = `
            <div style="width: 300px; margin: 0 auto; padding: 10px; font-family: 'Courier New', monospace; font-size: 12px; color: #000; text-align: left;">
                ${receiptHTML}
            </div>
        `;
        
        // Strip out any <style> tags that affect 'body' to prevent preview from breaking page
        const styles = receiptPreviewContent.getElementsByTagName('style');
        for (let i = styles.length - 1; i >= 0; i--) {
            if (styles[i].innerHTML.includes('body {')) {
                styles[i].parentNode.removeChild(styles[i]);
            }
        }

        receiptPreviewModal.classList.add('is-visible');
    }
}

function closeReceiptPreview() {
    receiptPreviewModal.classList.remove('is-visible');
    // Clean up
    currentReceiptHTML = "";
    // Clear cart after closing
    clearCart();
    window.currentDiscount = null;
    document.getElementById('discountInput').disabled = false;
    loadProducts();
    loadIngredients();
    // loadRecentOrders(); // REMOVED: Recent Orders panel no longer needed
    if (cartCol && cartCol.classList.contains('is-mobile-open')) {
        toggleMobileCart();
    }
}

function printReceipt() {
    if (!currentReceiptHTML) return;

    // Create an invisible iframe to print without affecting main page styles
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <html>
        <head>
            <title>Print Receipt</title>
            <style>
                @page { size: 80mm auto; margin: 0; }
                body { margin: 0; padding: 10px; font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; color: #000; }
                .receipt-container { width: 100%; max-width: 80mm; }
                /* Re-add essential styles here if they were stripped or use inline styles from template */
            </style>
        </head>
        <body>
            ${currentReceiptHTML}
        </body>
        </html>
    `);
    doc.close();
    
    iframe.contentWindow.focus();
    setTimeout(() => {
        iframe.contentWindow.print();
        // Remove iframe after printing to clean up
        setTimeout(() => {
            document.body.removeChild(iframe);
            closeReceiptPreview();
        }, 1000);
    }, 500);
}


// --- ORDER PROCESSING ---

async function processOrder() {
    if (cart.length === 0) {
        return showNotification('Cart is empty', 'error');
    }

    // NOTE: Automatic add-ons prompt removed - users now use the "Modify" button on cart items
    // to add or change add-ons at any time before processing the order

    const paymentMethod = getSelectedPaymentMethod(); // Use button-based selection
    let paymentDetails = {};

    if (paymentMethod === 'Gcash' || paymentMethod === 'Card') {
        paymentDetails = await showPaymentModal(paymentMethod);
        
        if (paymentDetails === null) {
            showNotification('Payment cancelled.', 'info');
            return; 
        }
    }

    const orderItems = [];
    cart.forEach(item => {
        orderItems.push({ 
            id: item.id, 
            quantity: item.quantity, 
            price: item.price 
        });
        
        if (item.addOns && item.addOns.length > 0) {
            item.addOns.forEach(addOn => {
                orderItems.push({
                    id: addOn.id,
                    quantity: item.quantity,
                    price: addOn.price
                });
            });
        }
    });

    const discountInfo = window.currentDiscount || { type: 'regular', id: '' };
    const diningOption = getSelectedDiningOption(); // Use button-based selection

    const orderData = {
        items: orderItems,
        total: parseFloat(document.getElementById('totalDisplay').textContent.replace('₱', '')),
        discount: parseFloat(document.getElementById('discountInput').value || 0),
        discount_type: discountInfo.type,
        discount_id: discountInfo.id,
        payment_method: paymentMethod,
        dining_option: diningOption,
        customer_name: "Walk-in",
        payment_details: paymentDetails
    };
    
    const processOrderBtn = document.getElementById('processOrderBtn');
    processOrderBtn.disabled = true;
    processOrderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const response = await fetch('/api/process-order/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
            body: JSON.stringify(orderData)
        });
        const data = await response.json();

        if (response.ok && data.success) {
            showNotification('Order processed successfully!', 'success');

            // SHOW RECEIPT PREVIEW MODAL instead of auto-printing
            if (data.receipt_html) {
                showReceiptPreview(data.receipt_html);
            } else {
                // Fallback if no HTML returned
                clearCart();
                window.currentDiscount = null;
                document.getElementById('discountInput').disabled = false;
                await loadIngredients();
                await loadProducts();
                // loadRecentOrders(); // REMOVED: Recent Orders panel no longer needed
                if (cartCol && cartCol.classList.contains('is-mobile-open')) {
                    toggleMobileCart();
                }
            }

        } else {
            showNotification(data.error || 'Failed to process order. Please try again.', 'error');
            const currentCategory = document.getElementById('productsGrid').dataset.currentCategory || 'all';
            showProductView(currentCategory);
        }
    } catch (error) {
        console.error('Error processing order:', error);
        showNotification('Network error. Could not process order.', 'error');
        const currentCategory = document.getElementById('productsGrid').dataset.currentCategory || 'all';
        showProductView(currentCategory);
    } finally {
        processOrderBtn.disabled = false;
        processOrderBtn.innerHTML = '<i class="fa-solid fa-check"></i> Process Order';
    }
}

function toggleMobileCart() {
    if (cartCol) {
        cartCol.classList.toggle('is-mobile-open');
        document.body.classList.toggle('cart-overlay-open');
    }
}


// ============================================
// NEW: BUTTON-BASED CONTROLS (CATEGORY, PAYMENT, DINING)
// ============================================

function setupButtonControls() {
    // Category Buttons
    const categoryBtns = document.querySelectorAll('.category-btn');
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active from all
            categoryBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'white';
                b.style.color = '#333';
                b.style.borderColor = '#ddd';
            });
            // Add active to clicked
            this.classList.add('active');
            const category = this.dataset.category;

            // Special styling for bestselling
            if (category === 'bestselling') {
                this.style.background = '#ffc107';
                this.style.color = '#333';
                this.style.borderColor = '#ffc107';
            } else {
                this.style.background = '#8B4513';
                this.style.color = 'white';
                this.style.borderColor = '#8B4513';
            }

            // Show products for category
            if (category === 'bestselling') {
                showBestSellingProducts();
            } else {
                showProductView(category);
            }
        });
    });

    // Dining Option Buttons
    const diningBtns = document.querySelectorAll('.dining-btn');
    diningBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active from all
            diningBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'white';
                b.style.color = '#333';
                b.style.borderColor = '#ddd';
                b.style.boxShadow = 'none';
            });
            // Add active to clicked with glow effect
            this.classList.add('active');
            this.style.background = '#28a745';
            this.style.color = 'white';
            this.style.borderColor = '#28a745';
            this.style.boxShadow = '0 0 15px rgba(40, 167, 69, 0.5)';
        });
    });

    // Payment Method Buttons
    const paymentBtns = document.querySelectorAll('.payment-btn');
    paymentBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active from all
            paymentBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'white';
                b.style.color = '#333';
                b.style.borderColor = '#ddd';
                b.style.boxShadow = 'none';
            });
            // Add active to clicked with glow effect
            this.classList.add('active');
            this.style.background = '#28a745';
            this.style.color = 'white';
            this.style.borderColor = '#28a745';
            this.style.boxShadow = '0 0 15px rgba(40, 167, 69, 0.5)';
        });
    });
}

// Get selected dining option from buttons
function getSelectedDiningOption() {
    const activeDiningBtn = document.querySelector('.dining-btn.active');
    return activeDiningBtn ? activeDiningBtn.dataset.option : 'dine-in';
}

// Get selected payment method from buttons
function getSelectedPaymentMethod() {
    const activePaymentBtn = document.querySelector('.payment-btn.active');
    return activePaymentBtn ? activePaymentBtn.dataset.method : 'Cash';
}

// Show Best Selling Products (sorted by sales count from OrderItems)
async function showBestSellingProducts() {
    try {
        const response = await fetch('/api/best-selling-products/');
        const data = await response.json();

        if (data.success && data.products) {
            renderProducts(data.products);
            const grid = document.getElementById('productsGrid');
            if(grid) grid.dataset.currentCategory = 'bestselling';
        } else {
            showNotification('Failed to load best-selling products', 'error');
            // Fallback to all products
            renderProducts(allProducts);
        }
    } catch (error) {
        console.error('Error loading best-selling products:', error);
        showNotification('Failed to load best-selling products', 'error');
        // Fallback to all products
        renderProducts(allProducts);
    }
}


// ============================================
// NEW: ADMIN AUTHENTICATION FOR DISCOUNT/VOID
// ============================================

let adminPasswordModal;
let adminPasswordResolve = null;

function setupAdminPasswordModal() {
    adminPasswordModal = document.getElementById('adminPasswordModal');
    const adminPasswordCancel = document.getElementById('adminPasswordCancel');
    const adminPasswordConfirm = document.getElementById('adminPasswordConfirm');
    const adminPassword = document.getElementById('adminPassword');

    if (adminPasswordCancel) {
        adminPasswordCancel.addEventListener('click', () => {
            closeAdminPasswordModal();
            if (adminPasswordResolve) adminPasswordResolve(false);
        });
    }

    // Handler function for authentication
    const handleAuthentication = async () => {
        const password = adminPassword.value.trim();

        if (!password) {
            showNotification('Please enter admin password', 'error');
            return;
        }

        // Verify admin credentials via API (password-only)
        const isValid = await verifyAdminCredentials(null, password);

        if (isValid) {
            showNotification('Admin authenticated successfully', 'success');
            closeAdminPasswordModal();
            if (adminPasswordResolve) adminPasswordResolve(true);
        } else {
            showNotification('Invalid admin password', 'error');
            adminPassword.value = '';
            adminPassword.focus();
        }
    };

    if (adminPasswordConfirm) {
        adminPasswordConfirm.addEventListener('click', handleAuthentication);
    }

    // Add Enter key support
    if (adminPassword) {
        adminPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAuthentication();
            }
        });
    }

    if (adminPasswordModal) {
        adminPasswordModal.addEventListener('click', (e) => {
            if (e.target === adminPasswordModal) {
                closeAdminPasswordModal();
                if (adminPasswordResolve) adminPasswordResolve(false);
            }
        });
    }
}

function showAdminPasswordModal() {
    return new Promise((resolve) => {
        adminPasswordResolve = resolve;
        const adminPassword = document.getElementById('adminPassword');
        if (adminPassword) {
            adminPassword.value = '';
            adminPassword.focus();
        }
        if (adminPasswordModal) {
            adminPasswordModal.style.display = 'flex';
        }
    });
}

function closeAdminPasswordModal() {
    if (adminPasswordModal) {
        adminPasswordModal.style.display = 'none';
    }
    adminPasswordResolve = null;
}

async function verifyAdminCredentials(username, password) {
    try {
        const payload = { password };
        // If username is provided, include it (for discount feature)
        if (username) {
            payload.username = username;
        }

        const response = await fetch('/api/verify-admin/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        return data.success === true && data.is_admin === true;
    } catch (error) {
        console.error('Error verifying admin:', error);
        return false;
    }
}

async function requireAdminForDiscount() {
    const isAuthenticated = await showAdminPasswordModal();

    if (isAuthenticated) {
        // Show the discount modal
        showDiscountModal();
    } else {
        showNotification('Admin authentication required to apply discounts', 'error');
    }
}

// Void function with admin authentication
window.voidItem = async function(productId) {
    console.log('voidItem called for product:', productId);

    const isAuthenticated = await showAdminPasswordModal();
    console.log('Authentication result:', isAuthenticated);

    if (isAuthenticated) {
        // Remove the item from cart
        const index = cart.findIndex(i => i.id === productId);
        if (index > -1) {
            const itemName = cart[index].name;
            cart.splice(index, 1);
            updateCartDisplay();
            showNotification(`${itemName} voided successfully`, 'success');
        }
    } else {
        showNotification('Admin authentication required to void items', 'error');
    }
};


// ============================================
// NEW: MODIFY PRODUCT (ADD-ONS)
// ============================================

window.modifyProduct = async function(productId) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    // Pre-select existing add-ons
    selectedAddOns = item.addOns ? [...item.addOns] : [];

    const addOns = await showAddOnsModalForModify(item.name, item.addOns || []);

    // Update the cart item with new add-ons
    item.addOns = addOns;
    updateCartDisplay();

    if (addOns.length > 0) {
        showNotification(`Add-ons updated for ${item.name}`, 'success');
    } else {
        showNotification(`Add-ons removed from ${item.name}`, 'info');
    }
}

function showAddOnsModalForModify(productName, existingAddOns = []) {
    return new Promise((resolve) => {
        selectedAddOns = [...existingAddOns];
        addOnsProductName.textContent = productName;

        const addOnsProducts = allProducts.filter(p =>
            p.category === 'Add Ons' &&
            (p.stock > 0 || (p.recipe && p.recipe.length > 0))
        );

        if (addOnsProducts.length === 0) {
            resolve([]);
            return;
        }

        addOnsGrid.innerHTML = addOnsProducts.map(product => {
            // Check if this add-on is already selected
            const isSelected = existingAddOns.some(a => a.id === product.id);
            return `
                <div class="addon-card ${isSelected ? 'selected' : ''}" data-id="${product.id}" onclick="toggleAddOn(${product.id}, '${escapeJs(product.name)}', ${product.price})">
                    <img src="${product.image_url || '/static/pos/img/placeholder.jpg'}" alt="${escapeHtml(product.name)}">
                    <div class="name">${escapeHtml(product.name)}</div>
                    <div class="price">₱${parseFloat(product.price).toFixed(2)}</div>
                </div>
            `;
        }).join('');

        addOnsModal.classList.add('is-visible');
        addOnsModalResolve = resolve;
    });
}