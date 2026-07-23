from fastapi import APIRouter, Depends, HTTPException
from app.core.security import validate_session
from app.database import get_db_connection
from app.schemas.models import (
    GetProfileRequest,
    TrackProductRequest,
    UnTrackProductRequest,
    UpdateTrackedProductRequest,
    RemoveTrackedProductRequest,
    GetStatsRequest,
    GetTrackedRequest,
)

profile = APIRouter(prefix="/profile", tags=["profile"])


# ─── helpers ─────────────────────────────────────────────────────────────────

def _require_session(session_id: str):
    """Raise 401 if the session is invalid."""
    if not validate_session(session_id):
        raise HTTPException(status_code=401, detail="Invalid or expired session.")


def _fetch_tracked_items(cur, session_id: str) -> list[dict]:
    """
    Return a list of tracked-product dicts shaped for the frontend.
    Fields: id, product_name, product_link, price, latest_price,
            source_site, image_url, rating, notify, target_price, price_history
    """
    cur.execute(
        """
        SELECT
            tp.tracked_product_id,
            tp.product_name,
            tp.product_link,
            tp.latest_price,
            utp.target_price,
            utp.notify
        FROM app.user_tracked_product utp
        JOIN app.tracked_product tp USING (tracked_product_id)
        WHERE utp.user_id = (
            SELECT user_id FROM app.profile
            WHERE username = (
                SELECT username FROM app.session WHERE session_id = %s
            )
        )
        ORDER BY tp.created_at DESC
        """,
        (session_id,),
    )
    rows = cur.fetchall()
    items = []
    for row in rows:
        tracked_product_id, product_name, product_link, latest_price, target_price, notify = row

        # Latest price-history entry
        cur.execute(
            """
            SELECT price, recorded_at
            FROM app.tracked_product_price_history
            WHERE tracked_product_id = %s
            ORDER BY recorded_at DESC
            """,
            (tracked_product_id,),
        )
        history_rows = cur.fetchall()
        price_history = [
            {"price": float(r[0]), "recorded_at": r[1].isoformat() if r[1] else None}
            for r in history_rows
        ]
        current_price = price_history[0]["price"] if price_history else (float(latest_price) if latest_price else 0)

        items.append(
            {
                "id": tracked_product_id,
                "product_name": product_name,
                "product_link": product_link,
                "price": current_price,
                "latest_price": float(latest_price) if latest_price else 0,
                "target_price": float(target_price) if target_price else None,
                "notify": bool(notify) if notify is not None else False,
                # source_site derived from the URL hostname
                "source_site": _domain_from_url(product_link),
                "image_url": None,
                "rating": None,
                "price_history": price_history,
            }
        )
    return items


def _domain_from_url(url: str) -> str:
    """Extract a short site label from a product URL."""
    try:
        from urllib.parse import urlparse
        hostname = urlparse(url).hostname or ""
        # Strip www. prefix
        if hostname.startswith("www."):
            hostname = hostname[4:]
        return hostname
    except Exception:
        return ""


# ─── endpoints ───────────────────────────────────────────────────────────────

@profile.post("/")
def get_profile(request: GetProfileRequest, conn=Depends(get_db_connection)):
    """Return user profile + tracked products."""
    _require_session(request.session_id)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT user_id, username
            FROM app.profile
            WHERE username = (
                SELECT username FROM app.session WHERE session_id = %s
            )
            """,
            (request.session_id,),
        )
        result = cur.fetchone()
        if not result:
            return {"status": False, "message": "Profile not found."}

        user_id, username = result
        items = _fetch_tracked_items(cur, request.session_id)

    return {
        "status": True,
        "user_id": user_id,
        "username": username,
        "tracked_products": items,
    }


@profile.post("/tracked")
def get_tracked(request: GetTrackedRequest, conn=Depends(get_db_connection)):
    """Return only the tracked products list."""
    _require_session(request.session_id)
    with conn.cursor() as cur:
        items = _fetch_tracked_items(cur, request.session_id)
    return {"status": True, "items": items}


@profile.post("/track")
def track_product(request: TrackProductRequest, conn=Depends(get_db_connection)):
    _require_session(request.session_id)
    with conn.cursor() as cur:
        # Check if already tracked globally
        cur.execute(
            "SELECT tracked_product_id FROM app.tracked_product WHERE product_link = %s",
            (request.product_link,),
        )
        existing = cur.fetchone()

        if existing:
            tracked_product_id = existing[0]
            # Check if THIS user already tracks it
            cur.execute(
                """
                SELECT 1 FROM app.user_tracked_product
                WHERE user_id = (
                    SELECT user_id FROM app.profile
                    WHERE username = (SELECT username FROM app.session WHERE session_id = %s)
                )
                AND tracked_product_id = %s
                """,
                (request.session_id, tracked_product_id),
            )
            if cur.fetchone():
                return {"status": False, "message": "Product is already being tracked by this user."}

            # Link to this user
            cur.execute(
                """
                INSERT INTO app.user_tracked_product (user_id, tracked_product_id)
                VALUES (
                    (SELECT user_id FROM app.profile WHERE username = (SELECT username FROM app.session WHERE session_id = %s)),
                    %s
                )
                """,
                (request.session_id, tracked_product_id),
            )
        else:
            # Insert brand-new tracked product
            cur.execute(
                "INSERT INTO app.tracked_product (product_link, product_name, latest_price) VALUES (%s, %s, %s)",
                (request.product_link, request.product_name, request.latest_price),
            )
            cur.execute(
                """
                INSERT INTO app.user_tracked_product (user_id, tracked_product_id)
                VALUES (
                    (SELECT user_id FROM app.profile WHERE username = (SELECT username FROM app.session WHERE session_id = %s)),
                    (SELECT tracked_product_id FROM app.tracked_product WHERE product_link = %s)
                )
                """,
                (request.session_id, request.product_link),
            )
            cur.execute(
                """
                INSERT INTO app.tracked_product_price_history (tracked_product_id, price)
                VALUES (
                    (SELECT tracked_product_id FROM app.tracked_product WHERE product_link = %s),
                    %s
                )
                """,
                (request.product_link, request.latest_price),
            )
        conn.commit()
    return {"status": True, "message": "Product tracked successfully."}


@profile.post("/untrack")
def untrack_product(request: UnTrackProductRequest, conn=Depends(get_db_connection)):
    _require_session(request.session_id)
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM app.user_tracked_product
            WHERE user_id = (
                SELECT user_id FROM app.profile
                WHERE username = (SELECT username FROM app.session WHERE session_id = %s)
            )
            AND tracked_product_id = (
                SELECT tracked_product_id FROM app.tracked_product WHERE product_link = %s
            )
            """,
            (request.session_id, request.product_link),
        )
        conn.commit()

        # If nobody tracks it anymore, delete the product row entirely
        cur.execute(
            """
            SELECT 1 FROM app.user_tracked_product
            WHERE tracked_product_id = (
                SELECT tracked_product_id FROM app.tracked_product WHERE product_link = %s
            )
            """,
            (request.product_link,),
        )
        if not cur.fetchone():
            cur.execute(
                "DELETE FROM app.tracked_product WHERE product_link = %s",
                (request.product_link,),
            )
        conn.commit()
    return {"status": True, "message": "Product untracked successfully."}


@profile.post("/tracked/update")
def update_tracked(request: UpdateTrackedProductRequest, conn=Depends(get_db_connection)):
    """Update target_price and/or notify flag for a tracked product."""
    _require_session(request.session_id)
    updates = []
    values = []
    if request.target_price is not None:
        updates.append("target_price = %s")
        values.append(request.target_price)
    if request.notify is not None:
        updates.append("notify = %s")
        values.append(request.notify)

    if not updates:
        return {"status": False, "message": "No fields to update."}

    # Ensure the table has these columns (they are added here dynamically if missing)
    with conn.cursor() as cur:
        # Add columns if they don't exist (idempotent)
        cur.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema='app' AND table_name='user_tracked_product' AND column_name='target_price'
                ) THEN
                    ALTER TABLE app.user_tracked_product ADD COLUMN target_price NUMERIC(10,2);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema='app' AND table_name='user_tracked_product' AND column_name='notify'
                ) THEN
                    ALTER TABLE app.user_tracked_product ADD COLUMN notify BOOLEAN DEFAULT FALSE;
                END IF;
            END$$;
            """
        )
        values.extend([request.session_id, request.tracked_product_id])
        cur.execute(
            f"""
            UPDATE app.user_tracked_product
            SET {', '.join(updates)}
            WHERE user_id = (
                SELECT user_id FROM app.profile
                WHERE username = (SELECT username FROM app.session WHERE session_id = %s)
            )
            AND tracked_product_id = %s
            """,
            values,
        )
        conn.commit()
    return {"status": True, "message": "Updated successfully."}


@profile.post("/tracked/remove")
def remove_tracked(request: RemoveTrackedProductRequest, conn=Depends(get_db_connection)):
    """Remove a tracked product by its numeric ID (alternative to /untrack)."""
    _require_session(request.session_id)
    with conn.cursor() as cur:
        # Get the product_link so we can re-use the cleanup logic
        cur.execute(
            "SELECT product_link FROM app.tracked_product WHERE tracked_product_id = %s",
            (request.tracked_product_id,),
        )
        row = cur.fetchone()
        if not row:
            return {"status": False, "message": "Product not found."}
        product_link = row[0]

        cur.execute(
            """
            DELETE FROM app.user_tracked_product
            WHERE user_id = (
                SELECT user_id FROM app.profile
                WHERE username = (SELECT username FROM app.session WHERE session_id = %s)
            )
            AND tracked_product_id = %s
            """,
            (request.session_id, request.tracked_product_id),
        )
        conn.commit()

        cur.execute(
            "SELECT 1 FROM app.user_tracked_product WHERE tracked_product_id = %s",
            (request.tracked_product_id,),
        )
        if not cur.fetchone():
            cur.execute(
                "DELETE FROM app.tracked_product WHERE tracked_product_id = %s",
                (request.tracked_product_id,),
            )
        conn.commit()
    return {"status": True, "message": "Product removed successfully."}


@profile.post("/stats")
def get_stats(request: GetStatsRequest, conn=Depends(get_db_connection)):
    """Return dashboard statistics for the logged-in user."""
    _require_session(request.session_id)
    with conn.cursor() as cur:
        # Total tracked products for this user
        cur.execute(
            """
            SELECT COUNT(*) FROM app.user_tracked_product
            WHERE user_id = (
                SELECT user_id FROM app.profile
                WHERE username = (SELECT username FROM app.session WHERE session_id = %s)
            )
            """,
            (request.session_id,),
        )
        total_tracked = cur.fetchone()[0]

        # Price drops today — products whose latest price is lower than the previous recording
        cur.execute(
            """
            WITH latest AS (
                SELECT DISTINCT ON (tracked_product_id)
                    tracked_product_id, price
                FROM app.tracked_product_price_history
                ORDER BY tracked_product_id, recorded_at DESC
            ),
            prev AS (
                SELECT DISTINCT ON (tracked_product_id)
                    tracked_product_id, price
                FROM app.tracked_product_price_history
                WHERE recorded_at < NOW() - INTERVAL '1 day'
                ORDER BY tracked_product_id, recorded_at DESC
            )
            SELECT COUNT(*) FROM latest l
            JOIN prev p USING (tracked_product_id)
            JOIN app.user_tracked_product utp USING (tracked_product_id)
            WHERE utp.user_id = (
                SELECT user_id FROM app.profile
                WHERE username = (SELECT username FROM app.session WHERE session_id = %s)
            )
            AND l.price < p.price
            """,
            (request.session_id,),
        )
        price_drops = cur.fetchone()[0]

    return {
        "status": True,
        "totalTracked": total_tracked,
        "priceDropsToday": price_drops,
        "activeAlerts": 0,  # placeholder – extend when alert system is built
    }
