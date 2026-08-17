import React from 'react'

export default function AuditLogPage() {
  const logs = [
    { id: '1', who: 'Alice', action: 'Created school', when: '2026-08-01' },
    { id: '2', who: 'Bola', action: 'Marked invoice paid', when: '2026-08-03' },
  ]

  return (
    <div>
      <div className="panel-head">
        <h2>Audit Log</h2>
        <span>All critical platform actions</span>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.when}</td>
                <td>{l.who}</td>
                <td>{l.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
