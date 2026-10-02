/**
 * Pro Interactive Canvas Candlestick & Indicator Chart Engine
 */

window.CandleChart = (function() {

    let candleCanvas, rsiCanvas, ctxMain, ctxRsi, wrapper;
    let candleData = [];
    let visibleBars = 60;
    let offsetIndex = 0; // scroll offset from right
    let isDragging = false;
    let dragStartX = 0;
    let crosshairPos = null;

    // Technical Indicator Toggles
    const indicators = {
        ema9: true,
        ema21: true,
        vwap: true,
        supertrend: false,
        rsi: true,
        macd: false
    };

    function init(canvasId, rsiCanvasId, wrapperId) {
        candleCanvas = document.getElementById(canvasId);
        rsiCanvas = document.getElementById(rsiCanvasId);
        wrapper = document.getElementById(wrapperId);

        if (!candleCanvas || !rsiCanvas || !wrapper) return;

        ctxMain = candleCanvas.getContext('2d');
        ctxRsi = rsiCanvas.getContext('2d');

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Attach Interactivity
        wrapper.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        wrapper.addEventListener('wheel', onWheel, { passive: false });
        wrapper.addEventListener('mouseleave', () => {
            crosshairPos = null;
            document.getElementById('chartTooltip').classList.add('hidden');
            render();
        });
    }

    function resizeCanvas() {
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        
        candleCanvas.width = rect.width * window.devicePixelRatio;
        candleCanvas.height = (rect.height * 0.70) * window.devicePixelRatio;
        
        rsiCanvas.width = rect.width * window.devicePixelRatio;
        rsiCanvas.height = (rect.height * 0.30) * window.devicePixelRatio;

        render();
    }

    function generateMockCandles(basePrice = 24500, count = 150) {
        let candles = [];
        let price = Math.max(basePrice, 1.0);
        let time = new Date(Date.now() - count * 5 * 60 * 1000);

        const stepScale = Math.max(basePrice * 0.0025, 0.1);
        const wickScale = Math.max(basePrice * 0.0015, 0.05);

        for (let i = 0; i < count; i++) {
            let change = (Math.random() - 0.48) * stepScale;
            let open = price;
            let close = Math.max(open + change, 0.05);
            let high = Math.max(open, close) + Math.random() * wickScale;
            let low = Math.max(Math.min(open, close) - Math.random() * wickScale, 0.01);
            let volume = Math.floor(Math.random() * 25000 + 5000);

            candles.push({
                time: new Date(time),
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(close.toFixed(2)),
                volume
            });

            price = close;
            time = new Date(time.getTime() + 5 * 60 * 1000);
        }

        // Calculate Indicators
        calculateIndicatorsData(candles);
        candleData = candles;
        offsetIndex = 0;
        render();
    }

    function calculateIndicatorsData(candles) {
        // EMA 9 & 21
        let ema9 = calculateEMA(candles, 9);
        let ema21 = calculateEMA(candles, 21);

        // VWAP
        let cumVol = 0, cumVolPrice = 0;
        let vwap = candles.map(c => {
            let tp = (c.high + c.low + c.close) / 3;
            cumVolPrice += tp * c.volume;
            cumVol += c.volume;
            return cumVol > 0 ? cumVolPrice / cumVol : c.close;
        });

        // RSI 14
        let rsi = calculateRSI(candles, 14);

        for (let i = 0; i < candles.length; i++) {
            candles[i].ema9 = ema9[i];
            candles[i].ema21 = ema21[i];
            candles[i].vwap = vwap[i];
            candles[i].rsi = rsi[i];
        }
    }

    function calculateEMA(candles, period) {
        let k = 2 / (period + 1);
        let ema = [];
        let prev = candles[0].close;

        for (let i = 0; i < candles.length; i++) {
            let val = (candles[i].close * k) + (prev * (1 - k));
            ema.push(val);
            prev = val;
        }
        return ema;
    }

    function calculateRSI(candles, period = 14) {
        let rsi = new Array(candles.length).fill(50);
        let gains = 0, losses = 0;

        for (let i = 1; i <= period && i < candles.length; i++) {
            let diff = candles[i].close - candles[i - 1].close;
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        for (let i = period + 1; i < candles.length; i++) {
            let diff = candles[i].close - candles[i - 1].close;
            let gain = diff >= 0 ? diff : 0;
            let loss = diff < 0 ? -diff : 0;

            avgGain = (avgGain * (period - 1) + gain) / period;
            avgLoss = (avgLoss * (period - 1) + loss) / period;

            let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi[i] = 100 - (100 / (1 + rs));
        }

        return rsi;
    }

    function render() {
        if (!candleData || candleData.length === 0 || !ctxMain) return;

        const dpr = window.devicePixelRatio || 1;
        const width = candleCanvas.width / dpr;
        const mainHeight = candleCanvas.height / dpr;
        const rsiHeight = rsiCanvas.height / dpr;

        ctxMain.save();
        ctxMain.scale(dpr, dpr);
        ctxRsi.save();
        ctxRsi.scale(dpr, dpr);

        // Clear Background
        ctxMain.fillStyle = '#0d1117';
        ctxMain.fillRect(0, 0, width, mainHeight);
        ctxRsi.fillStyle = '#0d1117';
        ctxRsi.fillRect(0, 0, width, rsiHeight);

        // Determine Visible Window
        const total = candleData.length;
        const endIndex = Math.max(0, total - offsetIndex);
        const startIndex = Math.max(0, endIndex - visibleBars);
        const visibleSlice = candleData.slice(startIndex, endIndex);

        if (visibleSlice.length === 0) return;

        // Price Min / Max bounds
        let minPrice = Math.min(...visibleSlice.map(c => c.low));
        let maxPrice = Math.max(...visibleSlice.map(c => c.high));
        const padding = (maxPrice - minPrice) * 0.05;
        minPrice -= padding;
        maxPrice += padding;

        const barWidth = width / visibleSlice.length;

        // Grid lines
        drawGrid(ctxMain, width, mainHeight, minPrice, maxPrice);

        // Render Volume Bars & Candlesticks
        visibleSlice.forEach((c, idx) => {
            const x = idx * barWidth + barWidth / 2;
            const isBullish = c.close >= c.open;

            // Volume bar at bottom 20%
            const maxVol = Math.max(...visibleSlice.map(v => v.volume));
            const volH = (c.volume / maxVol) * (mainHeight * 0.20);
            ctxMain.fillStyle = isBullish ? 'rgba(8, 153, 129, 0.25)' : 'rgba(242, 54, 69, 0.25)';
            ctxMain.fillRect(x - barWidth * 0.4, mainHeight - volH, barWidth * 0.8, volH);

            // Candle High-Low Wick
            const yHigh = mainHeight - ((c.high - minPrice) / (maxPrice - minPrice)) * mainHeight;
            const yLow = mainHeight - ((c.low - minPrice) / (maxPrice - minPrice)) * mainHeight;

            ctxMain.strokeStyle = isBullish ? '#089981' : '#f23645';
            ctxMain.lineWidth = 1.5;
            ctxMain.beginPath();
            ctxMain.moveTo(x, yHigh);
            ctxMain.lineTo(x, yLow);
            ctxMain.stroke();

            // Candle Body
            const yOpen = mainHeight - ((c.open - minPrice) / (maxPrice - minPrice)) * mainHeight;
            const yClose = mainHeight - ((c.close - minPrice) / (maxPrice - minPrice)) * mainHeight;
            const bodyY = Math.min(yOpen, yClose);
            const bodyH = Math.max(2, Math.abs(yClose - yOpen));

            ctxMain.fillStyle = isBullish ? '#089981' : '#f23645';
            ctxMain.fillRect(x - barWidth * 0.35, bodyY, barWidth * 0.7, bodyH);
        });

        // Overlay EMA 9 & EMA 21
        if (indicators.ema9) drawLineIndicator(ctxMain, visibleSlice, 'ema9', '#2962ff', width, mainHeight, minPrice, maxPrice, barWidth);
        if (indicators.ema21) drawLineIndicator(ctxMain, visibleSlice, 'ema21', '#ff9800', width, mainHeight, minPrice, maxPrice, barWidth);
        if (indicators.vwap) drawLineIndicator(ctxMain, visibleSlice, 'vwap', '#e91e63', width, mainHeight, minPrice, maxPrice, barWidth);

        // Render RSI Subchart
        drawRSI(ctxRsi, visibleSlice, width, rsiHeight, barWidth);

        // Render Crosshair if active
        if (crosshairPos) {
            drawCrosshair(ctxMain, width, mainHeight, crosshairPos.x, crosshairPos.y);
            updateTooltip(visibleSlice, crosshairPos.x, barWidth);
        }

        ctxMain.restore();
        ctxRsi.restore();
    }

    function drawGrid(ctx, w, h, minP, maxP) {
        ctx.strokeStyle = '#1e222d';
        ctx.lineWidth = 1;

        // Horizontal Price Grid Lines (4 levels)
        for (let i = 1; i <= 4; i++) {
            let y = (h / 5) * i;
            let pVal = maxP - (i / 5) * (maxP - minP);

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            ctx.fillStyle = '#787b86';
            ctx.font = '10px JetBrains Mono';
            ctx.fillText(pVal.toFixed(2), w - 55, y - 4);
        }
    }

    function drawLineIndicator(ctx, slice, key, color, w, h, minP, maxP, barW) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        slice.forEach((c, idx) => {
            if (!c[key]) return;
            const x = idx * barW + barW / 2;
            const y = h - ((c[key] - minP) / (maxP - minP)) * h;

            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
    }

    function drawRSI(ctx, slice, w, h, barW) {
        // Dotted lines at 70 and 30
        ctx.strokeStyle = '#2a2e39';
        ctx.setLineDash([4, 4]);

        const y70 = h - (70 / 100) * h;
        const y30 = h - (30 / 100) * h;

        ctx.beginPath();
        ctx.moveTo(0, y70); ctx.lineTo(w, y70);
        ctx.moveTo(0, y30); ctx.lineTo(w, y30);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#787b86';
        ctx.font = '9px JetBrains Mono';
        ctx.fillText('70', w - 20, y70 - 2);
        ctx.fillText('30', w - 20, y30 - 2);

        // Plot RSI Line
        ctx.strokeStyle = '#9c27b0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        slice.forEach((c, idx) => {
            const x = idx * barW + barW / 2;
            const rVal = c.rsi || 50;
            const y = h - (rVal / 100) * h;

            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();
    }

    function drawCrosshair(ctx, w, h, x, y) {
        ctx.strokeStyle = 'rgba(209, 212, 220, 0.4)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x, h);
        ctx.moveTo(0, y); ctx.lineTo(w, y);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    function updateTooltip(slice, mouseX, barW) {
        const tooltip = document.getElementById('chartTooltip');
        if (!tooltip) return;

        const index = Math.floor(mouseX / barW);
        if (index >= 0 && index < slice.length) {
            const c = slice[index];
            const timeStr = c.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            tooltip.innerHTML = `
                <div><strong>${timeStr}</strong></div>
                <div>O: <span class="${c.close >= c.open ? 'positive' : 'negative'}">${c.open}</span></div>
                <div>H: <span class="positive">${c.high}</span></div>
                <div>L: <span class="negative">${c.low}</span></div>
                <div>C: <span class="${c.close >= c.open ? 'positive' : 'negative'}">${c.close}</span></div>
                <div>Vol: ${c.volume.toLocaleString()}</div>
                <div>RSI: ${(c.rsi || 50).toFixed(1)}</div>
            `;

            tooltip.classList.remove('hidden');
            tooltip.style.left = `${Math.min(mouseX + 15, wrapper.clientWidth - 150)}px`;
            tooltip.style.top = `20px`;
        }
    }

    function onMouseDown(e) {
        isDragging = true;
        dragStartX = e.clientX;
    }

    function onMouseMove(e) {
        const rect = wrapper.getBoundingClientRect();
        crosshairPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (isDragging) {
            const diff = Math.round((e.clientX - dragStartX) / 10);
            offsetIndex = Math.max(0, Math.min(candleData.length - visibleBars, offsetIndex + diff));
            dragStartX = e.clientX;
        }

        render();
    }

    function onMouseUp() {
        isDragging = false;
    }

    function onWheel(e) {
        e.preventDefault();
        if (e.deltaY < 0) {
            visibleBars = Math.max(20, visibleBars - 5);
        } else {
            visibleBars = Math.min(120, visibleBars + 5);
        }
        render();
    }

    function updateLivePrice(price) {
        if (!candleData || candleData.length === 0) return;
        let last = candleData[candleData.length - 1];
        last.close = price;
        last.high = Math.max(last.high, price);
        last.low = Math.min(last.low, price);
        last.volume += Math.floor(Math.random() * 50 + 10);

        calculateIndicatorsData(candleData);
        render();
    }

    function setIndicator(name, active) {
        indicators[name] = active;
        render();
    }

    return {
        init,
        generateMockCandles,
        updateLivePrice,
        setIndicator,
        render
    };

})();
