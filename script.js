document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('productSearch');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const tableBody = document.getElementById('historyTableBody');
    const chartCanvas = document.getElementById('priceChart').getContext('2d');
    const chartMessage = document.getElementById('chartMessage');
    const modal = document.getElementById('detailsModal');
    const modalTitle = document.getElementById('modalTitle');
    const detailsTableBody = document.getElementById('detailsTableBody');
    const closeButton = document.querySelector('.close-button');

    let allData = []; // Almacena los items individuales procesados
    let groupedData = new Map(); // Almacena los datos agrupados (group_key -> [items])
    let priceChartInstance = null;

    // Función auxiliar para escapar caracteres especiales para Regex
    function escapeRegex(string) {
        if (!string) return '';
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Función mejorada para extraer nombre base, formato/tamaño y crear group_key
    function parseProductName(name) {
        if (!name) return { base_name: 'Desconocido', size: null, flavor: null, group_key: 'Desconocido' };

        let original_name = name;
        let base_name = name.trim();
        let size = null;
        let flavor = null;

        // Patrones de tamaño/formato comunes (más específicos primero)
        const sizePatterns = [
            // Unidades específicas
            /(\d+)\s*(x\d+)?\s*(veg caps?|softgels?|tabs?|cápsulas|caps|comprimidos|comp|perlas|gominolas|chuches|pastillas)/i,
            /(\d+)\s*(unidades?|uds?)/i,
            /(\d+)\s*(servicios?|serv|dosis)/i,
            /(\d+)\s*(viales?|sticks?|barritas?|packs?|ampollas?|sobres?)/i,
            // Pesos y volúmenes
            /(\d+\.?\d*)\s*Kg/i, /(\d+\.?\d*)\s*g/i, /(\d+\.?\d*)\s*L/i, /(\d+\.?\d*)\s*ml/i, /(\d+\.?\d*)\s*cc/i,
            // Tallas Ropa/Accesorios
            /\((XS|S|M|L|XL|XXL|XXXL)\)/i, /\b(XS|S|M|L|XL|XXL|XXXL)\b/i,
            // Otros formatos
            /\((\d+)\s*x\s*(\d+g)\)/i, // (2x15g)
            /(\d+x\d+cm)/i, // 35x43cm
            /(Pack\s*Degustación)/i,
            /(Dosificador)/i,
            /(2 UNIDADES)/i // Para correas
        ];

        let sizeMatch = null;
        let matchedPattern = null;

        for (const pattern of sizePatterns) {
            const match = base_name.match(pattern);
            // Priorizar matches más largos o más específicos si se solapan
            if (match && match[0] && (!sizeMatch || match[0].length > sizeMatch[0].length)) {
                 // Evitar que el tamaño capture parte del nombre base si hay '-' antes
                 const potentialDashIndex = base_name.indexOf(match[0]) - 1;
                 if (potentialDashIndex < 0 || base_name[potentialDashIndex] !== '-') {
                     sizeMatch = match;
                     matchedPattern = pattern;
                 }
            }
        }

        if (sizeMatch) {
            size = sizeMatch[0].trim();
            const sizeIndex = base_name.lastIndexOf(sizeMatch[0]);
            // Intentar extraer sabor de lo que viene DESPUÉS del tamaño
            flavor = base_name.substring(sizeIndex + sizeMatch[0].length).replace(/^-/, '').trim();
            // Limpiar nombre base quitando el tamaño y el texto posterior (sabor)
            base_name = base_name.substring(0, sizeIndex).trim();
            if (!flavor) flavor = null;
        }

        // Limpieza final del nombre base: quitar texto entre paréntesis residual, guiones al final
         base_name = base_name.replace(/\s*\(.*?\)$/, '').trim(); // Quitar (texto) al final
         base_name = base_name.replace(/\s*-\s*$/, '').trim(); // Quitar guion colgando al final

        // Casos especiales donde el "tamaño" es parte integral del nombre
        if (/Pack Degustación/i.test(original_name)) {
           base_name = original_name; // Usar nombre completo como base
           size = null; // No hay formato separable
        }
         if (/^CAMISETA|^MOCHILA|^SHAKER|^TOALLA|^CORREAS|^CACITO|^DISPENSADOR|^MASCARILLA|^PASTILLERO/i.test(base_name)) {
             // Para ropa/accesorios, intentar mantener el color/descripción si no es claramente sabor
             if (flavor && !/sabor|neutro/i.test(flavor)) {
                 base_name = `${base_name} ${flavor}`; // Añadir descripción de vuelta al nombre base
                 flavor = null;
             }
             if (!size && sizeMatch && /\((XS|S|M|L|XL|XXL|XXXL)\)/i.test(sizeMatch[0])){
                 size = sizeMatch[1].toUpperCase(); // Simplificar talla
             } else if (/UNIDADES/.test(size)) {
                 // Mantener '2 UNIDADES' como está si es relevante
             } else if (/\d+x\d+cm/.test(size)) {
                 // Mantener dimensiones
             } else {
                 // Para otros accesorios sin talla clara, quizas no hay 'size'
                 // size = size; // mantiene ml/cc si existe
             }
         }


        const group_key = size ? `${base_name} (${size})` : base_name;

        return { base_name, size, flavor, group_key };
    }


    // 1. Cargar y procesar datos
    async function fetchData() {
        try {
            const response = await fetch('hsn_order_history.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const rawData = await response.json();
            if (!rawData || rawData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6">No hay datos en el historial. Ejecuta primero el script de scraping.</td></tr>';
                showChartMessage("No hay datos en el historial.");
                return;
            }

            // Procesar cada item: calcular precio unitario y parsear nombre/grupo
            allData = rawData.map(item => {
                let unitPrice = 0; // Considerar 0 para gratis/muestras
                if (item.product_quantity && item.product_quantity > 0 && item.product_price !== null && item.product_price > 0) {
                    unitPrice = item.product_price / item.product_quantity;
                }
                const nameParts = parseProductName(item.product_name);
                return {
                    ...item, // Datos originales
                    ...nameParts, // base_name, size, flavor, group_key
                    unit_price: unitPrice,
                    order_date_obj: new Date(item.order_date) // Guardar objeto Date para ordenar
                };
            }).sort((a, b) => a.order_date_obj - b.order_date_obj); // Ordenar cronológicamente

            // Agrupar datos por group_key
            groupedData.clear();
            allData.forEach(item => {
                if (!groupedData.has(item.group_key)) {
                    groupedData.set(item.group_key, []);
                }
                groupedData.get(item.group_key).push(item);
            });

             // Convertir Map a Array y ordenar por group_key para consistencia
            const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => a[0].localeCompare(b[0]));

            populateTable(sortedGroupedData); // Poblar tabla con datos agrupados ordenados
            showChartMessage("Busca un grupo de productos para ver su gráfico de evolución.");

        } catch (error) {
            console.error("Error al cargar o procesar los datos:", error);
            tableBody.innerHTML = '<tr><td colspan="6">Error al cargar datos. Verifica que \'hsn_order_history.json\' existe y es válido.</td></tr>';
            showChartMessage("Error al cargar los datos.");
        }
    }

    // 2. Poblar la tabla con datos AGRUPADOS
    function populateTable(data) {
        tableBody.innerHTML = ''; // Limpiar tabla

        if (!data || data.length === 0) {
            const message = searchInput.value.trim()
                ? 'No se encontraron grupos de productos que coincidan con la búsqueda.'
                : 'No hay datos disponibles para mostrar.';
            tableBody.innerHTML = `<tr><td colspan="6">${message}</td></tr>`;
            return;
        }

        data.forEach(([groupKey, items]) => {
            if (!items || items.length === 0) return;

            // Ordenar items dentro del grupo por fecha (ya debería estarlo, pero por seguridad)
            items.sort((a, b) => a.order_date_obj - b.order_date_obj);

            const firstPurchase = items[0];
            const lastPurchase = items[items.length - 1];

            const row = tableBody.insertRow();
            row.insertCell().textContent = groupKey;
            row.insertCell().textContent = items.length;
            row.insertCell().textContent = `${firstPurchase.order_date} / ${firstPurchase.unit_price.toFixed(2)} €`;
            row.insertCell().textContent = `${lastPurchase.order_date} / ${lastPurchase.unit_price.toFixed(2)} €`;
            row.insertCell().textContent = `${lastPurchase.unit_price.toFixed(2)} €`;

            // Botón "Ver Detalles"
            const detailsCell = row.insertCell();
            const detailsButton = document.createElement('button');
            detailsButton.textContent = 'Detalles';
            detailsButton.classList.add('details-btn'); // Añadir clase para estilo si es necesario
            detailsButton.onclick = () => showDetailsModal(groupKey, items);
            detailsCell.appendChild(detailsButton);
        });
    }

    // 3. Mostrar/ocultar mensaje en área del gráfico
    function showChartMessage(message) {
        chartMessage.textContent = message;
        chartMessage.style.display = message ? 'block' : 'none';
    }

    // 4. Actualizar/crear el gráfico para UN grupo específico
    function updateChart(items, groupKey) {
        // Destruir gráfico anterior y ocultar mensaje por defecto
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
        showChartMessage(null);

        if (!items || items.length < 2) {
            showChartMessage(`No hay suficientes datos (${items ? items.length : 0}) para graficar la evolución de "${groupKey}". Se necesitan al menos 2 compras.`);
            return;
        }

        // Ordenar por fecha (ya debería estarlo)
        const sortedData = items.sort((a, b) => a.order_date_obj - b.order_date_obj);

        const labels = sortedData.map(item => item.order_date);
        const unitPrices = sortedData.map(item => item.unit_price);

        priceChartInstance = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `Precio Unitario (€) - ${groupKey}`,
                    data: unitPrices,
                    borderColor: 'var(--chart-line-color, rgb(40, 167, 69))',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.1,
                    fill: true,
                    pointBackgroundColor: 'var(--chart-line-color, rgb(40, 167, 69))',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Permite controlar altura con CSS
                scales: {
                    x: {
                        title: { display: true, text: 'Fecha Pedido', font: { weight: 'bold' } },
                        grid: { display: false }
                    },
                    y: {
                        title: { display: true, text: 'Precio Unitario (€)', font: { weight: 'bold' } },
                        beginAtZero: false, // Empezar cerca del min precio
                        ticks: {
                            callback: value => value.toFixed(2) + ' €'
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: `Evolución Precio Unitario: ${groupKey}`,
                        font: { size: 16 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { weight: 'bold' },
                        bodyFont: { size: 13 },
                        padding: 10,
                        callbacks: {
                            title: tooltipItems => `Fecha: ${tooltipItems[0].label}`,
                            label: context => {
                                const originalItem = sortedData[context.dataIndex];
                                let lines = [];
                                if (context.parsed.y !== null) {
                                    lines.push(`Precio Unitario: ${context.parsed.y.toFixed(2)} €`);
                                }
                                if (originalItem) {
                                    lines.push(`Producto Orig: ${originalItem.product_name}`);
                                    lines.push(`Cantidad: ${originalItem.product_quantity}`);
                                    lines.push(`Precio Total: ${originalItem.product_price !== null ? originalItem.product_price.toFixed(2) : 'N/A'} €`);
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

    // 5. Event Listener para búsqueda (ahora filtra grupos)
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        console.log(`Buscando grupo: "${searchTerm}"`);

        // Limpiar gráfico si se modifica la búsqueda
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
        showChartMessage("Introduce un término de búsqueda exacto para ver el gráfico."); // Mensaje por defecto al buscar

        if (!searchTerm) {
            const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            populateTable(sortedGroupedData); // Mostrar todos los grupos
            return;
        }

        const searchKeywords = searchTerm.split(/\s+/).filter(Boolean);

        // Filtrar los grupos basados en el groupKey
        const filteredGroups = Array.from(groupedData.entries()).filter(([key, items]) => {
            const groupKeyLower = key.toLowerCase();
            return searchKeywords.every(keyword => groupKeyLower.includes(keyword));
        }).sort((a, b) => a[0].localeCompare(b[0])); // Ordenar resultados


        populateTable(filteredGroups); // Poblar tabla con grupos filtrados

        // Intentar dibujar gráfico SOLO si la búsqueda resulta en UN ÚNICO grupo
        if (filteredGroups.length === 1) {
             const [groupKey, items] = filteredGroups[0];
             console.log(`Mostrando gráfico para el grupo único: ${groupKey}`);
             updateChart(items, groupKey);
        } else if (filteredGroups.length > 1) {
            console.log(`La búsqueda coincide con ${filteredGroups.length} grupos. No se muestra gráfico.`);
            showChartMessage("La búsqueda coincide con múltiples grupos. Refina tu búsqueda para ver un gráfico.");
        } else {
            console.log("La búsqueda no coincide con ningún grupo.");
             showChartMessage("No se encontraron grupos para la búsqueda actual.");
        }
    });

    // 6. Event Listener para botón Limpiar
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
         const sortedGroupedData = Array.from(groupedData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        populateTable(sortedGroupedData); // Mostrar todos los grupos
        if (priceChartInstance) {
            priceChartInstance.destroy();
            priceChartInstance = null;
        }
        showChartMessage("Busca un grupo de productos para ver su gráfico de evolución.");
        searchInput.focus();
    });

    // --- Funciones para el Modal ---
    function showDetailsModal(groupKey, items) {
        modalTitle.textContent = `Detalles de Compra: ${groupKey}`;
        detailsTableBody.innerHTML = ''; // Limpiar tabla del modal

        items.forEach(item => {
            const row = detailsTableBody.insertRow();
            row.insertCell().textContent = item.order_date || 'N/A';
            row.insertCell().textContent = item.product_name || 'N/A'; // Nombre original
            row.insertCell().textContent = item.product_quantity !== null ? item.product_quantity : 'N/A';
            row.insertCell().textContent = item.product_price !== null ? item.product_price.toFixed(2) : 'N/A';
            row.insertCell().textContent = item.unit_price !== null ? item.unit_price.toFixed(2) : 'N/A';
            row.insertCell().textContent = item.order_id || 'N/A';
        });

        modal.style.display = 'block'; // Mostrar modal
    }

    // Cerrar modal al hacer clic en la 'X'
    closeButton.onclick = () => {
        modal.style.display = 'none';
    };

    // Cerrar modal al hacer clic fuera del contenido
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };

    // --- Carga inicial ---
    fetchData();
});


// --- Estilos básicos para el Modal (añadir a style.css) ---
/*
.modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0,0,0,0.6);
}

.modal-content {
    background-color: #fefefe;
    margin: 10% auto;
    padding: 25px;
    border: 1px solid #888;
    width: 80%;
    max-width: 900px;
    border-radius: 8px;
    position: relative;
}

.close-button {
    color: #aaa;
    position: absolute;
    top: 10px;
    right: 20px;
    font-size: 28px;
    font-weight: bold;
    cursor: pointer;
}

.close-button:hover,
.close-button:focus {
    color: black;
    text-decoration: none;
}

#detailsTable {
    width: 100%;
    margin-top: 20px;
    border-collapse: collapse;
}

#detailsTable th, #detailsTable td {
    border: 1px solid var(--border-color);
    padding: 8px 12px;
    text-align: left;
}

#detailsTable th {
    background-color: var(--secondary-color);
}

#detailsTable tbody tr:nth-child(even) {
    background-color: #f9f9f9;
}
*/
