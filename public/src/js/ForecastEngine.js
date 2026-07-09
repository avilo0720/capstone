/**
 * Forecasting algorithms: Weighted Moving Average (WMA) and Croston's Method.
 * Used by Forecasting and Reports modules.
 */
export function forecastItem(dailyUsage, monthlyDemandFallback) {
  if (!dailyUsage || dailyUsage.length < 2) {
    return { method: "Static", forecast: monthlyDemandFallback || 0 };
  }

  const firstDate = new Date(dailyUsage[0].date);
  const lastDate = new Date(dailyUsage[dailyUsage.length - 1].date);
  const totalDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
  const demandRatio = dailyUsage.length / totalDays;

  if (demandRatio < 0.33) {
    return crostonsMethod(dailyUsage);
  }
  return weightedMovingAverage(dailyUsage);
}

export function crostonsMethod(dailyUsage, alpha = 0.2) {
  let smoothedSize = dailyUsage[0].qty;
  let smoothedInterval = 1;
  let lastDate = new Date(dailyUsage[0].date);

  for (let i = 1; i < dailyUsage.length; i++) {
    const currentDate = new Date(dailyUsage[i].date);
    const interval = Math.max(1, (currentDate - lastDate) / (1000 * 60 * 60 * 24));

    smoothedSize = alpha * dailyUsage[i].qty + (1 - alpha) * smoothedSize;
    smoothedInterval = alpha * interval + (1 - alpha) * smoothedInterval;
    lastDate = currentDate;
  }

  const dailyForecast = smoothedSize / Math.max(smoothedInterval, 1);
  return {
    method: "Croston",
    forecast: +(dailyForecast * 30).toFixed(1),
    demandSize: +smoothedSize.toFixed(2),
    demandInterval: +smoothedInterval.toFixed(1),
    dailyRate: +dailyForecast.toFixed(3),
  };
}

export function weightedMovingAverage(dailyUsage) {
  const monthly = {};
  dailyUsage.forEach((d) => {
    const dt = new Date(d.date);
    const key = dt.getFullYear() + "-" + (dt.getMonth() + 1);
    monthly[key] = (monthly[key] || 0) + d.qty;
  });

  const months = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, total]) => total);

  const n = months.length;
  let forecast;
  if (n >= 3) {
    const recent = months.slice(-3);
    forecast = (recent[0] * 1 + recent[1] * 2 + recent[2] * 3) / 6;
  } else if (n === 2) {
    forecast = (months[0] + months[1]) / 2;
  } else {
    forecast = months[0] || 0;
  }

  return { method: "WMA", forecast: +forecast.toFixed(1) };
}

export function computeForecasts(items, usageData) {
  return items.map((item) => {
    const dailyUsage = usageData[item.id] || [];
    const result = forecastItem(dailyUsage, item.monthlyDemand || 0);
    const qty = item.quantity || 0;
    const demand = result.forecast || 0;
    return {
      ...item,
      forecast: result.forecast,
      method: result.method,
      demandSize: result.demandSize || null,
      demandInterval: result.demandInterval || null,
      dailyRate: result.dailyRate || null,
      need3m: Math.max(0, Math.ceil(demand * 3 - qty)),
      need6m: Math.max(0, Math.ceil(demand * 6 - qty)),
      need1y: Math.max(0, Math.ceil(demand * 12 - qty)),
    };
  });
}
