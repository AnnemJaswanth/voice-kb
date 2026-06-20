'use client';

import React, { useState } from 'react';

interface AuthScreenProps {
  onAuth: (isRegister: boolean, name: string, email: string, pass: string) => Promise<void>;
  isLoading: boolean;
}

export default function AuthScreen({ onAuth, isLoading }: AuthScreenProps) {
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAuth(authTab === 'register', authName, authEmail, authPassword);
    if (authTab === 'login') {
      setAuthPassword('');
    } else {
      setAuthName('');
      setAuthEmail('');
      setAuthPassword('');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Voice Knowledge Base</h2>
        <p className="auth-subtitle">Transform your speech into searchable structured assets</p>
        
        <div className="auth-tabs">
          <button
            onClick={() => setAuthTab('login')}
            className={`auth-tab-btn ${authTab === 'login' ? 'active' : ''}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setAuthTab('register')}
            className={`auth-tab-btn ${authTab === 'register' ? 'active' : ''}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {authTab === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Jane Doe"
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="name@example.com"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: '2.5rem' }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={isLoading} className="btn">
            {isLoading ? (
              <>
                <div className="spinner"></div>
                Authenticating...
              </>
            ) : authTab === 'register' ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
