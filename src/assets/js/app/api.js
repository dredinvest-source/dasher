window.SupabaseApp = window.SupabaseApp || {};

(function (global) {
  function getPromoterIds() {
    let pids = userPermissions?.promoter_id;
    if (pids == null) return null;

    if (typeof pids === 'string') {
      try {
        pids = JSON.parse(pids);
      } catch (e) {
        pids = pids.split(',').map((s) => s.trim());
      }
    } else if (typeof pids === 'number') {
      pids = [pids];
    }

    if (Array.isArray(pids)) {
      const arr = pids.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
      return arr.length > 0 ? arr : null;
    }

    return null;
  }

  async function fetchAllOrders(pids, startDate, endDate, selectStr = 'visit_date, subtotal_amount, tickets_count, title, seller_id') {
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

  global.SupabaseApp.api = { getPromoterIds, fetchAllOrders };
  window.getPromoterIds = getPromoterIds;
  window.fetchAllOrders = fetchAllOrders;
})(window);
