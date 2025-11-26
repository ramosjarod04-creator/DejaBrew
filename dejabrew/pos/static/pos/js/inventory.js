// inventory.js - Unified Inventory Management for Admin & Staff

let allIngredients = [];
let filteredIngredients = []; // For search/filter results
let consumptionData = {};
let inventoryForecastChart;
let editingIngredientId = null;
let currentForecastPeriod = 'daily';
let currentPage = 1;
const itemsPerPage = 20; // Match Sales Monitoring & Stock Room

// USER_ROLE is defined globally in the HTML <script> tag BEFORE this script runs

async function init() {
    if (typeof USER_ROLE === 'undefined') {
         console.error("USER_ROLE was not defined globally before inventory.js ran. Check script order in inventory.html.");
         USER_ROLE = 'staff';
    }
    console.log("Initializing inventory page. Role:", USER_ROLE);

    const ingredientModal = document.getElementById("ingredientModal");
    if (ingredientModal) {
        ingredientModal.style.display = 'none'; 
        console.log("Modal explicitly hidden on init.");
    }
    
    const wasteModal = document.getElementById("wasteModal");
    if (wasteModal) {
        wasteModal.style.display = 'none';
    }

    await loadIngredients();
    await fetchConsumptionData();
    filteredIngredients = [...allIngredients]; // Initialize filtered list
    populateCategoryFilter();
    populateWasteModalSelect();
    applyFilters(); // Use applyFilters instead of renderTable
    updateStatsUI();
    await renderInventoryForecast(currentForecastPeriod);
    loadForecastChartFromLocalStorage(); // Load forecast chart from localStorage
    setupEventListeners();
    applyRolePermissions();
}

document.addEventListener('DOMContentLoaded', init);


async function loadIngredients() {
    try {
        const response = await fetch('/api/ingredients/');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        allIngredients = data.results || data;
        console.log(`✅ Loaded ${allIngredients.length} ingredients.`);
    } catch (error) {
        console.error("Error loading ingredients:", error);
        showNotification("Could not load ingredients. Please refresh.", "error");
    }
}

async function fetchConsumptionData() {
    try {
        const response = await fetch('/api/inventory/consumption/');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        consumptionData = data.success ? data.daily_consumption : {};
    } catch (error) {
        console.error("Error fetching consumption data:", error);
    }
}

function getCSRFToken() {
    return document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || '';
}

// --- PAGINATION FUNCTIONS ---
function getTotalPages() {
    return Math.ceil(filteredIngredients.length / itemsPerPage);
}

function getPaginatedIngredients() {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredIngredients.slice(start, end);
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

function applyFilters() {
    const q = (document.getElementById("searchInput")?.value || '').trim().toLowerCase();
    const catFilter = document.getElementById("categoryFilter")?.value || 'all';

    filteredIngredients = allIngredients.filter(ing => {
        const matchesQ = q === '' || ing.name.toLowerCase().includes(q) || (ing.category || '').toLowerCase().includes(q);
        const matchesCat = catFilter === 'all' || ing.category === catFilter;
        return matchesQ && matchesCat;
    });

    // REQUIREMENT: Default sort by lowest usage → highest
    filteredIngredients.sort((a, b) => {
        const dailyUseA = consumptionData[a.name] || 0;
        const dailyUseB = consumptionData[b.name] || 0;
        return dailyUseA - dailyUseB; // Ascending order (lowest first)
    });

    currentPage = 1; // Reset to first page when filters change
    renderTable();
}

function renderTable() {
    const tbody = document.querySelector("#inventoryTable tbody");
    if (!tbody) return;
    tbody.innerHTML = '';

    const headerCells = document.querySelectorAll("#inventoryTable thead th");
    let colCount = headerCells.length > 0 ? headerCells.length : 10;

    if (filteredIngredients.length === 0) {
        const q = (document.getElementById("searchInput")?.value || '').trim();
        const catFilter = document.getElementById("categoryFilter")?.value || 'all';
        tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 20px; color: #999;">No ingredients found${q || catFilter !== 'all' ? ' matching filters' : '.'} ${USER_ROLE === 'admin' ? ' Add ingredients using the button above.' : ''}</td></tr>`;
        updatePaginationControls();
        return;
    }

    const paginatedIngredients = getPaginatedIngredients();

    paginatedIngredients.forEach((ing) => {
        const totalStock = (Number(ing.mainStock) || 0) + (Number(ing.stockRoom) || 0);
        let currentStatus = ing.status || 'In Stock';

        const dailyUse = consumptionData[ing.name] || 0;
        let daysUntilEmpty = '∞';
        let daysClass = '';
        if (dailyUse > 0 && totalStock > 0) {
            const days = Math.floor(totalStock / dailyUse);
            if (isFinite(days)) { 
                daysUntilEmpty = `${days} days`; 
                if (days < 7) daysClass = 'forecast-critical'; 
                else if (days < 30) daysClass = 'forecast-warn'; 
            }
        } else if (totalStock <= 0) { 
            daysUntilEmpty = '0 days'; 
            daysClass = 'forecast-critical'; 
        }

        let actionsHtml = '';
        if (USER_ROLE === 'admin') {
            actionsHtml = `<div class="admin-actions admin-only"><i class="fa fa-pen" title="Edit" data-action="edit" data-id="${ing.id}"></i> <i class="fa fa-trash" title="Delete" data-action="delete" data-id="${ing.id}"></i></div>`;
        } else if (USER_ROLE === 'staff') {
            actionsHtml = `<div class="status-actions" data-ingredient-id="${ing.id}"><button class="btn-instock ${currentStatus === 'In Stock' ? 'active' : ''}" data-status="In Stock">In Stock</button> <button class="btn-lowstock ${currentStatus === 'Low Stock' ? 'active' : ''}" data-status="Low Stock">Low</button> <button class="btn-outofstock ${currentStatus === 'Out of Stock' ? 'active' : ''}" data-status="Out of Stock">Out</button></div>`;
        }

        const tr = document.createElement('tr');
        const costCellHtml = `<td class="cost-column">${formatPHP(Number(ing.cost || 0))}</td>`;

        // REQUIREMENT: Aggressive visual alerts for low/out of stock (bright red)
        let rowStyle = '';
        let statusHtml = '';
        if (currentStatus.toLowerCase().includes('out')) {
            rowStyle = 'background-color: #fee2e2 !important; border-left: 4px solid #dc2626 !important;';
            statusHtml = `<span style="background:#dc2626; color:white; padding:6px 12px; border-radius:6px; font-size:13px; font-weight:700; display:inline-block;">
                <i class="fa fa-exclamation-triangle"></i> OUT OF STOCK
            </span>`;
        } else if (currentStatus.toLowerCase().includes('low')) {
            rowStyle = 'background-color: #fff3cd !important; border-left: 4px solid #ff6b6b !important;';
            statusHtml = `<span style="background:#ff6b6b; color:white; padding:6px 12px; border-radius:6px; font-size:13px; font-weight:700; display:inline-block;">
                <i class="fa fa-exclamation-circle"></i> LOW STOCK
            </span>`;
        } else {
            statusHtml = `<span style="background:#28a745; color:white; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;">
                <i class="fa fa-check-circle"></i> In Stock
            </span>`;
        }

        tr.style.cssText = rowStyle;
        tr.innerHTML = `
            <td>
                ${escapeHtml(ing.name)}
                ${ing.ingredient_type === 'perishable' ? '<span style="background:#ffeeba; color:#856404; padding:2px 6px; border-radius:10px; font-size:10px; margin-left:5px; vertical-align:middle;" title="Perishable">P</span>' : ''}
            </td>
            <td><span class="badge-cat ${catClass(ing.category)}">${escapeHtml(ing.category)}</span></td>
            <td>${Number(ing.mainStock)}</td>
            <td>${Number(ing.stockRoom)}</td>
            <td>${escapeHtml(ing.unit)}</td>
            ${costCellHtml}
            <td>${statusHtml}</td>
            <td class="text-center">${dailyUse.toFixed(2)} / day</td>
            <td class="text-center font-bold ${daysClass}">${daysUntilEmpty}</td>
            <td class="actions">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    applyColumnVisibility();
    applyRolePermissions();
    updatePaginationControls();
}

function applyColumnVisibility() {
    const table = document.getElementById('inventoryTable');
    if (!table) return;
    const costColumnIndex = 5;
    const displayStyle = USER_ROLE === 'admin' ? '' : 'none';
    const headerCells = table.querySelectorAll('thead th');
    if (headerCells.length > costColumnIndex) { headerCells[costColumnIndex].style.display = displayStyle; }
    table.querySelectorAll(`tbody td:nth-child(${costColumnIndex + 1})`).forEach(cell => { cell.style.display = displayStyle; });
}

function updateStatsUI() {
    const lowAlerts = allIngredients.filter(i => ((i.mainStock || 0) + (i.stockRoom || 0)) < (i.reorder || 0) && ((i.mainStock || 0) + (i.stockRoom || 0)) > 0).length;
    let value = allIngredients.reduce((sum, i) => sum + ((Number(i.mainStock) || 0) + (Number(i.stockRoom) || 0)) * (Number(i.cost) || 0), 0);
    const statIngredients = document.getElementById("statIngredients");
    const statLow = document.getElementById("statLow");
    const statValue = document.getElementById("statValue");
    if (statIngredients) statIngredients.textContent = allIngredients.length;
    if (statLow) statLow.textContent = lowAlerts;
    if (statValue) statValue.textContent = formatPHP(value);
}

function populateCategoryFilter() {
    const categoryFilter = document.getElementById("categoryFilter");
    const ingCategorySelect = document.getElementById("ingCategory");
    if (!categoryFilter) return;
    const cats = [...new Set(allIngredients.map(i => i.category).filter(Boolean))].sort();
    categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    if (ingCategorySelect) ingCategorySelect.innerHTML = '';
    cats.forEach(c => { const opt = new Option(c, c); categoryFilter.appendChild(opt); if (ingCategorySelect) ingCategorySelect.appendChild(opt.cloneNode(true)); });
    if (!cats.includes('other')) { const optOther = new Option('other', 'other'); categoryFilter.appendChild(optOther); if (ingCategorySelect) ingCategorySelect.appendChild(optOther.cloneNode(true)); }
}

function populateWasteModalSelect() {
    const wasteSelect = document.getElementById("wasteIngredientSelect");
    if (!wasteSelect) return;
    
    wasteSelect.innerHTML = '<option value="">Select an ingredient...</option>';
    allIngredients.filter(ing => ing.mainStock > 0).forEach(ing => {
        const opt = new Option(`${ing.name} (${ing.mainStock} ${ing.unit})`, ing.id);
        wasteSelect.appendChild(opt);
    });
}

async function renderInventoryForecast(period = 'daily') {
    currentForecastPeriod = period;
    
    const ctx = document.getElementById('inventoryForecastChart');
    if (!ctx) {
        console.error("Forecast chart canvas not found");
        return;
    }

    // Show loading state
    if (inventoryForecastChart) {
        inventoryForecastChart.destroy();
    }

    try {
        // Determine the number of days based on period
        const daysMap = {
            'daily': 7,
            'weekly': 14,
            'monthly': 30
        };
        const days = daysMap[period] || 7;

        // Get today's date in YYYY-MM-DD format (local time)
        const today = new Date();
        const endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // Fetch forecast data from your existing API
        const response = await fetch(`/forecasting/api/predict/?days=${days}&period=${period}&end_date=${endDate}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load forecast data');
        }

        // Extract inventory forecast data
        const inventoryForecast = data.inventory_forecast || [];
        
        if (inventoryForecast.length === 0) {
            showChartMessage(ctx, 'No forecast data available. Please ensure sales data exists.');
            return;
        }

        // Get ALL ingredients that have forecast data
        const allIngredientsWithForecast = inventoryForecast
            .filter(item => item.forecast && item.forecast.length > 0)
            .sort((a, b) => {
                // Sort by current daily consumption (descending)
                const aConsumption = consumptionData[a.name] || 0;
                const bConsumption = consumptionData[b.name] || 0;
                return bConsumption - aConsumption;
            });

        if (allIngredientsWithForecast.length === 0) {
            showChartMessage(ctx, 'No ingredients with forecast data available.');
            return;
        }

        // Prepare data for bar chart
        const labels = allIngredientsWithForecast.map(item => item.name);
        
        // Current usage (average daily consumption)
        const currentUsageData = allIngredientsWithForecast.map(item => {
            return consumptionData[item.name] || 0;
        });

        // Predicted usage (average of forecast values)
        const predictedUsageData = allIngredientsWithForecast.map(item => {
            if (item.forecast && item.forecast.length > 0) {
                // Calculate average daily consumption based on forecast depletion
                const currentStock = item.forecast[0]; // Starting stock
                const endStock = item.forecast[item.forecast.length - 1]; // Ending stock
                const stockUsed = Math.max(0, currentStock - endStock);
                const avgDailyUse = stockUsed / days;
                return avgDailyUse;
            }
            return 0;
        });

        // Create the bar chart
        inventoryForecastChart = new Chart(ctx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Current Usage (avg/day)',
                        data: currentUsageData,
                        backgroundColor: '#8B4513',
                        borderColor: '#6B3410',
                        borderWidth: 1,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    },
                    {
                        label: 'Predicted Usage (avg/day)',
                        data: predictedUsageData,
                        backgroundColor: '#28a745',
                        borderColor: '#1e7e34',
                        borderWidth: 1,
                        barPercentage: 0.8,
                        categoryPercentage: 0.9
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y.toFixed(2);
                                const ingredient = allIngredientsWithForecast[context.dataIndex];
                                const unit = ingredient.unit || 'units';
                                return `${label}: ${value} ${unit}`;
                            },
                            afterLabel: function(context) {
                                const ingredient = allIngredientsWithForecast[context.dataIndex];
                                
                                // Add warning if ingredient will run out soon
                                if (ingredient.days_to_empty !== null) {
                                    if (ingredient.days_to_empty <= 0) {
                                        return '⚠️ OUT OF STOCK';
                                    } else if (ingredient.days_to_empty < 7) {
                                        return `⚠️ ${ingredient.days_to_empty} days remaining`;
                                    } else if (ingredient.days_to_empty < 30) {
                                        return `${ingredient.days_to_empty} days remaining`;
                                    }
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Average Daily Usage',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Ingredients',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 10
                            }
                        },
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });

        console.log(`✅ Inventory forecast chart rendered for ${period} period - showing ${allIngredientsWithForecast.length} ingredients`);

    } catch (error) {
        console.error('Error rendering inventory forecast:', error);
        showChartMessage(ctx, `Error loading forecast: ${error.message}`);
    }
}

// Helper function to generate forecast labels
function generateForecastLabels(days, period) {
    const labels = [];
    
    if (period === 'daily') {
        for (let i = 1; i <= days; i++) {
            labels.push(`Day ${i}`);
        }
    } else if (period === 'weekly') {
        const weeks = Math.ceil(days / 7);
        for (let i = 1; i <= weeks; i++) {
            labels.push(`Week ${i}`);
        }
    } else if (period === 'monthly') {
        const months = Math.ceil(days / 30);
        for (let i = 1; i <= months; i++) {
            labels.push(`Month ${i}`);
        }
    }
    
    return labels;
}

// Helper function to show message on chart canvas
function showChartMessage(ctx, message) {
    const context = ctx.getContext('2d');
    context.clearRect(0, 0, ctx.width, ctx.height);
    context.font = '16px Arial';
    context.fillStyle = '#666';
    context.textAlign = 'center';
    context.fillText(message, ctx.width / 2, ctx.height / 2);
}

// ========================================
// INVENTORY FORECAST CHART FROM LOCALSTORAGE
// ========================================

/**
 * Load forecast data from localStorage and render the chart
 */
function loadForecastChartFromLocalStorage() {
    try {
        // Get data from localStorage
        const storedData = localStorage.getItem('dejabrew_latest_forecast');

        if (!storedData) {
            console.log('No forecast data found in localStorage');
            updateForecastChartUI(null);
            return;
        }

        const forecastData = JSON.parse(storedData);

        // Validate the data structure
        if (!forecastData.inventory_forecast || forecastData.inventory_forecast.length === 0) {
            console.log('No inventory forecast data available');
            updateForecastChartUI(null);
            return;
        }

        // Update UI elements
        updateForecastChartUI(forecastData);

        // Render the chart
        renderInventoryForecastChart(forecastData.inventory_forecast);

    } catch (error) {
        console.error('Error loading forecast from localStorage:', error);
        updateForecastChartUI(null);
    }
}

/**
 * Update the chart container UI with product name and date
 */
function updateForecastChartUI(forecastData) {
    const chartTitle = document.querySelector('.chart-container h2');
    const chartSubtitle = document.querySelector('.chart-container .muted');

    if (!chartTitle || !chartSubtitle) return;

    if (forecastData && forecastData.product && forecastData.timestamp) {
        // Format the timestamp
        const date = new Date(forecastData.timestamp);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        chartTitle.textContent = `Inventory Forecast for ${forecastData.product}`;
        chartSubtitle.textContent = `Forecast generated on ${formattedDate} (${forecastData.days} days projection)`;
    } else {
        chartTitle.textContent = 'Inventory Forecast';
        chartSubtitle.textContent = 'No forecast data available. Please run a product forecast from the Dashboard.';
    }
}

/**
 * Render the inventory forecast bar chart
 */
function renderInventoryForecastChart(inventoryForecastData) {
    const ctx = document.getElementById('inventoryForecastChart');

    if (!ctx) {
        console.error('Forecast chart canvas not found');
        return;
    }

    // Destroy existing chart if it exists
    if (inventoryForecastChart) {
        inventoryForecastChart.destroy();
    }

    // Prepare data for the chart
    const labels = inventoryForecastData.map(item => item.ingredient);
    const currentStockData = inventoryForecastData.map(item => item.current_stock || 0);
    const predictedUsageData = inventoryForecastData.map(item => item.total_usage || 0);

    // Create the bar chart
    inventoryForecastChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Current Stock',
                    data: currentStockData,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)', // Green
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                },
                {
                    label: 'Predicted Usage',
                    data: predictedUsageData,
                    backgroundColor: 'rgba(139, 69, 19, 0.7)', // Primary color (brown)
                    borderColor: 'rgba(139, 69, 19, 1)',
                    borderWidth: 1,
                    barPercentage: 0.8,
                    categoryPercentage: 0.9
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y.toFixed(2);
                            const ingredient = inventoryForecastData[context.dataIndex];
                            const unit = ingredient.unit || 'units';
                            return `${label}: ${value} ${unit}`;
                        },
                        afterLabel: function(context) {
                            const ingredient = inventoryForecastData[context.dataIndex];

                            // Add warning if ingredient will run out soon
                            if (ingredient.days_until_depleted !== null && ingredient.days_until_depleted !== undefined && ingredient.days_until_depleted !== 'N/A') {
                                if (ingredient.days_until_depleted <= 0) {
                                    return '⚠️ OUT OF STOCK';
                                } else if (ingredient.days_until_depleted <= 3) {
                                    return `⚠️ CRITICAL: ${ingredient.days_until_depleted} days remaining`;
                                } else if (ingredient.days_until_depleted <= 7) {
                                    return `⚠️ LOW: ${ingredient.days_until_depleted} days remaining`;
                                } else {
                                    return `${ingredient.days_until_depleted} days remaining`;
                                }
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(1);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Ingredients',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 45,
                        font: {
                            size: 10
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });

    console.log(`✅ Inventory forecast chart rendered from localStorage - showing ${inventoryForecastData.length} ingredients`);
}

function chartOptions(prefix = '') { return { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true }, tooltip: { callbacks: { label: function(context) { return (context.dataset.label || '') + `: ` + (context.parsed.y || 0).toFixed(2) + ' units'; } } } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Projected Stock' } } } }; }

function setupEventListeners() {
    const addBtn = document.getElementById('addIngredientBtn');
    if (addBtn) addBtn.addEventListener('click', () => openIngredientModal());

    document.getElementById('refreshBtn')?.addEventListener('click', init);
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    document.getElementById('categoryFilter')?.addEventListener('change', applyFilters);

    // Pagination event listeners
    const firstPageBtn = document.getElementById('firstPageBtn');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const lastPageBtn = document.getElementById('lastPageBtn');

    if (firstPageBtn) firstPageBtn.addEventListener('click', () => {
        if (currentPage !== 1) {
            currentPage = 1;
            renderTable();
        }
    });

    if (prevPageBtn) prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
        const totalPages = getTotalPages();
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    if (lastPageBtn) lastPageBtn.addEventListener('click', () => {
        const totalPages = getTotalPages();
        if (currentPage !== totalPages && totalPages > 0) {
            currentPage = totalPages;
            renderTable();
        }
    });

    document.querySelector("#inventoryTable tbody")?.addEventListener('click', async (e) => {
        const actionElement = e.target.closest('[data-action]');
        const statusButton = e.target.closest('button[data-status]');

        if (actionElement && USER_ROLE === 'admin') {
            const action = actionElement.dataset.action;
            const id = Number(actionElement.dataset.id);
            if (action === 'edit') openIngredientModal(id);
            if (action === 'delete') { if (confirm('Delete this ingredient? This action cannot be undone.')) { await deleteIngredient(id); } }
        } else if (statusButton && USER_ROLE === 'staff') {
            const statusCell = statusButton.closest('.status-actions');
            if (!statusCell) return;
            const ingredientId = statusCell.dataset.ingredientId;
            const newStatus = statusButton.dataset.status;
            if (ingredientId && newStatus && !statusButton.classList.contains('active')) {
                await updateIngredientStatus(ingredientId, newStatus, statusCell);
            }
        }
    });

    const ingredientModal = document.getElementById("ingredientModal");
    if (ingredientModal) {
        document.getElementById("closeIngredientModal")?.addEventListener('click', closeIngredient);
        document.getElementById("cancelIngredient")?.addEventListener('click', closeIngredient);
        ingredientModal.addEventListener('click', (e) => { if (e.target === ingredientModal) closeIngredient(); });
        document.getElementById("ingredientForm")?.addEventListener('submit', handleIngredientSubmit);
    }

    const filterButtons = document.querySelectorAll('#inventoryFilter button');
    filterButtons.forEach(button => { 
        button.addEventListener('click', () => { 
            filterButtons.forEach(btn => btn.classList.remove('active')); 
            button.classList.add('active'); 
            const period = button.dataset.period;
            renderInventoryForecast(period); 
        }); 
    });

    window.addEventListener('storage', (event) => {
        if (event.key === 'inventoryUpdate') {
            showNotification('Stock was transferred from Stock Room. Refreshing list...', 'info');
            init(); // Re-run init to get fresh data
        }
    });
    
    const wasteModal = document.getElementById("wasteModal");
    if (wasteModal) {
        document.getElementById("recordWasteBtn")?.addEventListener('click', openWasteModal);
        document.getElementById("closeWasteModal")?.addEventListener('click', closeWasteModal);
        document.getElementById("cancelWaste")?.addEventListener('click', closeWasteModal);
        wasteModal.addEventListener('click', (e) => { if (e.target === wasteModal) closeWasteModal(); });
        document.getElementById("wasteForm")?.addEventListener('submit', handleWasteSubmit);
    }
}

function applyRolePermissions() {
    console.log("Applying permissions for role:", USER_ROLE);
    const adminElements = document.querySelectorAll('.admin-only');
    
    adminElements.forEach(el => {
        if (USER_ROLE === 'admin') {
            if (el.classList.contains('modal')) {
                // leave it alone
            } else if (el.tagName === 'BUTTON' || el.classList.contains('btn')) {
                el.style.display = 'inline-block';
            } else if (el.tagName === 'I' || el.classList.contains('admin-actions')) {
                 el.style.display = 'inline-flex';
            } else {
                el.style.display = 'block';
            }
        } else {
            el.style.display = 'none';
        }
    });
    applyColumnVisibility();
}


function openIngredientModal(id) {
    if (USER_ROLE !== 'admin') { console.warn("Attempted to open modal as non-admin."); return; }
    const modal = document.getElementById("ingredientModal");
    const form = document.getElementById("ingredientForm");
    if (!modal || !form) { console.error("Modal or form not found!"); return; }
    
    console.log("Opening modal...");
    modal.classList.add('visible'); // Use class to show
    
    if (id) {
        editingIngredientId = id;
        document.getElementById("ingredientModalTitle").textContent = 'Edit Ingredient';
        const ing = allIngredients.find(i => i.id === id);
        if (!ing) return;
        form.querySelector('#ingId').value = ing.id;
        form.querySelector('#ingName').value = ing.name;
        form.querySelector('#ingCategory').value = ing.category;
        form.querySelector('#ingNewCategory').value = ''; // Clear input on edit
        form.querySelector('#ingIngredientType').value = ing.ingredient_type || 'non-perishable'; 
        form.querySelector('#ingMainStock').value = ing.mainStock;
        form.querySelector('#ingStockRoom').value = ing.stockRoom;
        form.querySelector('#ingUnit').value = ing.unit;
        form.querySelector('#ingCost').value = ing.cost;
    } else {
        editingIngredientId = null;
        document.getElementById("ingredientModalTitle").textContent = 'Add Ingredient';
        form.reset();
        form.querySelector('#ingId').value = '';
        form.querySelector('#ingNewCategory').value = ''; 
        form.querySelector('#ingIngredientType').value = 'non-perishable'; 
    }
}

function closeIngredient() {
    const modal = document.getElementById("ingredientModal");
    if (modal) modal.classList.remove('visible'); // Use class to hide
    editingIngredientId = null;
}

async function handleIngredientSubmit(e) {
    e.preventDefault();
    if (USER_ROLE !== 'admin') return;
    const form = e.target;
    
    // --- NEW: Check if user typed a new category ---
    const selectedCategory = form.querySelector('#ingCategory')?.value;
    const newCategory = form.querySelector('#ingNewCategory')?.value.trim();
    const finalCategory = newCategory || selectedCategory; // Use typed one if exists
    // --- END NEW ---

    const data = {
        name: form.querySelector('#ingName')?.value.trim(),
        category: finalCategory,
        ingredient_type: form.querySelector('#ingIngredientType')?.value, 
        mainStock: parseFloat(form.querySelector('#ingMainStock')?.value || 0),
        stockRoom: parseFloat(form.querySelector('#ingStockRoom')?.value || 0),
        unit: form.querySelector('#ingUnit')?.value.trim(),
        cost: parseFloat(form.querySelector('#ingCost')?.value || 0)
    };
    if (!data.name) { showNotification('Name is required', 'error'); return; }
    const url = editingIngredientId ? `/api/ingredients/${editingIngredientId}/` : '/api/ingredients/';
    const method = editingIngredientId ? 'PUT' : 'POST';
    try {
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() }, body: JSON.stringify(data) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(JSON.stringify(errorData)); }
        
        localStorage.setItem('inventoryUpdate', Date.now().toString()); // Notify other tabs
        
        closeIngredient();
        await init(); // Rerun init to refresh everything
        showNotification(`Ingredient ${editingIngredientId ? 'updated' : 'added'}.`, 'success');
    } catch (error) { console.error('Failed to save ingredient:', error); showNotification(`Failed to save ingredient: ${error.message}`, 'error'); }
}

async function deleteIngredient(id) {
     if (USER_ROLE !== 'admin') return;
     try {
        const response = await fetch(`/api/ingredients/${id}/`, { method: 'DELETE', headers: { 'X-CSRFToken': getCSRFToken() } });
        if (!response.ok) { let errorMsg = 'Failed to delete.'; try { const d = await response.json(); errorMsg = d.detail || JSON.stringify(d); } catch (e) { /* Ignore */ } throw new Error(errorMsg); }
        
        localStorage.setItem('inventoryUpdate', Date.now().toString()); // Notify other tabs

        await init(); // Rerun init
        showNotification('Ingredient deleted.', 'success');
    } catch (error) { console.error('Error deleting:', error); showNotification(`Error deleting: ${error.message}`, 'error'); }
}

async function updateIngredientStatus(id, status, statusCell) {
    if (!id || !status || (USER_ROLE !== 'staff' && USER_ROLE !== 'admin') ) return;
    try {
        const response = await fetch(`/api/ingredients/${id}/`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() }, body: JSON.stringify({ status: status }) });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.detail || JSON.stringify(errorData)); }
        
        localStorage.setItem('inventoryUpdate', Date.now().toString()); // Notify other tabs
        
        if (statusCell) { const buttons = statusCell.querySelectorAll('button'); buttons.forEach(btn => btn.classList.remove('active')); const activeButton = statusCell.querySelector(`button[data-status="${status}"]`); if (activeButton) activeButton.classList.add('active'); const row = statusCell.closest('tr'); const statusPill = row?.querySelector('.pill'); if (statusPill) { statusPill.textContent = status; statusPill.className = `pill ${statusClass(status)}`; }
        } else { await loadIngredients(); renderTable(); }
        const index = allIngredients.findIndex(ing => ing.id == id); if (index > -1) allIngredients[index].status = status;
        showNotification(`Ingredient status updated to ${status}. Admin notified.`, 'success');
    } catch (error) { console.error('Failed to update status:', error); showNotification(`Failed to update status: ${error.message}`, 'error'); }
}

function openWasteModal() {
    const modal = document.getElementById("wasteModal");
    const form = document.getElementById("wasteForm");
    if (modal) modal.classList.add('visible');
    if (form) form.reset();
    populateWasteModalSelect(); // Re-populate to get current stock
}

function closeWasteModal() {
    const modal = document.getElementById("wasteModal");
    if (modal) modal.classList.remove('visible');
}

async function handleWasteSubmit(e) {
    e.preventDefault();
    const ingredientId = document.getElementById("wasteIngredientSelect").value;
    const quantity = document.getElementById("wasteQuantity").value;
    const reason = document.getElementById("wasteReason").value;
    
    if (!ingredientId || !quantity || quantity <= 0) {
        showNotification('Please select an ingredient and enter a valid quantity.', 'error');
        return;
    }
    
    const payload = {
        ingredient_id: ingredientId,
        quantity: quantity,
        reason: reason
    };

    try {
        const response = await fetch('/api/record-waste/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to record waste.');
        }

        localStorage.setItem('inventoryUpdate', Date.now().toString()); // Notify other tabs
        
        closeWasteModal();
        await init(); // Rerun init to refresh everything
        showNotification(data.message || 'Waste recorded successfully.', 'success');
        
    } catch (error) {
        console.error('Failed to record waste:', error);
        showNotification(error.message, 'error');
    }
}


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
    const styleId = 'notification-keyframes-inventory';
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