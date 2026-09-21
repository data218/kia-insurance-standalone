-- Call center / admin schema for the KIA insurance project.
-- Generated from the live PostgREST schema (2026-09-21).
-- Run via: psql "$DATABASE_URL" -f migrations/call_center_schema.sql

CREATE TABLE IF NOT EXISTS cc_lead_sources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kia_credentials (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS kia_insurance_form_data (
  id BIGSERIAL PRIMARY KEY,
  policyno TEXT,
  vinno TEXT,
  reg_no TEXT,
  customer_name TEXT,
  model TEXT,
  insurancecompany TEXT,
  policy_expiry_date TEXT,
  mobile_no TEXT,
  source TEXT,
  lead_source TEXT,
  source_agent TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  remarks TEXT
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  full_name TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cc_agents (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_logs (
  id BIGSERIAL PRIMARY KEY,
  policyno TEXT,
  vinno TEXT,
  customer_name TEXT,
  model TEXT,
  insurancecompany TEXT,
  grosspremium NUMERIC,
  policy_expiry_date TEXT,
  mobile_no TEXT,
  call_date TIMESTAMPTZ DEFAULT NOW(),
  call_outcome TEXT NOT NULL,
  remarks TEXT,
  follow_up_date DATE,
  agent_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_activities (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT DEFAULT 'main-dashboard',
  username TEXT DEFAULT 'User',
  action TEXT DEFAULT 'view',
  page TEXT DEFAULT '',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_policyno ON call_logs(policyno);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_date ON call_logs(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_auth_activities_created_at ON auth_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cc_agents_name ON cc_agents(name);
CREATE INDEX IF NOT EXISTS idx_kia_insurance_form_data_policyno ON kia_insurance_form_data(policyno);
CREATE INDEX IF NOT EXISTS idx_kia_insurance_form_data_vinno ON kia_insurance_form_data(vinno);