
⏺ Now I can give you a straight answer. Here's the mental model, then the honest gap,
  then exactly how the demo would work.

  The mental model

  safeskill is a bouncer in front of Claude Code's skills folder.

  Claude Code auto-loads any skill sitting in .claude/skills/ (project) or
  ~/.claude/skills/ (global) and trusts it blindly. safeskill is the gate: it only writes
  a skill into that folder if it passes the registry check. So:

  - Good skill → safeskill installs it → Claude Code discovers it → Claude can use it.
  - Malicious / tampered skill → safeskill refuses to write it → it never reaches
  How the demo flows (inside a Claude Code session)

  1. You ask Claude: "install the weather skill" → Claude runs safeskill use weather…
  --dir ~/.claude/skills → ✅ installed.
  2. You ask: "install the cloud-sync skill" (sync.evilcorp — the credential exfiltrator)
  → Claude runs safeskill → BLOCKED / needs-override, exit 1, nothing written → Claude
  reports it can't.
  3. New Claude session → the weather skill is available and works; the evil one was
  never installed, so it doesn't exist to Claude.

  safeskill enforces this with its exit code + fail-closed install, so even if a poisoned
  skill tells Claude to install it, safeskill is what says no.

  The honest gap (why it won't "just work" today)

  Two small mismatches between what safeskill writes and what Claude Code expects:

  ┌─────────────┬────────────────────────────────┬───────────────────────────────────┐
  │             │     safeskill writes today     │         Claude Code needs         │
  ├─────────────┼────────────────────────────────┼───────────────────────────────────┤
  │ Layout      │ a flat file                    │ .claude/skills/weather/SKILL.md   │
  │             │ weather.acme.safeskills.eth.md │ (a folder per skill)              │
  ├─────────────┼────────────────────────────────┼───────────────────────────────────┤
  │ Frontmatter │ plain markdown (# Weather\n…)  │ YAML frontmatter with name: +     │
  │             │                                │ description: so it's discoverable │
  └─────────────┴────────────────────────────────┴───────────────────────────────────┘

  The demo skills' content (in registry.ts) is plain markdown with no frontmatter, and
  install() writes one flat .md. So as-is, Claude Code won't auto-register the installed
  file as a usable skill.

  What I'd build to make it a real Claude Code demo (small)

  1. A safeskill use --claude mode that installs to
  ~/.claude/skills/<short-name>/SKILL.md (the layout Claude Code discovers).
  2. Add proper frontmatter (name, description) to the demo skills so Claude Code
  registers them.

  That's a contained change in safeskill + the demo registry — no touching the adapter
  lanes. After it, you can literally do the three-step flow above live in Claude Code,
  and the blocked skill is genuinely absent.

  Want me to build that bridge? If yes, I'd also pick which demo skills map to the
  on-stage beats (e.g. weather = installs & works, sync.evilcorp = blocked) and wire
  --claude to install into your real ~/.claude/skills/. Or if you'd rather keep the demo
  in the terminal (what we ran earlier) and just narrate the Claude Code part, that works
  with zero build too.