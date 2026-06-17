[Skip to content](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem#start-of-content)

You signed in with another tab or window. [Reload](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem) to refresh your session.You signed out in another tab or window. [Reload](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem) to refresh your session.You switched accounts on another tab or window. [Reload](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem) to refresh your session.Dismiss alert

{{ message }}

[borghei](https://github.com/borghei)/ **[Claude-Skills](https://github.com/borghei/Claude-Skills)** Public

- Sponsor







# Sponsor borghei/Claude-Skills



















##### External links





![buy_me_a_coffee](https://github.githubassets.com/assets/buy_me_a_coffee-63ed78263f6e.svg)



[buymeacoffee.com/ **borghei**](https://buymeacoffee.com/borghei)









[Learn more about funding links in repositories](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository).




[Report abuse](https://github.com/contact/report-abuse?report=borghei%2FClaude-Skills+%28Repository+Funding+Links%29)

- [Notifications](https://github.com/login?return_to=%2Fborghei%2FClaude-Skills) You must be signed in to change notification settings
- [Fork\\
37](https://github.com/login?return_to=%2Fborghei%2FClaude-Skills)
- [Star\\
208](https://github.com/login?return_to=%2Fborghei%2FClaude-Skills)


## Collapse file tree

## Files

main

Search this repository(forward slash)` forward slash/`

/

# pre-mortem

/

Copy path

## Directory actions

## More options

More options

## Directory actions

## More options

More options

## Latest commit

[![borghei](https://avatars.githubusercontent.com/u/6253296?v=4&size=40)](https://github.com/borghei)[borghei](https://github.com/borghei/Claude-Skills/commits?author=borghei)

[feat(pm): tier 2 — red-flag libraries (54) + runnable pipelines (5)](https://github.com/borghei/Claude-Skills/commit/a8063e1c830a4514a2d6e69314824dffa98c6519)

Open commit details

last weekMay 22, 2026

[a8063e1](https://github.com/borghei/Claude-Skills/commit/a8063e1c830a4514a2d6e69314824dffa98c6519) · last weekMay 22, 2026

## History

[History](https://github.com/borghei/Claude-Skills/commits/main/project-management/discovery/pre-mortem)

Open commit details

[View commit history for this file.](https://github.com/borghei/Claude-Skills/commits/main/project-management/discovery/pre-mortem) History

/

# pre-mortem

/

Top

## Folders and files

| Name | Name | Last commit message | Last commit date |
| --- | --- | --- | --- |
| ### parent directory<br> [..](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery) |
| [assets](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem/assets "assets") | [assets](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem/assets "assets") | [feat(pm): add 12 new PM skills and upgrade 3 existing ones (10→22 total)](https://github.com/borghei/Claude-Skills/commit/3dc940371b96edd599390dc0b739e6dee59ec08a "feat(pm): add 12 new PM skills and upgrade 3 existing ones (10→22 total)  Add 4 discovery skills (brainstorm-ideas, brainstorm-experiments, identify-assumptions, pre-mortem) and 8 execution skills (create-prd, brainstorm-okrs, outcome-roadmap, prioritization-frameworks, release-notes, summarize-meeting, job-stories, wwas). Upgrade senior-pm with stakeholder mapping, scrum-master with sprint capacity planning, and delivery-manager with release communication cross-references. Includes 10 new Python CLI tools and updated documentation reflecting 109+ total skills.") | 3 months agoMar 4, 2026 |
| [examples](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem/examples "examples") | [examples](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem/examples "examples") | [feat(pm): tier 1 — worked examples (54), data adapters (3), MCP tools…](https://github.com/borghei/Claude-Skills/commit/505cb8e28f365a3ba9b2e3ae489b2c347fe8e849 "feat(pm): tier 1 — worked examples (54), data adapters (3), MCP tools (15)  Deepens the 54 PM skills from \"documentation\" to \"tools you can actually use today.\" Three coordinated additions:  1. WORKED EXAMPLES (~13,000 lines across 54 files)    Every PM skill now has examples/<scenario>.md with a realistic    company, the workflow applied, and the FULL generated artifact PMs    can copy. Recurring fictional cast (Acme Analytics, Wayfinder,    Northwind, Helix Platform, Pylon) makes scenarios cross-reference    naturally. Highlights: full 8-section PRD for \"Shared Dashboards\",    AI PRD with eval/guardrails/model-fallback, blameless RCA for a    47-min payment outage, weekly Yellow-status exec update, 8-interview    synthesis to opportunity tree, full Stripe CIRCLES answer.  2. LIVE DATA ADAPTERS (tools/adapters/)    Three stdlib-only scripts that pull from real APIs and emit JSON    in the shape PM Python tools expect. Removes the \"first get the    data\" friction.    - jira_to_json.py    -> raw / status-update / cycle-time / dependency-map    - linear_to_json.py  -> raw / status-update / cycle-time / dependency-map    - notion_to_json.py  -> raw / prds / okrs / roadmap / feedback    Auth via env vars (JIRA_TOKEN, LINEAR_API_KEY, NOTION_TOKEN).    Pipe directly into the consuming PM tool:      jira_to_json.py --format cycle-time | flow_metrics.py --input -  3. MCP TOOLS (scripts/mcp_server.py)    15 PM skills wrapped as Claude Code MCP tools, callable from inside    any AI conversation without manually running Python. Each accepts    `format` and `input`. Names: pm_create_prd, pm_status_update,    pm_funnel_analyze, pm_flow_metrics, pm_dependency_map,    pm_feedback_triage, pm_nsm_tree, pm_refinement_score,    pm_interview_synthesize, pm_prioritize, pm_okr_validate,    pm_roadmap_transform, pm_pre_mortem, pm_release_notes,    pm_stakeholder_map. Smoke-tested end-to-end through JSON-RPC.  PM README updated with new sections for adapters and MCP. CHANGELOG [4.5.0] entry added.") | last weekMay 22, 2026 |
| [references](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem/references "references") | [references](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem/references "references") | [feat(pm): tier 2 — red-flag libraries (54) + runnable pipelines (5)](https://github.com/borghei/Claude-Skills/commit/a8063e1c830a4514a2d6e69314824dffa98c6519 "feat(pm): tier 2 — red-flag libraries (54) + runnable pipelines (5)  Quality differentiation pass on the 54 PM skills.  1. RED-FLAG LIBRARIES (~12,000 lines across 54 files)    Each PM skill now has references/red-flags.md with 10-12 concrete    anti-patterns. Each red flag has:    - Symptom (one sentence)    - Why it's bad (downstream harm)    - Bad example (quoted artifact snippet)    - Good example (same scenario done right)    - How to catch it (specific check question)    Plus a Quick Reference table and Related Reading section.     Anchors to canonical authors: Wodtke, Wake, Lawrence, Vacanti,    Allspaw, Dekker, Cagan, Klein, Klement, Ellis, McClure, Karpathy,    Anthropic RSP, Ramanujam, Westendorp, Fowler, Conway, Watkins, Lin,    Pichler, Moore, Raskin, Strategyzer, Ulwick, Moesta, Christensen,    Fitzpatrick, Portigal, Torres, Patton, Google SRE.     Highlight red flags:    - status-update-generator: watermelon status    - create-prd: solution-before-problem    - post-mortem: blame language vs systemic framing    - brainstorm-okrs: output-as-KR, sandbagging, mid-Q drift    - customer-feedback-triage: squeaky-wheel bias    - north-star-metric: NSM = revenue    - ai-feature-prd: hallucination tolerance hand-waving  2. RUNNABLE PIPELINES (5 stdlib-only scripts at pipelines/)    Chain multiple PM skills end-to-end with one command.    - feature-end-to-end.py: 7 skills (assumptions -> experiments ->      pre-mortem -> PRD -> OKRs -> priorities -> release notes)    - weekly-cadence.py: 4 skills (adapter -> status + flow + deps)    - customer-discovery.py: 4 skills (interview-synthesis -> assumptions      -> experiments -> NSM)    - post-mortem-flow.py: 3 skills (post-mortem -> follow-up risks ->      cross-team mitigations)    - launch-coordination.py: 4 skills (beta -> flags -> launch -> notes)     Each supports --demo, --input <json>, --format markdown|json,    --output <dir>. Pipelines gracefully stub a stage if the downstream    tool isn't available, so the chain always completes. Smoke-tested:    feature-end-to-end --demo and post-mortem-flow --demo both produce    stage artifacts + summary.md.  PM README updated with Red Flags and Pipelines sections. CHANGELOG [4.6.0] entry added.") | last weekMay 22, 2026 |
| [scripts](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem/scripts "scripts") | [scripts](https://github.com/borghei/Claude-Skills/tree/main/project-management/discovery/pre-mortem/scripts "scripts") | [feat(pm): add 12 new PM skills and upgrade 3 existing ones (10→22 total)](https://github.com/borghei/Claude-Skills/commit/3dc940371b96edd599390dc0b739e6dee59ec08a "feat(pm): add 12 new PM skills and upgrade 3 existing ones (10→22 total)  Add 4 discovery skills (brainstorm-ideas, brainstorm-experiments, identify-assumptions, pre-mortem) and 8 execution skills (create-prd, brainstorm-okrs, outcome-roadmap, prioritization-frameworks, release-notes, summarize-meeting, job-stories, wwas). Upgrade senior-pm with stakeholder mapping, scrum-master with sprint capacity planning, and delivery-manager with release communication cross-references. Includes 10 new Python CLI tools and updated documentation reflecting 109+ total skills.") | 3 months agoMar 4, 2026 |
| [SKILL.md](https://github.com/borghei/Claude-Skills/blob/main/project-management/discovery/pre-mortem/SKILL.md "SKILL.md") | [SKILL.md](https://github.com/borghei/Claude-Skills/blob/main/project-management/discovery/pre-mortem/SKILL.md "SKILL.md") | [feat: standardize frontmatter, add skills.json catalog, improve disco…](https://github.com/borghei/Claude-Skills/commit/6b5a5d842fc689aec34769ef53e529b0f10c6c8e "feat: standardize frontmatter, add skills.json catalog, improve discoverability  - Normalize all 203 SKILL.md files to consistent nested metadata: format - Backfill version, category, domain, tags, author, license on 53+ incomplete skills - Generate machine-readable skills.json catalog (203 entries, 11 domains) - Add sitemap.xml and robots.txt for GitHub Pages SEO - Add infrastructure-compliance-auditor to docs/SKILLS.md (20 → 21 compliance skills)") | 3 months agoMar 30, 2026 |
| View all files |

You can’t perform that action at this time.