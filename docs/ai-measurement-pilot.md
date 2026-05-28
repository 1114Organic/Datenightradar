# AI Measurement Pilot

This repository uses a lightweight team-level AI measurement approach. The goal is to understand whether AI-assisted workflows improve delivery, quality, developer experience, and repeatability.

This data must not be used for individual performance evaluation.

## What Is Collected

- PR template AI usage declarations
- Automated AI usage labels
- PR count, cycle time, and review turnaround time from GitHub
- CI result trends
- Monthly anonymous pulse survey responses

## PR Labels

| Label | Meaning |
| --- | --- |
| `ai-assisted-confirmed` | Developer or reviewer confirmed meaningful AI assistance. |
| `ai-assisted-likely` | Automation detected one or more AI usage indicators. |
| `ai-agent-authored` | PR or commits appear to be created by an AI agent or service account. |
| `ai-generated-tests` | PR appears to include significant generated or expanded test coverage. |
| `ai-generated-docs` | PR appears to include significant generated or expanded documentation. |
| `ai-usage-unknown` | PR did not include a completed AI usage declaration and no strong signal was detected. |

## Detection Signals

Strong signals:

- PR body mentions Copilot, ChatGPT, Claude, Codex, AI-assisted, AI-generated, or agent work.
- PR author appears to be a bot, service account, or AI agent.
- Branch name starts with `ai/`, `agent/`, or `codex/`, or references common AI tools.
- Commit messages include an AI marker.

Medium signals:

- Three or more changed test/spec files.
- Two or more changed documentation files.

The automation applies likely labels only. Developers and reviewers should confirm or correct AI usage in the PR template.

## Monthly Pulse Survey

Keep the survey anonymous and short:

1. Approximately how many hours per week does AI save you?
2. Which AI workflows provide the most value?
3. Where does AI create frustration, rework, or risk?
4. Has AI improved your ability to work in unfamiliar code or systems?
5. Do you trust AI-generated code after normal human review?
6. What repetitive work should we automate next?

## Starter Dashboard

Useful dashboard panels:

- AI-assisted PR percentage
- Confirmed vs likely vs unknown AI usage
- Agent-authored PR count
- PR throughput
- PR cycle time
- Review turnaround time
- Failed checks
- Reopened work or rework trends
- Monthly reported hours saved
- Top friction points
- Candidate automation opportunities

## Communication

Use this team message when introducing the measurement pilot:

> We are measuring AI-assisted workflows to understand where AI helps the team deliver better software, reduce repetitive work, and improve developer experience. These metrics will be reported at the team and workflow level only. They will not be used for individual performance evaluations. The goal is to guide tooling, training, and automation investments.
