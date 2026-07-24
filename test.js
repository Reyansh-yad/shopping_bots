
            (function () {
                const BASE = 'http://localhost:8000';
                const sessionId = localStorage.getItem('prc_session_id');
                const username = localStorage.getItem('prc_username');

                if (!sessionId) {
                    sessionStorage.setItem('prc_login_redirect', 'price-tracking.html');
                    window.location.href = '/Frontend/src/pages/login.html';
                    return;
                }

                const userEl = document.getElementById('tracker-username');
                if (userEl && username) userEl.textContent = username.toUpperCase();

                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        try { await fetch(BASE + '/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) }); } catch (_) { }
                        localStorage.removeItem('prc_session_id');
                        localStorage.removeItem('prc_username');
                        window.location.href = '/Frontend/src/pages/login.html';
                    });
                }

                // ── Format price ───────────────────────────────────────────────────────────
                function fmtPrice(n) {
                    return 'Rs ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }

                // ── Render chart from price_history ────────────────────────────────────────────
                function renderChart(priceHistory) {
                    const chartEl = document.getElementById('pt-chart-bars');
                    if (!chartEl) return;
                    if (!priceHistory || priceHistory.length === 0) {
                        chartEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;color:#c4c7c8;font-family:\'JetBrains Mono\',monospace;font-size:10px;">No history yet</div>';
                        return;
                    }
                    const prices = priceHistory.map(h => h.price);
                    const max = Math.max(...prices);
                    const min = Math.min(...prices);
                    const range = max - min || 1;
                    const slice = prices.slice(-7);
                    const sliceMax = Math.max(...slice);
                    chartEl.innerHTML = slice.map(p => {
                        const heightPct = Math.max(10, Math.round(((p - min) / range) * 80) + 10);
                        const isMax = (p === sliceMax);
                        const barColor = isMax ? '#c90317' : 'rgba(53,53,53,1)';
                        return '<div class="group relative flex-1">' +
                            '<div class="w-full rounded-t chart-bar mb-1.5" style="height:' + heightPct + '%;background-color:' + barColor + ';"></div>' +
                            '<div class="w-full h-1.5 rounded-full" style="background:rgba(255,255,255,0.2);"></div>' +
                            '</div>';
                    }).join('');
                    // Update volatility text
                    const volEl = document.getElementById('pt-volatility-text');
                    if (volEl && prices.length >= 2) {
                        const latest = prices[prices.length - 1];
                        const prev = prices[prices.length - 2];
                        const diff = latest - prev;
                        const pct = prev > 0 ? Math.abs(diff / prev * 100).toFixed(1) : 0;
                        const dir = diff < 0 ? 'down' : 'up';
                        const icon = diff < 0 ? 'trending_down' : 'trending_up';
                        const color = diff < 0 ? '#c90317' : '#22c55e';
                        volEl.innerHTML =
                            '<div class="flex items-center gap-2 mb-1">' +
                            '<span class="material-symbols-outlined text-sm" style="color:' + color + ';">' + icon + '</span>' +
                            '<p class="text-[11px] text-text-muted leading-tight font-medium uppercase tracking-tight">Latest Price Movement</p>' +
                            '</div>' +
                            '<p class="text-[12px] text-primary/80 leading-relaxed">Price moved <span style="color:' + color + ';font-weight:bold;">' + (diff < 0 ? '−' : '+') + pct + '%</span> from the previous recorded value.</p>';
                    }
                }

                // ── Render delta log from price_history ───────────────────────────────────────
                function renderDeltaLog(productName, priceHistory) {
                    const logEl = document.getElementById('delta-log-container');
                    if (!logEl) return;
                    if (!priceHistory || priceHistory.length < 2) {
                        logEl.innerHTML = '<p class="text-text-muted font-label-mono text-[11px] text-center py-6">Not enough history yet to show deltas.</p>';
                        return;
                    }
                    const entries = [];
                    for (let i = priceHistory.length - 1; i > 0 && entries.length < 4; i--) {
                        const curr = priceHistory[i];
                        const prev = priceHistory[i - 1];
                        const delta = curr.price - prev.price;
                        const pct = prev.price > 0 ? Math.abs(delta / prev.price * 100).toFixed(1) : 0;
                        const isDrop = delta < 0;
                        const borderColor = isDrop ? '#c90317' : 'rgba(34,197,94,0.5)';
                        const deltaColor = isDrop ? '#c90317' : '#22c55e';
                        const sign = isDrop ? '' : '+';
                        const dateStr = curr.recorded_at ? new Date(curr.recorded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
                        entries.push(
                            '<div class="p-4 bg-surface-void/40 rounded border-l-4" style="border-color:' + borderColor + ';">' +
                            '<div class="flex justify-between items-start mb-3">' +
                            '<span class="font-label-mono text-primary text-xs font-bold">' + productName + '</span>' +
                            '<span class="text-[10px] text-text-muted font-label-mono uppercase tracking-widest">' + dateStr + '</span>' +
                            '</div>' +
                            '<div class="flex justify-between items-end">' +
                            '<div>' +
                            '<p class="text-[9px] text-text-muted uppercase tracking-widest font-bold mb-1">Price Delta</p>' +
                            '<p class="font-label-mono text-lg font-bold" style="color:' + deltaColor + ';">' + sign + 'Rs ' + Math.abs(delta).toFixed(2) + ' (' + pct + '%)</p>' +
                            '</div>' +
                            '<div class="text-right">' +
                            '<p class="text-[9px] text-text-muted uppercase tracking-widest font-bold mb-1">Previous</p>' +
                            '<p class="text-primary/60 font-label-mono text-xs">' + fmtPrice(prev.price) + '</p>' +
                            '</div>' +
                            '</div>' +
                            '</div>'
                        );
                    }
                    logEl.innerHTML = entries.join('');
                }

                // ── Render tracking cards ───────────────────────────────────────────────────────
                function renderCards(items) {
                    const list = document.getElementById('active-targets-list');
                    const countEl = document.getElementById('active-targets-count');
                    if (!list) return;
                    if (countEl) countEl.textContent = items.length + ' Product' + (items.length !== 1 ? 's' : '') + ' Active';
                    if (items.length === 0) {
                        list.innerHTML =
                            '<div class="glass-card p-12 flex flex-col items-center justify-center gap-4">' +
                            '<span class="material-symbols-outlined text-text-muted" style="font-size:48px;">inventory_2</span>' +
                            '<p class="text-text-muted font-label-mono text-[12px] uppercase tracking-widest text-center">No tracked products yet.</p>' +
                            '<p class="text-text-muted font-label-mono text-[11px] text-center">Go to Dashboard and paste a product URL to start tracking.</p>' +
                            '</div>';
                        return;
                    }
                    list.innerHTML = items.map(function (item) {
                        const img = item.image_url
                            ? '<img src="' + item.image_url + '" alt="" class="w-full h-full object-cover" onerror="this.parentElement.innerHTML=\'<span class=\\&quot;material-symbols-outlined text-outline text-2xl\\&quot;>inventory_2</span>\'" >'
                            : '<span class="material-symbols-outlined text-outline text-2xl">inventory_2</span>';
                        const targetDisplay = item.target_price ? fmtPrice(item.target_price) : '—';
                        const notifyChecked = item.notify ? 'checked' : '';
                        const toggleRight = item.notify ? 'right:0;border-color:#c90317;' : '';
                        const toggleBg = item.notify ? 'background-color:#c90317;' : 'background-color:rgba(255,255,255,0.1);';
                        return '<div class="glass-card mb-8" data-tracked-id="' + item.id + '">' +
                            '<div class="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">' +
                            '<div class="flex items-center gap-6">' +
                            '<div class="w-24 h-24 bg-surface-container-high rounded border border-glass-stroke flex-shrink-0 flex items-center justify-center overflow-hidden">' + img + '</div>' +
                            '<div>' +
                            '<h4 class="text-primary font-headline-md text-lg leading-tight">' + item.product_name + '</h4>' +
                            '<div class="flex flex-wrap gap-2 mt-3">' +
                            '<span class="bg-surface-high px-3 py-1 rounded text-text-muted font-label-mono text-[10px]">' + (item.source_site || 'tracked') + '</span>' +
                            '<span class="text-secondary-container font-label-mono text-[10px] flex items-center gap-1.5">' +
                            '<span class="w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span> Tracking' +
                            '</span>' +
                            '</div>' +
                            '</div>' +
                            '</div>' +
                            '<div class="flex items-center gap-8">' +
                            '<div class="text-right">' +
                            '<div class="font-label-mono text-label-mono text-text-muted mb-1">Current</div>' +
                            '<div class="font-label-mono text-primary text-2xl tracking-tight">' + fmtPrice(item.price) + '</div>' +
                            '</div>' +
                            '<div class="text-right">' +
                            '<div class="font-label-mono text-label-mono text-text-muted mb-1">Target</div>' +
                            '<div class="font-label-mono text-secondary-container text-2xl tracking-tight">' + targetDisplay + '</div>' +
                            '</div>' +
                            '<div class="flex flex-col items-center">' +
                            '<span class="font-label-mono text-text-muted text-[10px] mb-2">Alert</span>' +
                            '<div class="relative inline-block w-10 h-5 align-middle select-none">' +
                            '<input ' + notifyChecked + ' class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer z-10 transition-all" style="' + toggleRight + '" id="toggle-' + item.id + '" type="checkbox" data-id="' + item.id + '">' +
                            '<label class="toggle-label block overflow-hidden h-5 rounded-full cursor-pointer" style="' + toggleBg + '" for="toggle-' + item.id + '"></label>' +
                            '</div>' +
                            '</div>' +
                            '<button class="untrack-btn text-text-muted hover:text-secondary-container transition-colors p-2 rounded-full hover:bg-glass-fill" data-link="' + item.product_link + '" title="Remove tracking">' +
                            '<span class="material-symbols-outlined" style="font-size:20px;">close</span>' +
                            '</button>' +
                            '</div>' +
                            '</div>' +
                            '</div>';
                    }).join('');

                    // Wire alert toggles → /profile/tracked/update
                    list.querySelectorAll('.toggle-checkbox').forEach(function (toggle) {
                        toggle.addEventListener('change', async function (e) {
                            const id = parseInt(e.target.dataset.id);
                            const notify = e.target.checked;
                            const label = e.target.nextElementSibling;
                            if (label) label.style.backgroundColor = notify ? '#c90317' : 'rgba(255,255,255,0.1)';
                            if (notify) { e.target.style.right = '0'; e.target.style.borderColor = '#c90317'; }
                            else { e.target.style.right = ''; e.target.style.borderColor = ''; }
                            try {
                                await fetch(BASE + '/profile/tracked/update', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ session_id: sessionId, tracked_product_id: id, notify: notify })
                                });
                            } catch (_) { }
                        });
                    });

                    // Wire untrack buttons → /profile/untrack
                    list.querySelectorAll('.untrack-btn').forEach(function (btn) {
                        btn.addEventListener('click', async function () {
                            const link = btn.dataset.link;
                            const icon = btn.querySelector('span');
                            btn.disabled = true;
                            return `<div class="p-3 bg-surface-void/30 rounded border-l-2" style="border-color:${borderColor}">
                    <div class="flex justify-between items-start mb-1.5">
                        <span class="font-label-mono text-primary text-xs font-bold truncate max-w-[140px]">${ev.product_name}</span>
                        <span class="text-[9px] text-text-muted font-label-mono uppercase tracking-widest shrink-0 ml-2">${ts}</span>
                    </div>
                    <div class="flex justify-between items-end">
                        <div>
                            <p class="text-[9px] text-text-muted uppercase tracking-widest mb-0.5">Delta</p>
                            <p class="${deltaColor} font-label-mono text-sm font-bold">${sign}${fmtNPR(Math.abs(delta))} (${pct}%)</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[9px] text-text-muted uppercase tracking-widest mb-0.5">Prev</p>
                            <p class="text-primary/60 font-label-mono text-xs">${fmtNPR(ev.old_price)}</p>
                        </div>
                    </div>
                </div>`;
                        }).join('');
                    } catch (_) { }
                }

                async function loadSidebarData() {
                    await Promise.allSettled([loadTopMovers(), loadActivityLog()]);
                }

                // ── Search ───────────────────────────────────────────────────────
                let currentPage = 1;
                let currentQuery = '';
                let currentSort = 'relevance';
                let isLoadingMore = false;

                const grid = document.getElementById('search-results-grid');
                const stateMsg = document.getElementById('search-state-msg');
                const searchControls = document.getElementById('search-controls');

                function showSearchState(html) {
                    if (stateMsg) { stateMsg.innerHTML = html; stateMsg.classList.add('visible'); }
                    if (grid) grid.classList.remove('visible');
                }

                function hideSearchState() {
                    if (stateMsg) stateMsg.classList.remove('visible');
                }

                function normProducts(raw) {
                    if (!Array.isArray(raw)) return [];
                    return raw.map(row => {
                        const p = Array.isArray(row) ? row[0] : row;
                        if (!p) return null;
                        const link = p.product_link || p.link || '#';
                        let site = '';
                        try { site = new URL(link).hostname.replace('www.', ''); } catch (_) { }
                        return {
                            product_name: p.product_name || p.name || '',
                            rating: p.rating || 0,
                            price: p.price != null ? Number(p.price) : null,
                            product_link: link,
                            image_url: p.image_url || p.image || '',
                            source_site: site,
                        };
                    }).filter(Boolean);
                }

                function buildSearchCard(p) {
                    const div = document.createElement('div');
                    div.className = 'search-result-card';
                    const safeName = (p.product_name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const priceStr = p.price != null ? fmtNPR(p.price) : 'Price N/A';
                    const stars = p.rating ? `⭐ ${Number(p.rating).toFixed(1)}` : '';
                    const isTracked = trackedLinks.has(p.product_link);

                    div.innerHTML = `
            <img src="${p.image_url || ''}" alt="${safeName}" loading="lazy"
                 onerror="this.src='https://placehold.co/280x160/1c1b1b/444?text=No+Image'"/>
            <div class="card-body">
                <div class="card-title" title="${safeName}">${p.product_name || 'Untitled'}</div>
                <div class="card-price">${priceStr}</div>
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="card-store">${p.source_site}</span>
                    ${stars ? `<span class="card-rating">${stars}</span>` : ''}
                </div>
                <div class="card-actions">
                    <a href="${p.product_link}" target="_blank" rel="noopener" class="btn-view-deal">View →</a>
                    <button class="btn-track-card${isTracked ? ' tracked' : ''}" data-link="${p.product_link}"
                        data-name="${safeName}" data-price="${p.price ?? 0}">
                        ${isTracked ? 'Tracked ✓' : 'Track 🔔'}
                    </button>
                </div>
            </div>`;

                    const trackBtn = div.querySelector('.btn-track-card');
                    trackBtn.addEventListener('click', async () => {
                        if (trackBtn.classList.contains('tracked')) {
                            // Toggle: untrack
                            trackBtn.textContent = 'Removing…';
                            trackBtn.disabled = true;
                            try {
                                const res = await fetch(BASE + '/profile/untrack', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ session_id: sessionId, product_link: p.product_link })
                                });
                                const data = await res.json();
                                if (data.status) {
                                    trackBtn.classList.remove('tracked');
                                    trackBtn.textContent = 'Track 🔔';
                                    trackBtn.disabled = false;
                                    trackedLinks.delete(p.product_link);
                                    showToast(`Untracked: ${p.product_name}`, 'success');
                                    loadTrackedItems();
                                    loadStats();
                                    loadSidebarData();
                                } else {
                                    trackBtn.textContent = 'Tracked ✓';
                                    trackBtn.disabled = false;
                                    showToast(data.message || 'Error.', 'error');
                                }
                            } catch (_) {
                                trackBtn.textContent = 'Tracked ✓';
                                trackBtn.disabled = false;
                                showToast('Network error.', 'error');
                            }
                        } else {
                            await handleTrack(p.product_link, p.product_name, p.price, trackBtn);
                        }
                    });

                    return div;
                }

                function refreshSearchCardButtons() {
                    document.querySelectorAll('.btn-track-card').forEach(btn => {
                        const link = btn.dataset.link;
                        if (trackedLinks.has(link)) {
                            btn.classList.add('tracked');
                            btn.textContent = 'Tracked ✓';
                        } else {
                            btn.classList.remove('tracked');
                            if (!btn.classList.contains('error')) btn.textContent = 'Track 🔔';
                        }
                    });
                }

                function showResults(products, append = false) {
                    if (!grid) return;
                    if (!append) grid.innerHTML = '';
                    products.forEach(p => grid.appendChild(buildSearchCard(p)));
                    grid.classList.add('visible');
                    hideSearchState();
                }

                async function performSearch(isMore = false) {
                    if (!isMore) {
                        const qRaw = (document.getElementById('header-search-input') || document.getElementById('mobile-search-input'))?.value.trim();
                        if (!qRaw || qRaw.length < 2) return;
                        currentQuery = qRaw;
                        const s = document.getElementById('sort-select');
                        currentSort = s ? s.value : 'relevance';
                        currentPage = 1;
                        showSearchState(`<span class="material-symbols-outlined text-[14px] align-middle mr-1">sync</span> Searching — this may take a moment while scrapers run…`);
                        stateMsg.classList.add('visible');
                        grid.innerHTML = '';
                        grid.classList.remove('visible');
                        if (searchControls) searchControls.style.removeProperty('display');
                    } else {
                        currentPage++;
                        isLoadingMore = true;
                    }

                    try {
                        const res = await fetch(BASE + '/search', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ product_search: currentQuery, filters: currentSort, page_number: currentPage })
                        });
                        if (!res.ok) throw new Error('search failed');
                        const data = await res.json();
                        let products = normProducts(data.products || []);

                        // Accuracy filter
                        if (currentQuery && products.length > 0) {
                            const words = currentQuery.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
                            if (words.length > 0) {
                                products = products.filter(p => {
                                    const n = (p.product_name || '').toLowerCase();
                                    return words.some(w => n.includes(w));
                                });
                            }
                        }

                        if (products.length > 0) {
                            showResults(products, isMore);
                        } else {
                            showSearchState(`<span class="material-symbols-outlined text-[14px] align-middle mr-1">search_off</span> No results found — try a different keyword.`);
                        }
                    } catch (e) {
                        console.error(e);
                        showSearchState(`<span class="material-symbols-outlined text-[14px] align-middle mr-1">wifi_off</span> Search error — is the backend running?`);
                    } finally {
                        isLoadingMore = false;
                    }
                }

                // Wire up search forms
                ['header-search-form', 'mobile-search-form'].forEach(id => {
                    const form = document.getElementById(id);
                    if (form) form.addEventListener('submit', e => { e.preventDefault(); performSearch(false); });
                });

                // Sync mobile/desktop search inputs
                const headerInput = document.getElementById('header-search-input');
                const mobileInput = document.getElementById('mobile-search-input');
                if (headerInput && mobileInput) {
                    headerInput.addEventListener('input', () => { mobileInput.value = headerInput.value; });
                    mobileInput.addEventListener('input', () => { headerInput.value = mobileInput.value; });
                }

                // Close search
                const closeBtn = document.getElementById('search-close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        if (grid) { grid.innerHTML = ''; grid.classList.remove('visible'); }
                        if (stateMsg) stateMsg.classList.remove('visible');
                        if (searchControls) searchControls.style.setProperty('display', 'none', 'important');
                        if (headerInput) headerInput.value = '';
                        if (mobileInput) mobileInput.value = '';
                    });
                }

                // ── Bootstrap ────────────────────────────────────────────────────
                (async () => {
                    await Promise.allSettled([
                        loadStats(),
                        loadTrackedItems(),
                        loadSidebarData(),
                    ]);
                })();

            })();
    