/**
 * Paper Trading, Positions Tracker & Order Execution Module
 */

window.PaperTrading = (function() {

    let positions = [];
    let orderHistory = [];
    let currentOrderSymbol = '';
    let currentOrderSide = 'BUY';
    let currentOrderPrice = 0;

    function init() {
        // Global Modal Triggers
        window.openOrderModal = openOrderModal;

        const modal = document.getElementById('orderModal');
        const closeBtn = document.getElementById('closeOrderModalBtn');
        const buyBtn = document.getElementById('buySideBtn');
        const sellBtn = document.getElementById('sellSideBtn');
        const form = document.getElementById('orderForm');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        
        if (buyBtn && sellBtn) {
            buyBtn.addEventListener('click', () => {
                currentOrderSide = 'BUY';
                buyBtn.classList.add('active');
                sellBtn.classList.remove('active');
            });
            sellBtn.addEventListener('click', () => {
                currentOrderSide = 'SELL';
                sellBtn.classList.add('active');
                buyBtn.classList.remove('active');
            });
        }

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                executeOrder();
            });
        }

        document.getElementById('openTradeBtn')?.addEventListener('click', () => {
            openOrderModal('CE', 24500, 148.50, 'BUY');
        });
    }

    function openOrderModal(type, strike, ltp, side = 'BUY') {
        const modal = document.getElementById('orderModal');
        if (!modal) return;

        currentOrderSymbol = `NIFTY ${strike} ${type}`;
        currentOrderSide = side;
        currentOrderPrice = ltp;

        document.getElementById('orderSymbol').value = currentOrderSymbol;
        document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-cart-shopping"></i> Trade ${currentOrderSymbol}`;

        const buyBtn = document.getElementById('buySideBtn');
        const sellBtn = document.getElementById('sellSideBtn');

        if (side === 'BUY') {
            buyBtn.classList.add('active');
            sellBtn.classList.remove('active');
        } else {
            sellBtn.classList.add('active');
            buyBtn.classList.remove('active');
        }

        modal.classList.remove('hidden');
    }

    function closeModal() {
        const modal = document.getElementById('orderModal');
        if (modal) modal.classList.add('hidden');
    }

    function executeOrder() {
        const lots = parseInt(document.getElementById('orderLots').value) || 1;
        const qty = lots * 75;

        const newPosition = {
            id: Date.now(),
            symbol: currentOrderSymbol,
            side: currentOrderSide,
            lots,
            qty,
            avgPrice: currentOrderPrice,
            ltp: currentOrderPrice,
            pnl: 0,
            pnlPct: 0
        };

        positions.push(newPosition);

        // Record in Order History
        orderHistory.unshift({
            time: new Date().toLocaleTimeString(),
            symbol: currentOrderSymbol,
            side: currentOrderSide,
            type: 'MARKET',
            qty,
            price: currentOrderPrice,
            status: 'EXECUTED'
        });

        closeModal();
        renderPositions();
        renderOrders();
    }

    function renderPositions() {
        const tbody = document.getElementById('positionsTbody');
        const posCount = document.getElementById('posCount');
        const totalPnlDisplay = document.getElementById('totalPnlDisplay');

        if (!tbody) return;

        posCount.innerText = positions.length;

        if (positions.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No active positions. Click Buy/Sell on Option Chain.</td></tr>';
            totalPnlDisplay.innerHTML = '₹0.00';
            totalPnlDisplay.className = 'pnl-value zero';
            return;
        }

        let totalPnl = 0;
        let html = '';

        positions.forEach((pos, idx) => {
            let pnl = 0;
            if (pos.side === 'BUY') {
                pnl = (pos.ltp - pos.avgPrice) * pos.qty;
            } else {
                pnl = (pos.avgPrice - pos.ltp) * pos.qty;
            }

            pos.pnl = pnl;
            totalPnl += pnl;

            let pnlPct = ((pnl / (pos.avgPrice * pos.qty)) * 100).toFixed(2);
            const pnlClass = pnl >= 0 ? 'positive' : 'negative';

            html += `
                <tr>
                    <td class="font-bold text-bright">${pos.symbol}</td>
                    <td><span class="badge ${pos.side === 'BUY' ? 'tag-long-buildup' : 'tag-short-buildup'}">${pos.side}</span></td>
                    <td>${pos.lots} (${pos.qty})</td>
                    <td>₹${pos.avgPrice.toFixed(2)}</td>
                    <td>₹${pos.ltp.toFixed(2)}</td>
                    <td class="${pnlClass} font-bold">₹${pnl.toFixed(2)}</td>
                    <td class="${pnlClass}">${pnlPct}%</td>
                    <td>
                        <button onclick="window.closePosition(${idx})" class="btn btn-danger btn-sm">Square Off</button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        totalPnlDisplay.innerText = `${totalPnl >= 0 ? '+' : ''}₹${totalPnl.toFixed(2)}`;
        totalPnlDisplay.className = `pnl-value ${totalPnl >= 0 ? 'positive' : 'negative'}`;

        window.closePosition = closePosition;
    }

    function closePosition(index) {
        positions.splice(index, 1);
        renderPositions();
    }

    function renderOrders() {
        const tbody = document.getElementById('ordersTbody');
        const count = document.getElementById('orderCount');
        if (!tbody) return;

        count.innerText = orderHistory.length;

        let html = '';
        orderHistory.forEach(ord => {
            html += `
                <tr>
                    <td>${ord.time}</td>
                    <td class="font-bold">${ord.symbol}</td>
                    <td><span class="badge ${ord.side === 'BUY' ? 'tag-long-buildup' : 'tag-short-buildup'}">${ord.side}</span></td>
                    <td>${ord.type}</td>
                    <td>${ord.qty}</td>
                    <td>₹${ord.price}</td>
                    <td><span class="positive">${ord.status}</span></td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function updateLivePrices(spot) {
        // Randomly simulate small LTP fluctuations for active positions
        positions.forEach(pos => {
            let change = (Math.random() - 0.48) * 0.8;
            pos.ltp = Math.max(0.5, pos.ltp + change);
        });

        if (positions.length > 0) renderPositions();
    }

    return {
        init,
        openOrderModal,
        updateLivePrices
    };

})();
