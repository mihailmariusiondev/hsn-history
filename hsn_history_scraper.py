import requests
import json
from datetime import datetime
import time
import re
import csv # Importar el módulo csv

# --- Configuración ---
# URL base de la API
BASE_URL = "https://www.hsnstore.com/ajax/index/ordersList/"

# Parámetros iniciales (lt_o puede necesitar ser actualizado si deja de funcionar)
PARAMS = {
    "lt_o": "7473528", # Este ID podría cambiar o expirar
    "page": 1,
    "limit": 20 # Puedes aumentar si tienes muchos pedidos por mes
}

# Cabeceras extraídas de tu ejemplo curl
HEADERS = {
    'accept': 'text/javascript, text/html, application/xml, text/xml, */*',
    'accept-language': 'en-US,en;q=0.9,es;q=0.8,fr;q=0.7,ro;q=0.6',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://www.hsnstore.com/sales/order/history/',
    'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'x-prototype-version': '1.7',
    'x-requested-with': 'XMLHttpRequest'
}

# Cookies extraídas de tu ejemplo curl (¡IMPORTANTE! Estas pueden caducar)
# Si el script falla, actualiza estas cookies desde tu navegador.
COOKIES = {
    'filter-by': '0',
    'product-listing-page': 'grid',
    'tiktok_pixel_consent': '0',
    '__rtbh.uid': '%7B%22eventType%22%3A%22uid%22%2C%22id%22%3A%22unknown%22%2C%22expiryDate%22%3A%222026-01-14T08%3A50%3A19.185Z%22%7D',
    '__rtbh.lid': '%7B%22eventType%22%3A%22lid%22%2C%22id%22%3A%229gR7WnWi0X88qUqwiglV%22%2C%22expiryDate%22%3A%222026-01-14T08%3A50%3A19.186Z%22%7D',
    'language_1': '1',
    'smclient': '08d4c046-ac2b-4d9a-b4ec-ccc6ca1e8e9e', # Puede haber varias cookies smclient, usa la última
    'smuuid': '1946401add0-3fe146446a7a-0bb24f72-c1e9e105-a77a098a-59d42edc6aab',
    'G_ENABLED_IDPS': 'google',
    'smcntctgs': '%7B%22d661d08e%22%3A%22strvw%2Cnws%22%7D',
    'apay-session-set': 'W5OLrTXz91ejzoGQ5zbHJ7rb5uy26SqWeElylQrVex2KK7RCf2iSPylPo0785GU%3D',
    'frontend': '6f5e6d6adf3a4f3a83b213e85d96f0e5', # ¡Importante!
    'countryLangSwitch': '%7B%22countryCode%22:%22es%22,%22countryName%22:%22espa%C3%B1a%22,%22langCode%22:%22es_es%22,%22currency%22:%22eur%22,%22isoCode%22:%22ES-ES%22%7D',
    '_smvs': 'DIRECT',
    'PHPSESSID': 'ekocbu9gud58q5nd8nqrs31js6', # ¡Importante!
    'customer_group': '4',
    'public_id': 'fb03ad85e46b6ff270e3e976a7', # ¡Importante!
    'segment_checksum': '4.86.5645',
    'smvr': 'eyJ2aXNpdHMiOjEzLCJ2aWV3cyI6OTMsInRzIjoxNzQ1NDA0Mjc0MzIzLCJpc05ld1Nlc3Npb24iOmZhbHNlfQ==' # Asegúrate de que este valor sea el más reciente
}

# Archivos de salida
OUTPUT_JSON_FILE = "hsn_order_history.json"
OUTPUT_CSV_FILE = "hsn_order_history.csv" # Nombre del archivo CSV

# Fecha de inicio (Año, Mes)
START_YEAR = 2025
START_MONTH = 3

# Número de meses vacíos consecutivos antes de parar
EMPTY_MONTH_THRESHOLD = 12
# --- Fin Configuración ---

def parse_date(date_str):
    """Convierte 'Realizado el DD/MM/YY' a 'YYYY-MM-DD'."""
    try:
        match = re.search(r'(\d{2})/(\d{2})/(\d{2})', date_str)
        if match:
            day, month, year_short = match.groups()
            year = int(f"20{year_short}")
            dt = datetime(year, int(month), int(day))
            return dt.strftime('%Y-%m-%d')
        else:
            print(f"Advertencia: No se pudo parsear la fecha: {date_str}")
            return None
    except Exception as e:
        print(f"Error parseando fecha '{date_str}': {e}")
        return None

def parse_quantity(qty_str):
    """Extrae el número de 'XN Unidad(es)'."""
    try:
        match = re.search(r'X(\d+)', qty_str)
        if match:
            return int(match.group(1))
        else:
            print(f"Advertencia: No se pudo parsear la cantidad: {qty_str}")
            return None
    except Exception as e:
        print(f"Error parseando cantidad '{qty_str}': {e}")
        return None

def parse_price(price_str):
    """Convierte 'NN,NN €' a un número float."""
    try:
        price_cleaned = price_str.replace('€', '').replace('.', '').replace(',', '.').strip()
        return float(price_cleaned)
    except Exception as e:
        print(f"Error parseando precio '{price_str}': {e}")
        return None

def fetch_orders(year, month):
    """Obtiene los pedidos para un año y mes específicos."""
    params = PARAMS.copy()
    params['year'] = year
    params['month'] = f"{month:02d}"

    print(f"Buscando pedidos para {year}-{month:02d}...")
    try:
        response = requests.get(BASE_URL, headers=HEADERS, cookies=COOKIES, params=params, timeout=30)
        response.raise_for_status()
        try:
            data = response.json()
            return data
        except json.JSONDecodeError:
            print(f"Error: La respuesta para {year}-{month:02d} no es un JSON válido.")
            print("Respuesta recibida:")
            print(response.text[:500])
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error de red al buscar {year}-{month:02d}: {e}")
        return None
    except Exception as e:
        print(f"Error inesperado al buscar {year}-{month:02d}: {e}")
        return None

def main():
    all_products = []
    current_year = START_YEAR
    current_month = START_MONTH
    empty_months_count = 0 # Contador de meses vacíos consecutivos

    while True:
        order_data = fetch_orders(current_year, current_month)

        if order_data is None:
            print("Error en la petición. Deteniendo.")
            break

        if order_data.get("success") == 1 and order_data.get("data"):
            print(f"-> Encontrados {len(order_data['data'])} pedidos.")
            empty_months_count = 0 # Reiniciar contador si se encuentran pedidos
            for order in order_data['data']:
                order_id = order.get('incr_id')
                created_at_str = order.get('created_at')
                order_date = parse_date(created_at_str) if created_at_str else None

                if not order_id or not order_date:
                    print(f"Advertencia: Pedido sin ID o fecha válida: {order.get('order')}")
                    continue

                items = order.get('items', [])
                for item in items:
                    product_name = item.get('name')
                    qty_str = item.get('qty')
                    price_str = item.get('price')
                    product_url = item.get('url')
                    image_url = item.get('img')

                    quantity = parse_quantity(qty_str) if qty_str else None
                    price = parse_price(price_str) if price_str else None

                    if product_name and quantity is not None and price is not None:
                        all_products.append({
                            "order_id": order_id,
                            "order_date": order_date,
                            "product_name": product_name,
                            "product_quantity": quantity,
                            "product_price": price,
                            "product_url": product_url,
                            "product_image_url": image_url
                        })
                    else:
                        print(f"Advertencia: Producto omitido en pedido {order_id} por datos faltantes: {product_name}")

        elif order_data.get("count", 0) == 0:
            print(f"No se encontraron pedidos en {current_year}-{current_month:02d}.")
            empty_months_count += 1 # Incrementar contador de meses vacíos
            if empty_months_count >= EMPTY_MONTH_THRESHOLD:
                print(f"Se alcanzaron {EMPTY_MONTH_THRESHOLD} meses consecutivos sin pedidos. Deteniendo búsqueda.")
                break # Detener si se alcanza el umbral
            else:
                print(f"Meses vacíos consecutivos: {empty_months_count}/{EMPTY_MONTH_THRESHOLD}. Continuando búsqueda...")

        else:
            print(f"Respuesta inesperada o sin éxito para {current_year}-{current_month:02d}. Deteniendo.")
            print(order_data)
            break

        # Ir al mes anterior
        current_month -= 1
        if current_month == 0:
            current_month = 12
            current_year -= 1
            if current_year < 2000: # Límite de seguridad por si acaso
                 print("Alcanzado año límite (2000). Deteniendo.")
                 break

        # Pequeña pausa
        time.sleep(1)

    # Guardar los resultados
    if all_products:
        print(f"\nSe encontraron un total de {len(all_products)} productos en los pedidos.")

        # Guardar en JSON
        try:
            with open(OUTPUT_JSON_FILE, 'w', encoding='utf-8') as f_json:
                json.dump(all_products, f_json, ensure_ascii=False, indent=2)
            print(f"Historial de productos guardado en '{OUTPUT_JSON_FILE}'")
        except IOError as e:
            print(f"Error al guardar el archivo JSON: {e}")

        # Guardar en CSV
        try:
            # Definir las cabeceras del CSV (el orden importa)
            fieldnames = [
                "order_id", "order_date", "product_name", "product_quantity",
                "product_price", "product_url", "product_image_url"
            ]
            with open(OUTPUT_CSV_FILE, 'w', newline='', encoding='utf-8') as f_csv:
                writer = csv.DictWriter(f_csv, fieldnames=fieldnames)
                writer.writeheader() # Escribir la fila de cabecera
                writer.writerows(all_products) # Escribir todos los datos
            print(f"Historial de productos guardado en '{OUTPUT_CSV_FILE}'")
        except IOError as e:
            print(f"Error al guardar el archivo CSV: {e}")
        except Exception as e:
             print(f"Error inesperado al escribir CSV: {e}")

    else:
        print("No se encontró ningún producto en el historial.")

if __name__ == "__main__":
    main()
