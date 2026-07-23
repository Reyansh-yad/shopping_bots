""""
User-agent: *
Sitemap: https://qualitycomputer.com.np/sitemap.xml
##############
#   custom   #
##############
User-agent: *
Disallow: /helpdesk/
Allow: /
"""

# order by options:
# "lis_prce asc" for price in ascending order
# "lis_prce desc" for price in descending order
from bs4 import BeautifulSoup
import re
import asyncio
import time
import random
from app.schemas.models import Product
from typing import Optional, Union, List
from app.hybrid_http_client import send_request
   

_last_request = 0
_lock = asyncio.Lock()
async def qualitycomputer_scraper(product: str,page_number: int=1,order: str="price-asc") -> Optional[Union[Product,List[Product]]]:
    global _last_request
    order=order.lower()
    order_options={
        "price-asc": "lis_prce asc",
        "price-desc": "lis_prce desc",
        "relevance" : "create_date desc",
        "rating-asc" : "create_date desc",
        "rating-desc" : "create_date desc"
    }
    async with _lock:
        now = time.monotonic()
        delay = 2 + abs(random.random()) - (now - _last_request)

        if delay > 0:
            await asyncio.sleep(delay)
            
        _last_request = time.monotonic()
    url=f"https://qualitycomputer.com.np/shop/page/{page_number}"
    params={
        "order": order_options.get(order),
        "search": product,
    }
    html_file=await send_request(url=url, method="GET", params=params)
    return qualitycomputer_parser(html_content=html_file)

def qualitycomputer_parser(html_content: str) -> Optional[Union[Product, List[Product]]]:

    soup = BeautifulSoup(html_content, "html.parser")
    Products: List[Product] = []

    # Odoo Product containers
    Product_elements = soup.find_all(
        "form",
        action=lambda x: x and "/shop/cart/update" in x
    )

    if not Product_elements:
        Product_elements = (
            soup.find_all(class_="oe_Product")
            or soup.find_all(class_="o_wsale_Product_grid_wrapper")
        )

    base_url = "https://qualitycomputer.com.np"

    for item in Product_elements:

        # Name
        name_el = (
            item.find(class_="o_wsale_Products_item_title")
            or item.find("a", itemprop="name")
            or item.find("h6")
        )
        name = name_el.get_text(strip=True) if name_el else "Unknown Product"

        # Link
        link_el = item.find("a", href=lambda x: x and "/shop/Product/" in x)
        if not link_el and name_el and name_el.name == "a":
            link_el = name_el

        href = link_el.get("href") if link_el else ""
        link = f"{base_url}{href}" if href.startswith("/") else href

        # Price
        price_el = (
            item.find(itemprop="price")
            or item.find(class_="oe_currency_value")
            or item.find(class_="Product_price")
        )

        raw_price = ""
        if price_el:
            raw_price = re.sub(r"[^\d.]", "", price_el.get_text(strip=True))

        try:
            price = float(raw_price) if raw_price else 0.0
        except ValueError:
            price = 0.0

        # Image
        img_el = (
            item.find("img", class_="img-fluid")
            or item.find("img", itemprop="image")
            or item.find("img")
        )

        img_src = ""
        if img_el:
            img_src = img_el.get("data-src") or img_el.get("src") or ""

        image = (
            f"{base_url}{img_src}" if img_src.startswith("/") else img_src
        )
        rating = 0.0

        description = name

        Products.append(
            Product(
                name=name,
                rating=float(rating),
                price=price,
                link=link,
                image=image,
                description=description,
            )
        )

    if not Products:
        return None
    if len(Products) == 1:
        return Products[0]
    return Products
