window.SupabaseApp = window.SupabaseApp || {};

(function (global) {
  const renderOrUpdateChart = (elementId, seriesArray, categories, colors, isCurrency) => {
    const options = {
      series: seriesArray,
      chart: { height: 350, type: 'area', toolbar: { show: false }, fontFamily: 'Public Sans, serif', sparkline: { enabled: false } },
      colors: colors,
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.6, opacityTo: 0.1 } },
      xaxis: { categories: categories, tickAmount: 6, labels: { rotate: -45, style: { fontSize: '10px' }, hideOverlappingLabels: true } },
      yaxis: { labels: { formatter: (v) => isCurrency ? Math.round(v).toLocaleString('uk-UA') + ' ₴' : v } },
      grid: { borderColor: '#f1f1f1', strokeDashArray: 2 },
      legend: { show: true, position: 'top', horizontalAlign: 'right' }
    };

    const chartElement = document.querySelector('#' + elementId);
    if (!chartElement) return;

    if (!window[elementId + 'Obj']) {
      window[elementId + 'Obj'] = new ApexCharts(chartElement, options);
      window[elementId + 'Obj'].render();
    } else {
      window[elementId + 'Obj'].updateOptions({ series: seriesArray, xaxis: { categories: categories } });
    }
  };

  function renderFunnelChart(data, categories) {
    const element = document.querySelector('#funnelChart');
    if (!element) return;

    const options = {
      series: [{ name: 'Користувачі', data: data }],
      chart: { type: 'bar', height: 350, toolbar: { show: false }, fontFamily: 'Public Sans, serif' },
      plotOptions: { bar: { borderRadius: 0, horizontal: true, barHeight: '80%', isFunnel: true } },
      colors: ['#00a76f'],
      dataLabels: {
        enabled: true,
        formatter: function (val, opt) {
          const prevVal = opt.w.globals.series[0][opt.dataPointIndex - 1];
          const pctFromPrev = prevVal > 0 ? ((val / prevVal) * 100).toFixed(0) + '%' : '';
          return categories[opt.dataPointIndex] + ': ' + val.toLocaleString('uk-UA') + (pctFromPrev ? ' (' + pctFromPrev + ')' : '');
        },
        dropShadow: { enabled: true }
      },
      xaxis: { categories: categories, labels: { show: false } },
      legend: { show: false },
      tooltip: { shared: false, y: { formatter: (val) => val.toLocaleString('uk-UA') + ' чол.' } },
      stroke: { show: true, width: 1, colors: ['#1c2434'] }
    };

    if (window.funnelChartObj) {
      window.funnelChartObj.updateOptions({ xaxis: { categories: categories } });
      window.funnelChartObj.updateSeries([{ data: data }]);
    } else {
      window.funnelChartObj = new ApexCharts(element, options);
      window.funnelChartObj.render();
    }
  }

  global.SupabaseApp.charts = { renderOrUpdateChart, renderFunnelChart };
  window.renderOrUpdateChart = renderOrUpdateChart;
  window.renderFunnelChart = renderFunnelChart;
})(window);
