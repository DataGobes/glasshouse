const fs = require('node:fs');
const path = require('node:path');

const WARNING = '// Contains personal data. Do not commit to a public repo.\n// Delete with: rm ~/.claude/privacy-complaint/complainant.json\n';

function profilePath(homeDir) {
  return path.join(homeDir, '.claude', 'privacy-complaint', 'complainant.json');
}

function readProfile(homeDir) {
  const p = profilePath(homeDir);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) throw new Error(`Profile at ${p} has no JSON body`);
  return JSON.parse(raw.slice(jsonStart));
}

function writeProfile(homeDir, profile) {
  const full = { ...profile, createdAt: profile.createdAt || new Date().toISOString() };
  const dir = path.dirname(profilePath(homeDir));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(profilePath(homeDir), WARNING + JSON.stringify(full, null, 2));
}

function anonymizedProfile() {
  return {
    fullName: '[COMPLAINANT NAME]',
    email: '[COMPLAINANT EMAIL]',
    postalAddress: {
      street: '[STREET]',
      city: '[CITY]',
      postalCode: '[POSTAL CODE]',
      country: '[COUNTRY]'
    },
    phone: '[PHONE - IF REQUIRED BY DPA]',
    dataSubjectStatus: 'self'
  };
}

module.exports = { readProfile, writeProfile, anonymizedProfile, profilePath };
