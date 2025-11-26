// This script powers the "Specific Product Forecast" tool on the dashboard

// Wait for the DOM to be fully loaded before attaching listeners
document.addEventListener('DOMContentLoaded', function() {

    // Get all the new elements we added to dashboard.html
    const runButton = document.getElementById('runForecastButton');
    const productInput = document.getElementById('product_name_input');
    const daysInput = document.getElementById('days_input');
    const tableBody = document.getElementById('specificForecastTable').querySelector('tbody');
    const inventoryTableBody = document.getElementById('inventoryForecastTable').querySelector('tbody');
    const errorDiv = document.getElementById('forecastError');
    const chartCanvas = document.getElementById('specificProductChart');
    const inventoryBarCanvas = document.getElementById('inventoryBarChart');

    // Chart instances
    let specificProductChart = null;
    let inventoryBarChart = null;

    // ✅ TASK 1: Load and display ML metrics on page load
    loadMLMetrics();

    // Attach the main event listener to the "Run" button
    if (runButton) {
        runButton.addEventListener('click', runSpecificForecast);
    } else {
        console.error("Forecast 'Run' button not found!");
        return;
    }

    // Also allow pressing "Enter" in the input fields
    productInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') runSpecificForecast();
    });
    daysInput.addEventListener('keyup', function(e) {
        if (e.key === 'Enter') runSpecificForecast();
    });


    // This is the main function that runs the forecast
    async function runSpecificForecast() {
        const productName = productInput.value.trim();
        const days = daysInput.value;
        const origin = window.location.origin;

        // Reset UI
        errorDiv.textContent = '';
        tableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">Loading...</td></tr>';
        
        // --- 1. Build the API URL ---
        // We MUST include the 'item' parameter for this to work
        if (!productName) {
            errorDiv.textContent = 'Please enter a product name.';
            tableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">Run a forecast to see results.</td></tr>';
            return;
        }
        
        // This calls the same API as your other chart, but adds the 'item' parameter
        const apiUrl = `${origin}/forecasting/api/predict/?days=${days}&retrain=0&item=${encodeURIComponent(productName)}`;

        try {
            // --- 2. Fetch the data ---
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'No model found for that item.');
            }

            const data = await response.json();

            // --- 3. Process the Response ---
            // Your views.py returns 'predictions' as a list. For a single item, we want the first one.
            if (!data.success || !data.predictions || data.predictions.length === 0) {
                // This happens if the name was valid but no model was found
                throw new Error('No prediction data was returned for that item.');
            }

            // The data for a single item is the *first* item in the 'predictions' array
            const forecastData = data.predictions[0].predictions;

            // --- 4. Populate the Table ---
            populateTable(forecastData);

            // --- 5. Render the Chart ---
            renderChart(forecastData, productName);

            // --- 6. Populate Inventory Depletion Table ---
            if (data.inventory_forecast) {
                populateInventoryTable(data.inventory_forecast);

                // ✅ TASK 3: Render Inventory Bar Chart
                renderInventoryBarChart(data.inventory_forecast);

                // ✅ TASK 4: Save to localStorage for inventory page
                saveForecastToLocalStorage({
                    product: productName,
                    days: days,
                    inventory_forecast: data.inventory_forecast,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('Error running specific forecast:', error);
            errorDiv.textContent = `Error: ${error.message}`;
            tableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">Failed to get forecast.</td></tr>';
            inventoryTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Run a forecast to see inventory depletion.</td></tr>';
        }
    }

    function populateTable(data) {
        // Clear the "Loading..." row
        tableBody.innerHTML = '';
        
        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No data found.</td></tr>';
            return;
        }

        data.forEach(row => {
            // Format the date for readability
            const dt = new Date(row.date + 'T00:00:00'); // Add time to avoid timezone issues
            const prettyDate = (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${prettyDate}</td>
                <td>${row.predicted_quantity} units</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function renderChart(data, productName) {
        // Get the labels (dates) and data (quantities)
        const labels = data.map(p => {
             const dt = new Date(p.date + 'T00:00:00');
             return (dt.getMonth() + 1) + '/' + dt.getDate();
        });
        const values = data.map(p => p.predicted_quantity);

        const ctx = chartCanvas.getContext('2d');

        // Destroy the old chart if it exists
        if (specificProductChart) {
            specificProductChart.destroy();
        }

        // Create the new chart
        specificProductChart = new Chart(ctx, {
            type: 'bar', // A bar chart is better for single-item data
            data: {
                labels: labels,
                datasets: [{
                    label: `Predicted Sales for ${productName}`,
                    data: values,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)', // Green
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false } // Hide legend; title is in dataset label
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                // Only show whole numbers
                                if (value % 1 !== 0) {
                                    return null;
                                }
                                return value + ' units'; // e.g., "5 units"
                            }
                        }
                    }
                }
            }
        });
    }

    function populateInventoryTable(inventoryData) {
        // Clear the table
        inventoryTableBody.innerHTML = '';

        if (!inventoryData || inventoryData.length === 0) {
            inventoryTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No inventory data available.</td></tr>';
            return;
        }

        inventoryData.forEach(ingredient => {
            const tr = document.createElement('tr');

            // Safety: Ensure numeric values exist and default to 0 if undefined
            const currentStock = ingredient.current_stock ?? 0;
            const totalUsage = ingredient.total_usage ?? 0;
            const daysUntilDepleted = ingredient.days_until_depleted;
            const unit = ingredient.unit || '';
            const ingredientName = ingredient.ingredient || 'Unknown';

            // Determine status and color
            let statusText = '';
            let statusColor = '';

            if (daysUntilDepleted === null || daysUntilDepleted === 'N/A' || daysUntilDepleted === undefined) {
                statusText = '✓ OK';
                statusColor = '#28a745'; // Green
            } else if (daysUntilDepleted <= 0) {
                statusText = '⚠️ OUT OF STOCK';
                statusColor = '#dc2626'; // Red
            } else if (daysUntilDepleted <= 3) {
                statusText = '⚠️ CRITICAL';
                statusColor = '#dc2626'; // Red
            } else if (daysUntilDepleted <= 7) {
                statusText = '⚠️ LOW';
                statusColor = '#f59e0b'; // Orange
            } else {
                statusText = '✓ OK';
                statusColor = '#28a745'; // Green
            }

            // Format days until depleted with safety check
            const daysDisplay = (daysUntilDepleted === null || daysUntilDepleted === 'N/A' || daysUntilDepleted === undefined)
                ? 'N/A'
                : `${daysUntilDepleted} days`;

            tr.innerHTML = `
                <td><strong>${ingredientName}</strong></td>
                <td>${currentStock.toFixed(2)} ${unit}</td>
                <td>${totalUsage.toFixed(2)} ${unit}</td>
                <td>${daysDisplay}</td>
                <td style="color: ${statusColor}; font-weight: 600;">${statusText}</td>
            `;
            inventoryTableBody.appendChild(tr);
        });
    }

    // ✅ TASK 1: Load ML Metrics from API
    async function loadMLMetrics() {
        try {
            const response = await fetch('/metrics_dashboard/');
            if (!response.ok) {
                console.warn('ML metrics not available yet. Run model training first.');
                return;
            }

            const data = await response.json();
            if (data.success && data.metrics) {
                const metrics = data.metrics;

                // Update metrics display
                document.getElementById('avgAccuracy').textContent =
                    (metrics.average_metrics?.test_accuracy || 0) + '%';

                document.getElementById('avgR2').textContent =
                    (metrics.average_metrics?.test_r2 || 0).toFixed(4);

                document.getElementById('totalModels').textContent =
                    metrics.total_models_trained || 0;

                // Format date
                if (metrics.trained_date) {
                    const date = new Date(metrics.trained_date);
                    document.getElementById('lastTraining').textContent =
                        date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                }
            }
        } catch (error) {
            console.error('Error loading ML metrics:', error);
        }
    }

    // ✅ TASK 3: Render Inventory Bar Chart
    function renderInventoryBarChart(inventoryData) {
        if (!inventoryBarCanvas) {
            console.warn('Inventory bar chart canvas not found');
            return;
        }

        // Prepare data for chart
        const labels = inventoryData.map(ing => ing.ingredient);
        const stockData = inventoryData.map(ing => ing.current_stock);
        const usageData = inventoryData.map(ing => ing.total_usage);

        // Destroy existing chart if exists
        if (inventoryBarChart) {
            inventoryBarChart.destroy();
        }

        const ctx = inventoryBarCanvas.getContext('2d');
        inventoryBarChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Current Stock',
                        data: stockData,
                        backgroundColor: 'rgba(40, 167, 69, 0.7)', // Green
                        borderColor: 'rgba(40, 167, 69, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Predicted Usage',
                        data: usageData,
                        backgroundColor: 'rgba(220, 38, 38, 0.7)', // Red
                        borderColor: 'rgba(220, 38, 38, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                const unit = inventoryData[context.dataIndex].unit || '';
                                return `${label}: ${value.toFixed(2)} ${unit}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Quantity'
                        }
                    }
                }
            }
        });
    }

    // ✅ TASK 4: Save forecast data to localStorage
    function saveForecastToLocalStorage(forecastData) {
        try {
            localStorage.setItem('dejabrew_latest_forecast', JSON.stringify(forecastData));
            console.log('Forecast data saved to localStorage');
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }
});

