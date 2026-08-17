import { pgTable, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core'

export const schools = pgTable('schools', {
  id: text('id').primaryKey(),
  school_name: text('school_name'),
  domain: text('domain'),
  status: text('status'),
  onboarding_step: text('onboarding_step'),
  active_students: integer('active_students'),
  invoice_due: text('invoice_due'),
  owner: text('owner'),
  revenue: text('revenue'),
})

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  school_id: text('school_id'),
  term: text('term'),
  amount: text('amount'),
  status: text('status'),
  issued_at: timestamp('issued_at'),
})

export const staff = pgTable('staff', {
  id: text('id').primaryKey(),
  name: text('name'),
  role: text('role'),
  email: text('email'),
  mfa: boolean('mfa'),
  password: text('password'),
})

export const audit_log = pgTable('audit_log', {
  id: text('id').primaryKey(),
  actor: text('actor'),
  action: text('action'),
  timestamp: timestamp('timestamp'),
  target: text('target'),
})
