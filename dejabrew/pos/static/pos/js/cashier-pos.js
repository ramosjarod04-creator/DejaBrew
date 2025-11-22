// Cashier POS JavaScript - Uses Database Ingredients, Server-Side Deduction

let cart = [];
let allProducts = [];
let productsByCategory = {};
let allIngredients = [];

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

// --- RECEIPT PREVIEW MODAL VARIABLES (NEW) ---
let receiptPreviewModal;
let receiptPreviewClose;
let receiptPreviewPrint;
let receiptPreviewContent;
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
        position: 'fixed', top: '20px', right: '20px', padding: '16px 24px',
        borderRadius: '8px', zIndex: '10000', fontWeight: '500',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)', animation: 'slideIn 0.3s ease',
        maxWidth: '400px', fontSize: '14px', background: '#fff'
    });
    const colors = {
        success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
        error: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
        info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
    };
    const color = colors[type] || colors.info;
    notification.style.background = color.bg;
    notification.style.color = color.color;
    notification.style.border = `1px solid ${color.border}`;
    const styleId = 'notification-keyframes-cashier';
    if (!document.getElementById(styleId)) {
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = ` @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } } `;
        document.head.appendChild(styleElement);
    }
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}


// --- INITIALIZATION & EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', async function() {
    await loadIngredients();
    await loadProducts();
    loadRecentOrders();
    setupEventListeners();
    updateCartDisplay();
    createAddOnsModal();
    setupDiscountModal();
    setupReceiptPreviewModal(); // Initialize Receipt Modal
});

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const processOrderBtn = document.getElementById('processOrderBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const discountInput = document.getElementById('discountInput');
    const categorySelect = document.getElementById('categorySelect');
    const applyDiscountBtn = document.getElementById('applyDiscountBtn');

    if (searchInput) searchInput.addEventListener('input', handleSearch);
    if (processOrderBtn) processOrderBtn.addEventListener('click', processOrder);
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    if (discountInput) discountInput.addEventListener('input', updateCartTotals);
    if (categorySelect) categorySelect.addEventListener('change', (e) => showProductView(e.target.value));
    if (applyDiscountBtn) applyDiscountBtn.addEventListener('click', showDiscountModal);

    window.addEventListener('storage', (event) => {
        if (event.key === 'productUpdate') {
            showNotification('Product list has been updated.', 'info');
            loadProducts();
        }
         if (event.key === 'inventoryUpdate') {
            showNotification('Inventory has been updated.', 'info');
            loadIngredients();
            const currentCategory = document.getElementById('productsGrid').dataset.currentCategory || 'all';
            showProductView(currentCategory);
        }
    });

    paymentModal = document.getElementById('paymentModal');
    paymentModalTitle = document.getElementById('paymentModalTitle');
    paymentCustomerName = document.getElementById('paymentCustomerName');
    paymentRefNum = document.getElementById('paymentRefNum');
    paymentModalCancel = document.getElementById('paymentModalCancel');
    paymentModalConfirm = document.getElementById('paymentModalConfirm');

    if (paymentModal) {
        paymentModalCancel.addEventListener('click', closePaymentModal);
        paymentModalConfirm.addEventListener('click', confirmPaymentDetails);
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) closePaymentModal();
        });
    }
}


// --- DATA LOADING (API) ---

async function loadIngredients() {
    try {
        const response = await fetch('/api/ingredients/');
        if (!response.ok) throw new Error('Network response was not ok');
        const ingredientsData = await response.json();
        allIngredients = ingredientsData.results || ingredientsData;
        console.log(`✅ Loaded ${allIngredients.length} ingredients from the database.`);
    } catch (error) {
        console.error('❌ Failed to load ingredients from the server:', error);
        showNotification('Could not load ingredients. Stock checks may fail.', 'error');
    }
}

async function loadProducts() {
    try {
        const response = await fetch('/api/products/');
        const data = await response.json();
        if (data.success) {
            allProducts = data.products;
            groupProductsByCategory();
            populateCategorySelect();
            showCategoryView();
        } else {
            showNotification('Failed to load products', 'error');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Failed to load products', 'error');
    }
}

async function loadRecentOrders() {
    try {
        const response = await fetch('/api/recent-orders/');
        const data = await response.json();
        const recentOrdersContainer = document.getElementById('recentOrders');
        if (data.orders && data.orders.length > 0) {
            recentOrdersContainer.innerHTML = data.orders.map(order => `
                <div class="recent-order-item">
                    <span>Order #${order.id} (${order.created_at})</span>
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
                    : `<button class="add-btn" onclick="addToCart(${product.id})">Add</button>`
                }
            </div>
        </div>
    `;
    }).join('');
}


// --- INVENTORY CHECK ---

function calculateMaxRecipeStock(product) {
    if (!product.recipe || product.recipe.length === 0) {
        return { maxCanMake: 0, missingIngredient: null };
    }
    
    let maxCanMake = Infinity;
    let bottleneck = null;

    for (const recipeItem of product.recipe) {
        const ingredient = allIngredients.find(ing => ing.name === recipeItem.ingredient);
        if (!ingredient) {
            console.warn(`Ingredient "${recipeItem.ingredient}" not found locally for product "${product.name}".`);
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
    document.getElementById('categorySelect').value = 'all';
}

window.showProductView = (category) => {
    const productsToShow = productsByCategory[category] || [];
    renderProducts(productsToShow);
    const grid = document.getElementById('productsGrid');
    if(grid) grid.dataset.currentCategory = category;
};

function showCategoryView() {
    showProductView('all');
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
        window.removeFromCart(productId);
        return;
    }
    
    const hasStock = (item.stock || 0) > 0;
    const hasRecipe = item.recipe && item.recipe.length > 0;
    
    if (hasStock) {
        if (newQuantity > item.stock) {
            showNotification('Cannot exceed available product stock', 'error');
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
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                    <input type="number" class="qty-input" value="${item.quantity}" min="1" max="999"
                           onchange="setQuantity(${item.id}, this.value)"
                           onkeypress="if(event.key==='Enter') this.blur()">
                    <button class="qty-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                </div>
                <div class="item-total">₱${(item.price * item.quantity).toFixed(2)}</div>
                <button class="remove-btn" onclick="removeFromCart(${item.id})">&times;</button>
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
    loadRecentOrders();
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
    
    for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const product = allProducts.find(p => p.id === item.id);
        
        if (!item.addOns || item.addOns.length === 0) {
            if (product && product.category !== 'Add Ons') {
                const addOns = await showAddOnsModal(item.name);
                item.addOns = addOns || [];
            }
        }
    }
    
    updateCartDisplay();

    const paymentMethod = document.getElementById('paymentMethod').value;
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
    
    const orderData = {
        items: orderItems,
        total: parseFloat(document.getElementById('totalDisplay').textContent.replace('₱', '')),
        discount: parseFloat(document.getElementById('discountInput').value || 0),
        discount_type: discountInfo.type,
        discount_id: discountInfo.id,
        payment_method: paymentMethod,
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
                loadRecentOrders();
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