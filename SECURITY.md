# Security policy

## Reporting a vulnerability

If you find a security issue, please **do not** open a public issue.
Email **gijs@datagobes.dev** with:

- A description of the issue
- Steps to reproduce
- (Optional) a suggested fix

You can expect an initial response within a few days. Once a fix is in
place, the issue can be disclosed publicly with credit to the reporter.

## Scope

This skill runs locally in a Claude Code environment. The threat model is
narrow:

- **Scanner (`scripts/scan.js`)** runs Playwright Firefox against an
  attacker-controlled URL. Treat the scan target as untrusted; the scanner
  should not execute or persist anything the target site sends beyond the
  documented JSON output and screenshots written to `/tmp/`.
- **Author tooling (`scripts/fetch-page.js`)** renders a URL in Playwright
  and prints the body text. Same trust posture as the scanner — input URL
  is attacker-controlled.
- **Complaint builder (`scripts/glasshouse-file.js`)** reads a scan JSON
  and writes a dossier folder. Input is the user's own scan JSON; the
  builder must not be tricked into writing outside the configured
  `--output-dir`.

Out of scope:

- The Playwright browser itself (report to Microsoft).
- The Claude Code harness (report to Anthropic).
- Vulnerabilities in third-party DPA portals (report to the relevant DPA).
