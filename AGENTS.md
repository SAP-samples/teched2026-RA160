# Agent guidance

## Project overview

This repository contains a financial data agent workshop for SAP TechEd 2026 (session RA160).
The agent queries SAP OData services, loads rows into an in-memory DB workspace, and uses SAP RPT or TabPFN for tabular predictions.
Implementations are provided in both TypeScript (LangChain + SAP Cloud SDK for AI) and Java (Spring AI + SAP Cloud SDK for AI).

## Key source locations

| Path                            | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `js-app/agent/src/agent.ts`     | Model config, system prompt, tool registration  |
| `js-app/agent/src/tools/`       | OData, SQL, RPT, TabPFN, and ground-truth tools |
| `mock-server/src/shared/db.ts`  | In-memory SQLite mock OData backend             |
| `mock-server/data/seed.sql`     | Static seed data (do not edit by hand)          |
| `java-app/agent/src/main/java/` | Java Spring Boot agent                          |
| `js-app/exercises/`             | JavaScript exercise guides (ex1–ex4)            |
| `java-app/exercises/`           | Java exercise guides (ex1–ex4)                  |

## JavaScript exercises

Four progressive exercises under `js-app/exercises/`, each with a `README.md`:

| Exercise | Topic                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------- |
| `ex1`    | Connect a TypeScript app to SAP AI Core via `OrchestrationClient`; first LLM round-trip        |
| `ex2`    | Add OData and SQL tools; agent queries real financial data and aggregates with an in-memory DB |
| `ex3`    | Add RPT and TabPFN forecasting tools; agent predicts future periods and evaluates actuals      |
| `ex4`    | Orchestration fallback configs; agent recovers automatically from model-level failures         |

Each exercise README describes what the participant implements and what the finished state looks like.

## Invariants

- `mock-server/data/seed.sql` is static and checked in; do not edit by hand.
- `js-app/agent/src/generated/` is pre-committed; EDMX service definitions are not tracked — do not edit generated files by hand.
- The agent always uses SQL for local analysis: OData tools load rows into the in-memory DB, `run_sql` reports, prediction tools consume session tables.
- Each JavaScript session owns an isolated in-memory DuckDB database; Java sessions likewise use per-session DuckDB state.
