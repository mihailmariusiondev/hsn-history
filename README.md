# Analizador de Historial de Precios HSN

Este proyecto visualiza el historial de compras realizadas en HSN Store, permitiendo analizar la evolución de los precios unitarios de los productos a lo largo del tiempo. Utiliza datos extraídos mediante un script de scraping y los presenta en una interfaz web interactiva.

[![Deploy GitHub Pages](https://github.com/mihailmariusiondev/hsn-history/actions/workflows/pages/pages-build-deployment/badge.svg)](https://mihailmariusiondev.github.io/hsn-history/)

**[Ver Demo en Vivo](https://mihailmariusiondev.github.io/hsn-history/)**

<!-- Añade aquí una captura de pantalla si quieres -->
<!-- ![Captura de pantalla de la aplicación](ruta/a/tu/screenshot.png) -->

## ✨ Características

- **Resumen Agrupado:** Muestra una tabla con productos únicos (agrupados por nombre y formato), indicando número de compras, primera/última fecha de compra y último precio unitario.
- **Filtrado:** Permite filtrar productos por categoría (asignada automáticamente).
- **Búsqueda:** Busca productos por nombre o formato.
- **Ordenación:** Ordena la tabla por cualquiera de sus columnas.
- **Detalles de Compra:** Muestra un modal con el historial detallado de compras para un producto específico (fechas, cantidades, precios).
- **Gráfico de Evolución de Precios:** Visualiza la evolución del precio unitario de un producto seleccionado a lo largo del tiempo mediante un gráfico de líneas (usando Chart.js).
- **Línea de Tendencia:** Incluye una línea de tendencia (regresión lineal) en el gráfico para visualizar la dirección general del precio.
- **Interfaz Responsiva:** Adaptada para visualizarse en diferentes tamaños de pantalla.

## ⚙️ Cómo Funciona

1.  **Scraping (Local):** El script `hsn_history_scraper.py` (ejecutado localmente) se conecta a la API de HSN (simulando una sesión de navegador con cookies y cabeceras) para descargar el historial de pedidos mes a mes.
2.  **Procesamiento de Datos (Local):** El script procesa la información, extrae los detalles de cada producto en cada pedido (nombre, cantidad, precio), calcula el precio unitario y los guarda en el archivo `hsn_order_history.json`.
3.  **Visualización (Web):**
    - La página `index.html` carga los archivos `style.css` y `script.js`.
    - `script.js` realiza una petición `fetch` para cargar los datos desde `hsn_order_history.json`.
    - JavaScript procesa los datos: agrupa productos por nombre y formato, asigna categorías, calcula estadísticas resumidas.
    - Se genera dinámicamente la tabla HTML con los datos agrupados.
    - Se implementan las funcionalidades de filtrado, búsqueda y ordenación.
    - Al hacer clic en una fila de la tabla, se utiliza Chart.js para generar un gráfico de líneas mostrando la evolución del precio unitario de ese producto.
    - Al hacer clic en el botón "Detalles", se muestra un modal con la información detallada de las compras individuales de ese producto.

## 🚀 Uso (Sitio Desplegado)

1.  Accede a la **[Demo en Vivo](https://mihailmariusiondev.github.io/hsn-history/)**.
2.  Explora la tabla de resumen de compras.
3.  Utiliza el desplegable de **Categoría** o el campo de **Buscar Producto** para filtrar los resultados.
4.  Haz clic en las cabeceras de la tabla para ordenar los productos.
5.  Haz clic en cualquier fila de la tabla para ver el gráfico de evolución de precios unitarios a la derecha.
6.  Haz clic en el botón **Detalles** de una fila para ver todas las compras individuales de ese producto en una ventana modal.

## 🛠️ Desarrollo Local y Actualización de Datos

Para ejecutar el scraper y actualizar los datos o modificar el código:

**Prerrequisitos:**

- Python 3.x
- Librería `requests` de Python (`pip install requests`)

**Pasos para Actualizar Datos:**

1.  **Obtener Cookies y Cabeceras:**

    - Abre tu navegador web e inicia sesión en `hsnstore.com`.
    - Ve a tu historial de pedidos (`https://www.hsnstore.com/sales/order/history/`).
    - Abre las herramientas de desarrollador (normalmente F12).
    - Ve a la pestaña "Network" (Red).
    - Filtra por "XHR" o busca peticiones a `ajax/index/ordersList/`.
    - Selecciona una de estas peticiones.
    - En la sección de Cabeceras (Headers), busca las `Request Headers`. Copia el valor completo de la cabecera `Cookie`.
    - **IMPORTANTE:** Abre el archivo `hsn_history_scraper.py` y actualiza el diccionario `COOKIES` con las cookies que acabas de copiar. Presta especial atención a `frontend`, `PHPSESSID`, y `public_id`, ya que son cruciales para la sesión. Puede que necesites copiar también otras cabeceras (`User-Agent`, `X-Requested-With`, etc.) en el diccionario `HEADERS` si las por defecto fallan.
    - **¡CUIDADO!** Las cookies son sensibles y caducan. Si el script falla, lo más probable es que necesites repetir este paso.

2.  **Ejecutar el Scraper:**

    - Abre una terminal en la carpeta del proyecto.
    - Ejecuta el script: `python hsn_history_scraper.py`
    - Esto generará (o sobrescribirá) el archivo `hsn_order_history.json` con los datos más recientes.

3.  **Actualizar Repositorio (para GitHub Pages):**
    - Añade el archivo JSON actualizado al control de versiones:
      ```bash
      git add hsn_order_history.json
      ```
    - Crea un commit:
      ```bash
      git commit -m "Update HSN order data"
      ```
    - Sube los cambios a GitHub:
      ```bash
      git push origin main
      ```
    - GitHub Pages detectará el cambio y reconstruirá el sitio automáticamente (puede tardar unos minutos).

## 💻 Tecnologías Utilizadas

- HTML5
- CSS3
- JavaScript (ES6+)
- [Chart.js](https://www.chartjs.org/) - Para la generación de gráficos.
- [chartjs-adapter-date-fns](https://github.com/chartjs/chartjs-adapter-date-fns) - Adaptador de fechas para Chart.js.
- Python 3 - Para el script de scraping.
- [Requests](https://requests.readthedocs.io/en/latest/) - Librería Python para peticiones HTTP.
- [GitHub Pages](https://pages.github.com/) - Para el alojamiento del sitio estático.

## 💡 Posibles Mejoras

- Mejorar la lógica de asignación de categorías.
- Añadir opción para exportar datos desde la interfaz (CSV/JSON).
- Permitir comparar gráficos de varios productos.
- Mejoras en la interfaz de usuario (UI/UX).
- Manejo de errores más robusto en el scraper (ej. si las cookies expiran).
- Investigar métodos menos frágiles para obtener los datos (aunque es poco probable sin una API pública oficial).

## 📄 Licencia

[MIT](LICENSE) (O la licencia que elijas. Si no tienes un archivo LICENSE, puedes eliminar esta sección o añadir uno).
