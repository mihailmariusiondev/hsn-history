document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const searchInput = document.getElementById('productSearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const tableBody = document.getElementById('historyTableBody');
    const chartCanvas = document.getElementById('priceChart').getContext('2d');
    const chartMessage = document.getElementById('chartMessage');
    const modal = document.getElementById('detailsModal');
    const modalTitle = document.getElementById('modalTitle');
    const detailsTableBody = document.getElementById('detailsTableBody');
    const closeButton = document.querySelector('.close-button');

    // State Variables
    let allData = []; // Processed individual items
    let groupedData = new Map(); // group_key -> [items]
    let priceChartInstance = null;
    let currentlySelectedRow = null; // Track the selected table row

    // --- Utility Functions ---
    function escapeRegex(string) {
        if (!string) return '';
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // --- Data Processing Functions ---
    function parseProductName(name) {
         if (!name) return { base_name: 'Desconocido', size: null, flavor: null, group_key: 'Desconocido' };

        let original_name = name;
        let base_name = name.trim();
        let size = null;
        let flavor = null;

        // Patrones de tamaño/formato comunes (más específicos primero)
        const sizePatterns = [
            // Unidades específicas con 'x' (e.g., 2x15g)
            /(\d+\s*x\s*\d+g)/i,
            // Unidades de conteo
            /(\d+)\s*(x\d+)?\s*(veg caps?|softgels?|tabs?|cápsulas|caps|comprimidos|comp|perlas|gominolas|chuches|pastillas)/i,
            /(\d+)\s*(unidades?|uds?)/i,
            /(\d+)\s*(servicios?|serv|dosis)/i,
            /(\d+)\s*(viales?|sticks?|barritas?|packs?|ampollas?|sobres?)/i,
            // Pesos y volúmenes
            /(\d+\.?\d*)\s*Kg/i, /(\d+\.?\d*)\s*g/i, /(\d+\.?\d*)\s*L/i, /(\d+\.?\d*)\s*ml/i, /(\d+\.?\d*)\s*cc/i,
            // Tallas Ropa/Accesorios (más específicas primero)
            /\((XS|S|M|L|XL|XXL|XXXL)\)/i, /\b(XS|S|M|L|XL|XXL|XXXL)\b/i,
            // Dimensiones
            /(\d+x\d+cm)/i,
            // Otros formatos
            /(Pack\s*Degustación)/i,
            /(Dosificador)/i
        ];

        let sizeMatch = null;
        let matchedPattern = null;

        for (const pattern of sizePatterns) {
            const match = base_name.match(pattern);
            if (match && match[0]) {
                // Priorizar matches más largos o específicos que no empiecen con '-'
                const matchIndex = base_name.lastIndexOf(match[0]);
                 const charBefore = matchIndex > 0 ? base_name[matchIndex - 1] : '';
                if ((!sizeMatch || match[0].length > sizeMatch[0].length) && charBefore !== '-') {
                    sizeMatch = match;
                    matchedPattern = pattern;
                }
            }
        }

        if (sizeMatch) {
            size = sizeMatch[0].trim();
             // Limpiar nombre base quitando tamaño y lo que sigue (posible sabor/descripción)
            const sizeIndex = base_name.lastIndexOf(sizeMatch[0]);
            const potentialFlavor = base_name.substring(sizeIndex + sizeMatch[0].length).replace(/^-/, '').trim();
            base_name = base_name.substring(0, sizeIndex).trim();

             // Manejo especial para Ropa/Accesorios: Reintegrar descripción si no es sabor
             if (/^CAMISETA|^MOCHILA|^SHAKER|^TOALLA|^CORREAS|^CACITO|^DISPENSADOR|^MASCARILLA|^PASTILLERO/i.test(base_name)) {
                 if (potentialFlavor && !/sabor|neutro|natural|unflavored/i.test(potentialFlavor)) {
                     base_name = `${base_name} ${potentialFlavor}`;
                     flavor = null; // Ya está en el nombre base
                 } else {
                      flavor = potentialFlavor || null;
                 }
                 // Simplificar talla si se detectó
                 if (/\(?(XS|S|M|L|XL|XXL|XXXL)\)?/.test(size)) {
                     size = size.match(/(XS|S|M|L|XL|XXL|XXXL)/i)[0].toUpperCase();
                 }
             } else {
                 flavor = potentialFlavor || null;
             }

        } else {
            // Si no se encontró tamaño, quitar texto entre paréntesis al final como posible sabor/descripción
            const parenthesisMatch = base_name.match(/\s*\((.+)\)$/);
             if(parenthesisMatch && parenthesisMatch[1]){
                 // Comprobar si el texto entre paréntesis parece más una descripción que un tamaño
                 if (!/\d/.test(parenthesisMatch[1]) || /\w+/.test(parenthesisMatch[1].replace(/\d/g,''))) {
                      flavor = parenthesisMatch[1].trim();
                      base_name = base_name.substring(0, parenthesisMatch.index).trim();
                 }
             }
        }

        // Limpieza final del nombre base
         base_name = base_name.replace(/\s*-\s*$/, '').trim(); // Quitar guion colgando al final

        // Caso especial Pack Degustación
        if (/Pack Degustación/i.test(original_name)) {
           base_name = original_name.replace(/\s*-\s*$/, '').trim();
           size = null;
           flavor = null;
        }

        // Crear clave de grupo
        const group_key = size ? `${base_name} (${size})` : base_name;

        return { base_name, size, flavor, group_key };
    }

    async function fetchData() {
        try {
            const response = await fetch('hsn_order_history.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawData = await response.json();

            if (!rawData || rawData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6">No hay datos en el historial. Ejecuta primero el script de scraping.</td></tr>';
                showChartMessage("No hay datos disponibles.");
                return;
            }

            allData = rawData.map(item => {
                let unitPrice = 0;
                if (item.product_quantity > 0 && item.product_price > 0) {
                    unitPrice = item.product_price / item.product_quantity;
                }
                const nameParts = parseProductName(item.product_name);
                return {
                    ...item, ...nameParts, unit_price: unitPrice,
                    order_date_obj: item.order_date ? new Date(item.order_date) : null // Use null for invalid dates
                };
            }).filter(item => item.order_date_obj); // Filtrar items sin fecha válida

            // Ordenar todos los datos por fecha
            allData.sort((a, b) => a.order_date_obj - b.order_date_obj);

            // Agrupar datos
            groupedData.clear();
            allData.forEach(item => {
                if (!groupedData.has(item.group_key)) {
                    groupedData.set(item.group_key, []);
                }
                groupedData.get(item.group_key).push(item);
            });

            const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            populateTable(sortedGroupedData);
            showChartMessage("Selecciona un producto de la tabla o realiza una búsqueda exacta para ver su gráfico.");

        } catch (error) {
            console.error("Error al cargar o procesar los datos:", error);
            tableBody.innerHTML = `<tr><td colspan="6">Error al cargar datos. Verifica la consola y el archivo JSON.</td></tr>`;
            showChartMessage("Error al cargar los datos.");
        }
    }

    // --- UI Update Functions ---
    function populateTable(data) {
        tableBody.innerHTML = '';
        removeRowHighlight(); // Limpiar selección al repoblar

        if (!data || data.length === 0) {
            const message = searchInput.value.trim() ? 'No se encontraron grupos de productos.' : 'No hay datos.';
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">${message}</td></tr>`;
            return;
        }

        data.forEach(([groupKey, items]) => {
            if (!items || items.length === 0) return;

            const firstPurchase = items[0];
            const lastPurchase = items[items.length - 1];

            const row = tableBody.insertRow();
            row.dataset.groupKey = groupKey; // Guardar key en el dataset para fácil acceso

            row.insertCell().textContent = groupKey;
            row.insertCell().textContent = items.length;
            // Mostrar solo fecha en primeras/últimas compras para ahorrar espacio
            row.insertCell().textContent = firstPurchase.order_date;
            row.insertCell().textContent = lastPurchase.order_date;
            row.insertCell().textContent = `${lastPurchase.unit_price.toFixed(2)}`; // Sin € para ahorrar espacio

            const detailsCell = row.insertCell();
            const detailsButton = document.createElement('button');
            detailsButton.textContent = 'Detalles';
            detailsButton.classList.add('details-btn');
            detailsButton.onclick = (e) => {
                 e.stopPropagation(); // Evitar que el click en el botón active el click de la fila
                 showDetailsModal(groupKey, items);
            };
            detailsCell.appendChild(detailsButton);

            // Añadir listener para actualizar gráfico al hacer clic en la fila
            row.addEventListener('click', () => handleRowClick(row, groupKey, items));
        });
    }

    function handleRowClick(rowElement, groupKey, items) {
         console.log(`Row clicked: ${groupKey}`);
         removeRowHighlight();
         rowElement.classList.add('selected-row');
         currentlySelectedRow = rowElement;
         updateChart(items, groupKey); // Actualizar gráfico con los datos de la fila
    }

    function removeRowHighlight() {
        if (currentlySelectedRow) {
            currentlySelectedRow.classList.remove('selected-row');
            currentlySelectedRow = null;
        }
    }

    function showChartMessage(message) {
        chartMessage.textContent = message;
        chartMessage.style.display = message ? 'block' : 'none'; // Mostrar/ocultar según haya mensaje
         // Ocultar canvas si hay mensaje, mostrar si no hay
         chartCanvas.canvas.style.display = message ? 'none' : 'block';
    }

    function updateChart(items, groupKey) {
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }

        if (!items || items.length < 2) {
             showChartMessage(`Se necesita${items && items.length === 1 ? '' : 'n'} al menos 2 compras para graficar: "${groupKey}" (${items ? items.length : 0} encontrada${items && items.length === 1 ? '' : 's'}).`);
            return;
        }

        showChartMessage(null); // Ocultar mensaje si hay datos suficientes

        const sortedData = items.sort((a, b) => a.order_date_obj - b.order_date_obj);

        const chartData = sortedData.map(item => ({
            x: item.order_date_obj.getTime(), // Usar timestamp para el eje X de tiempo
            y: item.unit_price
        }));

        priceChartInstance = new Chart(chartCanvas, {
            type: 'line',
            data: {
                datasets: [{
                    label: `Precio Unitario (€) - ${groupKey}`,
                    data: chartData,
                    borderColor: 'var(--chart-line-color)',
                    backgroundColor: 'var(--chart-bg-color)',
                    tension: 0.1, // Suavizado ligero
                    fill: true,
                    pointBackgroundColor: 'var(--chart-line-color)',
                    pointRadius: 4,
                    pointHoverRadius: 7,
                     borderWidth: 2 // Grosor línea
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time', // Indicar que el eje X es de tiempo
                        time: {
                            unit: 'month', // Ajustar unidad según rango de fechas
                            tooltipFormat: 'dd/MM/yyyy', // Formato para tooltip
                            displayFormats: {
                                month: 'MMM yyyy', // Formato en el eje
                                year: 'yyyy'
                            }
                        },
                        title: { display: true, text: 'Fecha Pedido', font: { weight: '600' } },
                        grid: { display: false }
                    },
                    y: {
                        title: { display: true, text: 'Precio Unitario (€)', font: { weight: '600' } },
                        beginAtZero: false,
                        ticks: {
                            callback: value => value.toFixed(2) + ' €'
                        },
                        grid: {
                             color: 'rgba(200, 200, 200, 0.2)' // Rejilla Y sutil
                         }
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: groupKey, // Título más limpio
                        font: { size: 16, weight: '600' },
                        padding: { bottom: 15 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 12, // Más padding
                        callbacks: {
                            title: tooltipItems => {
                                const date = new Date(tooltipItems[0].parsed.x);
                                return `Fecha: ${date.toLocaleDateString('es-ES')}`; // Formato fecha local
                            },
                            label: context => {
                                const originalItem = sortedData.find(item => item.order_date_obj.getTime() === context.parsed.x);
                                let lines = [];
                                if (context.parsed.y !== null) {
                                    lines.push(`Precio Unitario: ${context.parsed.y.toFixed(2)} €`);
                                }
                                if (originalItem) {
                                    lines.push(`Producto Orig: ${originalItem.product_name}`);
                                    lines.push(`Cantidad: ${originalItem.product_quantity}`);
                                    lines.push(`Precio Total: ${originalItem.product_price !== null ? originalItem.product_price.toFixed(2) : 'N/A'} €`);
                                    lines.push(`Pedido ID: ${originalItem.order_id || 'N/A'}`);
                                }
                                return lines;
                            }
                        }
                    }
                },
                interaction: { mode: 'index', intersect: false },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    function showDetailsModal(groupKey, items) {
        modalTitle.textContent = `Detalles de Compra: ${groupKey}`;
        detailsTableBody.innerHTML = '';

        // Ordenar por fecha descendente para el modal (más reciente primero)
        items.sort((a, b) => b.order_date_obj - a.order_date_obj);

        items.forEach(item => {
            const row = detailsTableBody.insertRow();
            row.insertCell().textContent = item.order_date || 'N/A';
            row.insertCell().textContent = item.product_name || 'N/A';
            row.insertCell().textContent = item.product_quantity !== null ? item.product_quantity : 'N/A';
            row.insertCell().textContent = item.product_price !== null ? item.product_price.toFixed(2) : 'N/A';
            row.insertCell().textContent = item.unit_price !== null ? item.unit_price.toFixed(2) : 'N/A';
            row.insertCell().textContent = item.order_id || 'N/A';
        });
        modal.style.display = 'block';
    }

    // --- Event Listeners ---
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        removeRowHighlight(); // Quitar selección si se busca

        // Limpiar gráfico inmediatamente al buscar
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
        showChartMessage("Realiza una búsqueda exacta o selecciona un producto de la tabla.");


        if (!searchTerm) {
            const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            populateTable(sortedGroupedData);
            return;
        }

        const searchKeywords = searchTerm.split(/\s+/).filter(Boolean);
        const filteredGroups = Array.from(groupedData.entries()).filter(([key, items]) => {
            const groupKeyLower = key.toLowerCase();
            return searchKeywords.every(keyword => groupKeyLower.includes(keyword));
        }).sort((a, b) => a[0].localeCompare(b[0]));

        populateTable(filteredGroups);

        // Actualizar gráfico SOLO si la búsqueda da UN resultado
        if (filteredGroups.length === 1) {
            const [groupKey, items] = filteredGroups[0];
            updateChart(items, groupKey);
             // Opcional: seleccionar la fila automáticamente
             // const rowToSelect = tableBody.querySelector(`tr[data-group-key="${groupKey}"]`);
             // if (rowToSelect) handleRowClick(rowToSelect, groupKey, items);
        }
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        removeRowHighlight();
        const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        populateTable(sortedGroupedData);
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
        showChartMessage("Selecciona un producto de la tabla o realiza una búsqueda exacta.");
        searchInput.focus();
    });

    closeButton.onclick = () => { modal.style.display = 'none'; };
    window.onclick = (event) => { if (event.target == modal) modal.style.display = 'none'; };

    // --- Initial Load ---
    fetchData();
});
