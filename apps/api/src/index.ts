import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { z } from 'zod'
import { z as zod } from 'zod'

import db from './db.js'
import jwt from 'jsonwebtoken'

// If running in Cloudflare Workers, wire the D1 binding
if (typeof globalThis !== 'undefined' && (globalThis as any).DB) {
  try {
    db.useD1((globalThis as any).DB)
  } catch (e) {
    console.warn('Failed to attach D1 binding to db module', e)
  }
}

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowHeaders: ['Content-Type', 'Authorization'] }))

const schoolSchema = z.object({
  schoolName: z.string().min(2),
  subdomain: z.string().min(2).regex(/^[a-z0-9-]+$/),
  proprietor: z.string().min(2),
  email: z.string().email(),
})

const staffSchema = zod.object({
  id: zod.string().min(1).optional(),
  name: zod.string().min(2),
  role: zod.string().min(2),
  email: zod.string().email().optional(),
  mfa: zod.boolean().optional(),
  password: zod.string().min(6).optional(),
})

let initialSchoolRegistry = [
  {
    id: 'sch-1001',
    schoolName: 'Lagos Academy',
    domain: 'lagosacademy',
    status: 'active',
    onboardingStep: 'complete',
    activeStudents: 420,
    invoiceDue: 'NGN 378,000',
    owner: 'Amina Bello',
    revenue: 'NGN 12.5M',
  },
  {
    id: 'sch-1002',
    schoolName: 'Kaduna International College',
    domain: 'kadunaic',
    status: 'suspended',
    onboardingStep: 'complete',
    activeStudents: 310,
    invoiceDue: 'NGN 279,000',
    owner: 'David Okafor',
    revenue: 'NGN 9.1M',
  },
  {
    id: 'sch-1003',
    schoolName: 'Ikeja Preparatory',
    domain: 'ikejaprep',
    status: 'provisioning',
    onboardingStep: 'schema-created',
    activeStudents: 205,
    invoiceDue: 'NGN 184,500',
    owner: 'Folasade Adebayo',
    revenue: 'NGN 6.3M',
  },
]

app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    service: 'scholarsync-master-api',
    status: 'running',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/dashboard', async (c) => {
  if (db.isEnabled()) {
    try {
      const stats = await db.getDashboardStats()
      return c.json({ ...stats, monthlyRevenue: 'NGN 28.8M', outstandingInvoices: 3, staffOnline: 12 })
    } catch (e) {
      console.error('DB dashboard error', e)
    }
  }

  return c.json({
    totalSchools: initialSchoolRegistry.length,
    active: initialSchoolRegistry.filter((s) => s.status === 'active').length,
    suspended: initialSchoolRegistry.filter((s) => s.status === 'suspended').length,
    provisioning: initialSchoolRegistry.filter((s) => s.status === 'provisioning').length,
    monthlyRevenue: 'NGN 28.8M',
    outstandingInvoices: 3,
    staffOnline: 12,
  })
})

app.get('/api/schools', async (c) => {
  if (db.isEnabled()) {
    try {
      const rows = await db.getSchools()
      return c.json(rows)
    } catch (e) {
      console.error('DB getSchools error', e)
    }
  }

  return c.json(initialSchoolRegistry)
})

app.post('/api/schools/onboard', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = schoolSchema.safeParse(body)

  if (!result.success) {
    return c.json({ ok: false, error: 'Invalid onboarding payload', details: result.error.flatten() }, 400)
  }

  const payload = result.data

  const created = {
    id: `sch-${Math.floor(Math.random() * 9000 + 1000)}`,
    schoolName: payload.schoolName,
    domain: payload.subdomain,
    status: 'provisioning',
    onboardingStep: 'schema-created',
    activeStudents: 0,
    invoiceDue: 'NGN 0',
    owner: payload.proprietor,
    revenue: 'NGN 0',
  }

  // persist either in DB or memory
  if (db.isEnabled()) {
    try {
      await db.createSchool(created)
      return c.json({ ok: true, school: created }, 201)
    } catch (e) {
      console.error('DB createSchool error', e)
      return c.json({ ok: false, error: 'DB error' }, 500)
    }
  }

  initialSchoolRegistry.push(created)

  return c.json({ ok: true, school: created }, 201)
})

// lightweight alias for older frontend path
app.post('/api/onboard', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const result = schoolSchema.safeParse(body)

  if (!result.success) {
    return c.json({ ok: false, error: 'Invalid onboarding payload', details: result.error.flatten() }, 400)
  }

  const payload = result.data

  const created = {
    id: `sch-${Math.floor(Math.random() * 9000 + 1000)}`,
    schoolName: payload.schoolName,
    domain: payload.subdomain,
    status: 'provisioning',
    onboardingStep: 'schema-created',
    activeStudents: 0,
    invoiceDue: 'NGN 0',
    owner: payload.proprietor,
    revenue: 'NGN 0',
  }

  initialSchoolRegistry.push(created)

  return c.json({ ok: true, school: created }, 201)
})

app.get('/api/staff', async (c) => {
  if (db.isEnabled()) {
    try {
      const rows = await db.getStaff()
      return c.json(rows)
    } catch (e) {
      console.error('DB getStaff error', e)
    }
  }

  return c.json([
    { id: 'staff-01', name: 'Sarah Johnson', role: 'Master Super Admin', email: 'sarah@scholarsync.com', mfa: true },
    { id: 'staff-02', name: 'Ayo Martins', role: 'Onboarding Staff', email: 'ayo@scholarsync.com', mfa: true },
    { id: 'staff-03', name: 'Chika Nwosu', role: 'Finance/Revenue Staff', email: 'chika@scholarsync.com', mfa: true },
    { id: 'staff-04', name: 'Daniel Peters', role: 'Support Staff', email: 'daniel@scholarsync.com', mfa: true },
    { id: 'staff-05', name: 'Efe George', role: 'Customer Care', email: 'efe@scholarsync.com', mfa: true },
  ])
})

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const email = body.email
  const password = body.password
  
  if (!email || !password) {
    return c.json({ ok: false, error: 'Email and password required' }, 400)
  }

  try {
    // Always require database for proper authentication
    if (!db.isEnabled()) {
      return c.json({ ok: false, error: 'Authentication service unavailable' }, 503)
    }

    const user = await db.getStaffByEmail(email)
    if (!user || !user.password) {
      return c.json({ ok: false, error: 'Invalid email or password' }, 401)
    }

    const bcrypt = await import('bcryptjs')
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return c.json({ ok: false, error: 'Invalid email or password' }, 401)
    }

    const secret = process.env.JWT_SECRET || 'change-me'
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role, email: user.email }, secret, { expiresIn: '8h' })
    const safeUser = { id: user.id, name: user.name, role: user.role, email: user.email, mfa: user.mfa }
    return c.json({ ok: true, token, user: safeUser })
  } catch (e) {
    console.error('Auth login error', e)
    return c.json({ ok: false, error: 'Authentication failed' }, 500)
  }
})

app.get('/api/auth/me', async (c) => {
  const auth = c.req.header('authorization')
  if (!auth) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  const token = auth.replace(/^Bearer\s+/i, '')
  try {
    const secret = process.env.JWT_SECRET || 'change-me'
    const payload: any = jwt.verify(token, secret)
    return c.json({ ok: true, user: payload })
  } catch (e) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }
})

app.get('/api/staff/:id', async (c) => {
  const id = c.req.param('id')
  if (db.isEnabled()) {
    try {
      const rows = await db.getStaff()
      const user = (rows || []).find((r: any) => r.id === id)
      if (user) return c.json(user)
      return c.json({ ok: false, error: 'Not found' }, 404)
    } catch (e) {
      console.error('DB getStaff by id error', e)
    }
  }

  return c.json({ ok: false, error: 'DB not enabled' }, 501)
})

app.post('/api/staff', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = staffSchema.safeParse(body)
  if (!parsed.success) return c.json({ ok: false, error: 'Invalid payload', details: parsed.error.flatten() }, 400)

  const member = { id: body.id ?? `staff-${Math.floor(Math.random() * 9000 + 1000)}`, ...parsed.data }

  if (db.isEnabled()) {
    try {
      // require admin role to create staff
      try {
        const auth = c.req.header('authorization')
        const secret = process.env.JWT_SECRET || 'change-me'
        if (!auth) return c.json({ ok: false, error: 'Unauthorized' }, 401)
        const token = auth.replace(/^Bearer\s+/i, '')
        const payload: any = jwt.verify(token, secret)
        if (payload.role !== 'Master Super Admin') return c.json({ ok: false, error: 'Forbidden' }, 403)
      } catch (e) {
        return c.json({ ok: false, error: 'Unauthorized' }, 401)
      }

      const created = await db.createStaff(member)
      return c.json({ ok: true, staff: created }, 201)
    } catch (e) {
      console.error('DB createStaff error', e)
      return c.json({ ok: false, error: 'DB error' }, 500)
    }
  }

  return c.json({ ok: false, error: 'DB not enabled' }, 501)
})

app.put('/api/staff/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const parsed = staffSchema.safeParse({ ...body, id })
  if (!parsed.success) return c.json({ ok: false, error: 'Invalid payload', details: parsed.error.flatten() }, 400)

  if (db.isEnabled()) {
    try {
      // require admin role to update staff
      try {
        const auth = c.req.header('authorization')
        const secret = process.env.JWT_SECRET || 'change-me'
        if (!auth) return c.json({ ok: false, error: 'Unauthorized' }, 401)
        const token = auth.replace(/^Bearer\s+/i, '')
        const payload: any = jwt.verify(token, secret)
        if (payload.role !== 'Master Super Admin') return c.json({ ok: false, error: 'Forbidden' }, 403)
      } catch (e) {
        return c.json({ ok: false, error: 'Unauthorized' }, 401)
      }

      const updated = await db.updateStaff(parsed.data)
      return c.json({ ok: true, staff: updated })
    } catch (e) {
      console.error('DB updateStaff error', e)
      return c.json({ ok: false, error: 'DB error' }, 500)
    }
  }

  return c.json({ ok: false, error: 'DB not enabled' }, 501)
})

app.delete('/api/staff/:id', async (c) => {
  const id = c.req.param('id')
  if (db.isEnabled()) {
    try {
      // require admin role to delete staff
      try {
        const auth = c.req.header('authorization')
        const secret = process.env.JWT_SECRET || 'change-me'
        if (!auth) return c.json({ ok: false, error: 'Unauthorized' }, 401)
        const token = auth.replace(/^Bearer\s+/i, '')
        const payload: any = jwt.verify(token, secret)
        if (payload.role !== 'Master Super Admin') return c.json({ ok: false, error: 'Forbidden' }, 403)
      } catch (e) {
        return c.json({ ok: false, error: 'Unauthorized' }, 401)
      }

      await db.deleteStaff(id)
      return c.json({ ok: true })
    } catch (e) {
      console.error('DB deleteStaff error', e)
      return c.json({ ok: false, error: 'DB error' }, 500)
    }
  }

  return c.json({ ok: false, error: 'DB not enabled' }, 501)
})

app.get('/api/audit-log', async (c) => {
  if (db.isEnabled()) {
    try {
      const rows = await db.getAuditLog()
      return c.json(rows)
    } catch (e) {
      console.error('DB getAuditLog error', e)
    }
  }

  return c.json([
    { id: 'audit-01', actor: 'Sarah Johnson', action: 'School Onboarded', timestamp: '2026-08-12T09:15:00Z', target: 'Lagos Academy' },
    { id: 'audit-02', actor: 'Chika Nwosu', action: 'Invoice Paid', timestamp: '2026-08-11T15:40:00Z', target: 'Kaduna International College' },
    { id: 'audit-03', actor: 'System', action: 'Revenue Snapshot Synced', timestamp: '2026-08-11T11:00:00Z', target: 'Platform' },
  ])
})

app.get('/api/schools/:id/invoices', async (c) => {
  const id = c.req.param('id')
  if (db.isEnabled()) {
    try {
      const rows = await db.getInvoicesForSchool(id)
      return c.json(rows)
    } catch (e) {
      console.error('DB getInvoices error', e)
    }
  }

  // mock invoices
  const invoices = [
    { id: `${id}-inv-1`, term: '2026 Term 1', amount: 'NGN 378,000', status: 'paid', issuedAt: '2026-02-01' },
    { id: `${id}-inv-2`, term: '2026 Term 2', amount: 'NGN 420,000', status: 'unpaid', issuedAt: '2026-06-01' },
  ]

  return c.json(invoices)
})

import PDFDocument from 'pdfkit'

app.get('/api/invoices/:id/pdf', async (c) => {
  const id = c.req.param('id')

  // generate a simple PDF in-memory using PDFKit
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Uint8Array[] = []

  doc.on('data', (chunk: Uint8Array) => chunks.push(chunk))

  doc.fontSize(20).text(`Invoice: ${id}`, { align: 'left' })
  doc.moveDown()
  doc.fontSize(12).text('This is a mock invoice PDF generated by ScholarSync Master API.', { align: 'left' })
  doc.moveDown()
  doc.text(`Generated: ${new Date().toISOString()}`)

  doc.end()

  await new Promise((resolve) => doc.on('end', resolve))

  const pdfBuf = Buffer.concat(chunks.map((c) => Buffer.from(c)))

  return c.body(pdfBuf, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${id}.pdf"`,
  })
})

const port = Number(process.env.PORT ?? 8787)

;(async () => {
  try {
    const enabled = await db.initDb()
    console.log('DB enabled:', enabled)

    if (enabled) {
      // seed DB with initial in-memory data if empty
      const sampleStaff = [
        { id: 'staff-01', name: 'Sarah Johnson', role: 'Master Super Admin', email: 'sarah@scholarsync.com', mfa: true },
        { id: 'staff-02', name: 'Ayo Martins', role: 'Onboarding Staff', email: 'ayo@scholarsync.com', mfa: true },
        { id: 'staff-03', name: 'Chika Nwosu', role: 'Finance/Revenue Staff', email: 'chika@scholarsync.com', mfa: true },
        { id: 'staff-04', name: 'Daniel Peters', role: 'Support Staff', email: 'daniel@scholarsync.com', mfa: true },
        { id: 'staff-05', name: 'Efe George', role: 'Customer Care', email: 'efe@scholarsync.com', mfa: true },
      ]

      const sampleAudit = [
        { id: 'audit-01', actor: 'Sarah Johnson', action: 'School Onboarded', timestamp: '2026-08-12T09:15:00Z', target: 'Lagos Academy' },
        { id: 'audit-02', actor: 'Chika Nwosu', action: 'Invoice Paid', timestamp: '2026-08-11T15:40:00Z', target: 'Kaduna International College' },
        { id: 'audit-03', actor: 'System', action: 'Revenue Snapshot Synced', timestamp: '2026-08-11T11:00:00Z', target: 'Platform' },
      ]

      const sampleInvoices = initialSchoolRegistry.flatMap((s) => [
        { id: `${s.id}-inv-1`, school_id: s.id, term: '2026 Term 1', amount: s.invoiceDue, status: 'paid', issued_at: '2026-02-01' },
      ])

      try {
        await db.seedInitialData(initialSchoolRegistry, sampleStaff, sampleAudit, sampleInvoices)
        console.log('Initial data seeded if DB was empty')
      } catch (e) {
        console.error('DB seeding error', e)
      }
    }
  } catch (e) {
    console.error('Failed to init DB', e)
  }

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`ScholarSync Master API running on http://localhost:${info.port}`)
  })
})()
