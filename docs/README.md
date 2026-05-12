# glasshouse

A [Claude Code](https://claude.ai/code) skill that runs a full GDPR /
ePrivacy audit of any public website and — optionally — turns the
result into a ready-to-submit complaint dossier for a data protection
authority of your choice.

This site hosts the published example audits. Everything else — source,
docs, install instructions, contributing — lives on the
[GitHub repo](https://github.com/DataGobes/glasshouse).

## Example audits

- [**datagobes.dev**](./examples/datagobes.dev/) — clean-baseline audit
  of this project's own homepage (9.5 / 10). Zero pre-consent trackers,
  six of six security headers, one genuine recommendation. Useful as a
  "passing audit" reference.

More examples will be added over time. Browse the
[examples index](./examples/) for the full list.

## Install the skill

```bash
git clone https://github.com/DataGobes/glasshouse ~/.claude/skills/glasshouse
cd ~/.claude/skills/glasshouse
npm install && npx playwright install firefox
```

Then in any Claude Code session: `/glasshouse <url>` to run an audit,
`/glasshouse file <scan.json>` to turn it into a DPA complaint.

## License

MIT. The bundled GDPR / ePrivacy / EDPB article text is in the public
domain. See [LICENSE](https://github.com/DataGobes/glasshouse/blob/main/LICENSE).
