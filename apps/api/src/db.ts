import type { D1Database } from '@cloudflare/workers-types'

type SchoolRow = {
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

type StaffRow = {
  id: string
  name: string
  role: string
  email: string | null
  mfa: number | boolean | null
  password: string | null
}

type InvoiceRow = {
  id: string
  term: string | null
  amount: string | null
  status: string | null
  issued_at: string | null
}

type AuditRow = {
  id: string
  actor: string | null
  action: string | null
  timestamp: string | null
  target: string | null
}

function mapSchoolRow(row: SchoolRow) {
  return {
    id: row.id,
    schoolName: row.school_name,
    domain: row.domain,
    status: row.status,
    onboardingStep: row.onboarding_step,
    activeStudents: row.active_students ?? 0,
    invoiceDue: row.invoice_due,
    owner: row.owner,
    revenue: row.revenue,
  }
}

function mapInvoiceRow(row: InvoiceRow) {
  return {
    id: row.id,
    term: row.term,
    amount: row.amount,
    status: row.status,
    issuedAt: row.issued_at,
  }
}

function mapStaffRow(row: StaffRow) {
  return { id: row.id, name: row.name, role: row.role, email: row.email, mfa: !!row.mfa }
}

export function createD1Db(database: D1Database) {
  return {
    isEnabled: () => true,

    async health() {
      return database.prepare('SELECT 1 AS connected').first<{ connected: number }>()
    },

    async getSchools() {
      const result = await database.prepare('SELECT * FROM schools ORDER BY school_name').all<SchoolRow>()
      return result.results.map(mapSchoolRow)
    },

    async createSchool(s: Record<string, string | number>) {
      await database
        .prepare('INSERT INTO schools(id, school_name, domain, status, onboarding_step, active_students, invoice_due, owner, revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(s.id, s.schoolName, s.domain, s.status, s.onboardingStep, s.activeStudents, s.invoiceDue, s.owner, s.revenue)
        .run()
      return s
    },

    async getInvoicesForSchool(schoolId: string) {
      const result = await database.prepare('SELECT * FROM invoices WHERE school_id = ? ORDER BY issued_at DESC').bind(schoolId).all<InvoiceRow>()
      return result.results.map(mapInvoiceRow)
    },

    async getDashboardStats() {
      const result = await database.prepare('SELECT status, COUNT(*) AS count FROM schools GROUP BY status').all<{ status: string | null; count: number }>()
      const counts = new Map(result.results.map((row) => [row.status, Number(row.count)]))
      return {
        totalSchools: [...counts.values()].reduce((total, count) => total + count, 0),
        active: counts.get('active') ?? 0,
        suspended: counts.get('suspended') ?? 0,
        provisioning: counts.get('provisioning') ?? 0,
      }
    },

    async getStaff() {
      const result = await database.prepare('SELECT * FROM staff ORDER BY name').all<StaffRow>()
      return result.results.map(mapStaffRow)
    },

    async getStaffByEmail(email: string) {
      const row = await database.prepare('SELECT * FROM staff WHERE email = ? LIMIT 1').bind(email).first<StaffRow>()
      if (!row) return null
      return { ...mapStaffRow(row), password: row.password }
    },

    async getStaffById(id: string) {
      const row = await database.prepare('SELECT * FROM staff WHERE id = ? LIMIT 1').bind(id).first<StaffRow>()
      if (!row) return null
      return { ...mapStaffRow(row), password: row.password }
    },

    async createStaff(member: { id: string; name: string; role: string; email?: string; mfa?: boolean; password?: string }) {
      const bcryptModule = await import('bcryptjs')
      const bcrypt = bcryptModule.default ?? bcryptModule
      const passwordHash = member.password ? await bcrypt.hash(member.password, 10) : null
      await database
        .prepare('INSERT INTO staff(id, name, role, email, mfa, password) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(member.id, member.name, member.role, member.email ?? null, member.mfa ? 1 : 0, passwordHash)
        .run()
      return mapStaffRow({ ...member, email: member.email ?? null, mfa: member.mfa ? 1 : 0, password: passwordHash })
    },

    async updateStaff(member: { id: string; name: string; role: string; email?: string; mfa?: boolean; password?: string }) {
      const bcryptModule = await import('bcryptjs')
      const bcrypt = bcryptModule.default ?? bcryptModule
      const passwordHash = member.password ? await bcrypt.hash(member.password, 10) : null
      if (passwordHash) {
        await database.prepare('UPDATE staff SET name = ?, role = ?, email = ?, mfa = ?, password = ? WHERE id = ?').bind(member.name, member.role, member.email ?? null, member.mfa ? 1 : 0, passwordHash, member.id).run()
      } else {
        await database.prepare('UPDATE staff SET name = ?, role = ?, email = ?, mfa = ? WHERE id = ?').bind(member.name, member.role, member.email ?? null, member.mfa ? 1 : 0, member.id).run()
      }
      return mapStaffRow({ ...member, email: member.email ?? null, mfa: member.mfa ? 1 : 0, password: passwordHash })
    },

    async deleteStaff(id: string) {
      await database.prepare('DELETE FROM staff WHERE id = ?').bind(id).run()
    },

    async getAuditLog() {
      const result = await database.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 200').all<AuditRow>()
      return result.results
    },
  }
}

export type D1Db = ReturnType<typeof createD1Db>
