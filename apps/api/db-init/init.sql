-- Init SQL for ScholarSync Master local Postgres
BEGIN;

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

ALTER TABLE staff ADD COLUMN IF NOT EXISTS password TEXT;

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT,
  action TEXT,
  timestamp TIMESTAMPTZ,
  target TEXT
);

-- seed schools
INSERT INTO schools(id, school_name, domain, status, onboarding_step, active_students, invoice_due, owner, revenue) VALUES
('sch-1001','Lagos Academy','lagosacademy','active','complete',420,'NGN 378,000','Amina Bello','NGN 12.5M'),
('sch-1002','Kaduna International College','kadunaic','suspended','complete',310,'NGN 279,000','David Okafor','NGN 9.1M'),
('sch-1003','Ikeja Preparatory','ikejaprep','provisioning','schema-created',205,'NGN 184,500','Folasade Adebayo','NGN 6.3M')
ON CONFLICT (id) DO NOTHING;


-- seed audit
INSERT INTO audit_log(id, actor, action, timestamp, target) VALUES
('audit-01','Sarah Johnson','School Onboarded','2026-08-12T09:15:00Z','Lagos Academy'),
('audit-02','Chika Nwosu','Invoice Paid','2026-08-11T15:40:00Z','Kaduna International College'),
('audit-03','System','Revenue Snapshot Synced','2026-08-11T11:00:00Z','Platform')
ON CONFLICT (id) DO NOTHING;

-- seed invoices
INSERT INTO invoices(id, school_id, term, amount, status, issued_at) VALUES
('sch-1001-inv-1','sch-1001','2026 Term 1','NGN 378,000','paid','2026-02-01'),
('sch-1001-inv-2','sch-1001','2026 Term 2','NGN 420,000','unpaid','2026-06-01')
ON CONFLICT (id) DO NOTHING;

COMMIT;
