// ========================================================================= //
// API CLIENT - FETCH FROM PHP ENDPOINTS
// ========================================================================= //

/**
 * Make API request to PHP endpoint
 */
async function apiCall(endpoint, params = {}) {
    try {
        const url = new URL(`/api/endpoints/${endpoint}.php`, window.location.origin);

        // Add telegram user ID if available
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (tgUser) {
            url.searchParams.append('tg_id', tgUser.id);
        }

        // Add other parameters
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                url.searchParams.append(key, value);
            }
        });

        const response = await fetch(url.toString());

        if (!response.ok) {
            if (response.status === 401) {
                console.error('❌ Unauthorized access to API');
                return null;
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (err) {
        console.error('API Error:', err);
        return null;
    }
}

/**
 * Get stats (sales or general)
 */
async function getStats(action = 'sales', start, end, prevStart, prevEnd) {
    return apiCall('stats', { action, start, end, prev_start: prevStart, prev_end: prevEnd });
}

/**
 * Get orders
 */
async function getOrders(start, end, offset = 0, limit = 1000) {
    return apiCall('orders', { action: 'recent', start, end, offset, limit });
}

/**
 * Get device stats
 */
async function getDeviceStats(start, end) {
    return apiCall('devices', { start, end });
}

/**
 * Get city stats
 */
async function getCityStats(start, end) {
    return apiCall('cities', { start, end });
}

/**
 * Get gender stats
 */
async function getGenderStats(start, end) {
    return apiCall('gender', { start, end });
}

/**
 * Get traffic stats
 */
async function getTrafficStats(start, end) {
    return apiCall('traffic', { start, end });
}

/**
 * Get SEO stats
 */
async function getSeoStats(start, end) {
    return apiCall('seo', { start, end });
}

/**
 * Get country stats
 */
async function getCountryStats(start, end) {
    return apiCall('countries', { start, end });
}

/**
 * Get funnel stats
 */
async function getFunnelStats(start, end) {
    return apiCall('funnel', { start, end });
}
