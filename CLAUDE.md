# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

HL7 **CDS Hooks** service implemented in **Node.js + Fastify 5 + TypeScript** (ESM, run via `tsx`). It exposes a Discovery endpoint plus `patient-view` hooks that return clinical-decision-support **Cards**. Rules run either in TypeScript or against compiled **CQL/ELM** (`USE_ELM=true`), with automatic fallback to TS when ELM execution fails.

## Two independent servers

There are **two separate Fastify processes** that share `src/fhir`, `src/cql`, and `src/cds/cdsServices.ts` but run on different ports and register different routes:

| Process | Entry | Default port | Hooks |
|---------|-------|--------------|-------|
| Main CDS | `src/server.ts` | 3000 (`PORT`) | `egfr-check`, `ckd-risk`, `ckd-comprehensive` |
| Emergency CDS | `src/emergency/server.ts` | 3001 (`EMERGENCY_CDS_PORT`) | `72hr-revisit`, `infection-control-warning`, `tb-detection` |

Both serve `GET /cds-services` (Discovery) and `POST /cds-services/<hook-id>`. Run them in separate terminals.

## Commands

```powershell
npm install
Copy-Item .env.example .env

npm run dev              # main CDS, watch mode
npm run dev:emergency    # emergency CDS, watch mode (port 3001)
npm start                # main CDS
npm run start:emergency  # emergency CDS
npm run build            # tsc -> dist/
npm run test:fhir        # verify FHIR connectivity (src/scripts/test-fhir-client.ts)
```

There is **no unit-test runner**. Verification is done through `npm run test:fhir`, the Postman collections in `postman/`, fixtures in `input/tests/{fhir,cds}/`, and the React test bench in `frontend/` (Vite — its own `npm install` / `npm run dev`).

A live **FHIR R4 server** is required for hooks that fall back to backend queries (default `FHIR_BASE_URL=http://localhost:9090/fhir`, e.g. local HAPI).

## Request flow (the pattern every hook follows)

1. `routes.ts` wraps each handler in `postCdsHook` / `postEmergencyCdsHook`, which catches errors and returns a FHIR `OperationOutcome` with HTTP **502**.
2. Handler reads `context.patientId` (strip a possible `Patient/` prefix via `stripPatientPrefix`).
3. **Hybrid prefetch**: use a resource from `body.prefetch` if present; otherwise query FHIR through `src/fhir/fhirClient.ts`. `firstEntryResource` unwraps either a Bundle's first entry or a bare resource.
4. **Engine selection** via `getUseElm()`: `USE_ELM=true` → run the ELM executor in `src/cql/`; on any thrown error, log and degrade to the TS rule path. The engine actually used (`ELM` / `TS` / `TS_FALLBACK`) is stamped onto every card's `extension` under `urn:cds-service:rule-engine` — relied on by QA/Postman/UI to confirm which path ran.
5. Return `{ cards: CdsCard[] }`. Cards typically include an `info` summary card and a conditional `warning`/`critical` card with guideline `links`.

The canonical reference implementation of this flow is `src/cds/egfrCheckHookHandler.ts`. The shared `CdsHooksRequest` / `CdsCard` / `CdsHooksResponse` types live there and in `ckdHookHandler.ts`.

## CQL / ELM

`cql-execution` runs **compiled ELM JSON**, not `.cql` directly. Source `cql/*.cql` must be compiled to `elm/*.json` before `USE_ELM=true` works. ELM files are loaded from `elm/` relative to `process.cwd()` and cached in-process, so **run the servers from the repo root**.

Compile with the Maven `cql-to-elm-cli` POM:

```powershell
mvn -f scripts/cql-compile-pom.xml exec:java `
  "-Dexec.args=--input cql/EGFR_Check.cql --output elm/EGFR_Check.json --format JSON"
```

ELM executor conventions (`src/cql/*ElmExecutor.ts`):
- Build a `Bundle` of the relevant resources, load via `cql-exec-fhir` `PatientSource.FHIRv401()` (must match `using FHIR 4.0.1` / `FHIRHelpers` or `USE_ELM` silently falls back).
- `FHIRHelpers.json` is loaded alongside every library in the `cql.Repository`.
- Watch UCUM unit normalization before execution (e.g. eGFR `mL/min/1.73m2` → `mL/min/1.73/m2`) — bad units fail ELM validation and trigger fallback.
- These modules do rule execution only — no HTTP or FHIR queries.

## TB Detection specifics

`tb-detection` uses FHIR **ValueSets** resolved by `src/cql/tbValueSetLoader.ts`, with canonical URLs prefixed by `TB_VALUESET_BASE_URL`. It has a dedicated FHIR client `src/fhir/tbFhirClient.ts` (built from the shared `createFhirInstance` factory). Trigger conditions, safety-lab codes, and the case-14…28 test matrix are documented in `docs/tb-detection/test-plan.md`.

## Conventions

- **ESM with NodeNext**: imports of local files must use the `.js` extension even though sources are `.ts` (e.g. `import { ... } from './routes.js'`).
- File headers carry a Chinese changelog block (`更新時間 / 作者 / 摘要`); preserve/prepend to it when materially editing a file.
- `tsconfig` is `strict`; `outDir` is `dist/`, `rootDir` is `src/`.
- New main hook: add the service definition, register the route in `src/cds/routes.ts`, and include it in the Discovery array in `cdsServices.ts`. Emergency hooks mirror this in `src/emergency/`.

## Key docs

`dev_readme.md` (operations manual), `hi_level_design.md` (high-level design), `docs/cql_elm.md` (CQL→ELM), `docs/E2E_Test_Plan.md`, `docs/CDS_Hook_UI_Operation.md` (test bench). Full env-var reference is in `.env.example`.
