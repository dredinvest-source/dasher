// Універсальні утиліти для SupabaseApp
window.SupabaseApp = window.SupabaseApp || {};
(function (global) {
  function getPromoterIds(userPermissions) {
    let pids = userPermissions?.promoter_id;
    if (pids == null) return null;
    if (typeof pids === 'string') {
      try { pids = JSON.parse(pids); } catch (e) { pids = pids.split(',').map((s) => s.trim()); }
    } else if (typeof pids === 'number') {
      pids = [pids];
    }
    if (Array.isArray(pids)) {
      const arr = pids.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
      return arr.length > 0 ? arr : null;
    }
    return null;
  }

  async function fetchAllOrders(supabaseClient, pids, startDate, endDate, selectStr = 'visit_date, subtotal_amount, tickets_count, title, seller_id') {
    let allData = [];
    let offset = 0;
    const limit = 1000;
    while (true) {
      let q = supabaseClient.from('orders').select(selectStr).gte('visit_date', startDate);
      if (endDate) q = q.lte('visit_date', endDate);
      if (pids) q = q.in('promoterId', pids);
      q = q.range(offset, offset + limit - 1);
      const { data, error } = await q;
      if (error) {
        console.error('Помилка завантаження orders:', error);
        break;
      }
      allData = allData.concat(data);
      if (data.length < limit) break;
      offset += limit;
    }
    return allData;
  }

  function formatDate(d) {
    return d.toISOString().split('T')[0];
  }

  function getDateRange(period, customDateRange) {
    const now = new Date();
    let start, end, prevStart, prevEnd;
    if (period === 'custom' && customDateRange) {
      start = customDateRange.start;
      end = customDateRange.end;
      const dStart = new Date(start);
      const dEnd = new Date(end);
      const diffInDays = Math.ceil((dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1;
      const pStart = new Date(dStart); pStart.setDate(pStart.getDate() - diffInDays);
      const pEnd = new Date(dEnd); pEnd.setDate(pEnd.getDate() - diffInDays);
      prevStart = formatDate(pStart);
      prevEnd = formatDate(pEnd);
      return { start, end, prevStart, prevEnd };
    }
    switch (period) {
      case 'today':
        start = end = formatDate(now);
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        prevStart = prevEnd = formatDate(yesterday);
        break;
      case 'yesterday':
        const yest = new Date(now); yest.setDate(now.getDate() - 1);
        start = end = formatDate(yest);
        const ereyesterday = new Date(now); ereyesterday.setDate(now.getDate() - 2);
        prevStart = prevEnd = formatDate(ereyesterday);
        break;
      case 'last7':
        const d7 = new Date(now); d7.setDate(now.getDate() - 7);
        start = formatDate(d7); end = formatDate(now);
        const d14 = new Date(now); d14.setDate(now.getDate() - 14);
        prevStart = formatDate(d14); prevEnd = formatDate(d7);
        break;
      case 'last30':
        const d30 = new Date(now); d30.setDate(now.getDate() - 30);
        start = formatDate(d30); end = formatDate(now);
        const d60 = new Date(now); d60.setDate(now.getDate() - 60);
        prevStart = formatDate(d60); prevEnd = formatDate(d30);
        break;
      default:
        start = end = formatDate(now);
        prevStart = prevEnd = formatDate(now);
    }
    return { start, end, prevStart, prevEnd };
  }

  function animateCount(element, targetValue, duration = 1500, suffix = '') {
    if (!element) return;
    let startTimestamp = null;
    const isFloat = targetValue % 1 !== 0;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      let currentCount = progress * targetValue;
      if (isFloat) {
        element.innerText = currentCount.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + suffix;
      } else {
        element.innerText = Math.floor(currentCount).toLocaleString('uk-UA') + suffix;
      }
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.innerText = isFloat
          ? targetValue.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + suffix
          : targetValue.toLocaleString('uk-UA') + suffix;
      }
    };
    window.requestAnimationFrame(step);
  }

  function updateTrendBadge(elementId, current, previous) {
    const container = document.getElementById(elementId);
    if (!container) return;
    let percent = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
    const isUp = percent >= 0;
    const absPercent = Math.abs(percent).toFixed(2);
    container.className = `small d-flex align-items-center gap-1 ${isUp ? 'text-success' : 'text-danger'}`;
    container.innerHTML = `
        <span>${isUp ? '+' : '-'}${absPercent}%</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${isUp ? '<path d="M3 17l6 -6l4 4l8 -8"/><path d="M14 7l7 0l0 7"/>' : '<path d="M3 7l6 6l4 -4l8 8"/><path d="M21 10l0 7l-7 0"/>'}
        </svg>
    `;
  }

  global.SupabaseApp.utils = { getPromoterIds, fetchAllOrders, formatDate, getDateRange, animateCount, updateTrendBadge };
})(window);
