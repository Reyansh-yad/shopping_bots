from fastapi import APIRouter, Depends
from app.schemas.models import Search
from app.database import get_db_connection
from app.services.hukut_scraper import hukut_scraper
from app.services.pcmodnepal_scraper import pcmodnepal_scraper
from app.services.qualitycomputer_scraper import qualitycomputer_scraper
import asyncio

router = APIRouter(prefix="/search", tags=["search"])

_lock=asyncio.Lock()
@router.post("")
async def search_items(request: Search, conn=Depends(get_db_connection)):
    product=request.product_search.lower().strip()
    filters=request.filters
    page_number=request.page_number
    with conn.cursor() as cursor:
        # Check if the product has already been searched and get the most recent ID
        cursor.execute(
            "SELECT product_search_id FROM app.product_search WHERE searched_product_name = %s ORDER BY created_at DESC LIMIT 1",
            (product,)
        )
        result = cursor.fetchone()
        if result:
            # Product exists in cache, try to get cached results for this page/filters
            product_search_id = result[0]
            cursor.execute(
                """
                SELECT row_to_json(p)
                FROM (
                    SELECT
                        name        AS product_name,
                        rating,
                        price,
                        description,
                        link        AS product_link,
                        image       AS image_url
                    FROM app.scraped_product sp
                    JOIN app.product_search ps ON sp.product_search_id = ps.product_search_id
                    WHERE ps.searched_product_name = %s
                    AND sp.page_number = %s
                    AND sp.filters = %s
                    ORDER BY
                        CASE WHEN %s = 'price-asc' THEN price END ASC,
                        CASE WHEN %s = 'price-desc' THEN price END DESC,
                        CASE WHEN %s = 'rating-asc' THEN rating END ASC,
                        CASE WHEN %s = 'rating-desc' THEN rating END DESC
                ) p;
                """,(product, page_number, filters, filters, filters, filters, filters)
            )
            data=cursor.fetchall()
            if data:
                # Found cached results for this specific page/filters
                conn.commit()
                return {
                    "status": "executed",
                    "_product_id": product_search_id,
                    "products": [r[0] for r in data]
                }
            # No cached results for this page/filters, fall through to scrape new results

        # Product not found in cache or no cached results for this page/filters
        # Insert the product search term (avoid duplicates if possible)
        cursor.execute(
            "INSERT INTO app.product_search (searched_product_name) VALUES (%s) ON CONFLICT DO NOTHING",
            (product,)
        )
        conn.commit()
        # Get the product_search_id (either existing or newly inserted)
        cursor.execute(
            "SELECT product_search_id FROM app.product_search WHERE searched_product_name = %s ORDER BY created_at DESC LIMIT 1",
            (product,)
        )
        product_search_id = cursor.fetchone()[0]

        global _product_id
        async with _lock:
            _product_id = product_search_id

    # Run the scrapers concurrently using asyncio.TaskGroup
    async with asyncio.TaskGroup() as tg:
        hukut_task = tg.create_task(hukut_scraper(product=product, order=filters,limit=20*page_number, offset=20*(page_number-1)))
        pcmodnepal_task = tg.create_task(pcmodnepal_scraper(product=product, order=filters,page_number=page_number))
        qualitycomputer_task = tg.create_task(qualitycomputer_scraper(product=product, order=filters,page_number=page_number))

    hukut_data = hukut_task.result()
    pcmodnepal_data = pcmodnepal_task.result()
    qualitycomputer_data = qualitycomputer_task.result()

    commit_data(hukut_data,request,conn=conn)
    commit_data(pcmodnepal_data,request,conn=conn)
    commit_data(qualitycomputer_data,request,conn=conn)
    data=None
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT row_to_json(p)
            FROM (
                SELECT
                    name        AS product_name,
                    rating,
                    price,
                    description,
                    link        AS product_link,
                    image       AS image_url
                FROM app.scraped_product
                WHERE product_search_id = %s
                ORDER BY
                    CASE WHEN %s = 'price-asc' THEN price END ASC,
                    CASE WHEN %s = 'price-desc' THEN price END DESC,
                    CASE WHEN %s = 'rating-asc' THEN rating END ASC,
                    CASE WHEN %s = 'rating-desc' THEN rating END DESC
            ) p;
            """,(_product_id, filters, filters, filters, filters,)
        )
        data=cursor.fetchall()
        conn.commit()

    return {
        "status": "executed",
        "_product_id": _product_id,
        "products": [r[0] for r in data]
    }

# commit data to the database
def commit_data(json_data,request,conn):
    query = "INSERT INTO app.scraped_product (product_search_id, name, rating, price, description, link, image, page_number, filters) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)";
    if(json_data==None):
        return None;
    with conn.cursor() as cur:
        for p in json_data:
            cur.execute(query, (_product_id,p.name,p.rating,p.price,p.description,p.link,p.image,request.page_number,request.filters))
    conn.commit()