# Tasks: Preserve Equivalent Time-Grain Expressions

**Input**: Design documents from `/specs/sc-112048-fix-date-trunc-grouping/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/query-expression-normalization.md, quickstart.md

**Tests**: Regression tests are required by FR-007, FR-010, and SC-001 through SC-004. Write each test task first and confirm the relevant assertion fails before implementing its paired behavior.

**Organization**: Tasks are grouped by user story so the PostgreSQL fix, semantic-preservation protections, and Redshift compatibility can each be validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on an incomplete task.
- **[Story]**: Maps the task to a user story from spec.md.
- Every task names the exact file or files it changes or validates.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the manual regression fixture and establish portable automated-test commands before code changes.

- [x] T001 Execute the failing mixed-case and successful lowercase PostgreSQL baseline queries against `cube_source.public.orders`, then record the observed error and expected quarter results in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`
- [x] T002 Run the existing focused suites using the checkout's configured Python environment and record portable commands, PostgreSQL-only marker behavior, and unexpected-skip handling in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the typed, documented, identity-by-default engine contract that all story-specific normalization uses.

**⚠️ CRITICAL**: Complete this phase before any user-story implementation.

- [x] T003 Add a failing identity-contract unit test for custom metric expression normalization on an unaffected engine in `tests/unit_tests/db_engine_specs/test_base.py`
- [x] T004 Add the typed PEP 257-documented identity custom metric normalization hook to `superset/db_engine_specs/base.py` and make T003 pass

**Checkpoint**: Engine specifications can opt into metric normalization while every existing engine remains unchanged by default.

---

## Phase 3: User Story 1 - Render a chart with a matching time-grain metric (Priority: P1) 🎯 MVP

**Goal**: A quarterly PostgreSQL chart with an uppercase or mixed-case `DATE_TRUNC` unit in its custom metric renders successfully and matches the direct SQL baseline.

**Independent Test**: Generate and execute a PostgreSQL quarterly chart query containing the ticket's conditional aggregate metric; assert the metric and `GROUP BY` use compatible lowercase units and the returned quarter values match direct execution.

### Tests for User Story 1

- [x] T005 [P] [US1] Add failing source-preservation contract tests for lowercase, uppercase, and mixed-case quarter units plus the nested `CASE` aggregate metric in `tests/unit_tests/db_engine_specs/test_postgres.py`
- [x] T006 [P] [US1] Add a failing ad hoc PostgreSQL metric final-query test asserting matching metric and `GROUP BY` quarter expressions in `tests/unit_tests/models/helpers_test.py`
- [x] T007 [P] [US1] Add a focused failing saved SQL metric normalization test in `tests/integration_tests/sqla_models_tests.py`
- [x] T008 [US1] Add focused failing processed/order-by consistency and Jinja-rendered `DATE_TRUNC` metric tests in `tests/unit_tests/models/helpers_test.py`
- [x] T009 [P] [US1] Add a failing PostgreSQL query-context execution regression using Superset's managed PostgreSQL fixture and PostgreSQL-only convention, including an assertion that the authoritative run does not skip, in `tests/integration_tests/query_context_tests.py`

### Implementation for User Story 1

- [x] T010 [US1] Implement the source-preserving token normalizer for recognized `DATE_TRUNC` first-argument literals and explicitly opt in `PostgresEngineSpec` in `superset/db_engine_specs/postgres.py`
- [x] T011 [US1] Implement one metric-only normalization entry point and atomically wire rendered saved, ad hoc, SELECT, processed/order-by, and Jinja metric paths through it exactly once in `superset/models/helpers.py` and `superset/connectors/sqla/models.py`
- [x] T012 [US1] Run the US1 focused unit, saved-metric, final-query, and managed-PostgreSQL suites and record exact passing commands and result comparisons in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`

**Checkpoint**: The reported PostgreSQL chart scenario works through a deterministic managed integration fixture without requiring a precomputed dataset column.

---

## Phase 4: User Story 2 - Preserve existing custom metric meaning (Priority: P2)

**Goal**: Narrow metric-only canonicalization does not change unrelated SQL, weaken safety validation, or restore the semantic rewrites removed by #36113.

**Independent Test**: Exercise unrelated literals, lookalike functions, dynamic or unknown units, comments, aggregates, malformed clauses, subqueries, and denylisted constructs at the final query boundary; only recognized units in actual `DATE_TRUNC` calls may change.

### Tests for User Story 2

- [x] T013 [P] [US2] Add failing non-overreach tests for unrelated `'QUARTER'` literals, lookalike functions, dynamic units, unknown units, genuinely different grains, and unaffected comments in `tests/unit_tests/db_engine_specs/test_postgres.py`
- [x] T014 [P] [US2] Add separate saved and ad hoc final-query tests for block, inline line, and trailing line comments that assert canonical `DATE_TRUNC`, safe embedding, preserved comment contents, and matching `GROUP BY` behavior in `tests/integration_tests/sqla_models_tests.py`
- [x] T015 [P] [US2] Add regression tests that malformed, subquery, disallowed-function, and disallowed-table ad hoc metrics remain rejected after normalization in `tests/unit_tests/models/helpers_test.py`

### Implementation for User Story 2

- [x] T016 [US2] Extend only the PostgreSQL/Redshift metric-specific normalization entry point with token-aware line-comment-to-block-comment safety while preserving comment contents and computational tokens in `superset/models/helpers.py`; do not change global `superset/sql/parse.py` behavior or identity-hook engines
- [x] T017 [US2] Run the final-query comment, sanitizer, helper, and PostgreSQL engine-spec regressions, including existing #36113 protections, and record passing commands in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`

**Checkpoint**: Existing custom metric meaning and validation remain intact, including comment-bearing metrics, with no cross-engine sanitizer behavior change.

---

## Phase 5: User Story 3 - Maintain behavior across affected databases (Priority: P3)

**Goal**: Redshift receives the same compatible final-query behavior while unrelated engines retain identity behavior and all affected time units are covered.

**Independent Test**: Compile the complete ticket chart query for Redshift and assert matching metric and `GROUP BY` expressions; exercise all eight direct units and composite PostgreSQL grains; confirm unaffected engines preserve input exactly.

### Tests for User Story 3

- [x] T018 [P] [US3] Add a failing Redshift test that compiles the complete ticket chart query and asserts compatible custom metric and `GROUP BY` unit literals in `tests/unit_tests/db_engine_specs/test_redshift.py`
- [x] T019 [US3] Parameterize the eight recognized units and composite PostgreSQL grains in `tests/unit_tests/db_engine_specs/test_postgres.py`, then add unaffected-engine identity cases in `tests/unit_tests/db_engine_specs/test_base.py`

### Implementation for User Story 3

- [x] T020 [US3] Explicitly opt `RedshiftEngineSpec` into the shared PostgreSQL `DATE_TRUNC` unit normalizer without enabling other `PostgresBaseEngineSpec` descendants in `superset/db_engine_specs/redshift.py`
- [x] T021 [US3] Run the complete PostgreSQL and Redshift engine-spec and final-query generation suites, then record Redshift compatibility evidence in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`

**Checkpoint**: PostgreSQL and Redshift generate structurally compatible complete queries for all affected units, and other engines remain unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate performance shape, the manual customer flow, typing, affected behavior, contract compliance, and repository quality gates.

- [x] T022 [P] Add a focused assertion that each rendered custom metric invokes the engine normalizer exactly once and performs no database calls in `tests/unit_tests/models/helpers_test.py`
- [x] T023 [P] Run MyPy and focused Python lint hooks for every changed backend file and record any intentional constraints in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`
- [x] T024 Execute the manual browser scenario against `public.orders` using the Docker PostgreSQL URI, verify Quarter and mixed-case inputs plus Month and `ROUND(AVG(amount), 4)` smoke cases, and record results in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`
- [x] T025 Verify the implementation against `specs/sc-112048-fix-date-trunc-grouping/contracts/query-expression-normalization.md`; correct implementation deviations and stop for explicit re-planning rather than weakening the contract if the approved contract is unsuitable
- [x] T026 Run the complete affected unit and integration matrix after all production paths are combined, require the managed PostgreSQL regression to execute rather than skip, and record the authoritative command or CI job in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`
- [x] T027 Stage only intended changes and run the mandatory `pre-commit run --all-files`, recording the final result in `specs/sc-112048-fix-date-trunc-grouping/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all story implementations.
- **User Story 1 (Phase 3)**: Depends on the foundational identity hook; all five tests precede the atomic implementation slice.
- **User Story 2 (Phase 4)**: Depends on the US1 metric-only entry point so it can lock down non-overreach and metric-scoped comment behavior.
- **User Story 3 (Phase 5)**: Depends on the US1 shared normalizer and can proceed in parallel with US2 after T011.
- **Polish (Phase 6)**: Depends on all selected story phases.

### User Story Dependencies

```text
Setup → Foundation → US1 tests (T005–T009) → US1 atomic implementation (T010–T011)
                                                    ├── US1 verification (T012)
                                                    ├── US2 protections (T013–T017)
                                                    └── US3 compatibility (T018–T021)
                                                                  ↓
                                                          Polish (T022–T027)
```

- **US1 (P1)**: First deliverable and prerequisite for shared metric normalization behavior.
- **US2 (P2)**: Uses the US1 metric entry point but remains independently testable through semantic, safety, and final-query comment regressions.
- **US3 (P3)**: Uses the US1 helper and remains independent of US2 because Redshift tests use comment-free metrics.

### Within Each User Story

- Write the listed tests and confirm they fail for the expected reason.
- Implement the narrowest behavior needed to pass them.
- Run the complete story-specific suite before crossing the checkpoint.
- Do not weaken an existing assertion or approved contract to make the implementation pass.

### Parallel Opportunities

- T005, T006, T007, and T009 can be written in parallel because they target different files; T008 follows T006 because both edit `helpers_test.py`.
- After T011, US2 test tasks T013–T015 can run in parallel with US3 test task T018.
- T013, T014, and T015 can run in parallel because they target different files.
- T019 follows T013 because both edit `test_postgres.py`.
- T022 and T023 can run in parallel after all story implementations stabilize; T024–T027 are sequential final gates.

## Parallel Examples

### User Story 1

```text
Task T005: PostgreSQL normalizer contract tests in tests/unit_tests/db_engine_specs/test_postgres.py
Task T006: Ad hoc final-query test in tests/unit_tests/models/helpers_test.py
Task T007: Saved metric test in tests/integration_tests/sqla_models_tests.py
Task T009: Managed PostgreSQL execution test in tests/integration_tests/query_context_tests.py
```

### User Story 2 and User Story 3 after the US1 core

```text
Track A: T013 + T014 + T015 → T016 → T017
Track B: T018 → T019 → T020 → T021
```

## Implementation Strategy

### MVP First

1. Complete T001–T004.
2. Write T005–T009 and confirm the expected failures.
3. Land T010–T011 as one atomic, disabled-until-complete implementation slice.
4. Complete T012 and stop to validate User Story 1 independently.
5. Do not push until US2 protections and mandatory final gates are complete.

### Incremental Delivery

1. **Foundation**: Identity hook establishes a safe extension seam.
2. **US1**: One atomic metric-only path makes the PostgreSQL quarter chart succeed.
3. **US2**: Safety and metric-scoped comment handling are locked down without changing the global sanitizer.
4. **US3**: Redshift and all affected unit cases are covered without broadening to unrelated engines.
5. **Polish**: Performance shape, manual validation, affected suites, contract review, typing, and full pre-commit complete the change.

## Notes

- `[P]` indicates tasks that can be executed concurrently without incomplete dependencies or same-file edits.
- User-story labels provide traceability to spec.md acceptance scenarios.
- No migration, API, frontend, documentation-site, global sanitizer, or public HTTP contract change is required.
- If metric-scoped comment handling cannot satisfy the contract without broader behavior, stop and update the plan before implementing it.
- Commit after each logical test-and-implementation group; treat T010–T011 as one atomic behavior slice.
