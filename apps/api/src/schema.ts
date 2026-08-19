export interface SchoolRecord {
  id: string
  school_name: string | null
  domain: string | null
  status: string | null
  onboarding_step: string | null
  active_students: number | null
  invoice_due: string | null
  owner: string | null
  revenue: string | null
}

export interface InvoiceRecord {
  id: string
  school_id: string
  term: string | null
  amount: string | null
  status: string | null
  issued_at: string | null
}

export interface StaffRecord {
  id: string
  name: string
  role: string
  email: string | null
  mfa: number
  password: string | null
}

export interface AuditLogRecord {
  id: string
  actor: string | null
  action: string | null
  timestamp: string | null
  target: string | null
}
