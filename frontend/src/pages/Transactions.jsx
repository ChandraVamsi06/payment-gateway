import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchDashboardData } from '../api';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetchDashboardData().then(data => {
        if(data) setTransactions(data.transactions);
    }).catch(console.error);
  }, []);

  return (
    <div className="tx-container">
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
        <h2>Recent Transactions</h2>
        
        <div className="table-wrapper">
          <table data-test-id="transactions-table" className="tx-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Order ID</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
                {transactions.map(tx => (
                    <tr key={tx.id} data-test-id="transaction-row" data-payment-id={tx.id}>
                        <td data-test-id="payment-id">{tx.id}</td>
                        <td data-test-id="order-id">{tx.order_id}</td>
                        <td data-test-id="amount">₹{(tx.amount/100).toFixed(2)}</td>
                        <td data-test-id="method">{tx.method}</td>
                        <td data-test-id="status">
                          <span className={`status-badge status-${tx.status}`}>
                            {tx.status}
                          </span>
                        </td>
                        <td data-test-id="created-at">{new Date(tx.created_at).toLocaleString()}</td>
                    </tr>
                ))}
                {transactions.length === 0 && (
                    <tr><td colSpan="6" className="empty-row">No transactions found</td></tr>
                )}
            </tbody>
          </table>
        </div>
    </div>
  );
}