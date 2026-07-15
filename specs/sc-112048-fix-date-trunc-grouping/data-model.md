# Data Model: Preserve Equivalent Time-Grain Expressions

This change adds no persistent entities, tables, columns, migrations, or lifecycle state. The model below describes transient query-construction values.

## Custom Metric Expression

| Field | Meaning | Validation |
|---|---|---|
| source text | User-authored or saved SQL metric after template rendering | Must pass existing subquery, parser, and operator denylist checks |
| database engine | Engine responsible for compiling the chart query | Normalization is identity unless the engine explicitly opts in |
| metric kind | Saved SQL metric or ad hoc SQL metric | Both kinds must receive equivalent normalization |
| processed state | Whether the expression has already passed metric processing for reuse, such as ordering | Reuse must not produce a differently normalized expression |

## Time-Grain Unit Literal

| Field | Meaning | Validation |
|---|---|---|
| function | Actual `DATE_TRUNC` function call | Match case-insensitively; do not match lookalike names or text inside comments/strings |
| argument position | First function argument | Only a simple quoted string literal is eligible |
| unit value | Requested date part | Recognized values: second, minute, hour, day, week, month, quarter, year |
| canonical form | Unit spelling used by generated PostgreSQL/Redshift time grains | Lowercase |
| source span | Exact literal location in the rendered source expression | Replace only this span; retain all other source text |

## Relationships

- A chart query contains zero or more custom metrics.
- A custom metric may contain zero or more eligible time-grain unit literals.
- A custom metric is compiled under exactly one database engine specification.
- A grouped time expression and a custom metric expression are compatible when they reference the same column, function, and canonical time-unit literal.

## State Transitions

```text
ad hoc source
  → template-rendered source
  → metric-only narrow normalization
  → existing runtime safety validation
  → SQLAlchemy literal expression

saved source validated at persistence time
  → template-rendered source
  → metric-only narrow normalization
  → SQLAlchemy literal expression
  → chart SELECT / ORDER BY query construction
```

No transition may broaden permissions or convert an invalid expression into a valid one. Unrecognized or dynamic unit arguments remain unchanged and proceed to existing validation.
