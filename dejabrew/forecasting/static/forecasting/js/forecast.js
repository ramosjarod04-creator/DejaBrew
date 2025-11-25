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

    // This variable will hold our chart instance
    let specificProductChart = null;

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

            // Determine status and color
            let statusText = '';
            let statusColor = '';

            if (ingredient.days_until_depleted === null || ingredient.days_until_depleted === 'N/A') {
                statusText = '✓ OK';
                statusColor = '#28a745'; // Green
            } else if (ingredient.days_until_depleted <= 0) {
                statusText = '⚠️ OUT OF STOCK';
                statusColor = '#dc2626'; // Red
            } else if (ingredient.days_until_depleted <= 3) {
                statusText = '⚠️ CRITICAL';
                statusColor = '#dc2626'; // Red
            } else if (ingredient.days_until_depleted <= 7) {
                statusText = '⚠️ LOW';
                statusColor = '#f59e0b'; // Orange
            } else {
                statusText = '✓ OK';
                statusColor = '#28a745'; // Green
            }

            tr.innerHTML = `
                <td><strong>${ingredient.ingredient}</strong></td>
                <td>${ingredient.current_stock.toFixed(2)} ${ingredient.unit || ''}</td>
                <td>${ingredient.total_usage.toFixed(2)} ${ingredient.unit || ''}</td>
                <td>${ingredient.days_until_depleted === null || ingredient.days_until_depleted === 'N/A' ? 'N/A' : ingredient.days_until_depleted + ' days'}</td>
                <td style="color: ${statusColor}; font-weight: 600;">${statusText}</td>
            `;
            inventoryTableBody.appendChild(tr);
        });
    }
});

