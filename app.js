/**
 * Main Application Orchestrator & Live Data Streamer with 9,700+ NSE Stocks Support
 */

document.addEventListener('DOMContentLoaded', () => {

    let spotPrice = 24525.80;
    let spotChange = 142.30;
    let currentSymbol = 'NIFTY';
    let currentStrikeStep = 50;

    const STRIKE_STEPS = {
        'NIFTY': 50,
        'BANKNIFTY': 100,
        'FINNIFTY': 50,
        'MIDCPNIFTY': 25,
        'RELIANCE': 20,
        'TCS': 50,
        'HDFCBANK': 10,
        'INFY': 20,
        'ICICIBANK': 10,
        'SBIN': 10,
        'TATAMOTORS': 10,
        'BHARTIARTL': 10,
        'LT': 50,
        'AXISBANK': 10,
        'KOTAKBANK': 20
    };

    // 1. Initialize Sub-modules
    CandleChart.init('mainCandleCanvas', 'rsiCanvas', 'chartWrapper');
    CandleChart.generateMockCandles(spotPrice, 120);

    OptionChain.init();
    StrategyBuilder.init();
    PaperTrading.init();

    // Upstox API & Market Data Manager
    UpstoxApi.init((liveData) => {
        if (liveData && liveData.spotPrice) {
            spotPrice = liveData.spotPrice;
            spotChange = liveData.change || spotChange;

            if (liveData.strikeStep) {
                currentStrikeStep = liveData.strikeStep;
                OptionChain.setStrikeStep(currentStrikeStep);
            }

            updateSpotHeaderUI(liveData.symbol || currentSymbol, spotPrice, spotChange);
            CandleChart.updateLivePrice(spotPrice);
            OptionChain.updateLiveSpot(spotPrice);
            PaperTrading.updateLivePrices(spotPrice);
        }
    });

    function updateSpotHeaderUI(symbol, price, change) {
        const labelEl = document.getElementById('spotCardLabel');
        const priceEl = document.getElementById('niftySpotPrice');
        const changeEl = document.getElementById('niftySpotChange');
        const chartPriceEl = document.getElementById('chartCurrentLtp');
        const chartSymbolSelect = document.getElementById('chartSymbolSelect');

        if (labelEl) labelEl.innerText = `${symbol} SPOT`;
        if (priceEl) priceEl.innerText = price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (chartPriceEl) chartPriceEl.innerText = `₹${price.toFixed(2)}`;

        if (chartSymbolSelect) {
            chartSymbolSelect.options[0].text = `${symbol} Spot Price`;
        }

        if (changeEl) {
            const isPos = change >= 0;
            changeEl.className = `ticker-change ${isPos ? 'positive' : 'negative'}`;
            const pct = ((change / price) * 100).toFixed(2);
            changeEl.innerText = `${isPos ? '+' : ''}${change.toFixed(2)} (${isPos ? '+' : ''}${pct}%)`;
        }
    }

    function switchActiveAsset(symbol, strikeStepHint) {
        currentSymbol = symbol.toUpperCase();
        currentStrikeStep = strikeStepHint || STRIKE_STEPS[currentSymbol] || 10;

        console.log(`[AssetSwitch] Selected Asset: ${currentSymbol} (Strike Step: ${currentStrikeStep})`);

        OptionChain.setStrikeStep(currentStrikeStep);
        UpstoxApi.subscribeSymbol(currentSymbol);

        // Fetch live quote snapshot
        fetch(`/api/live-data?symbol=${currentSymbol}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.spotPrice) {
                    spotPrice = data.spotPrice;
                    spotChange = data.change || 0;
                    if (data.strikeStep) {
                        currentStrikeStep = data.strikeStep;
                        OptionChain.setStrikeStep(currentStrikeStep);
                    }
                    updateSpotHeaderUI(currentSymbol, spotPrice, spotChange);
                    CandleChart.generateMockCandles(spotPrice, 120);
                    OptionChain.updateLiveSpot(spotPrice);
                }
            })
            .catch(err => console.error("Error fetching live asset quote:", err));
    }

    // 2. Dropdown Asset Selector
    const assetSelect = document.getElementById('assetSelect');
    if (assetSelect) {
        assetSelect.addEventListener('change', (e) => {
            switchActiveAsset(e.target.value);
        });
    }

    // 3. Live 9,700+ Stock Auto-Complete Search
    const searchInput = document.getElementById('stockSearchInput');
    const searchPopup = document.getElementById('stockSearchResults');
    let searchDebounceTimer = null;

    if (searchInput && searchPopup) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearTimeout(searchDebounceTimer);

            if (query.length === 0) {
                searchPopup.classList.add('hidden');
                searchPopup.innerHTML = '';
                return;
            }

            searchDebounceTimer = setTimeout(() => {
                fetch(`/api/search-stocks?q=${encodeURIComponent(query)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.results && data.results.length > 0) {
                            renderSearchResults(data.results);
                        } else {
                            searchPopup.innerHTML = `<div style="padding:10px; color:#888; text-align:center; font-size:12px;">No matching NSE stock found</div>`;
                            searchPopup.classList.remove('hidden');
                        }
                    })
                    .catch(err => console.error("Search error:", err));
            }, 200);
        });

        // Close search popup on click outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchPopup.contains(e.target)) {
                searchPopup.classList.add('hidden');
            }
        });
    }

    function renderSearchResults(results) {
        let html = '';
        results.forEach(item => {
            html += `
                <div class="search-item" data-symbol="${item.symbol}" data-step="${item.strikeStep}" style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:var(--accent-blue); font-size:13px; display:block;">${item.symbol}</strong>
                        <small style="color:#999; font-size:11px;">${item.name}</small>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:#fff; font-weight:700; font-size:12px;">₹${item.spotPrice ? item.spotPrice.toFixed(2) : '---'}</span>
                        <small style="display:block; color:#aaa; font-size:10px;">Lot: ${item.lotSize}</small>
                    </div>
                </div>
            `;
        });

        searchPopup.innerHTML = html;
        searchPopup.classList.remove('hidden');

        // Attach click listeners to search items
        const itemEls = searchPopup.querySelectorAll('.search-item');
        itemEls.forEach(el => {
            el.addEventListener('click', () => {
                const sym = el.dataset.symbol;
                const step = parseInt(el.dataset.step) || 10;
                
                searchInput.value = sym;
                searchPopup.classList.add('hidden');
                
                switchActiveAsset(sym, step);
            });
        });
    }

    window.handleSaveApiConfig = () => {
        const token = document.getElementById('configUpstoxToken').value;
        const source = document.getElementById('configDataSource').value;
        UpstoxApi.saveConfig(token, source);
    };

    // 4. View Mode Switcher
    const mainLayout = document.getElementById('mainLayout');
    const viewBtns = document.querySelectorAll('.view-btn');

    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.dataset.view;
            mainLayout.className = 'terminal-body';

            if (view === 'split') mainLayout.classList.add('split-mode');
            else if (view === 'chart') mainLayout.classList.add('chart-only');
            else if (view === 'chain') mainLayout.classList.add('chain-only');
            else if (view === 'strategy') {
                mainLayout.classList.add('strategy-only');
                expandDrawer('builder');
            }

            setTimeout(() => CandleChart.render(), 100);
        });
    });

    // 5. Timeframe Buttons
    const tfBtns = document.querySelectorAll('.tf-btn');
    tfBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tfBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            CandleChart.generateMockCandles(spotPrice, 120);
        });
    });

    // 6. Drawer Tabs & Toggle
    const bottomDrawer = document.getElementById('bottomDrawer');
    const toggleDrawerBtn = document.getElementById('toggleDrawerBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    toggleDrawerBtn?.addEventListener('click', () => {
        bottomDrawer.classList.toggle('collapsed');
        const icon = toggleDrawerBtn.querySelector('i');
        if (bottomDrawer.classList.contains('collapsed')) {
            icon.className = 'fa-solid fa-chevron-up';
        } else {
            icon.className = 'fa-solid fa-chevron-down';
        }
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            expandDrawer(targetTab);
        });
    });

    function expandDrawer(tabName) {
        if (bottomDrawer.classList.contains('collapsed')) {
            bottomDrawer.classList.remove('collapsed');
            const icon = toggleDrawerBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-chevron-down';
        }

        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        const activePane = document.getElementById(`pane${capitalize(tabName)}`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activePane) activePane.classList.add('active');
    }

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
});
