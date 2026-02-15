# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-02-13

### Added

- **Modular CLAUDE.md Pattern**: Framework rules auto-loaded from `.claude/rules/chati/` — zero `@` imports, zero approval dialogs, zero risk of accidental decline
- **Context Files**: 4 context files (`root.md`, `governance.md`, `protocols.md`, `quality.md`) in `.claude/rules/chati/` auto-discovered by Claude Code
- **CLAUDE.local.md**: Runtime state (session lock, current agent, recent decisions) moved to auto-gitignored file — never committed, never conflicts on upgrade
- **Migration v2.0.0→v2.0.1**: Automated migration to new modular pattern
- **Context validation**: Installer validator now checks all 4 context files (10 categories total, was 9)

### Changed

- Installer generates minimal CLAUDE.md (project info only) + copies context to `.claude/rules/chati/`
- Session lock now targets `CLAUDE.local.md` instead of `CLAUDE.md`
- Orchestrator updated to reference `CLAUDE.local.md` for all runtime state modifications
- Thin router (`.claude/commands/chati.md`) updated to pass `CLAUDE.local.md` as context
- Constitution article validation raised from >= 16 to >= 17
- Bundle script now includes `context/` directory

---

## [2.0.0] - 2026-02-13

### Added

- **Context Engine "PRISM"**: 5-layer context injection pipeline (Constitution, Global, Agent, Workflow, Task) with bracket tracking (FRESH/MODERATE/DEPLETED/CRITICAL), domain loading, XML formatting, and graceful degradation (261 tests)
- **Hooks System**: 5 Claude Code hooks for automatic enforcement — pre-write scope validation, post-write registry sync, pre-command mode check, context injection on notification, and session lock enforcement
- **Task Definitions**: 72 task definition files across 13 agents with YAML frontmatter, plus 4 runtime modules — loader, router, executor, handoff (58 tests)
- **Agent Enrichment**: All 13 agents enriched with 10 standardized sections — Identity, Authority, Domain, Behavioral, Tasks, Protocols, Handoff, Quality, Interaction, Examples
- **Memory System "RECALL"**: Gotchas auto-capture (3x/24h promotion), per-agent memory CRUD, session digests, unified search across all memory tiers (41 tests)
- **Decision Engine "COMPASS"**: Jaccard similarity for REUSE/ADAPT/CREATE decisions, BFS dependency analysis, entity-registry auto-update, 6 self-healing rules (40 tests)
- **Orchestrator Intelligence**: Intent classifier (9 types), agent selector (12-agent pipeline with parallel groups), pipeline manager with QA gates (95%/90%), handoff engine, deviation handler, session manager (163 tests)
- **Execution Modes & Autonomy**: Mode manager, mode suggester (weighted risk scoring), autonomous gate (90% default threshold), progress reporter, safety net with 5 triggers (77 tests)
- **Multi-Terminal Orchestration**: Terminal spawner, monitor, collector, write-scope isolation — enables parallel agent execution (Detail + Architect + UX simultaneously) (73 tests)
- **Infrastructure Scripts**: 18 scripts in 3 tiers — Tier 1 (codebase-mapper, health-check, validate-agents, validate-tasks, generate-constitution-domain, populate-entity-registry, ide-sync), Tier 2 (stuck-detector, test-quality-assessment, coverage-analyzer, changelog-generator, commit-message-generator, dependency-analyzer), Tier 3 (performance-analyzer, rollback-manager, framework-analyzer, plan-tracker, pr-review) (73 tests)
- **Quality Gates**: 5 pipeline gates (Planning Complete, QA Planning, Implementation, QA Implementation, Deploy Ready) with GateBase template method pattern and circuit breaker (35 tests)
- **Installer Hardening**: Brownfield upgrader with SHA-256 file hashing, installation manifests, smart file mergers (env/yaml/replace), atomic install transactions with rollback (80 tests)
- **Constitution Article XVII**: Execution Mode Governance — autonomous vs human-in-the-loop rules, safety net triggers, circuit breaker pattern
- **Migration v1.4→v2.0**: Automated upgrade path for existing installations

### Changed

- Quality gate thresholds raised from 80% to 90% default (qa-planning remains 95%)
- Constitution updated to 17 articles (was 16)
- Version bumped to 2.0.0

### Stats

- **843 tests** across 99 test suites (0 failures)
- **~60 source modules** + **18 infrastructure scripts**
- **72 task definitions** + **13 enriched agents**
- **Zero external dependencies added** — only Node.js built-ins + existing deps

---

## [1.4.0] - 2026-02-12

### Added

- **Model Governance (Article XVI)**: Per-agent model selection — opus for deep reasoning, sonnet for structured tasks, haiku for lightweight detection
- **Model metadata** in all 13 agent definitions (Identity section: `Model` field with default + upgrade conditions)
- **Model Selection Protocol** in orchestrator — evaluates complexity and recommends model per agent transition
- **Session schema**: `model_selections[]` array for cost tracking and audit trail
- Constitution now has **16 articles** (was 15) — added Article XVI (Model Governance)

### Changed

- All references updated from 15 → 16 articles across README, CONTRIBUTING, i18n (4 languages), entity registry, intelligence specs, validator, and tests
- SECURITY.md version table updated (1.4.x current)

## [1.3.3] - 2026-02-12

### Fixed

- npm package now includes README.md (was missing on npmjs.com)
- Removed 3 unused dependencies: `blessed`, `cli-progress`, `fs-extra` (-200KB install)
- GitHub repo description updated (was outdated: "7 IDEs" → "6 IDEs", "Framework" → "System")
- GitHub topics corrected (`framework` → `system`)
- Cleaned orphan git tags (v1.3.0, v1.3.1)

### Added

- `exports` field in package.json for proper ESM module resolution
- GitHub homepage set to npmjs.com/package/chati-dev

## [1.3.2] - 2026-02-12

### Fixed

- Removed `--provenance` from npm publish (requires public repo)

### Changed

- Tagline updated to "Structured vibe coding."
- SECURITY.md version table updated (1.3.x current)
- Automated npm publish pipeline validated with NPM_TOKEN secret
- Terminology: "framework" → "system" across 19 files

## [1.3.0] - 2026-02-12

### Added

- **Quality Infrastructure**: ESLint flat config, node:test suite (115+ tests), GitHub Actions CI (Node 18/20/22)
- **Intelligence Runtime**: CLI commands for memory, context, registry, and health check
  - `npx chati-dev memory [stats|list|search|clean]` — Memory Layer management
  - `npx chati-dev context` — Context bracket advisory
  - `npx chati-dev registry [check|stats]` — Entity registry validation
  - `npx chati-dev health` — Comprehensive system health check (5 checks)
- **Intelligence Specs**: context-engine.md, memory-layer.md, decision-engine.md
- **Schemas**: context.schema.json, memory.schema.json (JSON Schema 2020-12)
- **Entity Registry**: `chati.dev/data/entity-registry.yaml` — 47 entities cataloged
- **Dashboard Intelligence Section**: Memory stats, context bracket, registry status in TUI
- **Migration v1.1→v1.2**: Automated migration with memory directory tree creation
- **Installer Extensions**: Creates .chati/memories/ tree (26 dirs), intelligence files, entity registry
- **Validator Extensions**: Validates intelligence (6 files), registry, memories tree, 5 schemas, 15 articles

### Changed

- Constitution updated to 15 articles (was 11) — added Articles XII (Context Bracket), XIII (Memory), XIV (Framework Registry)
- Constitution footer updated to v1.3.0
- Installer now shows Intelligence Layer steps during installation
- Validator now checks 9 categories (was 6)
- Dashboard data-reader made async for intelligence module integration
- i18n strings updated across all 4 languages (EN, PT, ES, FR)

## [1.2.0] - 2026-02-12

### Added

- **Context Engine**: Bracket-aware context management with 4 brackets (FRESH, MODERATE, DEPLETED, CRITICAL) and 5 injection layers (Constitution, Mode, Agent, Pipeline, Task)
- **Memory Layer**: Persistent intelligence across sessions — 4 cognitive sectors (Episodic, Semantic, Procedural, Reflective), 3-level progressive retrieval, attention scoring with natural decay
- **Framework Registry**: Central entity catalog (`entity-registry.yaml`) with 48 tracked artifacts and decision engine (REUSE/ADAPT/CREATE) for brownfield analysis
- **Session Lock Protocol**: Once `/chati` is invoked, ALL messages are routed through the orchestrator. Users stay inside the system until explicit exit (`/chati exit`). Prevents context leakage to generic AI mode.
- **Constitution Article XV**: Session Lock Governance — mandatory lock when session active, explicit exit only, resume re-locks
- **Constitution Articles XII-XIV**: Context Bracket Governance, Memory Governance, Framework Registry Governance
- **Orchestrator subcommands**: `/chati exit`, `/chati stop`, `/chati quit`, `/chati help`, `/chati resume`
- **Health Check**: `npx chati-dev health` validates system integrity

### Removed

- **Windsurf IDE**: Removed from supported IDEs (7 -> 6)

## [1.1.0] - 2026-02-08

### Added

- **Mode Governance (Article XI)**: 3 modes (planning, build, deploy) with autonomous transitions
- **Autonomous transitions**: planning->build (QA-Planning>=95%), build->validate (dev done), validate->deploy (QA-Impl approved)
- **Backward transitions**: build/validate->planning when QA finds spec/architecture issues
- **New agent statuses**: skipped, needs_revalidation

## [1.0.0] - 2026-02-07

### Added

- **13 Agents**: Orchestrator + 12 specialized agents (Greenfield WU, Brownfield WU, Brief, Detail, Architect, UX, Phases, Tasks, QA-Planning, QA-Implementation, Dev, DevOps)
- **8 Universal Protocols**: Self-Validation, Loop Until Done, Guided Options, Persistence, Two-Layer Handoff, Language Protocol, Deviation Protocol, Interaction Model
- **5 Workflow Blueprints**: Greenfield Fullstack, Brownfield Discovery, Brownfield Fullstack, Brownfield UI, Brownfield Service
- **5 Templates**: PRD, Brownfield PRD, Fullstack Architecture, Task, QA Gate
- **Constitution**: 10 Articles + Preamble governing agent behavior
- **Intelligence Layer**: Gotchas, patterns, and confidence tracking
- **Schemas**: JSON schemas for session, config, and task validation
- **Frameworks**: Decision heuristics and quality dimensions
- **Quality Gates**: Planning gate (traceability) and implementation gate (tests + SAST)
- **i18n**: English, Portugues, Espanol, Francais
- **CLI Installer**: `npx chati-dev init` with 4-step wizard
- **Dashboard TUI**: `npx chati-dev status` with watch mode
- **Upgrade System**: `npx chati-dev upgrade` with backup, migrations, and config merge
- **6 IDE Support**: Claude Code, VS Code, AntiGravity, Cursor, Gemini CLI, GitHub Copilot
- **Blocker Taxonomy**: C01-C14 (Code) + G01-G08 (General)
- **Thin Router Pattern**: `.claude/commands/chati.md` delegates to orchestrator
