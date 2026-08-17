import React, { useEffect, useState } from 'react'

type Staff = { id: string; name: string; email?: string; role: string; mfa?: boolean; password?: string }

export default function StaffPage({ currentUser, onChange }: { currentUser: { id: string; name: string; role: string } | null; onChange: () => void }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [editing, setEditing] = useState<Staff | null>(null)

  useEffect(() => {
    // load from API, fallback to mock
    const load = async () => {
      try {
        const res = await fetch('/api/staff')
        if (res.ok) {
          const data = await res.json()
          setStaff(data)
          return
        }
      } catch (e) {
        // ignore
      }

      // fallback
      setStaff([
        { id: 'staff-01', name: 'Sarah Johnson', email: 'sarah@scholarsync.com', role: 'Master Super Admin', mfa: true },
        { id: 'staff-02', name: 'Ayo Martins', email: 'ayo@scholarsync.com', role: 'Onboarding Staff', mfa: true },
        { id: 'staff-03', name: 'Chika Nwosu', email: 'chika@scholarsync.com', role: 'Finance/Revenue Staff', mfa: true },
      ])
    }

    load()
  }, [])

  const addNew = () => setEditing({ id: `staff-${Math.floor(Math.random() * 9000 + 1000)}`, name: '', role: 'Onboarding Staff', mfa: false })

  const refresh = async () => {
    try {
      const res = await fetch('/api/staff')
      if (res.ok) {
        const data = await res.json()
        setStaff(data)
      }
    } catch (e) {
      console.error('Failed to refresh staff', e)
    }
  }

  const save = async (s: Staff) => {
    try {
      const exists = staff.find((p) => p.id === s.id)
      if (exists) {
        const token = localStorage.getItem('token')
        const headers: any = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch(`/api/staff/${s.id}`, { method: 'PUT', headers, body: JSON.stringify(s) })
        if (res.ok) {
          await refresh()
        }
      } else {
        const token = localStorage.getItem('token')
        const headers: any = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const res = await fetch('/api/staff', { method: 'POST', headers, body: JSON.stringify(s) })
        if (res.ok) {
          await refresh()
        }
      }
    } catch (e) {
      console.error('Save staff failed', e)
    } finally {
      setEditing(null)
      onChange()
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete staff account?')) return
    try {
      const token = localStorage.getItem('token')
      const headers: any = {}
      if (token) headers['Authorization'] = `Bearer ${token}`
      const res = await fetch(`/api/staff/${id}`, { method: 'DELETE', headers })
      if (res.ok) await refresh()
    } catch (e) {
      console.error('Delete failed', e)
    } finally {
      onChange()
    }
  }

  return (
    <div>
      <div className="panel-head">
        <h2>Staff</h2>
        <span>Manage ScholarSync staff accounts and roles</span>
      </div>

      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div />
          <div>
            <button onClick={addNew} className="primary-button">New Staff</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>MFA</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td>{s.role}</td>
                <td>{s.mfa ? 'Yes' : 'No'}</td>
                <td>
                  <button className="link-button" onClick={() => setEditing(s)}>Edit</button>
                  {' '}
                  <button className="link-button" onClick={() => remove(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3>{editing.name ? 'Edit Staff' : 'New Staff'}</h3>
          <StaffForm staff={editing} onCancel={() => setEditing(null)} onSave={save} />
        </div>
      )}
    </div>
  )
}

function StaffForm({ staff, onSave, onCancel }: { staff: Staff; onSave: (s: Staff) => void; onCancel: () => void }) {
  const [state, setState] = useState<Staff>(staff)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(state)
      }}
      style={{ display: 'grid', gap: 8, maxWidth: 420 }}
    >
      <label>
        Name
        <input value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
      </label>

      <label>
        Email
        <input value={state.email || ''} onChange={(e) => setState({ ...state, email: e.target.value })} />
      </label>

      <label>
        Password
        <input type="password" value={(state as any).password || ''} onChange={(e) => setState({ ...state, password: e.target.value })} />
      </label>

      <label>
        Role
        <select value={state.role} onChange={(e) => setState({ ...state, role: e.target.value })}>
          <option>Master Super Admin</option>
          <option>Onboarding Staff</option>
          <option>Finance/Revenue Staff</option>
        </select>
      </label>

      <label>
        MFA enabled
        <input type="checkbox" checked={!!state.mfa} onChange={(e) => setState({ ...state, mfa: e.target.checked })} />
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" className="primary-button">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

