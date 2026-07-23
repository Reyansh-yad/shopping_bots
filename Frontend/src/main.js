import "./style/main.css";
import "./page3-search.css";
import "./ui/dom-animations.js";
import "./three/delivery.js";
import "./three/water.js";
import { search, trackProduct, getSession } from "./api/api.js";

// ── Normalize backend products ─────────────────────────────────────────────
// Backend returns products as [[{name,rating,price,link,image}], ...]
// Each row is wrapped in an array by PostgreSQL row_to_json
function normalizeProducts(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(row => {
        // Unwrap if row_to_json wrapped it: [[{...}]] → [{...}]
        const p = Array.isArray(row) ? row[0] : row;
        if (!p) return null;
        const p_link = p.product_link || p.link || '#';
        // Extract source_site from link URL
        let source_site = p.source_site || '';
        if (!source_site) {
            try {
                const url = new URL(p_link);
                source_site = url.hostname.replace('www.', '');
            } catch (_) {}
        }
        return {
            product_name: p.product_name || p.name || '',
            rating: p.rating || 0,
            price: p.price || null,
            product_link: p_link,
            image_url: p.image_url || p.image || '',
            source_site,
            description: p.description || '',
        };
    }).filter(Boolean);
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput   = document.getElementById('page3-search-input');
    const searchBtn     = document.getElementById('page3-search-btn');
    const searchResults = document.getElementById('page3-search-results');

    // ── Nav search icon → scroll to Page 3 ───────────────────────────
    // Scoped ONLY to #nav-search-icon; all other nav buttons untouched.
    const navSearchIcon = document.getElementById('nav-search-icon');
    if (navSearchIcon) {
        navSearchIcon.addEventListener('click', () => {
            const page3 = document.getElementById('page3');
            if (page3) {
                page3.scrollIntoView({ behavior: 'smooth' });
                // Auto-focus the search input after the scroll settles
                setTimeout(() => searchInput && searchInput.focus(), 800);
            }
        });
    }

    if (!searchInput || !searchBtn || !searchResults) return;

    // ── Render a single product card ───────────────────────────────
    const renderCard = (p) => {
        const div = document.createElement('div');
        div.className = 'result-card';
        const safeName = (p.product_name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const stars = p.rating ? `⭐ ${Number(p.rating).toFixed(1)}` : '';
        const priceVal = (p.price != null) ? Number(p.price) : null;
        const priceFormatted = priceVal !== null
            ? `रू ${priceVal.toLocaleString('en-IN')}`
            : 'Price N/A';
        div.innerHTML = `
            <div class="result-image-wrap">
                <img class="result-image"
                     src="${p.image_url || ''}"
                     onerror="this.src='https://placehold.co/280x200?text=No+Image'"
                     alt="${safeName}"
                     loading="lazy">
            </div>
            <div class="result-content">
                <div class="result-title" title="${safeName}">${p.product_name || 'Untitled'}</div>
                <div class="result-meta">
                    <div class="result-price">${priceFormatted}</div>
                    <span class="result-store">${p.source_site || ''}</span>
                    ${stars ? `<span class="result-rating">${stars}</span>` : ''}
                </div>
                <a href="${p.product_link || '#'}" target="_blank" rel="noopener" class="btn-view">View Deal →</a>
                <button class="btn-track" data-link="${p.product_link}" data-name="${safeName}" data-price="${priceVal}">Track Price 🔔</button>
            </div>`;

        // Attach event listener for the track button
        const trackBtn = div.querySelector('.btn-track');
        trackBtn.addEventListener('click', async () => {
            const session = getSession();
            if (!session.sessionId) {
                // Redirect to login instead of alerting — better UX
                window.location.href = '/Frontend/src/pages/login.html';
                return;
            }
            trackBtn.textContent = 'Tracking…';
            trackBtn.style.opacity = '0.7';
            trackBtn.disabled = true;
            try {
                const res = await trackProduct(session.sessionId, p.product_link, p.product_name, priceVal || 0);
                if (res.status) {
                    trackBtn.textContent = 'Tracked ✓';
                    trackBtn.style.background = 'rgba(74, 222, 128, 0.15)';
                    trackBtn.style.borderColor = 'rgba(74, 222, 128, 0.3)';
                    trackBtn.style.color = '#4ade80';
                } else {
                    trackBtn.textContent = 'Error — retry';
                    trackBtn.disabled = false;
                    trackBtn.style.opacity = '1';
                }
            } catch (err) {
                console.error(err);
                trackBtn.textContent = 'Track Price 🔔';
                trackBtn.disabled = false;
                trackBtn.style.opacity = '1';
            }
        });

        return div;
    };

    // ── State helpers ──────────────────────────────────────────────
    const showState = (html) => {
        searchResults.innerHTML = html;
        searchResults.classList.add('visible');
    };

    let currentPage = 1;
    let currentQuery = '';
    let currentSortOrder = 'relevance';
    let isLoadingMore = false;

    const showResults = (products, fallback = false, origQuery = '', append = false, hasMore = false) => {
        if (!append) {
            searchResults.innerHTML = '';
            
            // Header bar with count + close
            const bar = document.createElement('div');
            bar.className = 'results-bar';
            const notice = fallback
                ? `<span class="results-fallback">"${origQuery}" not in our stores &mdash; showing similar products</span>`
                : '';
            bar.innerHTML = `
                <span class="results-count" id="results-count-display"></span>
                ${notice}
                <button class="results-close" id="p3-close-btn">✕</button>`;
            searchResults.appendChild(bar);
        } else {
            const countDisplay = document.getElementById('results-count-display');
            // We intentionally leave the text content blank as per user request
            const oldLoadBtn = document.getElementById('p3-load-more-btn');
            if (oldLoadBtn) oldLoadBtn.remove();
        }

        products.forEach(p => searchResults.appendChild(renderCard(p)));

        if (hasMore) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'p3-load-more-btn';
            loadMoreBtn.className = 'btn-load-more';
            loadMoreBtn.textContent = 'Load More Results';
            loadMoreBtn.addEventListener('click', () => {
                if (!isLoadingMore) performSearch(true);
            });
            searchResults.appendChild(loadMoreBtn);
        }

        if (!append) {
            searchResults.classList.add('visible');
            document.getElementById('p3-close-btn')?.addEventListener('click', () => {
                searchResults.classList.remove('visible');
                // Let the DOM update, then refresh layout for scroll triggers
                setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
            });
        }
        
        // Dispatch resize event so Lenis/ScrollTrigger updates with the new page height
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    };

    // ── Filter chips ───────────────────────────────────────────────
    let activeCategory = 'all';
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeCategory = chip.dataset.category || 'all';
        });
    });

    // ── Main search function ───────────────────────────────────────
    const performSearch = async (isLoadMore = false) => {
        if (!isLoadMore) {
            const rawQuery = searchInput.value.trim();
            if (rawQuery.length < 2) return;

            currentQuery = (activeCategory !== 'all' && !rawQuery.toLowerCase().includes(activeCategory))
                ? `${activeCategory} ${rawQuery}`
                : rawQuery;

            const sortSelect = document.getElementById('page3-sort-select');
            currentSortOrder = sortSelect ? sortSelect.value : 'relevance';
            currentPage = 1;

            showState('<div class="search-state"><div class="search-spinner"></div><span>Searching…</span></div>');
        } else {
            currentPage++;
            isLoadingMore = true;
            const loadBtn = document.getElementById('p3-load-more-btn');
            if (loadBtn) {
                loadBtn.textContent = 'Loading...';
                loadBtn.disabled = true;
            }
        }

        try {
            const data = await search(currentQuery, currentSortOrder, currentPage);
            // Normalize products from backend format
            let products = normalizeProducts(data.products || []);

            // Strict accuracy filter: product name must contain at least one word from the original search
            if (currentQuery && products.length > 0) {
                // Use the original search term (before category preprocessing) for accuracy filtering
                const originalQuery = currentQuery.replace(/^(laptop|phone|watch)\s+/i, '').toLowerCase();
                const searchWords = originalQuery.split(/\s+/).filter(w => w.length >= 2);
                if (searchWords.length > 0) {
                    products = products.filter(p => {
                        const name = (p.product_name || '').toLowerCase();
                        return searchWords.some(w => name.includes(w));
                    });
                }
            }

            if (products.length > 0 || isLoadMore) {
                showResults(products, false, currentQuery, isLoadMore, products.length >= 10);
            } else {
                showState('<div class="search-state"><span class="state-icon">🔍</span><span>No results found — try a different keyword</span></div>');
            }
        } catch (e) {
            console.error(e);
            if (!isLoadMore) {
                showState('<div class="search-state"><span class="state-icon">⚠️</span><span>Search error — is the backend running?</span></div>');
            } else {
                const loadBtn = document.getElementById('p3-load-more-btn');
                if (loadBtn) {
                    loadBtn.textContent = 'Error — Retry';
                    loadBtn.disabled = false;
                }
                currentPage--; 
            }
        } finally {
            isLoadingMore = false;
        }
    };

    const searchForm = document.getElementById('page3-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            performSearch(false);
        });
    } else {
        searchBtn.addEventListener('click', () => performSearch(false));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performSearch(false);
        });
    }

});
