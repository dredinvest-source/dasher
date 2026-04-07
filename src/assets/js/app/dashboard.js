// ========================================================================= //
// 0. ІНІЦІАЛІЗАЦІЯ СТАНУ ТА КОНСТАНТ
// ========================================================================= //

// Імпорт констант (припускаємо, що constants.js доступний глобально або через Gulp)
// Якщо ви використовуєте ES Modules, це було б: import { SELLER_IDS, CHART_COLORS } from '../config/constants.js';
// Для поточної структури, вони будуть доступні глобально після завантаження constants.js

/**
 * Об'єкт стану дашборду для інкапсуляції глобальних змінних.
 * @type {object}
 */
const dashboardState = {
    currentPeriod: 'today',
    userPermissions: null,
    customDateRange: null,
    chartInstances: { // Для зберігання об'єктів графіків ApexCharts та ECharts
        ticketsChart: null,
        combinedSalesChart: null,
        aovChart: null,
        deviceDonutChart: null,
        genderRadialChart: null,
        trafficGroupedObj: null,
        seoPerformanceChartObj: null,
        funnelChartObj: null,
        myMapChart: null, // Для карти України ECharts
        worldMap: null, // Для карти світу jsVectorMap
    },
    domElements: {} // Для кешування часто використовуваних DOM-елементів
};

// ========================================================================= //
// 1. ДОПОМІЖНІ ФУНКЦІЇ 
// ========================================================================= //

// Функція для отримання ID промоутерів масивом
function getPromoterIds() { // Використовує dashboardState.userPermissions
    let pids = dashboardState.userPermissions?.promoter_id;
    if (pids == null) return null;
    
    if (typeof pids === 'string') {
        try { pids = JSON.parse(pids); } catch(e) { pids = pids.split(',').map(s => s.trim()); }
    } else if (typeof pids === 'number') {
        pids = [pids];
    }
    
    if (Array.isArray(pids)) {
        const arr = pids.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
        return arr.length > 0 ? arr : null;
    }
    return null;
}

// Функція обходу ліміту 1000 рядків Supabase для таблиці orders
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
            console.error("Помилка завантаження orders:", error);
            break;
        }
        allData = allData.concat(data);
        if (data.length < limit) break; 
        offset += limit;
    }
    return allData;
}

function getDateRange() {
    const now = new Date();
    let start, end, prevStart, prevEnd;
    const formatDate = (d) => d.toISOString().split('T')[0];

    if (dashboardState.currentPeriod === 'custom' && dashboardState.customDateRange) {
        start = dashboardState.customDateRange.start; end = dashboardState.customDateRange.end;
        const dStart = new Date(start); const dEnd = new Date(end);
        const diffInDays = Math.ceil((dEnd - dStart) / (1000 * 60 * 60 * 24)) + 1;

        const pStart = new Date(dStart); pStart.setDate(pStart.getDate() - diffInDays);
        const pEnd = new Date(dEnd); pEnd.setDate(pEnd.getDate() - diffInDays);
        prevStart = formatDate(pStart); prevEnd = formatDate(pEnd);
        return { start, end, prevStart, prevEnd };
    }

    switch (dashboardState.currentPeriod) {
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
            element.innerText = isFloat ? targetValue.toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + suffix : targetValue.toLocaleString('uk-UA') + suffix;
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

const renderOrUpdateChart = (elementId, seriesArray, categories, colors, isCurrency) => {
    const options = {
        series: seriesArray, 
        chart: { height: 350, type: 'area', toolbar: { show: false }, fontFamily: 'Public Sans, serif', sparkline: { enabled: false } },
        colors: colors, dataLabels: { enabled: false }, stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.6, opacityTo: 0.1 } },
        xaxis: { categories: categories, tickAmount: 6, labels: { rotate: -45, style: { fontSize: '10px' }, hideOverlappingLabels: true } },
        yaxis: { labels: { formatter: (v) => isCurrency ? Math.round(v).toLocaleString('uk-UA') + ' ₴' : v } },
        grid: { borderColor: '#f1f1f1', strokeDashArray: 2 },
        legend: { show: true, position: 'top', horizontalAlign: 'right' }
    };
    const chartElement = document.querySelector("#" + elementId);
    if (!chartElement) return;
    if (!dashboardState.chartInstances[elementId]) {
        dashboardState.chartInstances[elementId] = new ApexCharts(chartElement, options);
        dashboardState.chartInstances[elementId].render();
    } else {
        dashboardState.chartInstances[elementId].updateOptions({ series: seriesArray, xaxis: { categories: categories } });
    }
};

// ========================================================================= //
// 2. ТОП БЛОК: Покупки, Дохід, Користувачі (ТРИ КАРТКИ)
// ========================================================================= //
async function updateSalesStats() {
    const { start, end, prevStart, prevEnd } = getDateRange();
    const pids = getPromoterIds();

    try {
        let currP, prevP;

        if (pids) {
            // Промоутер: витягуємо всі замовлення і групуємо по seller_id
            const currData = await fetchAllOrders(pids, start, end, 'tickets_count, subtotal_amount, seller_id');
            const prevData = await fetchAllOrders(pids, prevStart, prevEnd, 'tickets_count, subtotal_amount, seller_id');

            const groupRawOrders = (data) => (data || []).reduce((acc, row) => {
                const rev = parseFloat(row.subtotal_amount) || 0;
                const sId = Number(row.seller_id);
                
                // ФІКС БАГУ: Рахуємо ЗАМОВЛЕННЯ (1 рядок = 1 замовлення), а не сумуємо квитки
                acc.all.orders += 1; 
                acc.all.revenue += rev;
                
                if (sId === window.SELLER_IDS.NUMOTAMO) {
                    acc.numotamo.orders += 1; acc.numotamo.revenue += rev;
                } else if (sId === window.SELLER_IDS.KARABAS) {
                    acc.karabas.orders += 1; acc.karabas.revenue += rev;
                } else if (sId === window.SELLER_IDS.MTICKET) {
                    acc.mticket.orders += 1; acc.mticket.revenue += rev;
                } else if (sId === window.SELLER_IDS.INTERNET_BILET) {
                    acc.internet_bilet.orders += 1; acc.internet_bilet.revenue += rev;
                } else { // Всі інші seller_id групуємо під "Інші"
                    acc.others.orders += 1; acc.others.revenue += rev;
                }
                return acc;
            }, { all: {orders:0, revenue:0}, numotamo: {orders:0, revenue:0}, karabas: {orders:0, revenue:0}, mticket: {orders:0, revenue:0}, internet_bilet: {orders:0, revenue:0}, others: {orders:0, revenue:0} });

            currP = groupRawOrders(currData);
            prevP = groupRawOrders(prevData);

        } else {
            // Адмін: беремо з агрегованої таблиці
            const [currPortal, prevPortal] = await Promise.all([
                supabaseClient.from('portal_sales_daily').select('*').gte('visit_date', start).lte('visit_date', end),
                supabaseClient.from('portal_sales_daily').select('*').gte('visit_date', prevStart).lte('visit_date', prevEnd)
            ]);

            const groupPortal = (data) => (data || []).reduce((acc, row) => {
                const type = row.report_type;
                const orders = (Number(row.total_orders) || 0);
                const revenue = (Number(row.total_revenue) || 0);

                // Ensure all expected keys exist in the accumulator
                if (!acc.all) acc.all = { orders: 0, revenue: 0 };
                if (!acc.numotamo) acc.numotamo = { orders: 0, revenue: 0 };
                if (!acc.karabas) acc.karabas = { orders: 0, revenue: 0 };
                if (!acc.mticket) acc.mticket = { orders: 0, revenue: 0 };
                if (!acc.internet_bilet) acc.internet_bilet = { orders: 0, revenue: 0 };
                if (!acc.others) acc.others = { orders: 0, revenue: 0 };

                if (type === 'all') {
                    acc.all.orders += orders; acc.all.revenue += revenue;
                } else if (type === 'numotamo') {
                    acc.numotamo.orders += orders; acc.numotamo.revenue += revenue;
                } else if (type === 'karabas') {
                    acc.karabas.orders += orders; acc.karabas.revenue += revenue;
                } else if (type === 'mticket') {
                    acc.mticket.orders += orders; acc.mticket.revenue += revenue;
                } else if (type === 'internet_bilet') {
                    acc.internet_bilet.orders += orders; acc.internet_bilet.revenue += revenue;
                } else { // Будь-який інший report_type групуємо під "Інші"
                    acc.others.orders += orders; acc.others.revenue += revenue;
                }
                return acc;
            }, { all: {orders:0, revenue:0}, numotamo: {orders:0, revenue:0}, karabas: {orders:0, revenue:0}, mticket: {orders:0, revenue:0}, internet_bilet: {orders:0, revenue:0}, others: {orders:0, revenue:0} });

            currP = groupPortal(currPortal.data);
            prevP = groupPortal(prevPortal.data);
        }

        // Кешування DOM-елементів
        dashboardState.domElements.totalOrders = dashboardState.domElements.totalOrders || document.getElementById('total-orders');
        dashboardState.domElements.ordersTrend = dashboardState.domElements.ordersTrend || document.getElementById('orders-trend');
        dashboardState.domElements.ordersPortal = dashboardState.domElements.ordersPortal || document.getElementById('orders-portal');
        dashboardState.domElements.ordersGa = dashboardState.domElements.ordersGa || document.getElementById('orders-ga');
        dashboardState.domElements.totalRevenue = dashboardState.domElements.totalRevenue || document.getElementById('total-revenue');
        dashboardState.domElements.revenueTrend = dashboardState.domElements.revenueTrend || document.getElementById('revenue-trend');
        dashboardState.domElements.revenuePortal = dashboardState.domElements.revenuePortal || document.getElementById('revenue-portal');
        dashboardState.domElements.revenueGa = dashboardState.domElements.revenueGa || document.getElementById('revenue-ga');

        animateCount(dashboardState.domElements.totalOrders, currP.all.orders);
        updateTrendBadge('orders-trend', currP.all.orders, prevP.all.orders); // 'orders-trend' залишається ID
        animateCount(dashboardState.domElements.ordersPortal, currP.numotamo.orders); // Numotamo
        animateCount(dashboardState.domElements.ordersGa, currP.karabas.orders + currP.mticket.orders + currP.internet_bilet.orders + currP.others.orders); // Karabas + MTicket + Internet-Bilet + Інші
        animateCount(dashboardState.domElements.totalRevenue, currP.all.revenue, 1500, ' ₴');
        updateTrendBadge('revenue-trend', currP.all.revenue, prevP.all.revenue); // 'revenue-trend' залишається ID
        animateCount(dashboardState.domElements.revenuePortal, currP.numotamo.revenue, 1500, ' ₴');
        animateCount(dashboardState.domElements.revenueGa, currP.karabas.revenue + currP.mticket.revenue + currP.internet_bilet.revenue + currP.others.revenue, 1500, ' ₴'); // Karabas + MTicket + Internet-Bilet + Інші

    } catch (err) { console.error("❌ Помилка завантаження фінансової статистики:", err); }
}

async function updateGeneralStats() {
    try {
        const { start, end, prevStart, prevEnd } = getDateRange();
        const pids = getPromoterIds();

        let currQuery = supabaseClient.from('google_analytics_daily').select('total_users, user_type').gte('visit_date', start).lte('visit_date', end);
        let prevQuery = supabaseClient.from('google_analytics_daily').select('total_users').gte('visit_date', prevStart).lte('visit_date', prevEnd);

        if(pids) {
            currQuery = currQuery.in('promoter_id', pids);
            prevQuery = prevQuery.in('promoter_id', pids);
        }

        const [currRes, prevRes] = await Promise.all([currQuery, prevQuery]);
        if (currRes.error) throw currRes.error;

        let total = 0, newUsers = 0, returningUsers = 0;
        currRes.data?.forEach(row => {
            const count = parseInt(row.total_users) || 0;
            const type = row.user_type ? row.user_type.toLowerCase().trim() : "";
            total += count;
            if (type === 'new') newUsers += count; else if (type === 'returning') returningUsers += count;
        });
        const prevTotal = (prevRes.data || []).reduce((acc, row) => acc + (parseInt(row.total_users) || 0), 0);

        // Кешування DOM-елементів
        dashboardState.domElements.totalUsers = dashboardState.domElements.totalUsers || document.getElementById('total-users') || document.getElementById('users-count');
        dashboardState.domElements.usersNew = dashboardState.domElements.usersNew || document.getElementById('users-new');
        dashboardState.domElements.usersReturning = dashboardState.domElements.usersReturning || document.getElementById('users-returning');
        dashboardState.domElements.usersTrend = dashboardState.domElements.usersTrend || document.getElementById('users-trend');

        if (dashboardState.domElements.totalUsers) animateCount(dashboardState.domElements.totalUsers, total);
        animateCount(dashboardState.domElements.usersNew, newUsers);
        animateCount(dashboardState.domElements.usersReturning, returningUsers);
        updateTrendBadge('users-trend', total, prevTotal); // 'users-trend' залишається ID
        return total;
    } catch (err) { console.error("❌ Помилка загальної статистики:", err); return 0; }
}

async function updateSalesCharts() {
    const period = getDateRange();
    const chartStartDate = new Date(); 
    chartStartDate.setDate(chartStartDate.getDate() - 29);
    const chartStartISO = chartStartDate.toISOString().split('T')[0];
    const pids = getPromoterIds();

    try {
        let stats = [];

        if (pids) {
            const data = await fetchAllOrders(pids, chartStartISO, null, 'visit_date, subtotal_amount, tickets_count, seller_id');

            const tempMap = {};
            data.forEach(row => {
                if (!row.visit_date) return;
                const d = row.visit_date.substring(0, 10);
                
                if (!tempMap[d]) tempMap[d] = { 
                    all_r:0, all_o:0, all_t:0, 
                    numo_r:0, numo_o:0, numo_t:0, 
                    kara_r:0, kara_o:0, kara_t:0, 
                    mtic_r:0, mtic_o:0, mtic_t:0, 
                    ib_r:0, ib_o:0, ib_t:0,
                    others_r:0, others_o:0, others_t:0
                };
                
                const rev = parseFloat(row.subtotal_amount) || 0;
                const tix = parseInt(row.tickets_count) || 0;
                const ord = 1; 
                const sId = Number(row.seller_id);
                
                // 1. Загальна сума (All)
                tempMap[d].all_r += rev; tempMap[d].all_o += ord; tempMap[d].all_t += tix;
                
                // 2. Розподіл по конкретних селлерах
                if (sId === window.SELLER_IDS.NUMOTAMO) { 
                    tempMap[d].numo_r += rev; tempMap[d].numo_o += ord; tempMap[d].numo_t += tix; 
                } else if (sId === window.SELLER_IDS.KARABAS) { 
                    tempMap[d].kara_r += rev; tempMap[d].kara_o += ord; tempMap[d].kara_t += tix; 
                } else if (sId === window.SELLER_IDS.INTERNET_BILET) { 
                    tempMap[d].ib_r += rev; tempMap[d].ib_o += ord; tempMap[d].ib_t += tix; 
                } else if (sId === window.SELLER_IDS.MTICKET) { 
                    tempMap[d].mtic_r += rev; tempMap[d].mtic_o += ord; tempMap[d].mtic_t += tix; 
                } else { 
                    // Всі інші потрапляють сюди
                    tempMap[d].others_r += rev; tempMap[d].others_o += ord; tempMap[d].others_t += tix; 
                }
            });
            
            Object.entries(tempMap).forEach(([date, val]) => {
                const types = [
                    {key: 'all', r: 'all_r', o: 'all_o', t: 'all_t'},
                    {key: 'numotamo', r: 'numo_r', o: 'numo_o', t: 'numo_t'},
                    {key: 'karabas', r: 'kara_r', o: 'kara_o', t: 'kara_t'},
                    {key: 'mticket', r: 'mtic_r', o: 'mtic_o', t: 'mtic_t'},
                    {key: 'internet_bilet', r: 'ib_r', o: 'ib_o', t: 'ib_t'},
                    {key: 'others', r: 'others_r', o: 'others_o', t: 'others_t'}
                ];
                types.forEach(type => {
                    stats.push({ 
                        visit_date: date, 
                        total_revenue: val[type.r], 
                        total_orders: val[type.o], 
                        total_tickets: val[type.t], 
                        report_type: type.key 
                    });
                });
            });

        } else {
            const { data, error } = await supabaseClient
                .from('portal_sales_daily')
                .select('visit_date, total_revenue, total_orders, total_tickets, report_type')
                .gte('visit_date', chartStartISO);

            if (error) throw error;
            stats = data;
        }

        const daysMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            daysMap[iso] = { 
                label: d.toLocaleDateString('uk-UA', {day:'numeric', month:'short'}),
                all: { r: 0, o: 0, t: 0 }, 
                numo: { r: 0, o: 0, t: 0 }, 
                kara: { r: 0, o: 0, t: 0 }, 
                mtic: { r: 0, o: 0, t: 0 }, 
                ib: { r: 0, o: 0, t: 0 }, 
                others: { r: 0, o: 0, t: 0 }
            };
        }

        let periodTickets = 0, periodOrders = 0, periodRevenue = 0;

        stats.forEach(row => {
            if (!row.visit_date) return;
            const d = row.visit_date.substring(0, 10); 
            const type = row.report_type;
            if (!daysMap[d]) return;

            const r = parseFloat(row.total_revenue) || 0;
            const o = parseInt(row.total_orders) || 0;
            const t = parseInt(row.total_tickets) || 0;

            // КОРЕКТНЕ ВИЗНАЧЕННЯ КЛЮЧА
            let mapKey = 'others';
            if (type === 'all') mapKey = 'all';
            else if (type === 'numotamo') mapKey = 'numo';
            else if (type === 'karabas') mapKey = 'kara';
            else if (type === 'mticket') mapKey = 'mtic';
            else if (type === 'internet_bilet') mapKey = 'ib';
            
            if (daysMap[d][mapKey]) {
                daysMap[d][mapKey] = { r, o, t };
                if (type === 'all' && d >= period.start && d <= period.end) {
                    periodRevenue += r;
                    periodOrders += o;
                    periodTickets += t;
                }
            }
        });

        const labels = Object.values(daysMap).map(v => v.label);
        const days = Object.values(daysMap);

        const seriesConfig = [
            { name: 'Загалом',      key: 'all',   color: window.CHART_COLORS.ALL },
            { name: 'Numotamo',     key: 'numo',  color: window.CHART_COLORS.NUMOTAMO },
            { name: 'Karabas',      key: 'kara',  color: window.CHART_COLORS.KARABAS },
            { name: 'MTicket',      key: 'mtic',  color: window.CHART_COLORS.MTICKET },
            { name: 'Internet-Bilet',  key: 'ib', color: window.CHART_COLORS.INTERNET_BILET },
            { name: 'Інші',         key: 'others', color: window.CHART_COLORS.OTHERS }
        ];

        renderOrUpdateChart('ticketsChart', seriesConfig.map(s => ({ name: s.name, data: days.map(d => d[s.key].t) })), labels, seriesConfig.map(s => s.color), false);
        renderOrUpdateChart('combinedSalesChart', seriesConfig.map(s => ({ name: s.name, data: days.map(d => d[s.key].r) })), labels, seriesConfig.map(s => s.color), true);
        renderOrUpdateChart('aovChart', seriesConfig.map(s => ({ name: s.name, data: days.map(d => d[s.key].o > 0 ? Math.round(d[s.key].r / d[s.key].o) : 0) })), labels, seriesConfig.map(s => s.color), true);

        const avgCheck = periodOrders > 0 ? Math.round(periodRevenue / periodOrders) : 0;
        animateCount(document.getElementById('stat-total-tickets'), periodTickets, 1000, ' шт.');
        animateCount(document.getElementById('stat-total-revenue'), periodRevenue, 1000, ' ₴');
        animateCount(document.getElementById('stat-avg-check'), avgCheck, 1000, ' ₴');

    } catch (err) { console.error("❌ Помилка графіків:", err); }
}

// ========================================================================= //
// 4. БЛОК: Відвідувачі за пристроями (DONUT CHART)
// ========================================================================= //
async function updateDeviceStats() {
    try {
        const { start, end } = getDateRange();
        const pids = getPromoterIds();
        
        let query = supabaseClient.from('device_stats').select('device_category, total_users').gte('visit_date', start).lte('visit_date', end);
        if(pids) query = query.in('promoter_id', pids);

        const { data, error } = await query;
        if (error) throw error;

        const stats = { mobile: 0, desktop: 0, tablet: 0, "smart tv": 0 };
        data.forEach(item => {
            const cat = item.device_category.toLowerCase();
            if (stats.hasOwnProperty(cat)) stats[cat] += parseInt(item.total_users) || 0;
        });

        const localTotal = Object.values(stats).reduce((a, b) => a + b, 0);
        const mapping = { mobile: 'mobile', desktop: 'desktop', tablet: 'tablet', "smart tv": 'smarttv' };
        const seriesData = [];
        const countsOnly = [];

        Object.keys(mapping).forEach(key => {
            const count = stats[key];
            const idKey = mapping[key];
            const pct = localTotal > 0 ? ((count / localTotal) * 100).toFixed(1) : "0.0"; // Використовуємо toFixed(1) для відсотків

            // Кешування DOM-елементів для пристроїв
            dashboardState.domElements[`deviceCount${idKey}`] = dashboardState.domElements[`deviceCount${idKey}`] || document.getElementById(`device-count-${idKey}`);
            dashboardState.domElements[`devicePct${idKey}`] = dashboardState.domElements[`devicePct${idKey}`] || document.getElementById(`device-pct-${idKey}`);
            if (dashboardState.domElements[`deviceCount${idKey}`]) animateCount(dashboardState.domElements[`deviceCount${idKey}`], count);
            if (dashboardState.domElements[`devicePct${idKey}`]) dashboardState.domElements[`devicePct${idKey}`].innerText = `${pct}%`;
            seriesData.push(parseFloat(pct)); countsOnly.push(count);
        });

        // Оновлення або ініціалізація графіка
        if (dashboardState.chartInstances.deviceDonutChart) dashboardState.chartInstances.deviceDonutChart.updateOptions({ series: seriesData, tooltip: { y: { formatter: (val, { seriesIndex }) => countsOnly[seriesIndex].toLocaleString('uk-UA') + " відвідувачів" } } });
        else initDeviceChart(seriesData, countsOnly);

    } catch (err) { console.error(err); }
}

function initDeviceChart(series, counts) {
    dashboardState.chartInstances.deviceDonutChart = new ApexCharts(document.querySelector('#totalSale'), {
        series: series, labels: ['Мобільні', 'Десктоп', 'Планшети', 'Smart TV'],
        colors: [window.theme.primary, window.theme.warning, window.theme.info, window.theme.danger],
        chart: { type: 'donut', height: 377, fontFamily: 'Public Sans, serif' },
        tooltip: { y: { formatter: (val, { seriesIndex }) => counts[seriesIndex].toLocaleString('uk-UA') + " відвідувачів" } },
        legend: { show: false }, dataLabels: { enabled: false }, plotOptions: { pie: { donut: { size: '65%' } } }, stroke: { width: 0 }
    });
    dashboardState.chartInstances.deviceDonutChart.render();
}

// ========================================================================= //
// 5. БЛОК: Останні замовлення (ТАБЛИЦЯ)
// ========================================================================= //
async function updateOrdersTable() {
    try {
        const { start, end } = getDateRange();
        const tbody = dashboardState.domElements.ordersTableBody = dashboardState.domElements.ordersTableBody || document.getElementById('orders-table-body');
        if (!tbody) return;
        
        let query = supabaseClient.from('orders')
            .select('*')
            .gte('visit_date', start)
            .lte('visit_date', end)
            .order('date_created', { ascending: false })
            .limit(10);
            
        const pids = getPromoterIds();
        if (pids) query = query.in('promoterId', pids);

        const { data, error } = await query;
        if (error) throw error;

        const getSellerName = (sellerId) => {
            const id = Number(sellerId);
            if (id === window.SELLER_IDS.NUMOTAMO) return '<span class="badge text-danger border">Numotamo</span>';
            if (id === window.SELLER_IDS.KARABAS) return '<span class="badge text-warning border">Karabas</span>';
            if (id === window.SELLER_IDS.MTICKET) return '<span class="badge text-info border">MTicket</span>';
            if (id === window.SELLER_IDS.INTERNET_BILET) return '<span class="badge text-primary border">Internet-Bilet</span>';
            return '<span class="badge text-secondary border">Інший продавець</span>'; // Загальний fallback
        };

        tbody.innerHTML = (data || []).map(order => {
            const sellerName = getSellerName(order.seller_id);
            const dateConfirm = order.date_confirmed ? new Date(order.date_confirmed).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '---';
            return `<tr><td class="text-truncate" style="max-width: 220px;"><span class="fw-semibold">${order.title}</span></td><td>${order.order_id}</td><td class="fw-bold">${parseFloat(order.subtotal_amount).toLocaleString('uk-UA')} ₴</td><td>${order.tickets_count} шт.</td><td class="small">${sellerName}</td> <td>${dateConfirm}</td></tr>`;
        }).join('');
    } catch (err) { console.error(err); }
}

// ========================================================================= //
// 6. БЛОК: Відвідуваність за містами (КАРТА УКРАЇНИ)
// ========================================================================= //
async function updateCityStats() {
    try {
        const { start, end } = getDateRange();
        const container = dashboardState.domElements.citiesList = dashboardState.domElements.citiesList || document.getElementById('cities-list');
        if (!container) return;
        const pids = getPromoterIds();

        let query = supabaseClient.from('city_stats').select('city_ua, city_name, total_users, region_code, region_ua').gte('visit_date', start).lte('visit_date', end);
        if(pids) query = query.in('promoter_id', pids);

        const { data, error } = await query;
        if (error) throw error;

        const cityData = {}; const mapData = {};

        data.forEach(item => {
            const users = parseInt(item.total_users) || 0;
            const region = item.region_code;
            if (item.region_ua) { cityData[item.region_ua] = (cityData[item.region_ua] || 0) + users; }
            if (region) {
                if (!mapData[region]) mapData[region] = { value: 0, cities: [], uaName: item.region_ua };
                mapData[region].value += users;
                if (item.city_ua && !mapData[region].cities.includes(item.city_ua)) mapData[region].cities.push(item.city_ua);
            }
        });

        const sortedCities = Object.entries(cityData).map(([name, users]) => ({ name, users })).sort((a, b) => b.users - a.users).slice(0, 5);
        const localTotal = sortedCities.reduce((sum, item) => sum + item.users, 0);
        const barColors = ['bg-success', 'bg-primary', 'bg-info', 'bg-warning', 'bg-danger'];

        container.innerHTML = sortedCities.map((item, index) => {
            const pct = localTotal > 0 ? ((item.users / localTotal) * 100).toFixed(1) : 0;
            return `<div class="mb-3"><div class="d-flex justify-content-between"><span>${item.name}</span><span class="fw-bold">${item.users.toLocaleString('uk-UA')}</span></div><div class="progress mt-1" style="height: 6px"><div class="progress-bar ${barColors[index % 5]}" style="width: ${pct}%"></div></div></div>`;
        }).join('');

        renderUkraineMap(mapData);
    } catch (err) { console.error("Помилка:", err); }
}

function renderUkraineMap(dbData) {
    const mapEl = dashboardState.domElements.mapUkraine = dashboardState.domElements.mapUkraine || document.getElementById('map-ukraine');
    if (!mapEl) return;
    if (!dashboardState.chartInstances.myMapChart) dashboardState.chartInstances.myMapChart = echarts.init(mapEl);

    const chartData = Object.entries(dbData).map(([code, info]) => ({ name: code, value: info.value, uaName: info.uaName }));

    fetch('/assets/maps/ua-all.geo.json')
        .then(res => res.json())
        .then(geoJson => {
            echarts.registerMap('UKRAINE', geoJson);
            const maxVal = Math.max(...chartData.map(d => d.value), 1);
            dashboardState.chartInstances.myMapChart.setOption({
                tooltip: {
                    trigger: 'item',
                    backgroundColor: '#1c2434',
                    borderColor: '#1c2434',
                    textStyle: { color: '#fff' },
                    formatter: function (params) {
                        if (!params.data) return `<b>${params.name}</b><br/>Користувачів: 0`;
                        return `<b>${params.data.uaName || params.name}</b><br/>Користувачів: ${(params.data.value || 0).toLocaleString('uk-UA')}`;
                    }
                },
                visualMap: { min: 0, max: maxVal, inRange: { color: ['#abb5be', '#56ae90', '#01a76f'] }, show: false },
                series: [{
                    type: 'map',
                    map: 'UKRAINE',
                    roam: false,
                    selectedMode: false,
                    label: { show: false },
                    layoutAspect: 0.95,
                    itemStyle: { areaColor: '#abb5be', borderColor: '#ffffff', borderWidth: 1 },
                    emphasis: { label: { show: false }, itemStyle: { areaColor: '#01a76f', shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
                    select: { label: { show: false } },
                    data: chartData
                }]
            });
        })
        .catch(err => {
            console.error('Помилка завантаження карти України:', err);
        });
}

// ========================================================================= //
// 7. БЛОК: Продажі за статтю (RADIAL BAR)
// ========================================================================= //
async function updateGenderStats() {
    try {
        const { start, end } = getDateRange();
        const pids = getPromoterIds();

        let query = supabaseClient.from('gender_stats').select('user_gender, total_users').gte('visit_date', start).lte('visit_date', end);
        if(pids) query = query.in('promoter_id', pids);

        const { data, error } = await query;
        if (error) throw error;

        const aggregated = { male: 0, female: 0, unknown: 0 };
        data.forEach(item => {
            const g = item.user_gender.toLowerCase();
            if (aggregated.hasOwnProperty(g)) aggregated[g] += parseInt(item.total_users) || 0;
        });

        const genderData = [
            { name: 'Чоловіки', slug: 'male', count: aggregated.male },
            { name: 'Жінки', slug: 'female', count: aggregated.female },
            { name: 'Не визначено', slug: 'unknown', count: aggregated.unknown } // Додано для повноти
        ].sort((a, b) => b.count - a.count);

        const localTotal = genderData.reduce((sum, item) => sum + item.count, 0);

        // Кешування DOM-елементів для статі
        genderData.forEach(item => { dashboardState.domElements[`genderCount${item.slug}`] = dashboardState.domElements[`genderCount${item.slug}`] || document.getElementById(`gender-count-${item.slug}`); dashboardState.domElements[`genderPct${item.slug}`] = dashboardState.domElements[`genderPct${item.slug}`] || document.getElementById(`gender-pct-${item.slug}`); });

        const seriesData = []; const labelsData = []; const countsOnly = [];

        genderData.forEach(item => {
            const pct = localTotal > 0 ? parseFloat(((item.count / localTotal) * 100).toFixed(1)) : 0;
            seriesData.push(Math.round(pct)); labelsData.push(item.name); countsOnly.push(item.count);
            if (document.getElementById(`gender-count-${item.slug}`)) animateCount(document.getElementById(`gender-count-${item.slug}`), item.count);
            if (document.getElementById(`gender-pct-${item.slug}`)) document.getElementById(`gender-pct-${item.slug}`).innerText = `${pct}%`;
            if (dashboardState.domElements[`genderCount${item.slug}`]) animateCount(dashboardState.domElements[`genderCount${item.slug}`], item.count);
            if (dashboardState.domElements[`genderPct${item.slug}`]) dashboardState.domElements[`genderPct${item.slug}`].innerText = `${pct}%`;
        });
        if (dashboardState.chartInstances.genderRadialChart) dashboardState.chartInstances.genderRadialChart.updateOptions({ series: seriesData, labels: labelsData });
        else initGenderChart(seriesData, labelsData, countsOnly); // Ініціалізація графіка
    } catch (err) { console.error(err); }
}
function initGenderChart(series, labels, counts) {
    dashboardState.chartInstances.genderRadialChart = new ApexCharts(document.querySelector('#salesBygender'), {
        series: series, labels: labels, chart: { height: 350, type: 'radialBar' },
        colors: ['#5BE49B', '#FFD666', '#FFAC82'],
        plotOptions: { radialBar: { hollow: { size: '40%' }, track: { show: true, background: '#323d4e', strokeWidth: '45%' }, dataLabels: { name: { show: true, fontSize: '18px', color: '#fff' }, value: { show: true, fontSize: '16px', color: '#8c98a4', formatter: v => v + '%' } } } },
        fill: { type: 'gradient', gradient: { shade: 'dark', type: 'vertical', gradientToColors: ['#007867', '#FFD666', '#FFAC82'], stops: [0, 100] } },
        stroke: { lineCap: 'round' }, tooltip: { enabled: true, y: { formatter: (val, { seriesIndex }) => counts[seriesIndex].toLocaleString('uk-UA') + " відвідувачів" } }
    });
    dashboardState.chartInstances.genderRadialChart.render();
}

// ========================================================================= //
// 8. БЛОК: Найпопулярніші заходи (ТАБЛИЦЯ)
// ========================================================================= //
async function updateTopEventsTable() {
    try {
        const { start, end } = getDateRange();
        const tbody = dashboardState.domElements.topEventsBody = dashboardState.domElements.topEventsBody || document.getElementById('top-events-body');
        if (!tbody) return;

        const pids = getPromoterIds();
        
        // ФІКС: Тепер і адмін, і промоутер використовують пагінацію, щоб не впиратися в ліміт 1000 подій
        const data = await fetchAllOrders(pids, start, end, 'title, subtotal_amount, tickets_count');

        const eventsMap = (data || []).reduce((acc, order) => {
            const name = order.title ? order.title.trim() : 'Невідома подія';
            if (!acc[name]) acc[name] = { tickets: 0, totalRevenue: 0 };
            
            // В таблиці заходів ми все ще чесно рахуємо квитки, бо там стоїть "шт."
            acc[name].tickets += parseInt(order.tickets_count) || 0;
            acc[name].totalRevenue += parseFloat(order.subtotal_amount) || 0;
            return acc;
        }, {});

        const topEvents = Object.entries(eventsMap).map(([title, stats]) => ({ title, ...stats })).sort((a, b) => b.tickets - a.tickets).slice(0, 10);

        tbody.innerHTML = topEvents.map(event => `<tr><td class="text-truncate" style="max-width: 220px;"><span class="fw-semibold">${event.title}</span></td><td>${event.tickets} шт.</td><td class="fw-bold">${event.totalRevenue.toLocaleString('uk-UA')} ₴</td></tr>`).join('');
    } catch (err) { console.error("❌ Помилка завантаження топу подій:", err); }
}

// ========================================================================= //
// 9. БЛОК: Аналітика Трафіку та SEO (TABS)
// ========================================================================= //
async function updateTrafficPerformance() {
    const period = getDateRange();
    const pids = getPromoterIds();

    try {
        let query = supabaseClient.from('traffic_sources_stats').select('*').gte('visit_date', period.start).lte('visit_date', period.end).order('visit_date', { ascending: true });
        if(pids) query = query.in('promoter_id', pids);

        const { data: trafficData, error } = await query;
        if (error) throw error;

        if (!trafficData || trafficData.length === 0) {
            if (dashboardState.domElements.trafficStatTotalUsers) dashboardState.domElements.trafficStatTotalUsers.innerText = '0';
            if (dashboardState.chartInstances.trafficGroupedObj) dashboardState.chartInstances.trafficGroupedObj.updateSeries([]);
            return;
        }
        dashboardState.domElements.trafficStatTotalUsers = dashboardState.domElements.trafficStatTotalUsers || document.getElementById('traffic-stat-total-users');
        const totalUsers = trafficData.reduce((sum, row) => sum + (Number(row.total_users) || 0), 0);
        if (dashboardState.domElements.trafficStatTotalUsers) animateCount(dashboardState.domElements.trafficStatTotalUsers, totalUsers, 1000, '');

        const rawDates = [...new Set(trafficData.map(d => d.visit_date))];
        const labelsX = rawDates.map(d => new Date(d).toLocaleDateString('uk-UA', {day:'numeric', month:'short'}));
        const sources = [...new Set(trafficData.map(d => d.source_medium))];
        const groupedSeries = sources.map(source => ({
            name: source,
            data: rawDates.map(date => {
                const entry = trafficData.find(d => d.visit_date === date && d.source_medium === source);
                return entry ? Number(entry.total_users) : 0;
            })
        }));

        renderTrafficGroupedBarChart(groupedSeries, labelsX);
    } catch (err) { console.error("❌ Помилка оновлення трафіку:", err); }
}

function renderTrafficGroupedBarChart(series, categories) {
    const element = document.querySelector("#traffic-candlestick-chart");
    if (!element) return;
    const filteredSeries = series.filter(s => s.data.reduce((a, b) => a + b, 0) > 0);

    const options = {
        series: filteredSeries, chart: { type: 'bar', height: 400, stacked: false, toolbar: { show: false }, fontFamily: 'Public Sans, serif', zoom: { enabled: false } },
        plotOptions: { bar: { horizontal: false, columnWidth: '85%', borderRadius: 2 } }, colors: ['#00a76f', '#007bff', '#ffab00', '#ff5630', '#00b8d9', '#74ca0b', '#637381', '#323d4e', '#919eab', '#5be49b'],
        dataLabels: { enabled: false }, xaxis: { categories: categories, tickAmount: 6, labels: { style: { colors: '#637381', fontSize: '12px' }, hideOverlappingLabels: true, rotate: -45 }, axisBorder: { show: false } },
        yaxis: { labels: { style: { colors: '#637381' }, formatter: (val) => val.toFixed(0) } },
        tooltip: { shared: false, intersect: true, custom: function({ series, seriesIndex, dataPointIndex, w }) { const val = series[seriesIndex][dataPointIndex]; const name = w.globals.seriesNames[seriesIndex]; const color = w.globals.colors[seriesIndex]; const date = w.globals.labels[dataPointIndex]; if (val <= 0) return ''; return `<div class="p-2" style="background: #1c2434; border: 1px solid #2d3748; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"><div class="mb-1 fw-bold text-white-50" style="font-size: 10px; text-transform: uppercase;">${date}</div><div class="d-flex align-items-center gap-2"><span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; display: inline-block;"></span><span class="text-white" style="font-size: 13px;">${name}: <b>${val}</b></span></div></div>`; } },
        stroke: { show: true, width: 1, colors: ['#1c2434'] }, states: { hover: { filter: { type: 'lighten', value: 0.1 } }, active: { allowMultipleDataPointsSelection: false, filter: { type: 'darken', value: 0.2 } } }
    }; // Змінено на dashboardState.chartInstances.trafficGroupedObj
    if (dashboardState.chartInstances.trafficGroupedObj) dashboardState.chartInstances.trafficGroupedObj.updateOptions(options); else { dashboardState.chartInstances.trafficGroupedObj = new ApexCharts(element, options); dashboardState.chartInstances.trafficGroupedObj.render(); }
}

async function updateSEOCharts() {
    const chartStartDate = new Date(); chartStartDate.setDate(chartStartDate.getDate() - 29);
    const chartStartISO = chartStartDate.toISOString().split('T')[0];
    const pids = getPromoterIds();

    try {
        let query = supabaseClient.from('seo_performance_daily').select('*').gte('visit_date', chartStartISO);
        if(pids) query = query.in('prom_id', pids);

        const { data: stats, error } = await query;
        if (error) throw error;

        const daysMap = {};
        for (let i = 29; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            daysMap[iso] = { clicks: 0, impressions: 0, position: 0, ctr: 0 }; 
        }

        let monthTotalPos = 0, monthDays = 0;
        stats.forEach(row => {
            if (!row.visit_date) return;
            const d = row.visit_date.substring(0, 10);
            const c = parseInt(row.google_search_clicks) || 0;
            const im = parseInt(row.google_search_impressions) || 0;
            const po = parseFloat(row.google_search_avg_position) || 0;
            const ctr = (parseFloat(row.organic_ctr) || 0) * 100; 

            if (daysMap[d]) {
                daysMap[d].clicks += c; daysMap[d].impressions += im; 
                daysMap[d].position = daysMap[d].position ? (daysMap[d].position + po) / 2 : po; 
                daysMap[d].ctr = daysMap[d].ctr ? (daysMap[d].ctr + ctr) / 2 : ctr;
                if (po > 0) { monthTotalPos += po; monthDays++; }
            }
        });

        const labels = Object.keys(daysMap).map(d => new Date(d).toLocaleDateString('uk-UA', {day:'numeric', month:'short'}));
        const clicksData = Object.values(daysMap).map(v => v.clicks);
        const impsData = Object.values(daysMap).map(v => v.impressions);
        const posData = Object.values(daysMap).map(v => v.position);
        const ctrData = Object.values(daysMap).map(v => v.ctr);

        const seoSeries = [
            { name: 'Покази Google', type: 'area', data: impsData },
            { name: 'Кліки Google', type: 'area', data: clicksData },
            { name: 'Середня позиція', type: 'line', data: posData },
            { name: 'CTR', type: 'line', data: ctrData }
        ];

        renderSEOPerformanceChart(seoSeries, labels);

        const rawAvgPos = monthDays > 0 ? (monthTotalPos / monthDays) : 0;
        dashboardState.domElements.seoStatAvgPos = dashboardState.domElements.seoStatAvgPos || document.getElementById('seo-stat-avg-pos');
        if (dashboardState.domElements.seoStatAvgPos) {
            if (rawAvgPos === 0) dashboardState.domElements.seoStatAvgPos.innerText = "не визначено"; else animateCount(dashboardState.domElements.seoStatAvgPos, rawAvgPos, 1000, '');
        } // Змінено на dashboardState.domElements.seoStatAvgPos
    } catch (err) { console.error("❌ Помилка SEO аналітики:", err); }
}

function renderSEOPerformanceChart(series, labels) {
    const chartQuery = "#seo-performance-chart";
    const element = document.querySelector(chartQuery);
    if (!element) return;
    const isMobile = window.innerWidth <= 768;
    const options = {
        series: series, chart: { height: 400, type: 'area', stacked: false, toolbar: { show: false }, fontFamily: 'Public Sans, serif' },
        colors: ['#007bff', '#00a76f', '#ffab00', '#ff5630'], dataLabels: { enabled: false }, stroke: { curve: 'smooth', width: [2, 2, 3, 3] },
        fill: { type: ['gradient', 'gradient', 'none', 'none'], gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0, stops: [0, 90, 100] } },
        xaxis: { categories: labels, tickAmount: 6, labels: { rotate: -45, style: { fontSize: '10px', colors: '#637381' }, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: [
            { seriesName: 'Покази Google', opposite: false, title: isMobile ? { text: "" } : { text: 'Покази', style: { color: '#007bff', fontWeight: 500 } }, labels: { style: { colors: '#637381' }, formatter: (val) => val ? val.toLocaleString('uk-UA') : "0" }, min: 0, forceNiceScale: true },
            { seriesName: 'Кліки Google', opposite: true, title: isMobile ? { text: "" } : { text: 'Кліки', style: { color: '#00a76f', fontWeight: 500 } }, labels: { style: { colors: '#00a76f' }, formatter: (val) => val ? val.toLocaleString('uk-UA') : "0" }, min: 0, forceNiceScale: true },
            { seriesName: 'Середня позиція', show: false, reversed: true, min: 1, max: 100 }, { seriesName: 'CTR', show: false, min: 0 }
        ],
        grid: { borderColor: '#f1f1f1', strokeDashArray: 3, xaxis: { lines: { show: false } }, padding: { top: 20 } },
        legend: { position: 'top', horizontalAlign: 'right' },
        tooltip: { shared: true, intersect: false, y: { formatter: function (y, { seriesIndex, w }) { if (typeof y === "undefined" || y === null) return y; const seriesName = w.globals.seriesNames[seriesIndex]; if (seriesName === 'Середня позиція') return "№" + y.toFixed(1); if (seriesName === 'CTR') return y.toFixed(2) + "%"; if (seriesName === 'Кліки Google') return y.toLocaleString('uk-UA') + " кліків"; if (seriesName === 'Покази Google') return y.toLocaleString('uk-UA') + " показів"; return y; } } } // Змінено на dashboardState.chartInstances.seoPerformanceChartObj
    };

    if (dashboardState.chartInstances.seoPerformanceChartObj) dashboardState.chartInstances.seoPerformanceChartObj.updateOptions(options); else { dashboardState.chartInstances.seoPerformanceChartObj = new ApexCharts(element, options); dashboardState.chartInstances.seoPerformanceChartObj.render(); }
}

// ========================================================================= //
// 10. БЛОК: Відвідуваність за країнами (КАРТА СВІТУ)
// ========================================================================= //
async function updateCountryStats() {
    try {
        const { start, end } = getDateRange();
        const pids = getPromoterIds();
        const container = dashboardState.domElements.countriesList = dashboardState.domElements.countriesList || document.getElementById('countries-list');
        if (!container) return;

        let query = supabaseClient.from('country_stats').select('country_name, country_code, total_users').gte('visit_date', start).lte('visit_date', end);
        if(pids) query = query.in('promoter_id', pids);

        const { data, error } = await query;
        if (error) throw error;

        const aggregated = {};
        data.forEach(item => {
            const name = (item.country_name && item.country_name.trim() !== "") ? item.country_name : "(not set)";
            if (!aggregated[name]) aggregated[name] = { name, code: item.country_code, users: 0 };
            aggregated[name].users += parseInt(item.total_users) || 0;
        });

        const sortedData = Object.values(aggregated).sort((a, b) => b.users - a.users).slice(0, 5);
        const localTotal = sortedData.reduce((sum, item) => sum + item.users, 0);
        const mapValues = {};
        const barColors = ['bg-success', 'bg-primary', 'bg-info', 'bg-warning', 'bg-danger', 'bg-secondary'];

        container.innerHTML = sortedData.map((item, index) => {
            const pct = localTotal > 0 ? ((item.users / localTotal) * 100).toFixed(1) : 0;
            if (item.code) mapValues[item.code] = item.users;
            return `<div class="mb-3"><div class="d-flex justify-content-between align-items-center"><span class="text-truncate" style="max-width: 150px;">${item.name}</span><span class="fw-bold">${item.users.toLocaleString('uk-UA')}</span></div><div class="progress mt-1" style="height: 6px"><div class="progress-bar ${barColors[index % barColors.length]}" style="width: ${pct}%"></div></div></div>`;
        }).join('');

        renderWorldMap(mapValues);
    } catch (err) { console.error("Помилка країн:", err); }
}

function renderWorldMap(dataValues) {
    const mapEl = dashboardState.domElements.mapWorld = dashboardState.domElements.mapWorld || document.getElementById('map-world');
    if (!mapEl) return;
    mapEl.innerHTML = ''; 
    dashboardState.chartInstances.worldMap = new jsVectorMap({
        selector: '#map-world', map: 'world', backgroundColor: 'transparent', // Змінено на dashboardState.chartInstances.worldMap
        regionStyle: { initial: { fill: window.theme.gray300, stroke: window.theme.gray300, strokeWidth: 2 }, hover: { fillOpacity: 1, fill: window.theme.primary } }, zoomOnScroll: false, zoomButtons: false,
        visualizeData: { scale: ['#fcfdfd', '#c4cdd5', '#ff0000'], values: dataValues },
        onRegionTooltipShow(event, tooltip, code) { const count = dataValues[code] || 0; tooltip.text(`<strong>${tooltip.text()}</strong>: ${count.toLocaleString('uk-UA')}`, true); }
    });
}

// ========================================================================= //
// 11. БЛОК: Воронка конверсії (GA4)
// ========================================================================= //
async function updateConversionFunnelChart() {
    const period = getDateRange();
    const pids = getPromoterIds();
    const container = dashboardState.domElements.funnelChart = dashboardState.domElements.funnelChart || document.getElementById('funnelChart');
    if (!container) return;

    try {
        let query = supabaseClient.from('conversion_funnel_daily').select('*').gte('visit_date', period.start).lte('visit_date', period.end).order('visit_date', { ascending: true });
        if(pids) query = query.in('promoter_id', pids);

        const { data, error } = await query;
        if (error) throw error;
        
        if (!data || data.length === 0) return;

        let totalViews = 0, totalBooking = 0, totalCarts = 0, totalCheckouts = 0, totalPurchases = 0;
        data.forEach(row => {
            totalViews += (parseInt(row.views) || 0); totalBooking += (parseInt(row.booking_view) || 0); totalCarts += (parseInt(row.carts) || 0);
            totalCheckouts += (parseInt(row.checkouts) || 0); totalPurchases += (parseInt(row.purchases) || 0);
        });

        const funnelData = [totalViews, totalBooking, totalCarts, totalCheckouts, totalPurchases];
        const funnelCategories = ['Перегляди подій', 'Перегляди схеми', 'Додавання в кошик', 'Початок оплати', 'Покупка'];

        // Кешування DOM-елементів для воронки
        dashboardState.domElements.funnelViews = dashboardState.domElements.funnelViews || document.getElementById('funnel-views');
        dashboardState.domElements.funnelBooking = dashboardState.domElements.funnelBooking || document.getElementById('funnel-booking');
        dashboardState.domElements.funnelCarts = dashboardState.domElements.funnelCarts || document.getElementById('funnel-carts');
        dashboardState.domElements.funnelCheckouts = dashboardState.domElements.funnelCheckouts || document.getElementById('funnel-checkouts');
        dashboardState.domElements.funnelPurchases = dashboardState.domElements.funnelPurchases || document.getElementById('funnel-purchases');

        if (dashboardState.domElements.funnelViews) animateCount(dashboardState.domElements.funnelViews, totalViews, 1000, '');
        if (dashboardState.domElements.funnelBooking) animateCount(dashboardState.domElements.funnelBooking, totalBooking, 1000, '');
        if (dashboardState.domElements.funnelCarts) animateCount(dashboardState.domElements.funnelCarts, totalCarts, 1000, '');
        if (dashboardState.domElements.funnelCheckouts) animateCount(dashboardState.domElements.funnelCheckouts, totalCheckouts, 1000, '');
        if (dashboardState.domElements.funnelPurchases) animateCount(dashboardState.domElements.funnelPurchases, totalPurchases, 1000, '');

        renderFunnelChart(funnelData, funnelCategories);
    } catch (err) { console.error("❌ Помилка воронки конверсії:", err); }
}

function renderFunnelChart(data, categories) {
    const element = document.querySelector("#funnelChart");
    if (!element) return;
    const options = {
        series: [{ name: "Користувачі", data: data }], chart: { type: 'bar', height: 350, toolbar: { show: false }, fontFamily: 'Public Sans, serif' },
        plotOptions: { bar: { borderRadius: 0, horizontal: true, barHeight: '80%', isFunnel: true } }, colors: ['#00a76f'],
        dataLabels: { enabled: true, formatter: function (val, opt) { const prevVal = opt.w.globals.series[0][opt.dataPointIndex - 1]; const pctFromPrev = prevVal > 0 ? ((val / prevVal) * 100).toFixed(0) + '%' : ''; return categories[opt.dataPointIndex] + ': ' + val.toLocaleString('uk-UA') + (pctFromPrev ? ' (' + pctFromPrev + ')' : ''); }, dropShadow: { enabled: true } },
        xaxis: { categories: categories, labels: { show: false } }, legend: { show: false }, tooltip: { shared: false, y: { formatter: (val) => val.toLocaleString('uk-UA') + " чол." } }, stroke: { show: true, width: 1, colors: ['#1c2434'] } // Змінено на dashboardState.chartInstances.funnelChartObj
    };
    if (dashboardState.chartInstances.funnelChartObj) { dashboardState.chartInstances.funnelChartObj.updateOptions({ xaxis: { categories: categories } }); dashboardState.chartInstances.funnelChartObj.updateSeries([{ data: data }]); } else { dashboardState.chartInstances.funnelChartObj = new ApexCharts(element, options); dashboardState.chartInstances.funnelChartObj.render(); }
}

// ========================================================================= //
// 12. СИСТЕМА ДОСТУПУ (PERMISSIONS), REALTIME ТА ЗАПУСК
// ========================================================================= //

function subscribeToOrders() {
    if (dashboardState.isSubscribed) return; 
    supabaseClient.channel('schema-db-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        console.log('🔔 Нове замовлення!');
        if (dashboardState.userPermissions?.recent_orders) updateOrdersTable(); 
        if (dashboardState.userPermissions?.sales_charts) updateSalesCharts(); 
        if (dashboardState.userPermissions?.top_events) updateTopEventsTable(); 
        if (dashboardState.userPermissions?.top_stats) { updateGeneralStats(); updateSalesStats(); }
    }).subscribe();
    dashboardState.isSubscribed = true;
}

window.changeDashboardPeriod = function(period, label) {
    dashboardState.currentPeriod = period;
    initDashboard(); 
    dashboardState.domElements.currentPeriodText = dashboardState.domElements.currentPeriodText || document.getElementById('current-period-text');
    if (dashboardState.domElements.currentPeriodText) dashboardState.domElements.currentPeriodText.innerText = label;
};

// Запуск відмальовки тільки дозволених блоків
async function initDashboard() {
    try {
        console.log("🚀 Початок ініціалізації дашборду...");
        const tasks = []; // Змінено на dashboardState.userPermissions
        const p = dashboardState.userPermissions; 

        if (!p || p.top_stats) { tasks.push(updateSalesStats()); tasks.push(updateGeneralStats()); }
        if (!p || p.sales_charts) tasks.push(updateSalesCharts());
        if (!p || p.devices) tasks.push(updateDeviceStats());
        if (!p || p.recent_orders) tasks.push(updateOrdersTable());
        if (!p || p.cities) tasks.push(updateCityStats());
        if (!p || p.gender) tasks.push(updateGenderStats());
        if (!p || p.top_events) tasks.push(updateTopEventsTable());
        if (!p || p.traffic_seo) { tasks.push(updateTrafficPerformance()); tasks.push(updateSEOCharts()); }
        if (!p || p.countries) tasks.push(updateCountryStats());
        if (!p || p.funnel) tasks.push(updateConversionFunnelChart());

        await Promise.all(tasks);
        console.log("✅ Дашборд успішно оновлено");
    } catch (err) { 
        console.error("❌ Критична помилка ініціалізації:", err); 
    }
}

// Функція приховування недоступних блоків у HTML
function applyPermissionsToUI(permissions) {
    const hideElement = (id) => { const el = document.getElementById(id); if (el) el.classList.add('d-none'); };
    if (!permissions.top_stats) hideElement('block-top-stats');
    if (!permissions.sales_charts) hideElement('block-sales-charts');
    if (!permissions.users) hideElement('block-users-reten');
    if (!permissions.devices) hideElement('block-devices');
    if (!permissions.recent_orders) hideElement('block-recent-orders');
    if (!permissions.cities) hideElement('block-cities');
    if (!permissions.gender) hideElement('block-gender');
    if (!permissions.top_events) hideElement('block-top-events');
    if (!permissions.traffic_seo) hideElement('block-traffic-seo');
    if (!permissions.countries) hideElement('block-countries');
    if (!permissions.funnel) hideElement('block-funnel');
}

// Головна функція входу
async function authenticateAndInit() {
    // 0. TELEGRAM ІНІЦІАЛІЗАЦІЯ (перенесено сюди)
    const tg = window.Telegram?.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#1c2434');
        console.log("Привіт, Telegram юзер:", tg.initDataUnsafe?.user?.first_name);
    }

    const tgUser = tg?.initDataUnsafe?.user; // Отримуємо користувача після ініціалізації

    if (!tgUser) {
        // Якщо не Telegram WebApp, або користувач не авторизований, надаємо повні права
        // Це може бути тестовий режим або режим для адміна через браузер
        dashboardState.userPermissions = {
            promoter_id: null, dashboard: true, top_stats: true, sales_charts: true, users: true, devices: true, recent_orders: true, 
            cities: true, gender: true, top_events: true, traffic_seo: true, countries: true, funnel: true
        };
        initDashboard(); subscribeToOrders(); return;
    }

    const userId = tgUser.id; const firstName = tgUser.first_name;

    const { data: userRecord, error } = await supabaseClient.from('user_permissions').select('*').eq('tg_id', userId).single();

    if (error || !userRecord || userRecord.dashboard !== true) {
        document.body.innerHTML = `
            <div style="display:flex; height:100vh; align-items:center; justify-content:center; background:#1c2434; color:white; font-family:sans-serif; text-align:center; padding: 20px;">
                <div>
                    <h2 style="color:#ff5630; margin-bottom: 10px;">⛔ Доступ заборонено</h2>
                    <p style="font-size: 16px;">Вибачте, <b>${firstName}</b>, але у вас немає прав для перегляду цієї сторінки.</p>
                    <div style="margin-top: 20px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;"><span style="color:#637381; font-size: 12px;">Ваш Telegram ID:</span><br><b style="font-size: 18px; color: #00a76f;">${userId}</b></div>
                </div>
            </div>
        `;
        return; 
    }

    dashboardState.userPermissions = userRecord; // Змінено на dashboardState.userPermissions
    dashboardState.domElements.userGreetingName = dashboardState.domElements.userGreetingName || document.getElementById('user-greeting-name');
    if (dashboardState.domElements.userGreetingName) dashboardState.domElements.userGreetingName.innerText = firstName;
    
    applyPermissionsToUI(userPermissions);
    initDashboard(); subscribeToOrders();
}

document.addEventListener('DOMContentLoaded', authenticateAndInit);

window.SupabaseApp = window.SupabaseApp || {};
window.SupabaseApp.dashboard = {
    authenticateAndInit,
    initDashboard,
    changeDashboardPeriod
};


// Перерахунок розміру графіка при зміні табів
document.addEventListener('shown.bs.tab', function () { window.dispatchEvent(new Event('resize')); });

// ========================================================================= //
// 13. ІНІЦІАЛІЗАЦІЯ FLATPCIKR (ПЕРЕНЕСЕНО З VENDORS/CHART.JS)
// ========================================================================= //
document.addEventListener('DOMContentLoaded', function() {
    // Перевіряємо, чи flatpickr доступний
    if (typeof flatpickr !== 'undefined') {
        // Створюємо екземпляр flatpickr, але не прив'язуємо його до автоматичного відкриття
        const fp = flatpickr("#custom-range-menu-item", {
            locale: "uk",
            mode: "range",
            dateFormat: "Y-m-d",
            maxDate: "today",
            minDate: new Date().fp_incr(-30),
            disableMobile: true, // КРИТИЧНО для Telegram
            inline: false,
            static: false,
            appendTo: document.body, // Виносимо за межі DOM-дерева меню
            onClose: function(selectedDates, dateStr, instance) {
                if (selectedDates.length > 0) {
                    const start = instance.formatDate(selectedDates[0], "Y-m-d");
                    const end = selectedDates.length > 1 ? instance.formatDate(selectedDates[1], "Y-m-d") : start; // Змінено на dashboardState.customDateRange
                    
                    // customDateRange - це глобальна змінна, яка використовується в getDateRange
                    dashboardState.customDateRange = { start, end }; // CRITICAL FIX: Використовуємо dashboardState
                    
                    let displayText = instance.formatDate(selectedDates[0], "d.m");
                    if (selectedDates.length > 1) {
                        displayText += " - " + instance.formatDate(selectedDates[1], "d.m");
                    }
                    
                    // Викликаємо оновлення (використовуємо window.changeDashboardPeriod, яка тепер оновлює dashboardState)
                    window.changeDashboardPeriod('custom', displayText);
                    
                    // Закриваємо дропдаун Bootstrap вручну після вибору
                    const dropdownElement = document.querySelector('[data-bs-toggle="dropdown"]');
                    const bootstrapDropdown = bootstrap.Dropdown.getInstance(dropdownElement);
                    if (bootstrapDropdown) bootstrapDropdown.hide();
                }
            }
        });

        // Ручне відкриття при кліку (для TMA це надійніше)
        document.getElementById('custom-range-menu-item').addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fp.open(); // Явно відкриваємо календар
        });
    }
});