/**
 * Options Strategy Builder & Payoff Diagram Canvas Engine
 */

window.StrategyBuilder = (function() {

    let activeLegs = [];
    let spotPrice = 24525.80;
    let payoffCanvas, ctxPayoff;

    function init() {
        payoffCanvas = document.getElementById('payoffCanvas');
        if (payoffCanvas) {
            ctxPayoff = payoffCanvas.getContext('2d');
            resizePayoffCanvas();
            window.addEventListener('resize', resizePayoffCanvas);
        }

        // Global handler for preset buttons
        window.applyStrategyPreset = applyPreset;
    }

    function resizePayoffCanvas() {
        if (!payoffCanvas) return;
        const wrapper = payoffCanvas.parentElement;
        payoffCanvas.width = wrapper.clientWidth * window.devicePixelRatio;
        payoffCanvas.height = wrapper.clientHeight * window.devicePixelRatio;
        renderPayoff();
    }

    function applyPreset(presetType) {
        const atm = Math.round(spotPrice / 50) * 50;
        activeLegs = [];

        switch(presetType) {
            case 'BULL_CALL':
                activeLegs.push({ type: 'CE', strike: atm, action: 'BUY', lots: 1, entryPrice: 150 });
                activeLegs.push({ type: 'CE', strike: atm + 200, action: 'SELL', lots: 1, entryPrice: 65 });
                break;
            case 'BEAR_PUT':
                activeLegs.push({ type: 'PE', strike: atm, action: 'BUY', lots: 1, entryPrice: 140 });
                activeLegs.push({ type: 'PE', strike: atm - 200, action: 'SELL', lots: 1, entryPrice: 60 });
                break;
            case 'LONG_STRADDLE':
                activeLegs.push({ type: 'CE', strike: atm, action: 'BUY', lots: 1, entryPrice: 150 });
                activeLegs.push({ type: 'PE', strike: atm, action: 'BUY', lots: 1, entryPrice: 140 });
                break;
            case 'SHORT_STRADDLE':
                activeLegs.push({ type: 'CE', strike: atm, action: 'SELL', lots: 1, entryPrice: 150 });
                activeLegs.push({ type: 'PE', strike: atm, action: 'SELL', lots: 1, entryPrice: 140 });
                break;
            case 'IRON_CONDOR':
                activeLegs.push({ type: 'PE', strike: atm - 300, action: 'BUY', lots: 1, entryPrice: 30 });
                activeLegs.push({ type: 'PE', strike: atm - 150, action: 'SELL', lots: 1, entryPrice: 75 });
                activeLegs.push({ type: 'CE', strike: atm + 150, action: 'SELL', lots: 1, entryPrice: 80 });
                activeLegs.push({ type: 'CE', strike: atm + 300, action: 'BUY', lots: 1, entryPrice: 35 });
                break;
        }

        renderLegsList();
        renderPayoff();
    }

    function addLeg(leg) {
        activeLegs.push(leg);
        renderLegsList();
        renderPayoff();
    }

    function removeLeg(index) {
        activeLegs.splice(index, 1);
        renderLegsList();
        renderPayoff();
    }

    function renderLegsList() {
        const container = document.getElementById('strategyLegsList');
        if (!container) return;

        if (activeLegs.length === 0) {
            container.innerHTML = '<div class="empty-text">No legs added. Select a preset above.</div>';
            return;
        }

        let html = '';
        activeLegs.forEach((leg, idx) => {
            html += `
                <div class="leg-item" style="display:flex; justify-content:space-between; align-items:center; background:#131722; border:1px solid #2a2e39; padding:6px 10px; margin-bottom:6px; border-radius:4px;">
                    <div>
                        <span class="badge ${leg.action === 'BUY' ? 'tag-long-buildup' : 'tag-short-buildup'}">${leg.action}</span>
                        <strong>${leg.strike} ${leg.type}</strong>
                        <span style="color:#787b86;">@ ₹${leg.entryPrice}</span>
                    </div>
                    <button onclick="window.removeStrategyLeg(${idx})" class="icon-btn" style="width:20px; height:20px; border:none; color:#f23645;">&times;</button>
                </div>
            `;
        });

        container.innerHTML = html;
        window.removeStrategyLeg = removeLeg;
    }

    function calculatePayoffAtPrice(expiryPrice) {
        let totalPnl = 0;
        const lotSize = 75;

        activeLegs.forEach(leg => {
            let intrinsic = 0;
            if (leg.type === 'CE') intrinsic = Math.max(0, expiryPrice - leg.strike);
            else intrinsic = Math.max(0, leg.strike - expiryPrice);

            let legPnl = 0;
            if (leg.action === 'BUY') {
                legPnl = (intrinsic - leg.entryPrice) * (leg.lots * lotSize);
            } else {
                legPnl = (leg.entryPrice - intrinsic) * (leg.lots * lotSize);
            }

            totalPnl += legPnl;
        });

        return totalPnl;
    }

    function renderPayoff() {
        if (!ctxPayoff || !payoffCanvas) return;

        const dpr = window.devicePixelRatio || 1;
        const w = payoffCanvas.width / dpr;
        const h = payoffCanvas.height / dpr;

        ctxPayoff.save();
        ctxPayoff.scale(dpr, dpr);

        ctxPayoff.fillStyle = '#0d1117';
        ctxPayoff.fillRect(0, 0, w, h);

        if (activeLegs.length === 0) {
            ctxPayoff.fillStyle = '#787b86';
            ctxPayoff.font = '12px Plus Jakarta Sans';
            ctxPayoff.textAlign = 'center';
            ctxPayoff.fillText('Add strategy legs to view Payoff Diagram', w / 2, h / 2);
            ctxPayoff.restore();
            return;
        }

        const minPrice = spotPrice - 800;
        const maxPrice = spotPrice + 800;
        const steps = 150;

        let payoffPoints = [];
        let maxProfit = -Infinity;
        let maxLoss = Infinity;
        let breakevens = [];

        for (let i = 0; i <= steps; i++) {
            let p = minPrice + (i / steps) * (maxPrice - minPrice);
            let pnl = calculatePayoffAtPrice(p);
            payoffPoints.push({ price: p, pnl });

            if (pnl > maxProfit) maxProfit = pnl;
            if (pnl < maxLoss) maxLoss = pnl;
        }

        // Find Breakevens
        for (let i = 1; i < payoffPoints.length; i++) {
            let prev = payoffPoints[i - 1];
            let curr = payoffPoints[i];
            if ((prev.pnl < 0 && curr.pnl >= 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
                breakevens.push(Math.round(curr.price));
            }
        }

        // Update Summary Metrics
        document.getElementById('payoffMaxProfit').innerText = maxProfit > 500000 ? 'Unlimited' : `₹${Math.round(maxProfit).toLocaleString()}`;
        document.getElementById('payoffMaxLoss').innerText = maxLoss < -500000 ? 'Unlimited' : `₹${Math.round(maxLoss).toLocaleString()}`;
        document.getElementById('payoffBreakeven').innerText = breakevens.length > 0 ? breakevens.join(', ') : 'N/A';

        // Draw Axes & Curves
        const absMax = Math.max(Math.abs(maxProfit), Math.abs(maxLoss), 5000);
        const zeroY = h / 2;

        // Zero Line
        ctxPayoff.strokeStyle = '#2a2e39';
        ctxPayoff.setLineDash([4, 4]);
        ctxPayoff.beginPath();
        ctxPayoff.moveTo(0, zeroY); ctxPayoff.lineTo(w, zeroY);
        ctxPayoff.stroke();
        ctxPayoff.setLineDash([]);

        // Spot Price Vertical Line
        const spotX = ((spotPrice - minPrice) / (maxPrice - minPrice)) * w;
        ctxPayoff.strokeStyle = '#ffd700';
        ctxPayoff.setLineDash([2, 2]);
        ctxPayoff.beginPath();
        ctxPayoff.moveTo(spotX, 0); ctxPayoff.lineTo(spotX, h);
        ctxPayoff.stroke();
        ctxPayoff.setLineDash([]);

        // Payoff Line Plot
        ctxPayoff.lineWidth = 2;
        ctxPayoff.beginPath();

        payoffPoints.forEach((pt, idx) => {
            const x = ((pt.price - minPrice) / (maxPrice - minPrice)) * w;
            const y = zeroY - (pt.pnl / absMax) * (h * 0.4);

            if (idx === 0) ctxPayoff.moveTo(x, y);
            else ctxPayoff.lineTo(x, y);
        });

        // Gradient Stroke (Green when > 0, Red when < 0)
        const grad = ctxPayoff.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#089981');
        grad.addColorStop(0.5, '#2962ff');
        grad.addColorStop(1, '#f23645');

        ctxPayoff.strokeStyle = grad;
        ctxPayoff.stroke();

        ctxPayoff.restore();
    }

    return {
        init,
        applyPreset,
        addLeg,
        removeLeg
    };

})();
