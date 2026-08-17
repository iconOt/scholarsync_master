import React, { useEffect, useState } from 'react'
import type { School } from '../App'

type Props = {
  school: School | null
}

type Invoice = {
  id: string
  term: string
  amount: string
  status: string
  issuedAt: string
}

export default function SchoolDetail({ school }: Props) {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)

  useEffect(() => {
    if (!school) return
    const load = async () => {
      try {
        const res = await fetch(`/api/schools/${school.id}/invoices`)
        const data = await res.json()
        setInvoices(data)
      } catch (e) {
        console.error(e)
      }
    }

    load()
  }, [school])

  if (!school) return <div className="panel">Select a school to view details.</div>

  const downloadPdf = async (invoiceId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoiceId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Failed to download PDF', e)
    }
  }

  return (
    <div>
      <div className="panel-head">
        <h2>{school.schoolName}</h2>
        <span>{school.domain}.scholarsync.ng</span>
      </div>

      <div className="panel">
        <h3>Provisioning Status</h3>
        <p>Status: {school.status}</p>
        <p>Onboarding step: {school.onboardingStep}</p>
      </div>

      <div className="panel">
        <h3>Billing</h3>
        <p>Active students: {school.activeStudents}</p>
        <p>Invoice due: {school.invoiceDue}</p>

        <h4 style={{ marginTop: 12 }}>Invoices</h4>
        {!invoices && <p className="muted">Loading invoices...</p>}
        {invoices && (
          <table>
            <thead>
              <tr>
                <th>Term</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Issued</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.term}</td>
                  <td>{inv.amount}</td>
                  <td>{inv.status}</td>
                  <td>{inv.issuedAt}</td>
                  <td><button onClick={() => downloadPdf(inv.id)} className="link-button">Download PDF</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
