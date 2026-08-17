import React from 'react'
import type { School } from '../App'

type Props = {
  stats: any
  summaryCards: Array<{ label: string; value: any }>
  schools: School[]
  onSelectSchool: (id: string) => void
}

export default function DashboardPage({ stats, summaryCards, schools, onSelectSchool }: Props) {
  return (
    <>
      <section className="stats-grid">
        {summaryCards.map((card) => (
          <div key={card.label} className="stat-card">
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </div>
        ))}
      </section>

      <section className="panel-grid">
        <div className="panel large-panel">
          <div className="panel-head">
            <h3>School registry</h3>
            <span>{schools.length} schools</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>School</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Students</th>
                  <th>Invoice</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school.id}>
                    <td>
                      <div className="school-cell">
                        <strong>{school.schoolName}</strong>
                        <small>{school.domain}.scholarsync.ng</small>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill`}>{school.status}</span>
                    </td>
                    <td>{school.owner}</td>
                    <td>{school.activeStudents}</td>
                    <td>{school.invoiceDue}</td>
                    <td>
                      <button onClick={() => onSelectSchool(school.id)} className="link-button">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel side-panel">
          <div className="panel-head">
            <h3>Revenue snapshot</h3>
          </div>
          <div className="metric-stack">
            <div>
              <span>Monthly revenue</span>
              <strong>{stats?.monthlyRevenue ?? '-'}</strong>
            </div>
            <div>
              <span>Outstanding invoices</span>
              <strong>{stats?.outstandingInvoices ?? 0}</strong>
            </div>
            <div>
              <span>Staff online</span>
              <strong>{stats?.staffOnline ?? 0}</strong>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
