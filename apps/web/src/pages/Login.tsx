import React, { useState } from 'react'

export default function LoginPage({ onLogin }: { onLogin: (u: { id: string; name: string; role: string }) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }

    setIsLoading(true)

    const authenticate = async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })

        const data = await res.json()

        if (res.ok && data.ok && data.token) {
          localStorage.setItem('token', data.token)
          onLogin(data.user)
          return
        }

        // Show error from API
        setError(data.error || 'Invalid email or password')
      } catch (e) {
        console.error('Login error:', e)
        setError('Connection error. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    authenticate()
  }

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoBox}>S</div>
          <h1 style={styles.title}>ScholarSync Master</h1>
          <p style={styles.subtitle}>Staff Administration Portal</p>
        </div>

        {/* Form */}
        <form onSubmit={submit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@scholarsync.com"
              style={styles.input}
              required
              disabled={isLoading}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={styles.input}
              required
              disabled={isLoading}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.submitButton} disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>Staff Credentials</p>
          <p style={styles.footerHint}>Email: umafaruqabdulfatah20@gmail.com</p>
          <p style={styles.footerHint}>Password: Enitan247</p>
        </div>
      </div>

      {/* Background decoration */}
      <div style={styles.background}></div>
    </div>
  )
}

const styles = {
  container: {
    width: '100%',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #020817 0%, #0f172a 50%, #1e293b 100%)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  background: {
    position: 'absolute' as const,
    top: '-50%',
    right: '-50%',
    width: '800px',
    height: '800px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(96, 165, 250, 0.1) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
  },
  loginCard: {
    width: '100%',
    maxWidth: '420px',
    padding: '40px',
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(2, 6, 23, 0.6)',
    position: 'relative' as const,
    zIndex: 1,
    backdropFilter: 'blur(10px)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  logoBox: {
    width: '60px',
    height: '60px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 auto 16px',
    boxShadow: '0 4px 15px rgba(96, 165, 250, 0.3)',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#e2e8f0',
    margin: '0 0 8px 0',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#8ca0bc',
    margin: '0',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '18px',
    marginBottom: '24px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#cbd5e1',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  input: {
    padding: '10px 12px',
    background: 'rgba(2, 6, 23, 0.5)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    outline: 'none' as const,
  } as React.CSSProperties,
  error: {
    padding: '10px 12px',
    background: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid rgba(248, 113, 113, 0.3)',
    borderRadius: '6px',
    color: '#fca5a5',
    fontSize: '13px',
    marginTop: '4px',
  },
  submitButton: {
    padding: '12px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '8px',
    boxShadow: '0 4px 15px rgba(96, 165, 250, 0.3)',
  } as React.CSSProperties,
  footer: {
    textAlign: 'center' as const,
    paddingTop: '20px',
    borderTop: '1px solid rgba(148, 163, 184, 0.1)',
  },
  footerText: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#8ca0bc',
    margin: '0 0 8px 0',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  footerHint: {
    fontSize: '12px',
    color: '#64748b',
    margin: '4px 0',
    fontFamily: 'monospace',
  },
}
