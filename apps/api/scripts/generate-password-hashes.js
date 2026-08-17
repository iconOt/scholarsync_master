#!/usr/bin/env node
/**
 * Generate bcrypt password hashes for demo staff accounts
 * Run: node scripts/generate-password-hashes.js
 */

import bcryptjs from 'bcryptjs'

const staffAccounts = [
  { id: 'staff-01', name: 'Sarah Johnson', email: 'sarah@scholarsync.com', password: 'Sarah@123' },
  { id: 'staff-02', name: 'Ayo Martins', email: 'ayo@scholarsync.com', password: 'Ayo@123' },
  { id: 'staff-03', name: 'Chika Nwosu', email: 'chika@scholarsync.com', password: 'Chika@123' },
  { id: 'staff-04', name: 'Daniel Peters', email: 'daniel@scholarsync.com', password: 'Daniel@123' },
  { id: 'staff-05', name: 'Efe George', email: 'efe@scholarsync.com', password: 'Efe@123' },
]

async function generateHashes() {
  console.log('Generating bcrypt password hashes for demo staff accounts...\n')
  console.log('Staff Login Credentials:')
  console.log('=' .repeat(70))

  for (const staff of staffAccounts) {
    const hash = await bcryptjs.hash(staff.password, 10)
    console.log(`\nStaff ID: ${staff.id}`)
    console.log(`Name: ${staff.name}`)
    console.log(`Email: ${staff.email}`)
    console.log(`Password: ${staff.password}`)
    console.log(`Hash: ${hash}`)
  }

  console.log('\n' + '='.repeat(70))
  console.log('\nSQL INSERT statements for init.sql:')
  console.log('=' .repeat(70))

  for (const staff of staffAccounts) {
    const hash = await bcryptjs.hash(staff.password, 10)
    console.log(`UPDATE staff SET password = '${hash}' WHERE id = '${staff.id}';`)
  }
}

generateHashes().catch(console.error)
