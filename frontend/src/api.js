const API_BASE = 'http://localhost:8000/api/v1';

// We need to store the keys temporarily for requests (simulated auth)
let currentApiKey = '';
let currentApiSecret = '';

export const login = async (email, password) => {
    if (email === 'test@example.com') {
        const res = await fetch(`${API_BASE}/test/merchant`);
        if (!res.ok) throw new Error("Merchant not found");
        const data = await res.json();
        
        // Store credentials for subsequent requests
        currentApiKey = data.api_key;
        // In real app, secret is not sent back, but for test/dashboard simulation:
        currentApiSecret = 'secret_test_xyz789'; 
        
        return data;
    }
    throw new Error("Invalid credentials");
};

export const fetchDashboardData = async () => {
    if (!currentApiKey) return null;
    
    const res = await fetch(`${API_BASE}/merchant/stats`, {
        headers: {
            'X-Api-Key': currentApiKey,
            'X-Api-Secret': currentApiSecret
        }
    });
    
    if (!res.ok) throw new Error("Failed to fetch stats");
    return await res.json();
};