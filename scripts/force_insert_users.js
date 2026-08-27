import fs from 'fs'
import crypto from 'crypto'

const mapFile = '/tmp/luxeglow-export/identity-map-template.csv'
const lines = fs.readFileSync(mapFile, 'utf8').trim().split('\n')
const headers = lines[0]
const newLines = [headers]

const sqlInserts = ['BEGIN;']

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue
  const cols = line.split(',')
  const kind = cols[0]
  const legacyId = cols[1]
  const email = cols[2].replace(/"/g, '').toLowerCase()
  const id = crypto.randomUUID()
  cols[3] = id
  newLines.push(cols.join(','))
  
  const rawAppMeta = JSON.stringify({ provider: 'email', providers: ['email'] })
  const identityData = JSON.stringify({ sub: id, email: email })

  sqlInserts.push(`INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token, is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated', '${email}', '',
    now(), '${rawAppMeta}'::jsonb, '{}'::jsonb,
    now(), now(), '', '',
    '', '', false
  ) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;`)

  sqlInserts.push(`INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), '${id}', '${id}', '${identityData}'::jsonb, 'email', now(), now(), now()
  ) ON CONFLICT (provider_id, provider) DO UPDATE SET identity_data = EXCLUDED.identity_data;`)
}

sqlInserts.push('COMMIT;')

fs.writeFileSync('/tmp/luxeglow-export/identity-map-template.csv', newLines.join('\n') + '\n')
fs.writeFileSync('/tmp/luxeglow-export/force_users.sql', sqlInserts.join('\n') + '\n')
console.log('Done generating forced users and updated identity-map-template.csv!')

