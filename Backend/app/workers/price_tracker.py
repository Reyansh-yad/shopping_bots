import re
from app.database import pool
from bs4 import BeautifulSoup
from app.hybrid_http_client import send_request
import json

async def price_collector() -> None:
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                    SELECT tracked_product_id, product_link
                    FROM app.tracked_product;
            """)
            product_to_tracked=cur.fetchall()
            for product in product_to_tracked:
                url=product[1]
                if (re.search(r"qualitycomputer.com.np",url)):
                    price = await qualitcomputer_price_tracker(url=url)
                elif (re.search(r"hukut.com",url)):
                    price = await hukut_price_tracker(url=url)
                else:
                    price = await pcmodnepal_price_tracker(url=url)
                cur.execute(
                    "INSERT INTO app.tracked_product_price_history (tracked_product_id,price,discount) VALUES (%s,%s,%s)",
                    (product[0],price["price"],price["discount"])
                )
                conn.commit()
                print("\nSucesscull\n")
    print("INFO:\tExtracted product price")


async def qualitcomputer_price_tracker(url: str) -> dict:
    html_file = await send_request(url=url, method="GET")
    soup = BeautifulSoup(html_file, "html.parser")
    current_price = 0.0
    discount = 0.0
    price_span = soup.find("span", class_="oe_price") or soup.find("span", class_="product-price")
    if price_span:
        current_price = clean_price_to_float(price_span.text)
    original_price_span = soup.find("span", class_="oe_default_price")
    if original_price_span:
        if "d-none" not in original_price_span.get("class", []):
            original_price = clean_price_to_float(original_price_span.text)
            discount = original_price - current_price
    return {
        "price": current_price,
        "discount": discount
    }

async def hukut_price_tracker(url: str) -> dict:
    html_file=await send_request(url=url, method="GET")
    soup = BeautifulSoup(html_file, 'html.parser')
    json_ld_scripts = soup.find_all('script', type='application/ld+json')
    current_price = 0.0
    discount = 0.0
    
    for script in json_ld_scripts:
        try:
            data = json.loads(script.string)
    
            if isinstance(data, dict) and 'children' in data:
                data = json.loads(data['children'])
                
            if isinstance(data, dict):
                offers = data.get('offers', {})
                
                if isinstance(offers, dict):
                    price_val = offers.get('price') or offers.get('lowPrice')
                    if price_val:
                        current_price = float(price_val)
                    
                    high_price = offers.get('highPrice')
                    if high_price and price_val:
                        calculated_discount = float(high_price) - float(price_val)
                        if calculated_discount > 0:
                            discount = calculated_discount
                            
                if current_price > 0:
                    break
        except (json.JSONDecodeError, ValueError, TypeError):
            continue

    return {
        "price": current_price,
        "discount": discount
    }

async def pcmodnepal_price_tracker(url: str) -> dict:
    html_file=await send_request(url=url, method="GET")
    soup = BeautifulSoup(html_file, 'html.parser')
    
    current_price = 0
    discount = 0

    price_span = soup.find('p', class_='price') or soup.find('span', class_='woocommerce-Price-amount')
    
    if price_span:
        del_tag = price_span.find('del')
        ins_tag = price_span.find('ins')
        
        if del_tag and ins_tag:
            reg_price_text = del_tag.get_text()
            sale_price_text = ins_tag.get_text()
            
            reg_price = float(re.sub(r'[^\d.]', '', reg_price_text))
            current_price = float(re.sub(r'[^\d.]', '', sale_price_text))
    
            discount = max(0.0, reg_price - current_price)
        else:
            price_text = price_span.get_text()
            current_price = float(re.sub(r'[^\d.]', '', price_text))
            discount = 0.0
            
    return {
        "price": current_price,
        "discount": discount
    }

def clean_price_to_float(price_str: str) -> float:
    """
    Extracts numeric characters and dots from a currency string 
    and converts it into a clean float value.
    """
    if not price_str:
        return 0.0
    cleaned = re.sub(r'[^\d.]', '', price_str)
    return float(cleaned) if cleaned else 0.0