import React from 'react'

export default function RevenuePage({ stats }: any) {
  return (
    <div>
      <div className="panel-head">
        <h2>Revenue</h2>
        <span>Platform revenue and invoices</span>
      </div>

      <div className="panel">
        <h3>Platform totals</h3>
        <div className="metric-stack">
          <div>
            <span>Monthly revenue</span>
            <strong>{stats?.monthlyRevenue ?? '-'}</strong>
          </div>
          <div>
            <span>Outstanding invoices</span>
            <strong>{stats?.outstandingInvoices ?? 0}</strong>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Billing engine</h3>
        <p>Invoices are generated termly from active-student counts.</p>
        <p>Placeholder for invoice list and PDF exports.</p>
      </div>
    </div>
  )
}
