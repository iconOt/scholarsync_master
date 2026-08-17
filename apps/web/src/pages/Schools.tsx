import React from 'react'
import type { School } from '../App'

type Props = {
  schools: School[]
  onView?: (id: string) => void
}

export default function SchoolsPage({ schools, onView }: Props) {
  return (
    <div>
      <div className="panel-head">
        <h2>Schools</h2>
        <span>{schools.length} schools</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>School</th>
              <th>Status</th>
              <th>Students</th>
              <th>Invoice</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="school-cell">
                    <strong>{s.schoolName}</strong>
                    <small>{s.domain}.scholarsync.ng</small>
                  </div>
                </td>
                <td>{s.status}</td>
                <td>{s.activeStudents}</td>
                <td>{s.invoiceDue}</td>
                <td>
                  <button onClick={() => onView?.(s.id)} className="link-button">Open</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
