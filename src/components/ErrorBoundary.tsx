import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: string
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MoodBored error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#fff', color: '#1a1a2e',
          fontFamily: 'Inter, sans-serif', padding: 40
        }}>
          <div style={{ maxWidth: 500, textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, marginBottom: 16 }}>Something went wrong</h1>
            <p style={{ color: '#868e96', marginBottom: 16 }}>{this.state.error}</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload() }}
              style={{
                background: '#4f46e5', color: '#fff', border: 'none',
                padding: '8px 24px', borderRadius: 8, cursor: 'pointer', fontSize: 14
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
