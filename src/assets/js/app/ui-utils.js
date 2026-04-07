window.SupabaseApp = window.SupabaseApp || {};

(function (global) {
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

  function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('d-none');
  }

  global.SupabaseApp.ui = { animateCount, updateTrendBadge, hideElement };
  window.animateCount = animateCount;
  window.updateTrendBadge = updateTrendBadge;
  window.hideElement = hideElement;
})(window);
