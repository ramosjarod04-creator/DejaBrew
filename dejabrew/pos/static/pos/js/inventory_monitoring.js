/**
 * Inventory Monitoring JavaScript
 * Handles filtering, data display, and export functionality
 */

// Global state
let monitoringData = {
    transactions: [],
    ingredientSummary: [],
    summary: {},
    ingredients: []
};

// CSRF Token setup
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = getCookie('csrftoken');

// Initialize date filters to show all data (1 year back)
function initializeDateFilters() {
    const endDate = new Date();
    const startDate = new Date();
    // Go back 1 year to catch all historical data
    startDate.setFullYear(startDate.getFullYear() - 1);

    document.getElementById('end-date').valueAsDate = endDate;
    document.getElementById('start-date').valueAsDate = startDate;
}

// Fetch monitoring data
async function fetchMonitoringData() {
    try {
        showLoading();

        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const ingredientId = document.getElementById('ingredient-filter').value;
        const transactionType = document.getElementById('transaction-type-filter').value;

        const params = new URLSearchParams();
        if (startDate) params.append('start_date', new Date(startDate).toISOString());
        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            params.append('end_date', endDateTime.toISOString());
        }
        if (ingredientId) params.append('ingredient_id', ingredientId);
        if (transactionType) params.append('transaction_type', transactionType);

        const response = await fetch(`/api/inventory-monitoring/?${params.toString()}`, {
            headers: {
                'X-CSRFToken': csrftoken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch monitoring data');

        const data = await response.json();

        if (data.success) {
            monitoringData = {
                transactions: data.transactions || [],
                ingredientSummary: data.ingredient_summary || [],
                summary: data.summary || {},
                ingredients: data.ingredients || []
            };

            updateUI();
        } else {
            throw new Error(data.error || 'Unknown error');
        }

    } catch (error) {
        console.error('Error fetching monitoring data:', error);
        showError('Failed to load monitoring data. Please try again.');
    }
}

// Show loading state
function showLoading() {
    const transactionsTbody = document.getElementById('transactions-tbody');
    const ingredientsTbody = document.getElementById('ingredients-tbody');

    transactionsTbody.innerHTML = `
        <tr>
            <td colspan="9" class="loading">
                <i class="fas fa-spinner"></i><br>
                Loading data...
            </td>
        </tr>
    `;

    ingredientsTbody.innerHTML = `
        <tr>
            <td colspan="8" class="loading">
                <i class="fas fa-spinner"></i><br>
                Loading data...
            </td>
        </tr>
    `;
}

// Show error message
function showError(message) {
    const transactionsTbody = document.getElementById('transactions-tbody');
    transactionsTbody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 40px; color: #dc3545;">
                <i class="fas fa-exclamation-triangle"></i><br>
                ${message}
            </td>
        </tr>
    `;
}

// Update all UI elements
function updateUI() {
    updateSummaryStats();
    updateTransactionsTable();
    updateIngredientsTable();
    updateIngredientDropdown();
    checkForNoData();
}

// Check if there's no data and show setup notice
function checkForNoData() {
    const { transactions } = monitoringData;
    const setupNotice = document.getElementById('setup-notice');

    if (transactions.length === 0) {
        setupNotice.style.display = 'block';
    } else {
        setupNotice.style.display = 'none';
    }
}

// Update summary statistics
function updateSummaryStats() {
    const { summary } = monitoringData;

    // Stock In
    document.getElementById('stock-in-count').textContent = summary.stock_in?.count || 0;
    document.getElementById('stock-in-cost').textContent =
        `₱${(summary.stock_in?.total_cost || 0).toFixed(2)}`;

    // Stock Out
    document.getElementById('stock-out-count').textContent = summary.stock_out?.count || 0;
    document.getElementById('stock-out-cost').textContent =
        `₱${(summary.stock_out?.total_cost || 0).toFixed(2)}`;

    // Waste
    document.getElementById('waste-count').textContent = summary.waste?.count || 0;
    document.getElementById('waste-cost').textContent =
        `₱${(summary.waste?.total_cost || 0).toFixed(2)}`;

    // Transfers
    document.getElementById('transfers-count').textContent = summary.transfers?.count || 0;
}

// Update transactions table
function updateTransactionsTable() {
    const tbody = document.getElementById('transactions-tbody');
    const { transactions } = monitoringData;

    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <i class="fas fa-inbox"></i><br>
                    No transactions found for the selected filters
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = transactions.map(txn => {
        const date = new Date(txn.created_at);
        const badgeClass = getBadgeClass(txn.transaction_type);

        return `
            <tr>
                <td>${formatDateTime(date)}</td>
                <td>${escapeHtml(txn.ingredient_name)}</td>
                <td>
                    <span class="transaction-badge ${badgeClass}">
                        ${escapeHtml(txn.transaction_type_display)}
                    </span>
                </td>
                <td>${formatQuantity(txn.quantity)} ${escapeHtml(txn.unit)}</td>
                <td>₱${txn.total_cost.toFixed(2)}</td>
                <td>${txn.main_stock_after.toFixed(2)} ${escapeHtml(txn.unit)}</td>
                <td>${txn.stock_room_after.toFixed(2)} ${escapeHtml(txn.unit)}</td>
                <td>${escapeHtml(txn.user)}</td>
                <td>${escapeHtml(txn.notes || '-')}</td>
            </tr>
        `;
    }).join('');
}

// Update ingredients summary table
function updateIngredientsTable() {
    const tbody = document.getElementById('ingredients-tbody');
    const { ingredientSummary } = monitoringData;

    if (ingredientSummary.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-inbox"></i><br>
                    No ingredient data found for the selected filters
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = ingredientSummary.map(ing => {
        return `
            <tr>
                <td><strong>${escapeHtml(ing.name)}</strong></td>
                <td>${escapeHtml(ing.category || '-')}</td>
                <td class="text-success">+${ing.stock_in.toFixed(2)} ${escapeHtml(ing.unit)}</td>
                <td class="text-danger">-${ing.stock_out.toFixed(2)} ${escapeHtml(ing.unit)}</td>
                <td class="text-warning">${ing.waste.toFixed(2)} ${escapeHtml(ing.unit)}</td>
                <td><strong>₱${ing.total_cost.toFixed(2)}</strong></td>
                <td>${ing.current_main_stock.toFixed(2)} ${escapeHtml(ing.unit)}</td>
                <td>${ing.current_stock_room.toFixed(2)} ${escapeHtml(ing.unit)}</td>
            </tr>
        `;
    }).join('');
}

// Update ingredient dropdown
function updateIngredientDropdown() {
    const select = document.getElementById('ingredient-filter');
    const currentValue = select.value;

    // Keep "All Ingredients" option and add all ingredients
    const options = ['<option value="">All Ingredients</option>'];

    monitoringData.ingredients.forEach(ing => {
        options.push(`<option value="${ing.id}">${escapeHtml(ing.name)}</option>`);
    });

    select.innerHTML = options.join('');

    // Restore previous selection if it exists
    if (currentValue) {
        select.value = currentValue;
    }
}

// Get badge class based on transaction type
function getBadgeClass(type) {
    switch(type) {
        case 'STOCK_IN':
            return 'stock-in';
        case 'STOCK_OUT':
            return 'stock-out';
        case 'WASTE':
            return 'waste';
        case 'TRANSFER_TO_MAIN':
        case 'TRANSFER_TO_ROOM':
            return 'transfer';
        default:
            return '';
    }
}

// Format date/time
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Format quantity (show + for positive, - for negative)
function formatQuantity(qty) {
    if (qty > 0) {
        return `+${qty.toFixed(2)}`;
    } else if (qty < 0) {
        return qty.toFixed(2);
    }
    return qty.toFixed(2);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Export to CSV/Excel
async function exportData() {
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const ingredientId = document.getElementById('ingredient-filter').value;
        const transactionType = document.getElementById('transaction-type-filter').value;

        const params = new URLSearchParams();
        if (startDate) params.append('start_date', new Date(startDate).toISOString());
        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            params.append('end_date', endDateTime.toISOString());
        }
        if (ingredientId) params.append('ingredient_id', ingredientId);
        if (transactionType) params.append('transaction_type', transactionType);
        params.append('format', 'csv');

        // Create a temporary link and click it to download
        const url = `/api/inventory-monitoring/export/?${params.toString()}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = 'inventory_monitoring.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Failed to export data. Please try again.');
    }
}

// Reset filters
function resetFilters() {
    initializeDateFilters();
    document.getElementById('ingredient-filter').value = '';
    document.getElementById('transaction-type-filter').value = '';
    fetchMonitoringData();
}

// Tab switching
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            button.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// Populate historical data via API
async function populateHistoricalData() {
    const button = document.getElementById('populate-btn');
    const resultDiv = document.getElementById('populate-result');

    try {
        // Disable button and show loading
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Populating...';
        resultDiv.style.display = 'none';

        const response = await fetch('/api/inventory-monitoring/populate/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': csrftoken,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#d4edda';
            resultDiv.style.color = '#155724';
            resultDiv.style.border = '1px solid #c3e6cb';
            resultDiv.innerHTML = `
                <strong>✓ Success!</strong> Historical data populated successfully.<br>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    <li>Stock Out Transactions: ${data.stats.stock_out}</li>
                    <li>Waste Transactions: ${data.stats.waste}</li>
                    <li>Total: ${data.stats.total}</li>
                </ul>
            `;

            // Reload data after 2 seconds
            setTimeout(() => {
                fetchMonitoringData();
            }, 2000);

        } else {
            throw new Error(data.error || 'Failed to populate data');
        }

    } catch (error) {
        console.error('Error populating historical data:', error);
        resultDiv.style.display = 'block';
        resultDiv.style.background = '#f8d7da';
        resultDiv.style.color = '#721c24';
        resultDiv.style.border = '1px solid #f5c6cb';
        resultDiv.innerHTML = `
            <strong>✗ Error:</strong> ${error.message}<br>
            <small>Please try running the command manually or check the console for details.</small>
        `;
    } finally {
        // Re-enable button
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-database"></i> Populate Historical Data';
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    initializeDateFilters();
    setupTabs();

    // Fetch initial data
    fetchMonitoringData();

    // Event listeners
    document.getElementById('apply-filter').addEventListener('click', fetchMonitoringData);
    document.getElementById('reset-filter').addEventListener('click', resetFilters);
    document.getElementById('export-csv').addEventListener('click', exportData);

    // Populate button (if it exists)
    const populateBtn = document.getElementById('populate-btn');
    if (populateBtn) {
        populateBtn.addEventListener('click', populateHistoricalData);
    }

    // Allow enter key to apply filter
    document.querySelectorAll('.filter-group input, .filter-group select').forEach(element => {
        element.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                fetchMonitoringData();
            }
        });
    });
});
