from app.core.settings import settings
from app.database import pool

def create_schema():
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                        --DROP SCHEMA IF EXISTS app CASCADE;

                        CREATE SCHEMA IF NOT EXISTS app;
                        
                        SET search_path TO app;

                        ------------------------------------------------------------
                        -- HANDLING sessions
                        ------------------------------------------------------------
                        CREATE UNLOGGED TABLE IF NOT EXISTS session (
                            session_id UUID PRIMARY KEY,
                            username VARCHAR(255) NOT NULL,
                            created_at TIMESTAMP DEFAULT NOW(),
                            expired_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days')
                        );

                        ------------------------------------------------------------
                        -- PROFILE TABLE
                        ------------------------------------------------------------
                        CREATE TABLE IF NOT EXISTS profile (
                            user_id SERIAL PRIMARY KEY,
                            username VARCHAR(255) UNIQUE NOT NULL,
                            password_hash CHAR(60) NOT NULL,
                            created_at TIMESTAMP DEFAULT NOW()
                        );

                        ------------------------------------------------------------
                        -- PRODUCT SEARCH TABLE
                        ------------------------------------------------------------
                        CREATE TABLE IF NOT EXISTS product_search (
                            product_search_id SERIAL PRIMARY KEY,
                            searched_product_name VARCHAR(255) NOT NULL,
                            created_at TIMESTAMP DEFAULT NOW()
                        );

                        ------------------------------------------------------------
                        -- SCRAPED PRODUCT TABLE
                        ------------------------------------------------------------
                        CREATE TABLE IF NOT EXISTS scraped_product (
                            scraped_product_id SERIAL PRIMARY KEY,
                            product_search_id INT NOT NULL REFERENCES product_search(product_search_id) ON DELETE CASCADE,
                            page_number INT NOT NULL,
                            filters VARCHAR(50) NOT NULL,
                            name VARCHAR(255),
                            rating FLOAT,
                            price NUMERIC(10,2),
                            description TEXT,
                            link TEXT,
                            image TEXT
                        );

                        ------------------------------------------------------------
                        -- TRACKED PRODUCT TABLES
                        ------------------------------------------------------------
                        CREATE TABLE IF NOT EXISTS tracked_product (
                            tracked_product_id SERIAL PRIMARY KEY,
                            product_link TEXT NOT NULL UNIQUE,
                            product_name VARCHAR(255) NOT NULL,
                            latest_price NUMERIC(10,2),
                            created_at TIMESTAMP DEFAULT NOW()
                        );

                        ------------------------------------------------------------
                        -- USER TRACKED PRODUCT TABLES
                        ------------------------------------------------------------
                        CREATE TABLE IF NOT EXISTS user_tracked_product (
                            user_id INT NOT NULL REFERENCES profile(user_id) ON DELETE CASCADE,
                            tracked_product_id INT NOT NULL REFERENCES tracked_product(tracked_product_id) ON DELETE CASCADE,
                            target_price NUMERIC(10,2),
                            notify BOOLEAN DEFAULT FALSE,
                            PRIMARY KEY (user_id, tracked_product_id)
                        );

                        -- Migration: add columns if they do not exist yet (idempotent)
                        DO $$
                        BEGIN
                            -- session.expired_at (added when session expiry was introduced)
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'app'
                                  AND table_name   = 'session'
                                  AND column_name  = 'expired_at'
                            ) THEN
                                ALTER TABLE app.session
                                    ADD COLUMN expired_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days');
                                -- Back-fill existing rows so they expire 7 days from now
                                UPDATE app.session SET expired_at = NOW() + INTERVAL '7 days' WHERE expired_at IS NULL;
                            END IF;

                            -- user_tracked_product.target_price
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'app'
                                  AND table_name   = 'user_tracked_product'
                                  AND column_name  = 'target_price'
                            ) THEN
                                ALTER TABLE app.user_tracked_product ADD COLUMN target_price NUMERIC(10,2);
                            END IF;

                            -- user_tracked_product.notify
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'app'
                                  AND table_name   = 'user_tracked_product'
                                  AND column_name  = 'notify'
                            ) THEN
                                ALTER TABLE app.user_tracked_product ADD COLUMN notify BOOLEAN DEFAULT FALSE;
                            END IF;

                            -- profile.full_name
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'app'
                                  AND table_name   = 'profile'
                                  AND column_name  = 'full_name'
                            ) THEN
                                ALTER TABLE app.profile ADD COLUMN full_name VARCHAR(255) DEFAULT NULL;
                            END IF;

                            -- profile.email
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'app'
                                  AND table_name   = 'profile'
                                  AND column_name  = 'email'
                            ) THEN
                                ALTER TABLE app.profile ADD COLUMN email VARCHAR(255) DEFAULT NULL;
                            END IF;

                            -- profile.phone_number
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'app'
                                  AND table_name   = 'profile'
                                  AND column_name  = 'phone_number'
                            ) THEN
                                ALTER TABLE app.profile ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL;
                            END IF;

                            -- profile.photo_path
                            IF NOT EXISTS (
                                SELECT 1 FROM information_schema.columns
                                WHERE table_schema = 'app'
                                  AND table_name   = 'profile'
                                  AND column_name  = 'photo_path'
                            ) THEN
                                ALTER TABLE app.profile ADD COLUMN photo_path VARCHAR(500) DEFAULT NULL;
                            END IF;
                        END$$;

                        ------------------------------------------------------------
                        -- TRACKED PRODUCT PRICE HISTORY TABLES
                        ------------------------------------------------------------
                        CREATE TABLE IF NOT EXISTS tracked_product_price_history (
                            price_history_id SERIAL PRIMARY KEY,
                            tracked_product_id INT NOT NULL REFERENCES tracked_product(tracked_product_id) ON DELETE CASCADE,
                            price NUMERIC(10,2) NOT NULL,
                            discount NUMERIC(10,2) DEFAULT 0,
                            recorded_at TIMESTAMP DEFAULT NOW()
                        );
                        """)
            conn.commit()
            print("INFO:\tCreated schema")