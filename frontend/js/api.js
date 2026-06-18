const API_BASE = "http://localhost:5000";

async function apiGet(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    return await response.json();
}

async function apiPost(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    return await response.json();
}

async function apiPut(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });

    return await response.json();
}
