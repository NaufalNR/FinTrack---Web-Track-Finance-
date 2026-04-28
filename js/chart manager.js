/* =========================================
   FINTRACK — CHART MANAGER
   Handles all Chart.js rendering
   ========================================= */

const ChartManager = (() => {
  let monthlyChart = null;
  let categoryChart = null;
  let compareChart = null;

  const CHART_COLORS = [
    "#e8c97d",
    "#4ade80",
    "#f87171",
    "#60a5fa",
    "#a78bfa",
    "#fb923c",
    "#34d399",
    "#f472b6",
    "#facc15",
    "#38bdf8",
  ];

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1e2330",
        borderColor: "rgba(255,255,255,0.07)",
        borderWidth: 1,
        titleColor: "#f0f2f7",
        bodyColor: "#8b92a9",
        padding: 12,
        cornerRadius: 10,
        callbacks: {
          label: (ctx) => " " + formatRupiah(ctx.parsed.y ?? ctx.parsed),
        },
      },
    },
    scales: {},
  };

  function formatRupiah(n) {
    return "Rp " + Number(n).toLocaleString("id-ID");
  }

  const darkScales = {
    x: {
      grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
      ticks: { color: "#545d75", font: { size: 11 } },
    },
    y: {
      grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
      ticks: {
        color: "#545d75",
        font: { size: 11 },
        callback: (v) =>
          "Rp " +
          (v >= 1_000_000
            ? (v / 1_000_000).toFixed(1) + "jt"
            : v >= 1000
              ? (v / 1000).toFixed(0) + "rb"
              : v),
      },
    },
  };

  /** Monthly line chart: income vs expense per month */
  function renderMonthly(transactions) {
    const ctx = document.getElementById("monthlyChart").getContext("2d");

    // Group by YYYY-MM
    const months = {};
    transactions.forEach((t) => {
      const key = t.date.slice(0, 7);
      if (!months[key]) months[key] = { income: 0, expense: 0 };
      if (t.type === "income") months[key].income += t.amount;
      if (t.type === "expense") months[key].expense += t.amount;
    });

    const sorted = Object.keys(months).sort();
    const labels = sorted.map((k) => {
      const [y, m] = k.split("-");
      return new Date(+y, +m - 1).toLocaleString("id-ID", {
        month: "short",
        year: "2-digit",
      });
    });

    const incomeData = sorted.map((k) => months[k].income);
    const expenseData = sorted.map((k) => months[k].expense);

    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Pemasukan",
            data: incomeData,
            backgroundColor: "rgba(74,222,128,0.2)",
            borderColor: "#4ade80",
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: "Pengeluaran",
            data: expenseData,
            backgroundColor: "rgba(248,113,113,0.2)",
            borderColor: "#f87171",
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: {
            display: true,
            labels: {
              color: "#8b92a9",
              font: { size: 12 },
              usePointStyle: true,
              pointStyleWidth: 8,
            },
          },
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => " " + formatRupiah(ctx.parsed.y),
            },
          },
        },
        scales: darkScales,
      },
    });
  }

  /** Donut chart for category breakdown */
  function renderCategory(transactions) {
    const ctx = document.getElementById("categoryChart").getContext("2d");

    const expenses = transactions.filter((t) => t.type === "expense");
    const catMap = {};
    expenses.forEach((t) => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });

    const labels = Object.keys(catMap);
    const data = labels.map((k) => catMap[k]);

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: CHART_COLORS.map((c) => c + "33"),
            borderColor: CHART_COLORS,
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        ...baseOptions,
        cutout: "68%",
        plugins: {
          ...baseOptions.plugins,
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: "#8b92a9",
              font: { size: 11 },
              usePointStyle: true,
              pointStyleWidth: 8,
              padding: 12,
            },
          },
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => " " + formatRupiah(ctx.parsed),
            },
          },
        },
      },
    });
  }

  /** Simple line chart: cumulative balance over time */
  function renderCompare(transactions) {
    const ctx = document.getElementById("compareChart").getContext("2d");

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );

    let running = 0;
    const labels = [];
    const balances = [];

    sorted.forEach((t) => {
      running += t.type === "income" ? t.amount : -t.amount;
      labels.push(
        new Date(t.date).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
        }),
      );
      balances.push(running);
    });

    if (compareChart) compareChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, "rgba(232,201,125,0.25)");
    gradient.addColorStop(1, "rgba(232,201,125,0)");

    compareChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Saldo",
            data: balances,
            borderColor: "#e8c97d",
            backgroundColor: gradient,
            borderWidth: 2,
            pointRadius: balances.length < 30 ? 4 : 0,
            pointBackgroundColor: "#e8c97d",
            pointBorderColor: "#0a0c0f",
            pointBorderWidth: 2,
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (ctx) => " Saldo: " + formatRupiah(ctx.parsed.y),
            },
          },
        },
        scales: darkScales,
      },
    });
  }

  /** Update all charts */
  function updateAll(transactions) {
    if (!transactions.length) return destroyAll();
    renderMonthly(transactions);
    renderCategory(transactions);
    renderCompare(transactions);
  }

  function destroyAll() {
    [monthlyChart, categoryChart, compareChart].forEach((c) => c?.destroy());
    monthlyChart = categoryChart = compareChart = null;
  }

  return { updateAll, renderMonthly, renderCategory, renderCompare };
})();
