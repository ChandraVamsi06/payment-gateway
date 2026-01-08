import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboardData } from '../api';

export default function Dashboard({ user }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchDashboardData().then(setData).catch(console.error);
  }, []);

  return (
    <div data-test-id="dashboard" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Welcome, {user.name}</h1>
      
      <div data-test-id="api-credentials" style={{ background: '#f5f5f5', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>API Credentials</h3>
        <div style={{ marginBottom: '10px' }}>
          <strong style={{ marginRight: '10px' }}>API Key:</strong>
          <span data-test-id="api-key" style={{ fontFamily: 'monospace', background: '#e0e0e0', padding: '2px 5px' }}>{user.api_key}</span>
        </div>
        <div>
          <strong style={{ marginRight: '10px' }}>API Secret:</strong>
          <span data-test-id="api-secret" style={{ fontFamily: 'monospace', background: '#e0e0e0', padding: '2px 5px' }}>secret_test_xyz789</span>
        </div>
      </div>

      <div data-test-id="stats-container" style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#666' }}>Total Transactions</h3>
          <div data-test-id="total-transactions" style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {data ? data.stats.total_transactions : '...'}
          </div>
        </div>
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#666' }}>Total Amount</h3>
          <div data-test-id="total-amount" style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
            {data ? `₹${(data.stats.total_amount / 100).toFixed(2)}` : '...'}
          </div>
        </div>
        <div style={{ flex: 1, border: '1px solid #ddd', borderRadius: '8px', padding: '20px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#666' }}>Success Rate</h3>
          <div data-test-id="success-rate" style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
            {data ? `${data.stats.success_rate}%` : '...'}
          </div>
        </div>
      </div>
      
      <div style={{ textAlign: 'right' }}>
        <Link to="/dashboard/transactions" style={{ textDecoration: 'none', background: '#007bff', color: 'white', padding: '10px 20px', borderRadius: '5px' }}>View Recent Transactions →</Link>
      </div>
    </div>
  );
}