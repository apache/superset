# Feature Specification: Preserve Equivalent Time-Grain Expressions

**Feature Branch**: `sc-112048-fix-date-trunc-grouping`
**Created**: 2026-07-15
**Status**: Draft
**Input**: Shortcut story [SC-112048](https://app.shortcut.com/preset/story/112048) — Charts on Redshift/PostgreSQL fail with GroupingError when CASE WHEN metric references DATE_TRUNC expression used in GROUP BY

## Clarifications

### Session 2026-07-15

- Q: Must custom SQL remain textually identical, or is preserving its computational meaning sufficient? → A: Preserve computational meaning; harmless formatting may change.
- Q: What database validation is required for this fix? → A: Live PostgreSQL chart validation plus Redshift-compatible query-generation coverage; a live Redshift service is not required.
- Q: How broadly must time grains be exercised? → A: Validate quarter end to end and use focused regression coverage for other time-unit literals affected by the same behavior.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Render a chart with a matching time-grain metric (Priority: P1)

As a chart author, I can use the chart's selected time grain inside a custom conditional metric and render the chart without a grouping error when the grouped time expression and metric expression differ only in the letter casing of a supported `DATE_TRUNC` unit literal.

**Why this priority**: This is the reported customer failure. It prevents an otherwise valid time-series chart from rendering even though the equivalent query succeeds when run directly.

**Independent Test**: Create a time-series chart on a PostgreSQL-compatible database, select a quarterly time grain, add a custom conditional metric that compares the same date column at quarterly grain, and verify that the chart renders with the expected grouped results.

**Acceptance Scenarios**:

1. **Given** a time-series chart grouped by quarter, **When** a custom metric compares that same quarterly date expression using a differently cased time-unit literal, **Then** the chart query executes successfully and the chart renders.
2. **Given** an equivalent chart query that succeeds when run directly, **When** the chart executes it through the chart workflow, **Then** the chart workflow preserves the equivalence needed by the database's grouping rules.
3. **Given** a custom metric containing aggregate calculations within conditional branches, **When** its time-grain expression matches the chart grouping semantically, **Then** the metric returns the expected values for each grouped period.

---

### User Story 2 - Preserve existing custom metric meaning (Priority: P2)

As a chart author, I can continue using custom metrics that do not depend on the grouped time expression without their meaning or results changing.

**Why this priority**: Correcting the regression must not introduce new query failures or silently change existing chart results.

**Independent Test**: Run representative custom metrics with aggregates, conditional expressions, comments, and database-specific syntax before and after the change and confirm that accepted metrics retain equivalent results while unsafe expressions remain rejected.

**Acceptance Scenarios**:

1. **Given** an existing valid custom metric unrelated to the chart's time grain, **When** the chart executes, **Then** its results remain equivalent to the results before this fix even if harmless formatting changes.
2. **Given** a custom metric that fails existing safety validation, **When** the user attempts to run it, **Then** the metric remains rejected.
3. **Given** a custom metric containing comments, **When** it is validated for chart use, **Then** removing or handling those comments does not change the metric's computational meaning.

---

### User Story 3 - Maintain behavior across affected databases (Priority: P3)

As an operator supporting multiple database types, I can expect equivalent grouped time expressions to behave consistently on PostgreSQL and Redshift without regressing charts on other supported databases.

**Why this priority**: The known customer impact is on PostgreSQL-compatible databases, but custom metric validation is shared behavior and therefore requires compatibility protection.

**Independent Test**: Exercise the complete chart flow against PostgreSQL, verify Redshift-compatible query generation for the same chart definition, then run the existing cross-database custom metric and time-grain regression suite.

**Acceptance Scenarios**:

1. **Given** the reported chart definition, **When** it runs against PostgreSQL, **Then** the database accepts the grouping and the chart renders.
2. **Given** the same chart definition targets Redshift, **When** its query is generated, **Then** the grouped time expression and custom metric remain compatible with Redshift grouping rules without requiring a live Redshift validation service.
3. **Given** a supported database with different time-grain syntax, **When** an existing valid time-series chart runs, **Then** its generated query remains valid and its results remain unchanged.

### Edge Cases

- The metric uses uppercase, lowercase, or mixed-case spelling for the same supported time unit.
- The chart uses a time grain other than quarter, including grains whose database representation differs across supported databases.
- The custom metric references a date expression that is not semantically the same as the chart's grouped time expression; the system must not falsely treat it as grouped.
- The chart uses no time grain, or the metric contains no grouped time expression.
- The custom metric contains comments, nested conditional expressions, multiple aggregates, or database-specific syntax.
- The metric is invalid or unsafe under existing validation rules; correcting expression preservation must not bypass those rules.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a chart to execute when its custom metric and grouped `DATE_TRUNC` expression differ only in the letter casing of a supported time-unit literal.
- **FR-002**: The system MUST canonicalize supported custom-metric time-unit literals to the form used by PostgreSQL and Redshift generated time-grain expressions.
- **FR-003**: The system MUST support the reported combination of a quarterly time-series grouping and a conditional aggregate metric referencing that quarterly expression.
- **FR-004**: The system MUST preserve the computational meaning of valid custom metrics while validating them for chart execution; exact textual preservation is not required when formatting changes do not affect meaning.
- **FR-005**: The system MUST continue to enforce all existing safety restrictions applied to custom metric expressions.
- **FR-006**: The system MUST avoid changing query behavior for charts whose custom metrics do not reference the grouped time expression.
- **FR-007**: The system MUST preserve valid behavior for time grains beyond quarter that pass through the same time-unit normalization behavior; these grains require focused regression coverage rather than separate end-to-end chart scenarios.
- **FR-008**: The system MUST preserve valid chart behavior across supported database types, including database-specific time-grain representations.
- **FR-009**: The system MUST produce chart results consistent with direct execution of the equivalent valid query for the reported scenario.
- **FR-010**: Regression coverage MUST distinguish semantic expression changes from harmless presentation-only formatting changes.

### Key Entities

- **Chart query**: The complete analytical request generated from a chart's dimensions, time grain, metrics, and filters.
- **Grouped time expression**: The date or timestamp expression that assigns source rows to the chart's selected time periods.
- **Custom metric**: A user-defined calculation that may contain conditional logic, aggregate calculations, and references to grouped expressions.
- **Validated metric expression**: The custom metric after safety checks, which must retain the original computational meaning.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The reported quarterly chart scenario renders successfully in PostgreSQL end-to-end validation, and its Redshift-compatible generated query passes grouping regression validation, in 100% of regression runs.
- **SC-002**: The chart output for the reported scenario matches direct execution of the equivalent query for every returned time period and metric value.
- **SC-003**: All existing custom metric safety and cross-database query tests continue to pass without changed expected results.
- **SC-004**: The quarterly scenario passes end-to-end chart validation, and focused tests for every other time-unit literal affected by the same normalization behavior complete without a grouping mismatch.
- **SC-005**: A chart author can reproduce the original chart configuration and obtain a rendered result on the first execution without creating a precomputed dataset column as a workaround.

## Assumptions

- The chart's grouped time expression and the expression inside the custom metric are intended to be treated as equivalent when they differ only in presentation, such as the letter casing of a time-unit literal.
- Expressions that are genuinely different must continue to follow the database's normal grouping rules and may still be rejected.
- Existing custom metric safety validation remains required and is not relaxed by this change.
- The reported PostgreSQL and Redshift behavior represents the primary acceptance target; shared behavior must remain compatible with other supported databases.
- A live PostgreSQL fixture is available for end-to-end chart validation; Redshift compatibility can be verified from generated query behavior without access to a live Redshift service.
- Precomputing the time-grain expression in a virtual dataset remains a workaround, but users should not need that workaround for semantically equivalent expressions.
