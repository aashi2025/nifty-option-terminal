/**
 * Upstox API & WebSocket Live Market Data Feed Manager
 */

window.UpstoxApi = (function() {

    let currentSource = 'upstox'; // 'upstox', 'nse', 'sim'
    let hasToken = false;
    let onLiveDataCallback = null;
    let ws = null;
    let activeSymbol = 'NIFTY';
    let isWsConnected = false;
    let reconnectTimer = null;

    async function init(callback) {
        onLiveDataCallback = callback;

        // Add API Settings Modal Trigger to Header
        attachHeaderControls();
        await fetchConfig();
        
        // Connect to Python Backend WebSocket Feed
        connectWebSocket();

        // Also poll HTTP fallback every 3s in case WS is paused
        startFallbackPoll();
    }

    function attachHeaderControls() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        // Insert API Settings Button if not existing
        if (!document.getElementById('apiSettingsBtn')) {
            const btn = document.createElement('button');
            btn.id = 'apiSettingsBtn';
            btn.className = 'btn btn-secondary';
            btn.title = 'Upstox & Market Data Settings';
            btn.innerHTML = `<i class="fa-solid fa-key"></i> Upstox API`;
            btn.addEventListener('click', openConfigModal);
            
            const feedStatus = document.getElementById('feedStatusBtn');
            if (feedStatus) headerRight.insertBefore(btn, feedStatus);
            else headerRight.appendChild(btn);
        }
    }

    async function fetchConfig() {
        try {
            const res = await fetch('/api/config');
            if (res.ok) {
                const data = await res.json();
                currentSource = data.dataSource || 'upstox';
                hasToken = data.hasUpstoxToken;
                updateBadgeStatus(data);
            }
        } catch (e) {
            console.warn("Could not fetch API config:", e);
        }
    }

    function connectWebSocket() {
        if (ws) {
            try { ws.close(); } catch(e) {}
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:8000';
        const wsUrl = `${protocol}//${host}/ws`;

        console.log(`[WebSocket] Connecting to ${wsUrl}...`);

        try {
            ws = new WebSocket(wsUrl);

            ws.onopen = function() {
                console.log("[WebSocket] Connected successfully!");
                isWsConnected = true;
                subscribeSymbol(activeSymbol);
                updateBadgeStatus({ hasUpstoxToken: hasToken, dataSource: currentSource });
            };

            ws.onmessage = function(event) {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'tick' && msg.data && onLiveDataCallback) {
                        onLiveDataCallback(msg.data);
                    }
                } catch(e) {
                    console.error("[WebSocket] Parse error:", e);
                }
            };

            ws.onerror = function(err) {
                console.warn("[WebSocket] Error:", err);
                isWsConnected = false;
            };

            ws.onclose = function() {
                console.log("[WebSocket] Closed. Reconnecting in 3s...");
                isWsConnected = false;
                clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(connectWebSocket, 3000);
            };
        } catch(e) {
            console.error("[WebSocket] Connection failed:", e);
        }
    }

    function subscribeSymbol(symbol) {
        activeSymbol = symbol;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                action: 'subscribe',
                symbol: symbol
            }));
            console.log(`[WebSocket] Subscribed to ${symbol}`);
        }
    }

    function updateBadgeStatus(info) {
        const badge = document.getElementById('feedStatusBtn');
        if (!badge) return;

        const textEl = badge.querySelector('.status-text');
        const dotEl = badge.querySelector('.status-dot');

        if (isWsConnected) {
            if (info.hasUpstoxToken && currentSource === 'upstox') {
                if (textEl) textEl.innerText = 'UPSTOX WS LIVE';
                if (dotEl) dotEl.style.backgroundColor = '#089981';
                badge.style.borderColor = 'rgba(8, 153, 129, 0.4)';
            } else if (currentSource === 'nse') {
                if (textEl) textEl.innerText = 'NSE WS LIVE';
                if (dotEl) dotEl.style.backgroundColor = '#2962ff';
                badge.style.borderColor = 'rgba(41, 98, 255, 0.4)';
            } else {
                if (textEl) textEl.innerText = 'SIM WS STREAM';
                if (dotEl) dotEl.style.backgroundColor = '#ffd700';
                badge.style.borderColor = 'rgba(255, 215, 0, 0.4)';
            }
        } else {
            if (textEl) textEl.innerText = 'CONNECTING...';
            if (dotEl) dotEl.style.backgroundColor = '#ff4d4f';
            badge.style.borderColor = 'rgba(255, 77, 79, 0.4)';
        }
    }

    function openConfigModal() {
        const modal = document.getElementById('apiConfigModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeConfigModal() {
        const modal = document.getElementById('apiConfigModal');
        if (modal) modal.classList.add('hidden');
    }

    async function saveConfig(token, source) {
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    upstoxAccessToken: token,
                    dataSource: source
                })
            });

            const data = await res.json();
            if (data.status === 'success') {
                alert("Upstox API settings saved successfully to .env!");
                closeConfigModal();
                await fetchConfig();
            } else {
                alert("Error saving config: " + data.message);
            }
        } catch (e) {
            alert("Failed to connect to backend server.");
        }
    }

    function startFallbackPoll() {
        setInterval(async () => {
            if (!isWsConnected) {
                try {
                    const res = await fetch(`/api/live-data?symbol=${activeSymbol}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.status === 'success' && data.spotPrice && onLiveDataCallback) {
                            onLiveDataCallback(data);
                        }
                    }
                } catch (e) {
                    // Silently ignore
                }
            }
        }, 3000);
    }

    return {
        init,
        subscribeSymbol,
        openConfigModal,
        closeConfigModal,
        saveConfig,
        getCurrentSource: () => currentSource,
        getActiveSymbol: () => activeSymbol
    };

})();
