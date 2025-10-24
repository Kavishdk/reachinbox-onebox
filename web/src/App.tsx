import React, { useState, useEffect } from 'react';
import { emailAPI, Email, SearchParams } from './api';
import './App.css';

interface FilterState {
  query: string;
  account: string;
  folder: string;
}

const App: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  
  const [filters, setFilters] = useState<FilterState>({
    query: '',
    account: '',
    folder: ''
  });

  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);

  // Fetch emails when filters change
  useEffect(() => {
    searchEmails();
  }, [filters]);

  // Extract unique accounts and folders from emails
  useEffect(() => {
    const accounts = [...new Set(emails.map(email => email.accountId))];
    const folders = [...new Set(emails.map(email => email.folder))];
    
    setAvailableAccounts(accounts);
    setAvailableFolders(folders);
  }, [emails]);

  const searchEmails = async () => {
    setLoading(true);
    setError(null);

    try {
      const searchParams: SearchParams = {};
      
      if (filters.query.trim()) searchParams.q = filters.query.trim();
      if (filters.account) searchParams.account = filters.account;
      if (filters.folder) searchParams.folder = filters.folder;

      const response = await emailAPI.searchEmails(searchParams);
      setEmails(response.hits);
      setTotal(response.total);
    } catch (err) {
      setError('Failed to fetch emails');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getCategoryColor = (category?: string): string => {
    switch (category) {
      case 'Interested': return '#10b981'; // green
      case 'Not Interested': return '#ef4444'; // red
      case 'Follow Up': return '#3b82f6'; // blue
      case 'Spam': return '#f59e0b'; // yellow
      case 'Important': return '#8b5cf6'; // purple
      case 'Newsletter': return '#6b7280'; // gray
      default: return '#9ca3af'; // light gray
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📧 ReachInbox Email Dashboard</h1>
        <p>Search and filter your emails with AI-powered categorization</p>
      </header>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="search">Search:</label>
          <input
            id="search"
            type="text"
            placeholder="Search emails..."
            value={filters.query}
            onChange={(e) => handleFilterChange('query', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="account">Account:</label>
          <select
            id="account"
            value={filters.account}
            onChange={(e) => handleFilterChange('account', e.target.value)}
          >
            <option value="">All Accounts</option>
            {availableAccounts.map(account => (
              <option key={account} value={account}>{account}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="folder">Folder:</label>
          <select
            id="folder"
            value={filters.folder}
            onChange={(e) => handleFilterChange('folder', e.target.value)}
          >
            <option value="">All Folders</option>
            {availableFolders.map(folder => (
              <option key={folder} value={folder}>{folder}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="results-info">
        {loading && <div className="loading">🔄 Loading emails...</div>}
        {error && <div className="error">❌ {error}</div>}
        {!loading && !error && (
          <div className="count">
            📊 Found {total} email{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="email-table-container">
        <table className="email-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>From</th>
              <th>Subject</th>
              <th>AI Category</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id}>
                <td className="date-cell">
                  {formatDate(email.date)}
                </td>
                <td className="from-cell">
                  {email.from}
                </td>
                <td className="subject-cell">
                  {email.subject || '(No Subject)'}
                </td>
                <td className="category-cell">
                  {email.aiCategory ? (
                    <span 
                      className="category-tag"
                      style={{ backgroundColor: getCategoryColor(email.aiCategory) }}
                    >
                      {email.aiCategory}
                      {email.aiConfidence && (
                        <span className="confidence">
                          ({Math.round(email.aiConfidence * 100)}%)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="category-tag unclassified">
                      Not Classified
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && emails.length === 0 && (
          <div className="no-results">
            📭 No emails found. Try adjusting your search criteria.
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
