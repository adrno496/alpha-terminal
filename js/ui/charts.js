// Helpers Chart.js (pie portfolio, gauge sentiment, courbe Kelly simulation)
const COLORS = ['#00ff88', '#4488ff', '#ffaa00', '#ff3355', '#ff66cc', '#66ddee', '#aa88ff', '#88ee66', '#eebb44', '#777'];
const TEXT_PRIMARY = '#e8e8e8';
const TEXT_MUTED = '#888';
const GRID = '#2a2a2a';

function ensureChart() {
  if (!window.Chart) throw new Error('Chart.js non chargé');
  Chart.defaults.color = TEXT_PRIMARY;
  Chart.defaults.borderColor = GRID;
  Chart.defaults.font.family = "'JetBrains Mono', monospace";
  Chart.defaults.font.size = 11;
}

export function pieAllocation(canvas, items) {
  ensureChart();
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: items.map(i => i.label),
      datasets: [{
        data: items.map(i => i.value),
        backgroundColor: COLORS.slice(0, items.length),
        borderColor: '#0a0a0a',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: TEXT_PRIMARY, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return `${ctx.label}: ${ctx.raw.toLocaleString('fr-FR')} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// Gauge sentiment (0-100)
export function gaugeSentiment(canvas, score) {
  ensureChart();
  const color = score < 25 ? '#ff3355' : score < 45 ? '#ffaa00' : score < 55 ? '#888' : score < 75 ? '#88ee66' : '#00ff88';
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [score, 100 - score],
        backgroundColor: [color, '#1f1f1f'],
        borderColor: '#0a0a0a',
        borderWidth: 2,
        circumference: 180,
        rotation: 270
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

// Wealth evolution — line chart (total + lignes par catégorie)
export function wealthEvolution(canvas, snapshots, { categories = null } = {}) {
  ensureChart();
  if (!snapshots || !snapshots.length) return null;
  const labels = snapshots.map(s => new Date(s.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
  const totalData = snapshots.map(s => s.total);

  const datasets = [{
    label: 'Total',
    data: totalData,
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderWidth: 2.5,
    fill: true,
    pointRadius: 2,
    pointHoverRadius: 5,
    tension: 0.25
  }];

  if (categories && categories.length) {
    const palette = ['#4488ff', '#ffaa00', '#ff66cc', '#66ddee', '#aa88ff', '#88ee66', '#eebb44', '#ff3355'];
    categories.forEach((cat, i) => {
      datasets.push({
        label: cat.label,
        data: snapshots.map(s => s.byCategory?.[cat.id] || 0),
        borderColor: palette[i % palette.length],
        backgroundColor: palette[i % palette.length] + '15',
        borderWidth: 1.2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        hidden: true
      });
    });
  }

  return new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { color: TEXT_PRIMARY, font: { size: 11 }, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              return ctx.dataset.label + ': ' + (v >= 1000 ? (v/1000).toFixed(1) + 'k' : v.toFixed(0));
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: TEXT_MUTED, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 }, grid: { color: GRID } },
        y: {
          ticks: {
            color: TEXT_MUTED,
            callback: v => v >= 1e6 ? (v/1e6).toFixed(1) + 'M' : v >= 1000 ? (v/1000).toFixed(0) + 'k' : v
          },
          grid: { color: GRID }
        }
      }
    }
  });
}

// Simulation 100 trades Kelly (lignes Full / Half / Quarter)
export function kellySimulation(canvas, { winrate, R, capital, kelly, runs = 100 }) {
  ensureChart();
  const fractions = [
    { label: 'Full Kelly',    f: kelly,        color: '#ff3355' },
    { label: 'Half Kelly',    f: kelly / 2,    color: '#00ff88' },
    { label: 'Quarter Kelly', f: kelly / 4,    color: '#4488ff' }
  ];
  const labels = Array.from({ length: runs + 1 }, (_, i) => i);
  const datasets = fractions.map(({ label, f, color }) => {
    let cap = capital;
    const pts = [cap];
    for (let i = 0; i < runs; i++) {
      const win = Math.random() < winrate;
      const delta = win ? cap * f * R : -cap * f;
      cap = Math.max(0, cap + delta);
      pts.push(cap);
    }
    return {
      label,
      data: pts,
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.1
    };
  });
  return new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: TEXT_PRIMARY } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: { ticks: { color: TEXT_MUTED }, grid: { color: GRID } },
        y: {
          ticks: {
            color: TEXT_MUTED,
            callback: (v) => (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) + ' €'
          },
          grid: { color: GRID }
        }
      }
    }
  });
}
