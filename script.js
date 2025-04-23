document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('productSearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn'); // Botón limpiar
    const tableBody = document.getElementById('historyTableBody');
    const chartCanvas = document.getElementById('priceChart').getContext('2d');
    const chartMessage = document.getElementById('chartMessage'); // Div para mensajes del gráfico

    let allData = []; // Para almacenar todos los datos procesados
    let priceChartInstance = null; // Para mantener la instancia del gráfico

    // Función auxiliar para escapar caracteres especiales para Regex
    function escapeRegex(string) {
        if (!string) return '';
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Función auxiliar para intentar extraer nombre base y tamaño
    function parseProductName(name) {
        if (!name) return { base_name: null, size: null, flavor: null, group_key: null };

        let original_name = name;
        let base_name = name.trim();
        let size = null;
        let flavor = null;

        const sizePatterns = [
            /(\d+\.?\d*)\s*Kg/i, /(\d+\.?\d*)\s*g/i, /(\d+\.?\d*)\s*ml/i,
            /(\d+)\s*Unidad(?:es)?/i, /(\d+)\s*cápsulas/i, /(\d+)\s*caps/i,
            /(\d+)\s*comprimidos/i, /(\d+)\s*comp/i, /(\d+)\s*tabs/i,
            /(\d+)\s*servicios/i, /(\d+)\s*serv/i, /(\d+)\s*dosis/i,
            /(\d+)\s*viales/i, /(\d+)\s*sticks/i, /(\d+)\s*barritas/i,
            /(\d+)\s*packs/i, /(\d+)\s*ampollas/i, /(\d+)\s*sobres/i,
            /(\d+)\s*pastillas/i, /(\d+)\s*perlas/i, /(\d+)\s*gominolas/i,
            /(\d+)\s*chuches/i
        ];

        let sizeMatch = null;
        for (const pattern of sizePatterns) {
            const match = base_name.match(pattern);
            if (match && match[0]) {
                if (!sizeMatch || match[0].length > sizeMatch[0].length) {
                    sizeMatch = match;
                }
            }
        }

        if (sizeMatch) {
            size = sizeMatch[0].trim();
            const sizeIndex = base_name.lastIndexOf(sizeMatch[0]);
            if (sizeIndex !== -1) {
                flavor = base_name.substring(sizeIndex + sizeMatch[0].length).trim();
                base_name = base_name.substring(0, sizeIndex).trim();
                if (flavor.startsWith('-')) flavor = flavor.substring(1).trim();
                if (!flavor) flavor = null;
            }
        }

        base_name = base_name.replace(/ \(.*?\)/g, '').trim();
        base_name = base_name.replace(/\s*-\s*$/, '').trim();

        const group_key = (base_name && size) ? `${base_name} | ${size}` : original_name;

        return { base_name, size, flavor, group_key };
    }


    // 1. Función para cargar y procesar los datos
    async function fetchData() {
        try {
            const response = await fetch('hsn_order_history.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const rawData = await response.json();
            if (!rawData || rawData.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="6">No hay datos en el historial. Ejecuta primero el script de scraping.</td></tr>';
                 showChartMessage("No hay datos en el historial.");
                 return;
            }
            allData = processData(rawData);
            populateTable(allData);
            showChartMessage("Introduce un término de búsqueda para ver el gráfico de evolución de un producto."); // Mensaje inicial
        } catch (error) {
            console.error("Error al cargar o procesar los datos:", error);
            tableBody.innerHTML = `<tr><td colspan="6">Error al cargar datos. Verifica que 'hsn_order_history.json' existe y es válido.</td></tr>`;
            showChartMessage("Error al cargar los datos.");
        }
    }

    // 2. Función para procesar datos (calcular precio unitario y parsear nombre)
    function processData(data) {
        return data.map(item => {
            let unitPrice = null;
            if (item.product_quantity && item.product_quantity > 0 && item.product_price !== null) {
                unitPrice = item.product_price / item.product_quantity;
            }
            const nameParts = parseProductName(item.product_name);
            return { ...item, ...nameParts, unit_price: unitPrice };
        }).sort((a, b) => new Date(b.order_date) - new Date(a.order_date));
    }

    // 3. Función para poblar la tabla HTML
    function populateTable(data) {
        tableBody.innerHTML = '';
        if (!data || data.length === 0) {
            // Ajustar mensaje si la tabla está vacía debido a una búsqueda sin resultados
            if (searchInput.value.trim()) {
                 tableBody.innerHTML = '<tr><td colspan="6">No se encontraron productos que coincidan con la búsqueda.</td></tr>';
            } else {
                 tableBody.innerHTML = '<tr><td colspan="6">No hay datos disponibles.</td></tr>';
            }
            return;
        }

        data.forEach(item => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = item.order_date || 'N/A';
            row.insertCell().textContent = item.product_name || 'N/A';
            row.insertCell().textContent = item.product_quantity !== null ? item.product_quantity : 'N/A';
            row.insertCell().textContent = item.product_price !== null ? item.product_price.toFixed(2) : 'N/A';
            row.insertCell().textContent = item.unit_price !== null ? item.unit_price.toFixed(2) : 'N/A';
            row.insertCell().textContent = item.order_id || 'N/A';
        });
    }

    // Función para mostrar/ocultar mensaje en el área del gráfico
    function showChartMessage(message) {
        if (message) {
            chartMessage.textContent = message;
            chartMessage.style.display = 'block';
        } else {
            chartMessage.style.display = 'none';
        }
    }

    // 4. Función para actualizar/crear el gráfico (mejorada)
    function updateChart(data) {
        // Destruir gráfico anterior y ocultar mensaje
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
        showChartMessage(null); // Ocultar mensaje por defecto

        if (!data || data.length === 0) {
            showChartMessage("No hay datos para mostrar en el gráfico con la búsqueda actual.");
            return;
        }

        const uniqueGroupKeys = [...new Set(data.map(item => item.group_key))];

        if (uniqueGroupKeys.length !== 1 || !uniqueGroupKeys[0] || uniqueGroupKeys[0] === data[0].product_name) {
             console.log("Múltiples grupos de productos encontrados o grupo no identificable, no se dibujará el gráfico de evolución.", uniqueGroupKeys);
             // Mostrar mensaje adecuado según si hay búsqueda o no
             if (searchInput.value.trim()) {
                 showChartMessage("La búsqueda coincide con múltiples tipos de productos. Refina tu búsqueda para ver un gráfico.");
             } else {
                 showChartMessage("Introduce un término de búsqueda para ver el gráfico de evolución de un producto.");
             }
             return;
        }
        const groupKey = uniqueGroupKeys[0];

        const groupData = data.filter(item => item.group_key === groupKey);

        // Necesitamos al menos 2 puntos para dibujar una línea útil
        if (groupData.length < 2) {
            showChartMessage(`Solo se encontró una compra para "${groupKey}". Se necesitan al menos dos para mostrar la evolución.`);
            return;
        }

        const sortedData = groupData.sort((a, b) => new Date(a.order_date) - new Date(b.order_date));

        const labels = sortedData.map(item => item.order_date);
        const unitPrices = sortedData.map(item => item.unit_price);

        priceChartInstance = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Precio Unitario (€) - ${groupKey}`,
                    data: unitPrices,
                    borderColor: 'var(--chart-line-color, rgb(40, 167, 69))', // Usar variable CSS
                    backgroundColor: 'rgba(40, 167, 69, 0.1)', // Relleno suave
                    tension: 0.1,
                    fill: true, // Rellenar área bajo la línea
                    pointBackgroundColor: 'var(--chart-line-color, rgb(40, 167, 69))', // Color de los puntos
                    pointRadius: 4, // Tamaño de los puntos
                    pointHoverRadius: 6 // Tamaño al pasar el ratón
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Fecha Pedido', font: { weight: 'bold' } },
                        grid: { display: false } // Ocultar rejilla X
                    },
                    y: {
                        title: { display: true, text: 'Precio Unitario (€)', font: { weight: 'bold' } },
                        beginAtZero: false, // Ajustar inicio del eje Y
                        ticks: {
                            // Formatear ticks del eje Y como moneda
                            callback: function(value, index, values) {
                                return value.toFixed(2) + ' €';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false // Ocultar leyenda si solo hay una línea
                    },
                    title: { // Añadir título al gráfico
                        display: true,
                        text: `Evolución del Precio Unitario: ${groupKey}`,
                        font: { size: 16 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 10,
                        callbacks: {
                            title: function(tooltipItems) {
                                // Mostrar fecha en el título del tooltip
                                return `Fecha: ${tooltipItems[0].label}`;
                            },
                            label: function(context) {
                                let label = `Precio Unitario: `;
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(2) + ' €';
                                }
                                // Añadir detalles del producto original
                                const originalItem = sortedData[context.dataIndex];
                                if (originalItem) {
                                    label += `\nProducto: ${originalItem.product_name}`;
                                    label += `\nCantidad: ${originalItem.product_quantity}`;
                                    label += `\nPrecio Total: ${originalItem.product_price.toFixed(2)} €`;
                                }
                                return label.split('\n'); // Mostrar en múltiples líneas
                            }
                        }
                    }
                },
                interaction: { // Mejorar interacción
                    mode: 'index',
                    intersect: false,
                },
                hover: {
                    mode: 'nearest',
                    intersect: true
                }
            }
        });
    }

    // 5. Event Listener para el input de búsqueda
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        console.log(`Buscando: "${searchTerm}"`);

        if (!searchTerm) {
            populateTable(allData);
            updateChart(null); // Limpiar gráfico
            showChartMessage("Introduce un término de búsqueda para ver el gráfico de evolución de un producto."); // Mostrar mensaje inicial
            return;
        }

        const searchKeywords = searchTerm.split(/\s+/).filter(Boolean);

        const filteredData = allData.filter(item => {
            const productNameLower = item.product_name ? item.product_name.toLowerCase() : '';
            if (!productNameLower) return false;
            return searchKeywords.every(keyword => productNameLower.includes(keyword));
        });

        console.log(`Resultados encontrados: ${filteredData.length}`);
        populateTable(filteredData);
        updateChart(filteredData); // Intentar actualizar gráfico
    });

    // 6. Event Listener para el botón Limpiar
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = ''; // Limpiar input
        populateTable(allData); // Mostrar todos los datos
        updateChart(null); // Limpiar gráfico
        showChartMessage("Introduce un término de búsqueda para ver el gráfico de evolución de un producto."); // Mostrar mensaje inicial
        searchInput.focus(); // Poner foco de nuevo en el input
    });


    // Carga inicial de datos
    fetchData();
});
