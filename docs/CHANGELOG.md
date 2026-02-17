# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.2] - 2026-02-17

### Changed

- **License**: Migrated from BSL 1.1 to MIT License with trademark notice
- **README**: Full rewrite for clarity and non-technical accessibility
- **SECURITY.md**: Simplified — removed SLA commitments, fixed broken links
- **Sponsor**: Added Buy Me a Coffee via GitHub Sponsors

---

## [2.1.0] - 2026-02-17

### Changed

- **Pipeline Phases**: Split PLANNING into DISCOVER + PLAN. Pipeline is now 4 phases: DISCOVER → PLAN → BUILD → DEPLOY
- **Quick Flow**: New workflow blueprint for rapid prototyping

### Fixed

- Full internal consistency audit — 990 tests, 158 files validated, 4 scan rounds
- Mode governance hook, session state defaults, task phase alignment, cross-references

---

## [2.0.9] - 2026-02-17

- Migrated repository to `Chati-dev` GitHub organization
- Restructured Quick Start documentation

---

## [2.0.7] - 2026-02-16

### Added

- **Ed25519 Manifest Signing**: Cryptographic signing of framework files on publish, verified on install
- **Read Protection Hook**: Blocks reads of sensitive files (`.env`, `.pem`, `.key`, `credentials.*`)
- **Semantic Linter**: Cross-reference validation across entity registry, domains, workflows, i18n, schemas
- **Package Validator**: Pre-publish validation of framework bundle

---

## [2.0.5] - 2026-02-14

### Added

- **Multi-Terminal Spawning**: Autonomous agents in separate `claude -p` terminals with model assignments
- **Terminal Modules**: prompt-builder, handoff-parser, run-agent, run-parallel
- **Stdin Piping**: Prompts piped via stdin for shell injection prevention

### Changed

- Pipeline phase renamed from CLARITY to PLANNING across ~150 files
- README rewritten with pipeline diagram showing terminal spawning and parallel execution

---

## [2.0.0] - 2026-02-13

### Added

- **Context Engine PRISM**: 5-layer injection pipeline with bracket tracking and domain loading
- **Hooks System**: 5 Claude Code hooks for automatic enforcement
- **Task Definitions**: 72 task files across 13 agents with runtime modules
- **Memory System RECALL**: Gotchas auto-capture, per-agent memory, session digests
- **Decision Engine COMPASS**: Jaccard similarity for REUSE/ADAPT/CREATE decisions
- **Orchestrator Intelligence**: Intent classifier, agent selector, pipeline manager, deviation handler
- **Execution Modes**: Autonomous and human-in-the-loop with safety net and circuit breaker
- **Quality Gates**: 5 pipeline gates with circuit breaker pattern
- **18 Infrastructure Scripts**: Health check, validators, analyzers, generators

### Stats

- 843 tests, ~60 source modules, 72 task definitions, 13 enriched agents

---

## [1.4.0] - 2026-02-12

- **Model Governance (Article XVI)**: Per-agent model selection (opus/sonnet/haiku)
- Constitution updated to 16 articles

## [1.3.0] - 2026-02-12

- **Quality Infrastructure**: ESLint, node:test suite (115+ tests), GitHub Actions CI
- **Intelligence Runtime**: CLI commands for memory, context, registry, health check
- **Entity Registry**: 47 entities cataloged
- Constitution updated to 15 articles

## [1.2.0] - 2026-02-12

- **Context Engine**: Bracket-aware context management (FRESH/MODERATE/DEPLETED/CRITICAL)
- **Memory Layer**: 4 cognitive sectors, 3-level retrieval, attention scoring
- **Session Lock Protocol**: All messages routed through orchestrator when active
- Constitution Articles XII-XV added

## [1.1.0] - 2026-02-08

- **Mode Governance (Article XI)**: 3 modes (planning, build, deploy) with autonomous transitions

## [1.0.0] - 2026-02-07

- **13 Agents**: Orchestrator + 12 specialized agents
- **8 Universal Protocols**: Self-Validation, Loop Until Done, Guided Options, Persistence, Two-Layer Handoff, Language Protocol, Deviation Protocol, Interaction Model
- **5 Workflow Blueprints**: Greenfield Fullstack, Brownfield Discovery/Fullstack/UI/Service
- **Constitution**: 10 Articles + Preamble
- **CLI**: Installer wizard, dashboard TUI, upgrade system
- **6 IDE Support**: Claude Code, VS Code, AntiGravity, Cursor, Gemini CLI, GitHub Copilot
- **i18n**: EN, PT, ES, FR
