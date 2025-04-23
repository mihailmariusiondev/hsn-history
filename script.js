document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  // (Same as before)
  const searchInput = document.getElementById("productSearch");
  const clearSearchBtn = document.getElementById("clearSearchBtn");
  const categoryFilter = document.getElementById("categoryFilter");
  const tableBody = document.getElementById("historyTableBody");
  const tableHeaders = document.querySelectorAll("#historyTable th[data-sort]");
  const chartCanvas = document.getElementById("priceChart").getContext("2d");
  const chartMessage = document.getElementById("chartMessage");
  const modal = document.getElementById("detailsModal");
  const modalTitle = document.getElementById("modalTitle");
  const detailsTableBody = document.getElementById("detailsTableBody");
  const closeButton = document.querySelector(".close-button");
  const itemCountSpan = document.getElementById("itemCount");

  // --- State Variables ---
  // (Same as before)
  let allData = [];
  let groupedDataMap = new Map();
  let priceChartInstance = null;
  let currentlySelectedRow = null;
  let currentSort = { column: "groupKey", direction: "asc" };
  let currentCategory = "all";
  let currentSearchTerm = "";

  // --- Utility ---
  function escapeRegex(string) {
    return string ? string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
  }

  // --- Category Assignment ---
  // (Same as before)
  function assignCategory(groupKey) {
    const keyLower = groupKey.toLowerCase();
    if (
      keyLower.includes("proteína") ||
      keyLower.includes("protein") ||
      keyLower.includes("whey") ||
      keyLower.includes("casein") ||
      keyLower.includes("beef") ||
      keyLower.includes("vegan") ||
      keyLower.includes("isolate") ||
      keyLower.includes("concentrate") ||
      keyLower.includes("soja")
    )
      return "Proteínas";
    if (keyLower.includes("creatina") || keyLower.includes("creapure")) return "Creatina";
    if (keyLower.includes("bcaa") || keyLower.includes("eaa") || keyLower.includes("amino")) return "Aminoácidos";
    if (keyLower.includes("glutamina")) return "Aminoácidos";
    if (keyLower.includes("citrulina") || keyLower.includes("arginina")) return "Pre-entreno / Óxido Nítrico";
    if (keyLower.includes("beta-alanina")) return "Pre-entreno / Óxido Nítrico";
    if (
      keyLower.includes("pre-entreno") ||
      keyLower.includes("pre-workout") ||
      keyLower.includes("evopump") ||
      keyLower.includes("evobomb") ||
      keyLower.includes("evordx")
    )
      return "Pre-entreno / Óxido Nítrico";
    if (keyLower.includes("cafeína")) return "Estimulantes / Energía";
    if (
      keyLower.includes("harina") ||
      keyLower.includes("avena") ||
      keyLower.includes("oatmeal") ||
      keyLower.includes("arroz") ||
      keyLower.includes("rice") ||
      keyLower.includes("copos") ||
      keyLower.includes("evocarbs") ||
      keyLower.includes("amilopectina") ||
      keyLower.includes("evodextrin")
    )
      return "Harinas / Carbohidratos";
    if (
      keyLower.includes("barrita") ||
      keyLower.includes("bar") ||
      keyLower.includes("snack") ||
      keyLower.includes("gominolas") ||
      keyLower.includes("chuches") ||
      keyLower.includes("pudding") ||
      keyLower.includes("crema") ||
      keyLower.includes("mantequilla") ||
      keyLower.includes("peanut") ||
      keyLower.includes("nutry bowl")
    )
      return "Snacks / Cremas / Barritas";
    if (
      keyLower.includes("salsa") ||
      keyLower.includes("sirope") ||
      keyLower.includes("syrup") ||
      keyLower.includes("ketchup") ||
      keyLower.includes("bbq") ||
      keyLower.includes("sauce") ||
      keyLower.includes("cacao") ||
      keyLower.includes("cocoa")
    )
      return "Salsas / Siropes / Cacao";
    if (keyLower.includes("vitamina") || keyLower.includes("vitamin") || keyLower.includes("multivitamínico"))
      return "Vitaminas / Minerales";
    if (keyLower.includes("omega-3") || keyLower.includes("aceite de") || keyLower.includes("oil") || keyLower.includes("krill"))
      return "Salud / Omega 3 / Aceites";
    if (
      keyLower.includes("magnesio") ||
      keyLower.includes("calcio") ||
      keyLower.includes("zinc") ||
      keyLower.includes("hierro") ||
      keyLower.includes("potasio") ||
      keyLower.includes("selenio")
    )
      return "Vitaminas / Minerales";
    if (
      keyLower.includes("colágeno") ||
      keyLower.includes("collagen") ||
      keyLower.includes("evoflex") ||
      keyLower.includes("articular") ||
      keyLower.includes("joint")
    )
      return "Salud / Articulaciones";
    if (
      keyLower.includes("extracto") ||
      keyLower.includes("extract") ||
      keyLower.includes("curcuma") ||
      keyLower.includes("ashwagandha") ||
      keyLower.includes("ginseng") ||
      keyLower.includes("boswellia") ||
      keyLower.includes("té verde") ||
      keyLower.includes("nac")
    )
      return "Salud / Extractos Herbales";
    if (keyLower.includes("digestivo") || keyLower.includes("digezyme") || keyLower.includes("probiótico") || keyLower.includes("inulina"))
      return "Salud / Digestivos";
    if (
      keyLower.includes("melatonina") ||
      keyLower.includes("5-htp") ||
      keyLower.includes("gaba") ||
      keyLower.includes("descanso") ||
      keyLower.includes("sleep")
    )
      return "Salud / Descanso";
    if (
      keyLower.includes("camiseta") ||
      keyLower.includes("shaker") ||
      keyLower.includes("mochila") ||
      keyLower.includes("toalla") ||
      keyLower.includes("gorra") ||
      keyLower.includes("correas") ||
      keyLower.includes("cacito") ||
      keyLower.includes("pastillero") ||
      keyLower.includes("mascarilla") ||
      keyLower.includes("dispensador")
    )
      return "Ropa / Accesorios";
    if (
      keyLower.includes("pack") ||
      keyLower.includes("muestra") ||
      keyLower.includes("monodosis") ||
      keyLower.includes("gratis") ||
      keyLower.includes("regalo")
    )
      return "Packs / Muestras / Otros";
    if (keyLower.includes("sal") || keyLower.includes("goma") || keyLower.includes("sucralosa") || keyLower.includes("levadura"))
      return "Ingredientes / Otros";
    return "Otros";
  }

  // --- Trendline Calculation ---
  function calculateLinearRegression(data) {
    // data is expected to be an array of {x: timestamp, y: price}
    const n = data.length;
    if (n < 2) return null; // Cannot calculate trendline with less than 2 points

    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (const point of data) {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumX2 += point.x * point.x;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (Math.abs(denominator) < 1e-10) return null; // Avoid division by zero (vertical line)

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  // --- Data Processing & Grouping ---
  // (Same as before)
  function parseProductName(name) {
    if (!name) return { base_name: "Desconocido", size: null, flavor: null, group_key: "Desconocido" };
    let original_name = name;
    let base_name = name.trim();
    let size = null;
    let flavor = null;
    const sizePatterns = [
      /(\d+\s*x\s*\d+g)/i,
      /(\d+)\s*(x\d+)?\s*(veg caps?|softgels?|tabs?|cápsulas|caps|comprimidos|comp|perlas|gominolas|chuches|pastillas)/i,
      /(\d+)\s*(unidades?|uds?)/i,
      /(\d+)\s*(servicios?|serv|dosis)/i,
      /(\d+)\s*(viales?|sticks?|barritas?|packs?|ampollas?|sobres?)/i,
      /(\d+\.?\d*)\s*Kg/i,
      /(\d+\.?\d*)\s*g/i,
      /(\d+\.?\d*)\s*L/i,
      /(\d+\.?\d*)\s*ml/i,
      /(\d+\.?\d*)\s*cc/i,
      /\((XS|S|M|L|XL|XXL|XXXL)\)/i,
      /\b(XS|S|M|L|XL|XXL|XXXL)\b/i,
      /(\d+x\d+cm)/i,
      /(Pack\s*Degustación)/i,
      /(Dosificador)/i,
    ];
    let sizeMatch = null;
    for (const pattern of sizePatterns) {
      const match = base_name.match(pattern);
      if (match && match[0]) {
        const matchIndex = base_name.lastIndexOf(match[0]);
        const charBefore = matchIndex > 0 ? base_name[matchIndex - 1] : "";
        if ((!sizeMatch || match[0].length > sizeMatch[0].length) && charBefore !== "-") {
          sizeMatch = match;
        }
      }
    }
    if (sizeMatch) {
      size = sizeMatch[0].trim();
      const sizeIndex = base_name.lastIndexOf(sizeMatch[0]);
      const potentialFlavor = base_name
        .substring(sizeIndex + sizeMatch[0].length)
        .replace(/^-/, "")
        .trim();
      base_name = base_name.substring(0, sizeIndex).trim();
      if (/^CAMISETA|^MOCHILA|^SHAKER|^TOALLA|^CORREAS|^CACITO|^DISPENSADOR|^MASCARILLA|^PASTILLERO/i.test(base_name)) {
        if (potentialFlavor && !/sabor|neutro|natural|unflavored/i.test(potentialFlavor)) {
          base_name = `${base_name} ${potentialFlavor}`;
          flavor = null;
        } else {
          flavor = potentialFlavor || null;
        }
        if (/\(?(XS|S|M|L|XL|XXL|XXXL)\)?/.test(size)) {
          size = size.match(/(XS|S|M|L|XL|XXL|XXXL)/i)[0].toUpperCase();
        }
      } else {
        flavor = potentialFlavor || null;
      }
    } else {
      const parenthesisMatch = base_name.match(/\s*\((.+)\)$/);
      if (parenthesisMatch && parenthesisMatch[1]) {
        if (!/\d/.test(parenthesisMatch[1]) || /\w+/.test(parenthesisMatch[1].replace(/\d/g, ""))) {
          flavor = parenthesisMatch[1].trim();
          base_name = base_name.substring(0, parenthesisMatch.index).trim();
        }
      }
    }
    base_name = base_name.replace(/\s*-\s*$/, "").trim();
    if (/Pack Degustación/i.test(original_name)) {
      base_name = original_name.replace(/\s*-\s*$/, "").trim();
      size = null;
      flavor = null;
    }
    const group_key = size ? `${base_name} (${size})` : base_name;
    return { base_name, size, flavor, group_key };
  }

  async function fetchData() {
    /* (Same as before) */
    try {
      const response = await fetch("hsn_order_history.json");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const rawData = await response.json();
      if (!rawData || rawData.length === 0) throw new Error("No data found in JSON file.");
      allData = rawData
        .map((item) => {
          let unitPrice = 0;
          if (item.product_quantity > 0 && item.product_price > 0) {
            unitPrice = item.product_price / item.product_quantity;
          }
          const nameParts = parseProductName(item.product_name);
          const category = assignCategory(nameParts.group_key);
          return {
            ...item,
            ...nameParts,
            category,
            unit_price: unitPrice,
            order_date_obj: item.order_date ? new Date(item.order_date) : null,
          };
        })
        .filter((item) => item.order_date_obj);
      allData.sort((a, b) => a.order_date_obj - b.order_date_obj);
      groupedDataMap.clear();
      const categories = new Set(["all"]);
      allData.forEach((item) => {
        categories.add(item.category);
        if (!groupedDataMap.has(item.group_key)) {
          groupedDataMap.set(item.group_key, { items: [], summary: {} });
        }
        groupedDataMap.get(item.group_key).items.push(item);
      });
      groupedDataMap.forEach((group, key) => {
        const items = group.items;
        const firstPurchase = items[0];
        const lastPurchase = items[items.length - 1];
        group.summary = {
          groupKey: key,
          category: firstPurchase.category,
          count: items.length,
          firstDate: firstPurchase.order_date_obj,
          firstDateStr: firstPurchase.order_date,
          lastDate: lastPurchase.order_date_obj,
          lastDateStr: lastPurchase.order_date,
          lastPrice: lastPurchase.unit_price,
        };
      });
      populateCategoryFilter(categories);
      updateTable();
    } catch (error) {
      console.error("Error loading/processing data:", error);
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #dc3545;">Error: ${error.message}. Verifique la consola.</td></tr>`;
      showChartMessage("Error al cargar los datos.");
    }
  }

  function populateCategoryFilter(categories) {
    /* (Same as before) */
    const sortedCategories = Array.from(categories).sort((a, b) => (a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b)));
    categoryFilter.innerHTML = "";
    sortedCategories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat === "all" ? "-- Todas --" : cat;
      categoryFilter.appendChild(option);
    });
  }

  // --- Filtering & Sorting Logic ---
  function getFilteredAndSortedData() {
    /* (Same as before) */
    let filteredGroups = Array.from(groupedDataMap.values());
    if (currentCategory !== "all") {
      filteredGroups = filteredGroups.filter((group) => group.summary.category === currentCategory);
    }
    if (currentSearchTerm) {
      const searchKeywords = currentSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
      filteredGroups = filteredGroups.filter((group) => {
        const groupKeyLower = group.summary.groupKey.toLowerCase();
        return searchKeywords.every((keyword) => groupKeyLower.includes(keyword));
      });
    }
    filteredGroups.sort((a, b) => {
      const valA = a.summary[currentSort.column];
      const valB = b.summary[currentSort.column];
      let comparison = 0;
      if (valA instanceof Date && valB instanceof Date) {
        comparison = valA - valB;
      } else if (typeof valA === "number" && typeof valB === "number") {
        comparison = valA - valB;
      } else {
        comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
      }
      return currentSort.direction === "asc" ? comparison : -comparison;
    });
    return filteredGroups;
  }

  // --- UI Update Functions ---
  function updateTable() {
    /* (Same as before) */
    const dataToDisplay = getFilteredAndSortedData();
    populateTable(dataToDisplay);
    updateSortHeaders();
    removeRowHighlight();
    if (priceChartInstance) {
      priceChartInstance.destroy();
      priceChartInstance = null;
    }
    showChartMessage("Selecciona un producto de la tabla.");
  }

  function populateTable(groups) {
    /* (Same as before - Minor tweak for alignment class) */
    tableBody.innerHTML = "";
    itemCountSpan.textContent = `(${groups.length} Productos)`;
    if (groups.length === 0) {
      const message =
        currentCategory !== "all" || currentSearchTerm ? "No se encontraron productos con los filtros actuales." : "No hay datos.";
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">${message}</td></tr>`;
      return;
    }
    groups.forEach((groupData) => {
      const summary = groupData.summary;
      const row = tableBody.insertRow();
      row.dataset.groupKey = summary.groupKey;
      row.insertCell().textContent = summary.groupKey;
      row.insertCell().textContent = summary.count;
      row.insertCell().textContent = summary.firstDateStr;
      row.insertCell().textContent = summary.lastDateStr;
      row.insertCell().textContent = summary.lastPrice.toFixed(2);
      row.cells[1].classList.add("text-right");
      row.cells[4].classList.add("text-right");
      const detailsCell = row.insertCell();
      detailsCell.classList.add("text-center");
      const detailsButton = document.createElement("button");
      detailsButton.textContent = "Detalles";
      detailsButton.classList.add("details-btn");
      detailsButton.onclick = (e) => {
        e.stopPropagation();
        showDetailsModal(summary.groupKey, groupData.items);
      };
      detailsCell.appendChild(detailsButton);
      row.addEventListener("click", () => handleRowClick(row, summary.groupKey, groupData.items));
    });
  }

  function updateSortHeaders() {
    /* (Same as before) */
    tableHeaders.forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sort === currentSort.column) {
        th.classList.add(currentSort.direction === "asc" ? "sort-asc" : "sort-desc");
      }
    });
  }

  function handleRowClick(rowElement, groupKey, items) {
    /* (Same as before) */
    removeRowHighlight();
    rowElement.classList.add("selected-row");
    currentlySelectedRow = rowElement;
    updateChart(items, groupKey);
  }

  function removeRowHighlight() {
    /* (Same as before) */
    if (currentlySelectedRow) {
      currentlySelectedRow.classList.remove("selected-row");
      currentlySelectedRow = null;
    }
  }

  function showChartMessage(message) {
    /* (Same as before) */
    chartMessage.textContent = message;
    chartMessage.style.display = message ? "block" : "none";
    chartCanvas.canvas.style.display = message ? "none" : "block";
  }

  // --- Chart Update Function (Modified) ---
  function updateChart(items, groupKey) {
    if (priceChartInstance) {
      priceChartInstance.destroy();
      priceChartInstance = null;
    }

    if (!items || items.length < 2) {
      showChartMessage(
        `Se necesita${items && items.length === 1 ? "" : "n"} al menos 2 compras para graficar: "${groupKey}" (${
          items ? items.length : 0
        } encontrada${items && items.length === 1 ? "" : "s"}).`
      );
      return;
    }

    showChartMessage(null); // Ocultar mensaje si hay datos suficientes

    const sortedData = items.sort((a, b) => a.order_date_obj - b.order_date_obj);
    const chartData = sortedData.map((item) => ({
      x: item.order_date_obj.getTime(), // Usar timestamp para el eje X de tiempo
      y: item.unit_price,
    }));

    // --- Trendline Calculation ---
    const regression = calculateLinearRegression(chartData);
    let trendlineData = [];
    if (regression) {
      const firstX = chartData[0].x;
      const lastX = chartData[chartData.length - 1].x;
      trendlineData = [
        { x: firstX, y: regression.slope * firstX + regression.intercept },
        { x: lastX, y: regression.slope * lastX + regression.intercept },
      ];
    }
    // --- End Trendline Calculation ---

    const datasets = [
      {
        // --- Actual Data ---
        label: `Precio Unitario (€)`, // Label for legend
        data: chartData,
        borderColor: "var(--primary-color)", // Use primary theme color
        backgroundColor: "var(--primary-color)", // Keep same for point fill
        tension: 0.1,
        fill: false, // <<< REMOVE FILL
        pointBackgroundColor: "var(--primary-color)", // Point color
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2,
      },
    ];

    // Add trendline dataset if calculated
    if (trendlineData.length > 0) {
      datasets.push({
        // --- Trendline ---
        label: "Tendencia", // Label for legend
        data: trendlineData,
        borderColor: "rgba(255, 99, 132, 0.8)", // Distinct color (e.g., pink/red)
        borderWidth: 1.5,
        borderDash: [5, 5], // Dashed line style
        fill: false,
        pointRadius: 0, // No points on the trendline
        pointHoverRadius: 0,
      });
    }

    priceChartInstance = new Chart(chartCanvas, {
      type: "line",
      data: { datasets: datasets }, // Use the datasets array
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          /* (Scales options remain the same) */
          x: {
            type: "time",
            time: { unit: "month", tooltipFormat: "dd/MM/yyyy", displayFormats: { month: "MMM yyyy", year: "yyyy" } },
            title: { display: true, text: "Fecha Pedido", font: { weight: "600" } },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "Precio Unitario (€)", font: { weight: "600" } },
            beginAtZero: false,
            ticks: { callback: (value) => value.toFixed(2) + " €" },
            grid: { color: "rgba(200, 200, 200, 0.2)" },
          },
        },
        plugins: {
          legend: {
            display: true, // <<< SHOW LEGEND
            position: "bottom", // Position legend below chart
            labels: {
              boxWidth: 12,
              padding: 15,
            },
          },
          title: {
            /* (Title options remain the same) */ display: true,
            text: groupKey,
            font: { size: 16, weight: "600" },
            padding: { bottom: 15 },
          },
          tooltip: {
            /* (Tooltip options remain the same) */ backgroundColor: "rgba(0, 0, 0, 0.8)",
            titleFont: { weight: "bold" },
            bodyFont: { size: 13 },
            padding: 12,
            callbacks: {
              title: (tooltipItems) => {
                const date = new Date(tooltipItems[0].parsed.x);
                return `Fecha: ${date.toLocaleDateString("es-ES")}`;
              },
              label: (context) => {
                // Find original item corresponding to the x-value
                const originalItem = sortedData.find((item) => item.order_date_obj.getTime() === context.parsed.x);
                let lines = [];
                // Show label from dataset (e.g., "Precio Unitario" or "Tendencia")
                if (context.dataset.label) {
                  lines.push(`${context.dataset.label}: ${context.parsed.y.toFixed(2)} €`);
                }
                // Add details only for the actual data points, not the trendline
                if (originalItem && context.datasetIndex === 0) {
                  // Only for first dataset
                  lines.push(`Producto Orig: ${originalItem.product_name}`);
                  lines.push(`Cantidad: ${originalItem.product_quantity}`);
                  lines.push(`Precio Total: ${originalItem.product_price !== null ? originalItem.product_price.toFixed(2) : "N/A"} €`);
                  lines.push(`Pedido ID: ${originalItem.order_id || "N/A"}`);
                }
                return lines;
              },
            },
          },
        },
        interaction: { mode: "index", intersect: false },
        hover: { mode: "nearest", intersect: true },
      },
    });
  }

  function showDetailsModal(groupKey, items) {
    /* (Same as before) */
    modalTitle.textContent = `Detalles de Compra: ${groupKey}`;
    detailsTableBody.innerHTML = "";
    items.sort((a, b) => b.order_date_obj - a.order_date_obj);
    items.forEach((item) => {
      const row = detailsTableBody.insertRow();
      row.insertCell().textContent = item.order_date || "N/A";
      row.insertCell().textContent = item.product_name || "N/A";
      row.insertCell().textContent = item.product_quantity !== null ? item.product_quantity : "N/A";
      row.insertCell().textContent = item.product_price !== null ? item.product_price.toFixed(2) : "N/A";
      row.insertCell().textContent = item.unit_price !== null ? item.unit_price.toFixed(2) : "N/A";
      row.insertCell().textContent = item.order_id || "N/A";
    });
    modal.style.display = "block";
  }

  // --- Event Listeners ---
  // (Same as before)
  categoryFilter.addEventListener("change", (e) => {
    currentCategory = e.target.value;
    updateTable();
  });
  searchInput.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value;
    updateTable();
  });
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    categoryFilter.value = "all";
    currentSearchTerm = "";
    currentCategory = "all";
    currentSort = { column: "groupKey", direction: "asc" };
    updateTable();
  });
  tableHeaders.forEach((th) => {
    th.addEventListener("click", () => {
      const newSortColumn = th.dataset.sort;
      if (!newSortColumn) return;
      let newSortDirection = "asc";
      if (currentSort.column === newSortColumn && currentSort.direction === "asc") {
        newSortDirection = "desc";
      }
      currentSort = { column: newSortColumn, direction: newSortDirection };
      updateTable();
    });
  });
  closeButton.onclick = () => {
    modal.style.display = "none";
  };
  window.onclick = (event) => {
    if (event.target == modal) modal.style.display = "none";
  };

  // --- Initial Load ---
  fetchData();
});
