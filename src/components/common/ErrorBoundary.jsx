import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    try {
      // Clear message map key if quota was exceeded
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('zuhali_messages_map')) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#0f172a',
          color: '#f8fafc',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '400px', marginBottom: '20px' }}>
            An unexpected error occurred. Click below to clear memory and restore the application.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
            }}
          >
            Reload & Clear Cache
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
