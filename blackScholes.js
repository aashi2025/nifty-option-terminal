/**
 * Black-Scholes Options Pricing & Greeks Engine
 */

window.BlackScholes = (function() {

    // Cumulative Normal Distribution Function approximation (Abramowitz & Stegun)
    function cdf(x) {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p  = 0.3275911;

        const sign = (x < 0) ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2.0);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return 0.5 * (1.0 + sign * y);
    }

    // Standard Normal Probability Density Function
    function pdf(x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }

    // Helper d1 and d2 calculations
    function calculateD1D2(S, K, T, r, v) {
        if (T <= 0 || v <= 0) return { d1: 0, d2: 0 };
        const d1 = (Math.log(S / K) + (r + (v * v) / 2.0) * T) / (v * Math.sqrt(T));
        const d2 = d1 - v * Math.sqrt(T);
        return { d1, d2 };
    }

    // Option Premium Calculation
    function calculatePrice(type, S, K, T, r = 0.07, v = 0.15) {
        if (T <= 0.0001) {
            return type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
        }
        const { d1, d2 } = calculateD1D2(S, K, T, r, v);
        if (type === 'CE') {
            return S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
        } else {
            return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
        }
    }

    // Option Greeks Calculation
    function calculateGreeks(type, S, K, T, r = 0.07, v = 0.15) {
        if (T <= 0.0001) {
            return { delta: type === 'CE' ? (S >= K ? 1 : 0) : (S <= K ? -1 : 0), gamma: 0, theta: 0, vega: 0 };
        }

        const { d1, d2 } = calculateD1D2(S, K, T, r, v);
        const sqrtT = Math.sqrt(T);

        // Gamma (Same for CE and PE)
        const gamma = pdf(d1) / (S * v * sqrtT);

        // Vega (Same for CE and PE, per 1% change in IV)
        const vega = (S * pdf(d1) * sqrtT) / 100;

        let delta, theta;
        if (type === 'CE') {
            delta = cdf(d1);
            theta = (-(S * pdf(d1) * v) / (2 * sqrtT) - r * K * Math.exp(-r * T) * cdf(d2)) / 365;
        } else {
            delta = cdf(d1) - 1;
            theta = (-(S * pdf(d1) * v) / (2 * sqrtT) + r * K * Math.exp(-r * T) * cdf(-d2)) / 365;
        }

        return {
            delta: parseFloat(delta.toFixed(4)),
            gamma: parseFloat(gamma.toFixed(5)),
            theta: parseFloat(theta.toFixed(2)),
            vega: parseFloat(vega.toFixed(2))
        };
    }

    // Newton-Raphson Implied Volatility Solver
    function calculateIV(type, marketPrice, S, K, T, r = 0.07) {
        let v = 0.20; // initial guess 20%
        const maxIter = 50;
        const tol = 1e-4;

        for (let i = 0; i < maxIter; i++) {
            const p = calculatePrice(type, S, K, T, r, v);
            const diff = p - marketPrice;

            if (Math.abs(diff) < tol) return v;

            const { d1 } = calculateD1D2(S, K, T, r, v);
            const vegaVal = S * pdf(d1) * Math.sqrt(T);

            if (Math.abs(vegaVal) < 1e-6) break;
            v = v - diff / vegaVal;
            if (v <= 0.01) v = 0.01;
        }
        return v;
    }

    return {
        cdf,
        pdf,
        calculatePrice,
        calculateGreeks,
        calculateIV
    };

})();
