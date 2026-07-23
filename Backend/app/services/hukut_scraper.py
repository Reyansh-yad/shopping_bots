"""
robots.txt for https://hukut.com

User-Agent: *
Allow: /
Disallow: /dashboard
Disallow: /cart

Host: https://hukut.com
Sitemap: https://hukut.com/sitemap.xml
"""

"""
for sorting by price in ascending order, use:
"sort": [{ "price": 1 }]
for sorting by price in descending order, use:
"sort": [{ "price": -1 }]
for sorting by relevance, use:
"sort": [{ "relevance": 0 }]
for sorting by rating in descending order, use:
"sort": [{ "rating": -1 }]
"""

import asyncio
import time
import random
import httpx
from app.schemas.models import Product
from typing import Optional, Union, List

_last_request = 0
_lock = asyncio.Lock()



async def hukut_scraper(product: str,limit: int=20, offset: int=0, order: str="price-asc") -> Optional[Union[Product, List[Product]]] :
    order=order.lower()
    global _last_request
    order_options = {
        "price-asc": [{"price": 1}],
        "price-desc": [{"price": -1}],
        "relevance": [{"relevance": 0}],
        "rating-asc": [{"rating": 1}],
        "rating-desc": [{"rating": -1}]
    }
    async with _lock:
        now = time.monotonic()
        delay = 2 + abs(random.random()) - (now - _last_request)

        if delay > 0:
            await asyncio.sleep(delay)

        _last_request = time.monotonic()

    async with httpx.AsyncClient(timeout=30,) as session:
        url = "https://hukut.com/api-server/v1/Product/list-elastic"
        payload = {
            "searchText": product,
            "pagination": {"limit": limit, "offset": offset},
            "sort": order_options.get(order) 
        }
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
        }
        response = await session.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return hukut_parser(data)

def hukut_parser(data: dict,) -> Optional[Union[Product, List[Product]]]:
    Products: List[Product] = []

    for item in data.get("data", {}).get("rows", []):
        name = item.get("name") or ""

        rating = item.get("averageRating") or 0

        default_variant = item.get("defaultVariant") or {}
        price = default_variant.get("price") or 0

        slug = item.get("slug") or ""
        link = f"https://hukut.com/{slug}" if slug else ""

        image = item.get("image", {}).get("cdn") or ""

        description = name 

        Products.append(
            Product(
                name=name,
                rating=float(rating),
                price=float(price),
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