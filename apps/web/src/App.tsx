import { useEffect, useMemo, useState } from 'react'
import DashboardPage from './pages/Dashboard'
import OnboardingPage from './pages/Onboarding'
import SchoolsPage from './pages/Schools'
import RevenuePage from './pages/Revenue'
import StaffPage from './pages/Staff'
import AuditLogPage from './pages/AuditLog'
import SchoolDetail from './pages/SchoolDetail'
import LoginPage from './pages/Login'

type SchoolStatus = 'active' | 'suspended' | 'provisioning'

export type School = {
  id: string
  schoolName: string
  domain: string
  status: SchoolStatus
  onboardingStep: string
  activeStudents: number
  invoiceDue: string
  owner: string
  revenue: string
}

type DashboardStats = {
  totalSchools: number
  active: number
  suspended: number
  provisioning: number
  monthlyRevenue: string
  outstandingInvoices: number
  staffOnline: number
}

export default function App() {
  const [schools, setSchools] = useState<School[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState<'dashboard' | 'onboarding' | 'schools' | 'revenue' | 'staff' | 'audit' | 'login'>('login')
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [schoolsRes, statsRes] = await Promise.all([
          fetch('/api/schools'),
          fetch('/api/dashboard'),
        ])

        const schoolsData = await schoolsRes.json()
        const statsData = await statsRes.json()

        setSchools(schoolsData)
        setStats(statsData)
      } catch (error) {
        console.error('Failed to load dashboard data', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('token')
        if (token) {
          const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
          if (res.ok) {
            const data = await res.json()
            if (data.ok && data.user) { setCurrentUser(data.user); return }
          }
        }

        const raw = localStorage.getItem('currentUser')
        if (raw) setCurrentUser(JSON.parse(raw))
      } catch (e) {
        // ignore
      }
    }

    init()
  }, [])

  const summaryCards = useMemo(() => {
    if (!stats) return []

    return [
      { label: 'Total Schools', value: stats.totalSchools },
      { label: 'Active', value: stats.active },
      { label: 'Suspended', value: stats.suspended },
      { label: 'Provisioning', value: stats.provisioning },
    ]
  }, [stats])

  if (loading) {
    return (
      <div className="app-shell">
        <div className="loading-box">Loading ScholarSync Master...</div>
      </div>
    )
  }

  // Show login page if not logged in
  if (!currentUser) {
    return (
      <div className="app-shell login-view">
        <LoginPage onLogin={(u) => { setCurrentUser(u); localStorage.setItem('currentUser', JSON.stringify(u)); setRoute('dashboard') }} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">S</div>
          <div>
            <p className="eyebrow">PLATFORM</p>
            <h1>ScholarSync Master</h1>
          </div>
        </div>

        <nav className="nav">
          <button onClick={() => setRoute('dashboard')} className={route === 'dashboard' ? 'nav-item active' : 'nav-item'}>Dashboard</button>
          <button onClick={() => setRoute('onboarding')} className={route === 'onboarding' ? 'nav-item active' : 'nav-item'}>Onboarding</button>
          <button onClick={() => setRoute('schools')} className={route === 'schools' ? 'nav-item active' : 'nav-item'}>Schools</button>
          {/* Example role-based restriction: Onboarding staff only see onboarding-related pages */}
          {(!currentUser || currentUser.role !== 'Onboarding Staff') && (
            <>
              <button onClick={() => setRoute('revenue')} className={route === 'revenue' ? 'nav-item active' : 'nav-item'}>Revenue</button>
              <button onClick={() => setRoute('audit')} className={route === 'audit' ? 'nav-item active' : 'nav-item'}>Audit Log</button>
            </>
          )}

          {/* Staff management visible only to admin roles */}
          {(!currentUser || currentUser.role === 'Master Super Admin') && (
            <button onClick={() => setRoute('staff')} className={route === 'staff' ? 'nav-item active' : 'nav-item'}>Staff</button>
          )}
        </nav>

        <div className="sidebar-card">
          <p className="eyebrow">Security</p>
          <strong>MFA Required</strong>
          <span>Every staff account is protected.</span>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Internal admin console</p>
            <h2>Platform overview</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setRoute('onboarding')} className="primary-button">Create New School</button>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{currentUser?.name}</span>
            <button onClick={() => { localStorage.removeItem('currentUser'); setCurrentUser(null); setRoute('login') }} className="secondary-button">Logout</button>
          </div>
        </header>

        {route === 'dashboard' && (
          <DashboardPage stats={stats} summaryCards={summaryCards} schools={schools} onSelectSchool={(id) => { setSelectedSchoolId(id); setRoute('schools') }} />
        )}

        {route === 'onboarding' && <OnboardingPage onDone={() => setRoute('schools')} />}

        {route === 'schools' && (
          <div>
            <SchoolsPage schools={schools} onView={(id) => { setSelectedSchoolId(id); }} />
            {selectedSchoolId && (
              <div style={{ marginTop: 20 }}>
                <SchoolDetail school={schools.find((s) => s.id === selectedSchoolId) ?? null} />
              </div>
            )}
          </div>
        )}

        {route === 'revenue' && <RevenuePage stats={stats} />}

        {route === 'staff' && <StaffPage currentUser={currentUser} onChange={() => { }} />}

        {route === 'audit' && <AuditLogPage />}
      </main>
    </div>
  )
}
