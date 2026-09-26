// @ts-check
/** 25-year cumulative savings chart (Chart.js, lazily loaded). */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{year:number, cumulative:number}[]} series
 * @param {number} netCost
 */
export async function drawSavingsChart(canvas, series, netCost) {
  const { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } = await import('chart.js');
  Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
  const lakh = (/** @type {number} */ v) => `₹${(v / 100000).toFixed(1)} L`;
  return new Chart(canvas, {
    type: 'line',
    data: {
      labels: series.map((s) => `Y${s.year}`),
      datasets: [
        {
          label: 'Cumulative bill savings',
          data: series.map((s) => s.cumulative),
          borderColor: '#0a6b4f',
          backgroundColor: 'rgba(10,107,79,0.12)',
          fill: true,
          pointRadius: 0,
          tension: 0.2,
        },
        {
          label: 'Net system cost',
          data: series.map(() => netCost),
          borderColor: '#f2a516',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${lakh(Number(ctx.parsed.y))}` } },
      },
      scales: {
        y: { ticks: { callback: (v) => lakh(Number(v)), font: { size: 11 } }, grid: { color: '#eef1f4' } },
        x: { ticks: { maxTicksLimit: 9, font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}
