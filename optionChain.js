/**
 * Real-Time NSE Option Chain Matrix Module (Dynamic Strikes & Greeks)
 */

window.OptionChain = (function() {

    let spotPrice = 24525.80;
    let viewMode = 'standard'; // 'standard' (LTP & OI) or 'greeks' (Delta, Gamma, Theta, Vega)
    let strikeCount = 15;
    let strikeStep = 50;
    let selectedExpiryDays = 5; // 5 days to weekly expiry

    let strikesData = [];

    function init() {
        renderHeader();
        generateOptionChainData(spotPrice);
        renderTable();

        // Listeners for view mode toggle
        document.getElementById('modeStandardBtn')?.addEventListener('click', () => {
            viewMode = 'standard';
            document.getElementById('modeStandardBtn').classList.add('active');
            document.getElementById('modeGreeksBtn').classList.remove('active');
            renderHeader();
            renderTable();
        });

        document.getElementById('modeGreeksBtn')?.addEventListener('click', () => {
            viewMode = 'greeks';
            document.getElementById('modeGreeksBtn').classList.add('active');
            document.getElementById('modeStandardBtn').classList.remove('active');
            renderHeader();
            renderTable();
        });

        document.getElementById('strikeFilterSelect')?.addEventListener('change', (e) => {
            const val = e.target.value;
            strikeCount = val === 'ALL' ? 30 : parseInt(val);
            generateOptionChainData(spotPrice);
            renderTable();
        });
    }

    function setStrikeStep(step) {
        if (step && step > 0) {
            strikeStep = step;
        }
    }

    function renderHeader() {
        const tr = document.getElementById('tableSubHeader');
        if (!tr) return;

        if (viewMode === 'standard') {
            tr.innerHTML = `
                <th>Call OI</th>
                <th>Chg OI</th>
                <th>IV %</th>
                <th>LTP</th>
                <th>Chg %</th>
                <th>Buildup</th>
                <th class="strike-title">STRIKE</th>
                <th>Buildup</th>
                <th>Chg %</th>
                <th>LTP</th>
                <th>IV %</th>
                <th>Chg OI</th>
                <th>Put OI</th>
            `;
        } else {
            tr.innerHTML = `
                <th>Delta (&Delta;)</th>
                <th>Gamma (&Gamma;)</th>
                <th>Theta (&Theta;)</th>
                <th>Vega (&nu;)</th>
                <th>IV %</th>
                <th>Call LTP</th>
                <th class="strike-title">STRIKE</th>
                <th>Put LTP</th>
                <th>IV %</th>
                <th>Delta (&Delta;)</th>
                <th>Gamma (&Gamma;)</th>
                <th>Theta (&Theta;)</th>
                <th>Vega (&nu;)</th>
            `;
        }
    }

    function generateOptionChainData(spot) {
        spotPrice = spot;
        const atmStrike = Math.round(spot / strikeStep) * strikeStep;
        const strikes = [];

        for (let i = -strikeCount; i <= strikeCount; i++) {
            strikes.push(atmStrike + (i * strikeStep));
        }

        const T = selectedExpiryDays / 365;

        strikesData = strikes.map(strike => {
            const isAtm = strike === atmStrike;
            const isCallItm = strike < spot;
            const isPutItm = strike > spot;

            // Base IV with volatility smile curve
            const distFromAtm = Math.abs(strike - atmStrike) / strikeStep;
            const baseIv = 0.125 + (distFromAtm * 0.003); // ~12.5% IV

            // Call Option Calculations
            const callLtp = BlackScholes.calculatePrice('CE', spot, strike, T, 0.07, baseIv);
            const callGreeks = BlackScholes.calculateGreeks('CE', spot, strike, T, 0.07, baseIv);
            const callOi = Math.floor(Math.random() * 800000 + 100000);
            const callChgOi = Math.floor((Math.random() - 0.4) * 150000);

            // Put Option Calculations
            const putLtp = BlackScholes.calculatePrice('PE', spot, strike, T, 0.07, baseIv);
            const putGreeks = BlackScholes.calculateGreeks('PE', spot, strike, T, 0.07, baseIv);
            const putOi = Math.floor(Math.random() * 800000 + 100000);
            const putChgOi = Math.floor((Math.random() - 0.4) * 150000);

            return {
                strike,
                isAtm,
                isCallItm,
                isPutItm,

                // Call Data
                ce: {
                    ltp: parseFloat(callLtp.toFixed(2)),
                    chgPct: parseFloat(((Math.random() - 0.45) * 8).toFixed(2)),
                    iv: parseFloat((baseIv * 100).toFixed(2)),
                    oi: callOi,
                    chgOi: callChgOi,
                    buildup: getBuildup(callChgOi, Math.random() > 0.5),
                    greeks: callGreeks
                },

                // Put Data
                pe: {
                    ltp: parseFloat(putLtp.toFixed(2)),
                    chgPct: parseFloat(((Math.random() - 0.45) * 8).toFixed(2)),
                    iv: parseFloat((baseIv * 100).toFixed(2)),
                    oi: putOi,
                    chgOi: putChgOi,
                    buildup: getBuildup(putChgOi, Math.random() > 0.5),
                    greeks: putGreeks
                }
            };
        });

        // Update PCR calculation
        updateSummaryMetrics();
    }

    function getBuildup(chgOi, isPriceUp) {
        if (chgOi > 0 && isPriceUp) return { label: 'Long Buildup', class: 'tag-long-buildup' };
        if (chgOi > 0 && !isPriceUp) return { label: 'Short Buildup', class: 'tag-short-buildup' };
        if (chgOi < 0 && isPriceUp) return { label: 'Short Covering', class: 'tag-short-covering' };
        return { label: 'Long Unwinding', class: 'tag-long-unwinding' };
    }

    function updateSummaryMetrics() {
        if (!strikesData || strikesData.length === 0) return;

        let totalCallOi = strikesData.reduce((acc, row) => acc + row.ce.oi, 0);
        let totalPutOi = strikesData.reduce((acc, row) => acc + row.pe.oi, 0);
        let pcr = totalPutOi > 0 ? (totalPutOi / totalCallOi).toFixed(2) : 1.0;

        const pcrEl = document.getElementById('pcrRatio');
        if (pcrEl) {
            pcrEl.innerHTML = `${pcr} <small class="${pcr > 1 ? 'text-bullish' : 'negative'}">(${pcr > 1 ? 'Bullish' : 'Bearish'})</small>`;
        }

        const maxPainEl = document.getElementById('maxPainStrike');
        if (maxPainEl && strikesData.length > 0) {
            const atmRow = strikesData.find(s => s.isAtm) || strikesData[Math.floor(strikesData.length / 2)];
            if (atmRow) maxPainEl.innerText = atmRow.strike.toLocaleString();
        }
    }

    function renderTable() {
        const tbody = document.getElementById('optionChainTbody');
        if (!tbody) return;

        const maxCallOi = Math.max(...strikesData.map(s => s.ce.oi));
        const maxPutOi = Math.max(...strikesData.map(s => s.pe.oi));

        let html = '';

        strikesData.forEach(row => {
            const callOiWidth = (row.ce.oi / maxCallOi * 100).toFixed(1);
            const putOiWidth = (row.pe.oi / maxPutOi * 100).toFixed(1);

            const rowClass = row.isAtm ? 'atm-row' : '';

            if (viewMode === 'standard') {
                html += `
                    <tr class="${rowClass}">
                        <!-- CALL SIDE -->
                        <td class="${row.isCallItm ? 'itm-ce' : ''}">
                            <div class="oi-bar-bg oi-bar-ce" style="width:${callOiWidth}%"></div>
                            <span class="cell-val">${row.ce.oi.toLocaleString()}</span>
                        </td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''} ${row.ce.chgOi >= 0 ? 'positive' : 'negative'}">
                            ${row.ce.chgOi > 0 ? '+' : ''}${row.ce.chgOi.toLocaleString()}
                        </td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''}">${row.ce.iv}%</td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''} font-bold text-bright">
                            ₹${row.ce.ltp}
                            <div class="trade-actions-cell">
                                <button class="act-btn act-buy" onclick="window.openOrderModal('CE', ${row.strike}, ${row.ce.ltp}, 'BUY')">B</button>
                                <button class="act-btn act-sell" onclick="window.openOrderModal('CE', ${row.strike}, ${row.ce.ltp}, 'SELL')">S</button>
                            </div>
                        </td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''} ${row.ce.chgPct >= 0 ? 'positive' : 'negative'}">
                            ${row.ce.chgPct > 0 ? '+' : ''}${row.ce.chgPct}%
                        </td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''}">
                            <span class="buildup-tag ${row.ce.buildup.class}">${row.ce.buildup.label}</span>
                        </td>

                        <!-- STRIKE -->
                        <td class="strike-cell">${row.strike}</td>

                        <!-- PUT SIDE -->
                        <td class="${row.isPutItm ? 'itm-pe' : ''}">
                            <span class="buildup-tag ${row.pe.buildup.class}">${row.pe.buildup.label}</span>
                        </td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''} ${row.pe.chgPct >= 0 ? 'positive' : 'negative'}">
                            ${row.pe.chgPct > 0 ? '+' : ''}${row.pe.chgPct}%
                        </td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''} font-bold text-bright">
                            ₹${row.pe.ltp}
                            <div class="trade-actions-cell">
                                <button class="act-btn act-buy" onclick="window.openOrderModal('PE', ${row.strike}, ${row.pe.ltp}, 'BUY')">B</button>
                                <button class="act-btn act-sell" onclick="window.openOrderModal('PE', ${row.strike}, ${row.pe.ltp}, 'SELL')">S</button>
                            </div>
                        </td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''}">${row.pe.iv}%</td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''} ${row.pe.chgOi >= 0 ? 'positive' : 'negative'}">
                            ${row.pe.chgOi > 0 ? '+' : ''}${row.pe.chgOi.toLocaleString()}
                        </td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''}">
                            <div class="oi-bar-bg oi-bar-pe" style="width:${putOiWidth}%"></div>
                            <span class="cell-val">${row.pe.oi.toLocaleString()}</span>
                        </td>
                    </tr>
                `;
            } else {
                // GREEKS MODE
                html += `
                    <tr class="${rowClass}">
                        <td class="${row.isCallItm ? 'itm-ce' : ''}">${row.ce.greeks.delta}</td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''}">${row.ce.greeks.gamma}</td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''} negative">${row.ce.greeks.theta}</td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''}">${row.ce.greeks.vega}</td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''}">${row.ce.iv}%</td>
                        <td class="${row.isCallItm ? 'itm-ce' : ''} font-bold">₹${row.ce.ltp}</td>

                        <td class="strike-cell">${row.strike}</td>

                        <td class="${row.isPutItm ? 'itm-pe' : ''} font-bold">₹${row.pe.ltp}</td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''}">${row.pe.iv}%</td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''}">${row.pe.greeks.delta}</td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''}">${row.pe.greeks.gamma}</td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''} negative">${row.pe.greeks.theta}</td>
                        <td class="${row.isPutItm ? 'itm-pe' : ''}">${row.pe.greeks.vega}</td>
                    </tr>
                `;
            }
        });

        tbody.innerHTML = html;
    }

    function updateLiveSpot(spot) {
        generateOptionChainData(spot);
        renderTable();
    }

    function getStrikesData() { return strikesData; }

    return {
        init,
        setStrikeStep,
        updateLiveSpot,
        getStrikesData
    };

})();
