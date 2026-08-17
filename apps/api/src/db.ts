import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { and } from 'drizzle-orm'
import { schools, invoices, staff, audit_log } from './schema.js'

// Postgres pool + Drizzle instance
let pool: Pool | null = null
let db: ReturnType<typeof drizzle> | null = null

// D1 binding (Cloudflare). When running on Workers, call `useD1(env.DB)` to enable.
let d1: any = null

export function useD1(binding: any) {
  d1 = binding
}

function mapSchoolRow(r: any) {
  return {
    id: r.id,
    schoolName: r.school_name ?? r.schoolName,
    domain: r.domain,
    status: r.status,
    onboardingStep: r.onboarding_step ?? r.onboardingStep,
    activeStudents: r.active_students ?? r.activeStudents ?? 0,
    invoiceDue: r.invoice_due ?? r.invoiceDue,
    owner: r.owner,
    revenue: r.revenue,
  }
}

function mapInvoiceRow(r: any) {
  return {
    id: r.id,
    term: r.term,
    amount: r.amount,
    status: r.status,
    issuedAt: r.issued_at ?? r.issuedAt,
  }
}

export async function initDb() {
  const url = process.env.DATABASE_URL

  // Prefer Postgres when DATABASE_URL is set
  if (url) {
    try {
      pool = new Pool({ connectionString: url })
      db = drizzle(pool)

      // create minimal tables if they don't exist (Postgres)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schools (
          id TEXT PRIMARY KEY,
          school_name TEXT,
          domain TEXT,
          status TEXT,
          onboarding_step TEXT,
          active_students INTEGER,
          invoice_due TEXT,
          owner TEXT,
          revenue TEXT
        );

        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          school_id TEXT REFERENCES schools(id),
          term TEXT,
          amount TEXT,
          status TEXT,
          issued_at DATE
        );

        CREATE TABLE IF NOT EXISTS staff (
          id TEXT PRIMARY KEY,
          name TEXT,
          role TEXT,
          email TEXT,
          mfa BOOLEAN,
          password TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT PRIMARY KEY,
          actor TEXT,
          action TEXT,
          timestamp TIMESTAMPTZ,
          target TEXT
        );
      `)

      console.log('Connected to Postgres and ensured schema')
      return true
    } catch (e) {
      console.error('Postgres connection failed, falling back to in-memory/D1 if available', e)
      pool = null
      db = null
      // don't throw; continue to check for D1 binding
    }
  }

  // If running on Cloudflare Workers with a D1 binding
  if (d1) {
    // Ensure SQLite-compatible schema exists
    await d1.prepare('PRAGMA foreign_keys = ON;').run()
    await d1.prepare(`CREATE TABLE IF NOT EXISTS schools (
      id TEXT PRIMARY KEY,
      school_name TEXT,
      domain TEXT,
      status TEXT,
      onboarding_step TEXT,
      active_students INTEGER,
      invoice_due TEXT,
      owner TEXT,
      revenue TEXT
    );`).run()
    await d1.prepare(`CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      school_id TEXT,
      term TEXT,
      amount TEXT,
      status TEXT,
      issued_at TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id)
    );`).run()
    await d1.prepare(`CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT,
      role TEXT,
      email TEXT,
      mfa INTEGER,
      password TEXT
    );`).run()
    await d1.prepare(`CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor TEXT,
      action TEXT,
      timestamp TEXT,
      target TEXT
    );`).run()

    console.log('Connected to D1 and ensured schema')
    return true
  }

  console.log('No DATABASE_URL and no D1 binding — running with in-memory mocks')
  return false
}

export function isEnabled() {
  return !!db || !!d1
}

export async function getSchools() {
  if (d1) {
    const res = await d1.prepare('SELECT * FROM schools ORDER BY school_name').all()
    return (res.results || []).map(mapSchoolRow)
  }

  if (!db) throw new Error('DB not initialized')
  const rows = await db.select().from(schools).orderBy(schools.school_name)
  return rows.map(mapSchoolRow)
}

export async function createSchool(s: any) {
  if (d1) {
    await d1
      .prepare('INSERT INTO schools(id, school_name, domain, status, onboarding_step, active_students, invoice_due, owner, revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(s.id, s.schoolName, s.domain, s.status, s.onboardingStep, s.activeStudents, s.invoiceDue, s.owner, s.revenue)
      .run()
    return s
  }

  if (!db) throw new Error('DB not initialized')
  await db.insert(schools).values({
    id: s.id,
    school_name: s.schoolName,
    domain: s.domain,
    status: s.status,
    onboarding_step: s.onboardingStep,
    active_students: s.activeStudents,
    invoice_due: s.invoiceDue,
    owner: s.owner,
    revenue: s.revenue,
  })
  return s
}

export async function getInvoicesForSchool(schoolId: string) {
  if (d1) {
    const res = await d1.prepare('SELECT * FROM invoices WHERE school_id = ? ORDER BY issued_at DESC').bind(schoolId).all()
    return (res.results || []).map(mapInvoiceRow)
  }

  if (!db) throw new Error('DB not initialized')
  const rows = await db.select().from(invoices).where(and(invoices.school_id.eq(schoolId))).orderBy(invoices.issued_at.desc())
  return rows.map(mapInvoiceRow)
}

export async function addInvoice(invoice: any) {
  if (d1) {
    await d1
      .prepare('INSERT INTO invoices(id, school_id, term, amount, status, issued_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(invoice.id, invoice.school_id, invoice.term, invoice.amount, invoice.status, invoice.issued_at)
      .run()
    return invoice
  }

  if (!db) throw new Error('DB not initialized')
  await db.insert(invoices).values({
    id: invoice.id,
    school_id: invoice.school_id,
    term: invoice.term,
    amount: invoice.amount,
    status: invoice.status,
    issued_at: new Date(invoice.issued_at),
  })
  return invoice
}

export async function getDashboardStats() {
  if (d1) {
    const total = await d1.prepare("SELECT COUNT(*) as count FROM schools").all()
    const active = await d1.prepare("SELECT COUNT(*) as count FROM schools WHERE status = 'active'").all()
    const suspended = await d1.prepare("SELECT COUNT(*) as count FROM schools WHERE status = 'suspended'").all()
    const provisioning = await d1.prepare("SELECT COUNT(*) as count FROM schools WHERE status = 'provisioning'").all()
    return {
      totalSchools: Number((total.results?.[0]?.count) ?? 0),
      active: Number((active.results?.[0]?.count) ?? 0),
      suspended: Number((suspended.results?.[0]?.count) ?? 0),
      provisioning: Number((provisioning.results?.[0]?.count) ?? 0),
    }
  }

  if (!db) throw new Error('DB not initialized')
  const total = await db.select({ count: schools.id.count() }).from(schools)
  const active = await db.select({ count: schools.id.count() }).from(schools).where(schools.status.eq('active'))
  const suspended = await db.select({ count: schools.id.count() }).from(schools).where(schools.status.eq('suspended'))
  const provisioning = await db.select({ count: schools.id.count() }).from(schools).where(schools.status.eq('provisioning'))
  return {
    totalSchools: Number(total[0].count ?? 0),
    active: Number(active[0].count ?? 0),
    suspended: Number(suspended[0].count ?? 0),
    provisioning: Number(provisioning[0].count ?? 0),
  }
}

export async function getStaff() {
  if (d1) {
    const res = await d1.prepare('SELECT * FROM staff ORDER BY name').all()
    return (res.results || []).map((r: any) => ({ id: r.id, name: r.name, role: r.role, email: r.email, mfa: !!r.mfa }))
  }

  if (!db) throw new Error('DB not initialized')
  const rows = await db.select().from(staff).orderBy(staff.name)
  return rows
}

export async function getStaffByEmail(email: string) {
  if (d1) {
    const res = await d1.prepare('SELECT * FROM staff WHERE email = ? LIMIT 1').bind(email).all()
    const r = res.results?.[0]
    if (!r) return null
    return { id: r.id, name: r.name, role: r.role, email: r.email, mfa: !!r.mfa, password: r.password }
  }

  if (!db) throw new Error('DB not initialized')
  const rows = await db.select().from(staff).where(staff.email.eq(email)).limit(1)
  if (!rows[0]) return null
  return { id: rows[0].id, name: rows[0].name, role: rows[0].role, email: rows[0].email, mfa: rows[0].mfa, password: (rows[0] as any).password }
}

export async function getStaffById(id: string) {
  if (d1) {
    const res = await d1.prepare('SELECT * FROM staff WHERE id = ? LIMIT 1').bind(id).all()
    const r = res.results?.[0]
    if (!r) return null
    return { id: r.id, name: r.name, role: r.role, email: r.email, mfa: !!r.mfa, password: r.password }
  }

  if (!db) throw new Error('DB not initialized')
  const rows = await db.select().from(staff).where(staff.id.eq(id)).limit(1)
  if (!rows[0]) return null
  return { id: rows[0].id, name: rows[0].name, role: rows[0].role, email: rows[0].email, mfa: rows[0].mfa, password: (rows[0] as any).password }
}

export async function createStaff(member: any) {
  const bcrypt = await import('bcryptjs')
  const passwordPlain = member.password ?? null
  const passwordHash = passwordPlain ? await bcrypt.hash(passwordPlain, 10) : null

  if (d1) {
    await d1.prepare('INSERT INTO staff(id, name, role, email, mfa, password) VALUES (?, ?, ?, ?, ?, ?)').bind(member.id, member.name, member.role, member.email, member.mfa ? 1 : 0, passwordHash).run()
    return { id: member.id, name: member.name, role: member.role, email: member.email, mfa: !!member.mfa }
  }

  if (!db || !pool) throw new Error('DB not initialized')
  await pool.query('INSERT INTO staff(id, name, role, email, mfa, password) VALUES ($1, $2, $3, $4, $5, $6)', [member.id, member.name, member.role, member.email, member.mfa, passwordHash])
  return { id: member.id, name: member.name, role: member.role, email: member.email, mfa: !!member.mfa }
}

export async function updateStaff(member: any) {
  const bcrypt = await import('bcryptjs')
  const passwordPlain = member.password ?? null
  const passwordHash = passwordPlain ? await bcrypt.hash(passwordPlain, 10) : null

  if (d1) {
    if (passwordHash) {
      await d1.prepare('UPDATE staff SET name = ?, role = ?, email = ?, mfa = ?, password = ? WHERE id = ?').bind(member.name, member.role, member.email, member.mfa ? 1 : 0, passwordHash, member.id).run()
    } else {
      await d1.prepare('UPDATE staff SET name = ?, role = ?, email = ?, mfa = ? WHERE id = ?').bind(member.name, member.role, member.email, member.mfa ? 1 : 0, member.id).run()
    }
    return { id: member.id, name: member.name, role: member.role, email: member.email, mfa: !!member.mfa }
  }

  if (!db || !pool) throw new Error('DB not initialized')
  if (passwordHash) {
    await pool.query('UPDATE staff SET name=$1, role=$2, email=$3, mfa=$4, password=$5 WHERE id=$6', [member.name, member.role, member.email, member.mfa, passwordHash, member.id])
  } else {
    await pool.query('UPDATE staff SET name=$1, role=$2, email=$3, mfa=$4 WHERE id=$5', [member.name, member.role, member.email, member.mfa, member.id])
  }
  return { id: member.id, name: member.name, role: member.role, email: member.email, mfa: !!member.mfa }
}

export async function deleteStaff(id: string) {
  if (d1) {
    await d1.prepare('DELETE FROM staff WHERE id = ?').bind(id).run()
    return true
  }

  if (!db || !pool) throw new Error('DB not initialized')
  await pool.query('DELETE FROM staff WHERE id = $1', [id])
  return true
}

export async function getAuditLog() {
  if (d1) {
    const res = await d1.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 200').all()
    return (res.results || []).map((r: any) => ({ id: r.id, actor: r.actor, action: r.action, timestamp: r.timestamp, target: r.target }))
  }

  if (!db) throw new Error('DB not initialized')
  const rows = await db.select().from(audit_log).orderBy(audit_log.timestamp.desc()).limit(200)
  return rows
}

export async function seedInitialData(initialSchools: any[], staffList: any[], auditList: any[], invoicesArr: any[]) {
  if (d1) {
    const countRes = await d1.prepare('SELECT COUNT(*) as count FROM schools').all()
    const count = Number((countRes.results?.[0]?.count) ?? 0)
    if (count > 0) return
    for (const s of initialSchools) {
      await d1
        .prepare('INSERT OR IGNORE INTO schools(id, school_name, domain, status, onboarding_step, active_students, invoice_due, owner, revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(s.id, s.schoolName, s.domain, s.status, s.onboardingStep, s.activeStudents, s.invoiceDue, s.owner, s.revenue)
        .run()
    }

    const bcrypt = await import('bcryptjs')
    for (const st of staffList) {
      const passwordPlain = (st as any).password ?? 'Password123!'
      const hash = await bcrypt.hash(passwordPlain, 10)
      await d1.prepare('INSERT OR IGNORE INTO staff(id, name, role, email, mfa, password) VALUES (?, ?, ?, ?, ?, ?)').bind(st.id, st.name, st.role, st.email, st.mfa ? 1 : 0, hash).run()
    }

    for (const a of auditList) {
      await d1.prepare('INSERT OR IGNORE INTO audit_log(id, actor, action, timestamp, target) VALUES (?, ?, ?, ?, ?)').bind(a.id, a.actor, a.action, a.timestamp, a.target).run()
    }

    for (const inv of invoicesArr) {
      await d1.prepare('INSERT OR IGNORE INTO invoices(id, school_id, term, amount, status, issued_at) VALUES (?, ?, ?, ?, ?, ?)').bind(inv.id, inv.school_id, inv.term, inv.amount, inv.status, inv.issued_at).run()
    }

    return
  }

  if (!db) throw new Error('DB not initialized')

  const countRes = await db.select({ count: schools.id.count() }).from(schools)
  const count = Number(countRes[0].count ?? 0)
  if (count > 0) return

  for (const s of initialSchools) {
    await db.insert(schools).values({
      id: s.id,
      school_name: s.schoolName,
      domain: s.domain,
      status: s.status,
      onboarding_step: s.onboardingStep,
      active_students: s.activeStudents,
      invoice_due: s.invoiceDue,
      owner: s.owner,
      revenue: s.revenue,
    })
  }

  for (const st of staffList) {
    const hash = await (await import('bcryptjs')).hash((st as any).password ?? 'Password123!', 10)
    await db.insert(staff).values({ id: st.id, name: st.name, role: st.role, email: st.email, mfa: st.mfa, password: hash }).onConflictDoNothing()
  }

  for (const a of auditList) {
    await db.insert(audit_log).values({ id: a.id, actor: a.actor, action: a.action, timestamp: new Date(a.timestamp), target: a.target }).onConflictDoNothing()
  }

  for (const inv of invoicesArr) {
    await db.insert(invoices).values({ id: inv.id, school_id: inv.school_id, term: inv.term, amount: inv.amount, status: inv.status, issued_at: new Date(inv.issued_at) }).onConflictDoNothing()
  }
}

export default {
  initDb,
  isEnabled,
  getSchools,
  createSchool,
  getInvoicesForSchool,
  addInvoice,
  getDashboardStats,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  getAuditLog,
  seedInitialData,
  useD1,
}
