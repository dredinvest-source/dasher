window.SupabaseApp = window.SupabaseApp || {};

(function (global) {
  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }

  function getDateRange() {
    const now = new Date();
    let start, end, prevStart, prevEnd;

    if (currentPeriod === 'custom' && typeof customDateRange !== 'undefined' && customDateRange) {
      start = customDateRange.start;
      end = customDateRange.end;
      const dStart = new Date(start);
      const dEnd = new Date(end);
      const diffInDays = Math.ceil((dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1;

      const pStart = new Date(dStart);
      pStart.setDate(pStart.getDate() - diffInDays);
      const pEnd = new Date(dEnd);
      pEnd.setDate(pEnd.getDate() - diffInDays);
      prevStart = formatDate(pStart);
      prevEnd = formatDate(pEnd);
      return { start, end, prevStart, prevEnd };
    }

    switch (currentPeriod) {
      case 'today':
        start = end = formatDate(now);
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        prevStart = prevEnd = formatDate(yesterday);
        break;
      case 'yesterday':
        const yest = new Date(now);
        yest.setDate(now.getDate() - 1);
        start = end = formatDate(yest);
        const ereyesterday = new Date(now);
        ereyesterday.setDate(now.getDate() - 2);
        prevStart = prevEnd = formatDate(ereyesterday);
        break;
      case 'last7':
        const d7 = new Date(now);
        d7.setDate(now.getDate() - 7);
        start = formatDate(d7);
        end = formatDate(now);
        const d14 = new Date(now);
        d14.setDate(now.getDate() - 14);
        prevStart = formatDate(d14);
        prevEnd = formatDate(d7);
        break;
      case 'last30':
        const d30 = new Date(now);
        d30.setDate(now.getDate() - 30);
        start = formatDate(d30);
        end = formatDate(now);
        const d60 = new Date(now);
        d60.setDate(now.getDate() - 60);
        prevStart = formatDate(d60);
        prevEnd = formatDate(d30);
        break;
      default:
        start = end = formatDate(now);
        prevStart = prevEnd = formatDate(new Date(now.setDate(now.getDate() - 1)));
    }

    return { start, end, prevStart, prevEnd };
  }

  global.SupabaseApp.dateUtils = { getDateRange, formatDate };
    window.formatDate = function(d) {
      return window.SupabaseApp.utils.formatDate(d);
    };
    
    window.getDateRange = function() {
      return window.SupabaseApp.utils.getDateRange(window.currentPeriod, window.customDateRange);
    };
})(window);
