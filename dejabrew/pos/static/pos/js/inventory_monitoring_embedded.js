/**
 * Inventory Monitoring Embedded JavaScript
 * Handles the monitoring modal within the inventory page
 */

// Global state for monitoring
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

// Modal controls
function openMonitoringModal() {
    const modal = document.getElementById('monitoringModal');
    if (modal) {
        modal.style.display = 'flex';
        initializeMonitoringDateFilters();
        fetchMonitoringData();
    }
}

function closeMonitoringModal() {
    const modal = document.getElementById('monitoringModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Initialize date filters to show all data (1 year back)
function initializeMonitoringDateFilters() {
    const endDate = new Date();
    const startDate = new Date();
    // Go back 1 year to catch all historical data
    startDate.setFullYear(startDate.getFullYear() - 1);

    const endDateInput = document.getElementById('monitoring-end-date');
    const startDateInput = document.getElementById('monitoring-start-date');

    if (endDateInput) endDateInput.valueAsDate = endDate;
    if (startDateInput) startDateInput.valueAsDate = startDate;
}

// Fetch monitoring data
async function fetchMonitoringData() {
    try {
        showMonitoringLoading();

        const startDate = document.getElementById('monitoring-start-date').value;
        const endDate = document.getElementById('monitoring-end-date').value;
        const ingredientId = document.getElementById('monitoring-ingredient-filter').value;
        const transactionType = document.getElementById('monitoring-transaction-type-filter').value;

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

            updateMonitoringUI();
        } else {
            throw new Error(data.error || 'Unknown error');
        }

    } catch (error) {
        console.error('Error fetching monitoring data:', error);
        showMonitoringError('Failed to load monitoring data. Please try again.');
    }
}

// Show loading state
function showMonitoringLoading() {
    const transactionsTbody = document.getElementById('monitoring-transactions-tbody');
    const ingredientsTbody = document.getElementById('monitoring-ingredients-tbody');

    if (transactionsTbody) {
        transactionsTbody.innerHTML = `
            <tr>
                <td colspan="9" class="loading">
                    <i class="fas fa-spinner"></i><br>
                    Loading data...
                </td>
            </tr>
        `;
    }

    if (ingredientsTbody) {
        ingredientsTbody.innerHTML = `
            <tr>
                <td colspan="8" class="loading">
                    <i class="fas fa-spinner"></i><br>
                    Loading data...
                </td>
            </tr>
        `;
    }
}

// Show error message
function showMonitoringError(message) {
    const transactionsTbody = document.getElementById('monitoring-transactions-tbody');
    if (transactionsTbody) {
        transactionsTbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 40px; color: #dc3545;">
                    <i class="fas fa-exclamation-triangle"></i><br>
                    ${message}
                </td>
            </tr>
        `;
    }
}

// Update all UI elements
function updateMonitoringUI() {
    updateMonitoringSummaryStats();
    updateMonitoringTransactionsTable();
    updateMonitoringIngredientsTable();
    updateMonitoringIngredientDropdown();
    checkMonitoringForNoData();
}

// Check if there's no data and show setup notice
function checkMonitoringForNoData() {
    const { transactions } = monitoringData;
    const setupNotice = document.getElementById('monitoring-setup-notice');

    if (setupNotice) {
        if (transactions.length === 0) {
            setupNotice.style.display = 'block';
        } else {
            setupNotice.style.display = 'none';
        }
    }
}

// Update summary statistics
function updateMonitoringSummaryStats() {
    const { summary } = monitoringData;

    // Stock In
    const stockInCount = document.getElementById('monitoring-stock-in-count');
    const stockInCost = document.getElementById('monitoring-stock-in-cost');
    if (stockInCount) stockInCount.textContent = summary.stock_in?.count || 0;
    if (stockInCost) stockInCost.textContent = `₱${(summary.stock_in?.total_cost || 0).toFixed(2)}`;

    // Stock Out
    const stockOutCount = document.getElementById('monitoring-stock-out-count');
    const stockOutCost = document.getElementById('monitoring-stock-out-cost');
    if (stockOutCount) stockOutCount.textContent = summary.stock_out?.count || 0;
    if (stockOutCost) stockOutCost.textContent = `₱${(summary.stock_out?.total_cost || 0).toFixed(2)}`;

    // Waste
    const wasteCount = document.getElementById('monitoring-waste-count');
    const wasteCost = document.getElementById('monitoring-waste-cost');
    if (wasteCount) wasteCount.textContent = summary.waste?.count || 0;
    if (wasteCost) wasteCost.textContent = `₱${(summary.waste?.total_cost || 0).toFixed(2)}`;

    // Transfers
    const transfersCount = document.getElementById('monitoring-transfers-count');
    if (transfersCount) transfersCount.textContent = summary.transfers?.count || 0;
}

// Update transactions table
function updateMonitoringTransactionsTable() {
    const tbody = document.getElementById('monitoring-transactions-tbody');
    if (!tbody) return;

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
        const badgeClass = getMonitoringBadgeClass(txn.transaction_type);

        return `
            <tr>
                <td>${formatMonitoringDateTime(date)}</td>
                <td>${escapeHtml(txn.ingredient_name)}</td>
                <td>
                    <span class="transaction-badge ${badgeClass}">
                        ${escapeHtml(txn.transaction_type_display)}
                    </span>
                </td>
                <td>${formatMonitoringQuantity(txn.quantity)} ${escapeHtml(txn.unit)}</td>
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
function updateMonitoringIngredientsTable() {
    const tbody = document.getElementById('monitoring-ingredients-tbody');
    if (!tbody) return;

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
function updateMonitoringIngredientDropdown() {
    const select = document.getElementById('monitoring-ingredient-filter');
    if (!select) return;

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
function getMonitoringBadgeClass(type) {
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
function formatMonitoringDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Format quantity (show + for positive, - for negative)
function formatMonitoringQuantity(qty) {
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
async function exportMonitoringData() {
    try {
        const startDate = document.getElementById('monitoring-start-date').value;
        const endDate = document.getElementById('monitoring-end-date').value;
        const ingredientId = document.getElementById('monitoring-ingredient-filter').value;
        const transactionType = document.getElementById('monitoring-transaction-type-filter').value;

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

// Reset filters to default (1 year back)
function resetMonitoringFilters() {
    initializeMonitoringDateFilters();
    const ingredientFilter = document.getElementById('monitoring-ingredient-filter');
    const transactionTypeFilter = document.getElementById('monitoring-transaction-type-filter');

    if (ingredientFilter) ingredientFilter.value = '';
    if (transactionTypeFilter) transactionTypeFilter.value = '';

    fetchMonitoringData();
}

// Tab switching
function setupMonitoringTabs() {
    const tabButtons = document.querySelectorAll('.monitoring-tab-button');
    const tabContents = document.querySelectorAll('.monitoring-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            button.classList.add('active');
            const targetContent = document.getElementById(`monitoring-${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// Populate historical data via API
async function populateMonitoringHistoricalData() {
    const button = document.getElementById('monitoring-populate-btn');
    const resultDiv = document.getElementById('monitoring-populate-result');

    if (!button || !resultDiv) return;

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

// Initialize monitoring modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Setup modal open/close
    const monitorBtn = document.getElementById('monitorInventoryBtn');
    const closeBtn = document.getElementById('closeMonitoringModal');
    const modal = document.getElementById('monitoringModal');

    if (monitorBtn) {
        monitorBtn.addEventListener('click', openMonitoringModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeMonitoringModal);
    }

    // Close modal when clicking outside the modal card
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeMonitoringModal();
            }
        });
    }

    // Setup tabs
    setupMonitoringTabs();

    // Event listeners for filter buttons
    const applyFilterBtn = document.getElementById('monitoring-apply-filter');
    const resetFilterBtn = document.getElementById('monitoring-reset-filter');
    const exportCsvBtn = document.getElementById('monitoring-export-csv');
    const populateBtn = document.getElementById('monitoring-populate-btn');

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
            console.log('Monitoring: Apply Filter clicked');
            console.log('Start Date:', document.getElementById('monitoring-start-date').value);
            console.log('End Date:', document.getElementById('monitoring-end-date').value);
            fetchMonitoringData();
        });
    }

    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', resetMonitoringFilters);
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', exportMonitoringData);
    }

    if (populateBtn) {
        populateBtn.addEventListener('click', populateMonitoringHistoricalData);
    }

    // Allow enter key to apply filter
    const filterInputs = document.querySelectorAll('#monitoringModal .filter-group input, #monitoringModal .filter-group select');
    filterInputs.forEach(element => {
        element.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                fetchMonitoringData();
            }
        });
    });

    // Show hint when dates change
    const startDateInput = document.getElementById('monitoring-start-date');
    const endDateInput = document.getElementById('monitoring-end-date');

    if (startDateInput) {
        startDateInput.addEventListener('change', () => {
            console.log('Monitoring: Start date changed to:', startDateInput.value);
        });
    }

    if (endDateInput) {
        endDateInput.addEventListener('change', () => {
            console.log('Monitoring: End date changed to:', endDateInput.value);
        });
    }
});
