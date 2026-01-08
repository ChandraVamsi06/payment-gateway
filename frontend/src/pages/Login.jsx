import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

export default function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      setUser(user);
      navigate('/dashboard');
    } catch (err) {
      alert("Login failed");
    }
  };

  return (
    <div className="login-container">
      <form data-test-id="login-form" onSubmit={handleLogin} className="login-form">
        <h2>Merchant Login</h2>
        <input 
          data-test-id="email-input" 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
        />
        <input 
          data-test-id="password-input" 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
        />
        <button data-test-id="login-button" type="submit">Login</button>
      </form>
    </div>
  );
}