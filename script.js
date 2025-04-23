document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('productSearch');
    const tableBody = document.getElementById('historyTableBody');
    const chartCanvas = document.getElementById('priceChart').getContext('2d');

    let allData = []; // Para almacenar todos los datos procesados
    let priceChartInstance = null; // Para mantener la instancia del gráfico

    // 1. Función para cargar y procesar los datos
    async function fetchData() {
        try {
            const response = await fetch('hsn_order_history.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawData = await response.json();
            allData = processData(rawData);
            populateTable(allData); // Llenar la tabla inicialmente con todos los datos
            // No dibujamos el gráfico hasta que se busque algo
        } catch (error) {
            console.error("Error al cargar o procesar los datos:", error);
            tableBody.innerHTML = `<tr><td colspan="6">Error al cargar datos. Verifica que 'hsn_order_history.json' existe y es válido.</td></tr>`;
        }
    }

    // 2. Función para procesar datos (calcular precio unitario)
    function processData(data) {
        return data.map(item => {
            let unitPrice = null;
            if (item.product_quantity && item.product_quantity > 0 && item.product_price !== null) {
                unitPrice = item.product_price / item.product_quantity;
            }
            // Añadir el precio unitario al objeto
            return { ...item, unit_price: unitPrice };
        }).sort((a, b) => new Date(b.order_date) - new Date(a.order_date)); // Ordenar por fecha descendente inicialmente
    }

    // 3. Función para poblar la tabla HTML
    function populateTable(data) {
        tableBody.innerHTML = ''; // Limpiar tabla anterior
        if (!data || data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No se encontraron productos.</td></tr>';
            return;
        }

        data.forEach(item => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = item.order_date || 'N/A';
            row.insertCell().textContent = item.product_name || 'N/A';
            row.insertCell().textContent = item.product_quantity !== null ? item.product_quantity : 'N/A';
            row.insertCell().textContent = item.product_price !== null ? item.product_price.toFixed(2) : 'N/A';
            // Mostrar precio unitario formateado
            row.insertCell().textContent = item.unit_price !== null ? item.unit_price.toFixed(2) : 'N/A';
            row.insertCell().textContent = item.order_id || 'N/A';
        });
    }

    // 4. Función para actualizar/crear el gráfico
    function updateChart(data) {
        // Destruir gráfico anterior si existe
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }

        if (!data || data.length === 0) {
            // Opcional: podrías mostrar un mensaje en el canvas si no hay datos
            return;
        }

        // Verificar si todos los datos filtrados pertenecen al mismo producto (o muy pocos)
        const uniqueProductNames = [...new Set(data.map(item => item.product_name))];

        // Solo dibujar el gráfico si encontramos datos para UN solo producto
        if (uniqueProductNames.length !== 1) {
             console.log("Múltiples productos encontrados, no se dibujará el gráfico de evolución.");
             // Opcional: Limpiar el canvas o mostrar mensaje
             return;
        }
        const productName = uniqueProductNames[0];


        // Ordenar los datos por fecha para el gráfico
        const sortedData = data.sort((a, b) => new Date(a.order_date) - new Date(b.order_date));

        const labels = sortedData.map(item => item.order_date);
        const unitPrices = sortedData.map(item => item.unit_price);

        priceChartInstance = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Precio Unitario (€) - ${productName}`,
                    data: unitPrices,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Fecha Pedido'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Precio Unitario (€)'
                        },
                        beginAtZero: false // Empezar el eje Y cerca del valor mínimo
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2) + ' €';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // 5. Event Listener para el input de búsqueda
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();

        if (!searchTerm) {
            populateTable(allData); // Mostrar todo si la búsqueda está vacía
            updateChart(null); // Limpiar gráfico si no hay búsqueda
            return;
        }

        const filteredData = allData.filter(item =>
            item.product_name && item.product_name.toLowerCase().includes(searchTerm)
        );

        populateTable(filteredData);
        updateChart(filteredData); // Intentar actualizar el gráfico con los datos filtrados
    });

    // Carga inicial de datos
    fetchData();
});
