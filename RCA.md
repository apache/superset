# RCA: Custom SQL metric reported as a non-existent saved metric

Every causal claim below is labelled `verified` (executed, or the full code path
read end to end) or `inferred` (reasoned but not observed).

## What Happened

A Sankey chart is configured against a dataset with a Custom SQL metric whose
expression is `count(DISTINCT product_line)`. The dataset is edited to add a
calculated column and saved. Subsequent chart data requests fail with:

```
Metric 'count(DISTINCT product_line)' does not exist
```

The string in the message is the metric's SQL expression, not a metric name.
The message has exactly two call sites, both in `superset/models/helpers.py`:
`:4087` for the `metrics` list and `:3432` for `series_limit_metric`. Both
resolve a `str` against the dataset's saved metrics and raise when it misses.
There is a single matching user-facing string in
`superset/translations/en/LC_MESSAGES/messages.po:8218` (`verified`).

The analysis below traces the `:4087` (`metrics`) path. The `:3432` path is
reachable the same way whenever a chart sorts by an ad-hoc metric (`inferred`).

## Root Cause

### The sink: a malformed ad-hoc metric is silently reread as a saved metric name

`verified` — reproduced by executing the real request-deserialization path and
the real query builder; see `tests/unit_tests/charts/data/malformed_adhoc_metric_test.py`.

`QueryObject._set_metrics` (`superset/common/query_object.py:192-203`) supports
three metric shapes, one of which is the legacy `{"label": "saved_metric_name"}`
reference to a metric saved on the dataset:

```python
def is_str_or_adhoc(metric: Metric) -> bool:
    return isinstance(metric, str) or is_adhoc_metric(metric)

self.metrics = metrics and [
    x if is_str_or_adhoc(x) else x["label"]  # type: ignore
    for x in metrics
]
```

`is_adhoc_metric` (`superset/utils/core.py:1312-1313`) classifies a metric
solely by the presence of one key:

```python
def is_adhoc_metric(metric: Metric) -> TypeGuard[AdhocMetric]:
    return isinstance(metric, dict) and "expressionType" in metric
```

So any metric `dict` carrying a `label` but no `expressionType` — including a
fully-formed Custom SQL definition that has `sqlExpression`, `optionName` and
`hasCustomLabel` — is collapsed to its `label`. Explore auto-derives a Custom
SQL metric's label from its SQL text, so the ad-hoc definition becomes the bare
string `"count(DISTINCT product_line)"`, indistinguishable from a request for a
saved metric of that name.

Metric resolution (`superset/models/helpers.py:4069-4088`) then looks the string
up in `metrics_by_name` (the dataset's saved metrics), misses, and raises at
`:4087` with the string echoed back as a metric name.

Nothing rejects the shape earlier. `ChartDataAdhocMetricSchema` declares
`expressionType` as `required=True` (`superset/charts/schemas.py:419-423`), but
`ChartDataQueryObjectSchema.metrics` is `fields.List(fields.Raw())`
(`superset/charts/schemas.py:1289-1298`), so that contract is never applied at
the API boundary (`verified` — a payload carrying the malformed metric
deserializes without error and yields `['count(DISTINCT product_line)']`).

This mechanism is not Sankey-specific. Any chart type carrying a Custom SQL
metric is exposed to it (`verified` — the coercion is in shared query-object
construction, with no viz-type branch).

### The producer: unresolved

`inferred` — the sink requires an inbound metric object that lacks
`expressionType`. What omits that key between the dataset save and the failing
request was **not identified**. The following were eliminated:

| Candidate | Evidence | Label |
| --- | --- | --- |
| `getControlValuesCompatibleWithDatasource` drops the key on datasource change (`superset-frontend/src/explore/controlUtils/getControlValuesCompatibleWithDatasource.ts:86-89`) | A Custom SQL metric short-circuits on `isAdhocMetricSQL(value)`, gets `datasourceWarning: true` assigned, and is returned unchanged. The repo's own test `getControlValuesCompatibleWithDatasource.test.ts:199-217` asserts `expressionType` survives. | `verified` |
| `ControlPanelsContainer` rebuilds the metric when clearing `datasourceWarning` (`superset-frontend/src/explore/components/ControlPanelsContainer.tsx:373-388`, `{ ...value, datasourceWarning: false }`) | Executed the spread against an `AdhocMetric` instance: own enumerable keys are `aggregate,column,expressionType,hasCustomLabel,label,optionName,sqlExpression`; `expressionType` is preserved. | `verified` |
| `AdhocMetric` can emit an object without the key (`superset-frontend/src/explore/components/controls/MetricControl/AdhocMetric.ts:101`) | Constructed one from an object with `expressionType` removed; the constructor defaults it to `SIMPLE`. It is never absent on the way out. | `verified` |
| Stale `SqlaTable` memoization; a stale metric/column allowlist; a naming collision with the new calculated column; a stale Explore `datasource` payload (`DatasourceModal` re-fetches after save); Sankey-specific code | Read out by the prior analysis; no such caching, allowlist, or viz-type branch exists. | `inferred` |
| Any frontend writer of `form_data.metric` that omits the key | Two independent sweeps of `superset-frontend/{src,packages,plugins}` found none. | `inferred` |

A backend-only reproduction cannot settle this: the chart data request is built
client-side from Redux `form_data` and POSTed verbatim; the backend deserializes
it and does not rebuild it (`verified` — the only backend reader of a stored
`query_context` is `SqlaTable._extract_query_context_columns`,
`superset/connectors/sqla/models.py:569-652`, which is read-only column
accounting).

Consequence for scoping: hardening the sink converts a misleading error into an
actionable one, but is **not** established to restore rendering on its own. If
the reported flow still fails after the sink fix, the remaining work is to
capture the actual `/api/v1/chart/data` request body from a live browser session
immediately after a dataset save and confirm whether `expressionType` is absent
on the wire.

## Why It Wasn't Caught

`verified`. `_set_metrics`' fallback branch is covered only in its
success direction: `tests/unit_tests/common/test_query_object_factory.py:124-140`
(`test_query_context_metric_names`) asserts that `{"label": "sum__num"}`
collapses to `"sum__num"`. No test asserts what the branch must *not* swallow, so
a dict carrying unmistakable ad-hoc markers (`sqlExpression`, `aggregate`,
`column`) falls into the legacy path unchallenged.

The API boundary has the same shape of gap: `ChartDataAdhocMetricSchema` exists
and declares its required fields, but because `metrics` is `fields.Raw()` the
schema is never exercised against a real payload, so no test could have failed
when the contract stopped being enforced.

## The Fix

**Not applied in this commit.** The committed change is the regression guard
only; `test_adhoc_metric_without_expression_type_is_not_read_as_a_saved_metric`
is red until the fix lands.

The legacy `{"label": ...}` shape is live and test-covered (see above), so the
coercion cannot simply be removed — it must be narrowed. The discriminator is
that a legacy reference carries *only* a label, whereas a malformed ad-hoc
metric also carries keys that only ever appear on an ad-hoc definition.

`superset/common/query_object.py:192-203`

Before:

```python
def is_str_or_adhoc(metric: Metric) -> bool:
    return isinstance(metric, str) or is_adhoc_metric(metric)

self.metrics = metrics and [
    x if is_str_or_adhoc(x) else x["label"]  # type: ignore
    for x in metrics
]
```

After (sketch):

```python
# Keys that only ever appear on an ad-hoc definition. A dict carrying any of
# them but no `expressionType` is a malformed ad-hoc metric, not a legacy
# `{"label": ...}` reference to a metric saved on the dataset.
ADHOC_ONLY_KEYS = {"sqlExpression", "aggregate", "column"}

def normalize(metric: Metric) -> Metric:
    if isinstance(metric, str) or is_adhoc_metric(metric):
        return metric
    if ADHOC_ONLY_KEYS & metric.keys():
        raise QueryObjectValidationError(
            _(
                "Invalid ad-hoc metric %(label)s: `expressionType` is missing",
                label=metric.get("label"),
            )
        )
    return metric["label"]

self.metrics = metrics and [normalize(x) for x in metrics]
```

Optionally also enforce the declared contract at the boundary by replacing
`fields.Raw()` in `ChartDataQueryObjectSchema.metrics`
(`superset/charts/schemas.py:1289-1298`) with a field that validates dict
entries against `ChartDataAdhocMetricSchema`. That yields a 400 with a precise
message instead of a query-time error, and makes the existing schema meaningful.

## Latent Bugs Found

Carried forward unchanged from the prior analysis; not re-verified here and out
of scope for this change.

- Test-coverage gap at `tests/integration_tests/model_tests.py:619`.
- `superset/superset_typing.py` — the `AdhocMetric` TypedDict and the accepted
  wire format disagree about which fields are required.
- Several frontend control bugs; details recorded in the analysis manifest.

## Prevention

- Classify metrics by intent rather than by the presence of a single key. Any
  branch that decides "ad-hoc vs. saved-metric reference" should reject shapes
  that match neither instead of falling through to a lossy default.
- When a schema is declared for a payload element (`ChartDataAdhocMetricSchema`),
  wire it into the parent field. A `fields.Raw()` list silently voids every
  constraint declared on the element schema.
- Cover permissive compatibility branches in both directions: a test for what
  the branch accepts, and a test for what it must refuse.
- Error messages that interpolate a user-supplied value should make the value's
  role explicit, so that a coerced SQL expression cannot read as a metric name.
