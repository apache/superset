## What Happened

Repro steps (verified against current `master`):

1. Create a Pie chart on a dataset with a temporal column, leave the default
   "Time Range" filter untouched, save it, and add it to a dashboard.
2. On the dashboard, apply a Time Range filter and a Filter Value ("Value")
   native filter on a categorical column (e.g. `country`). Apply both.
3. Click the chart's title to open it in Explore. The dashboard's filters are
   merged into the Explore session; the inherited pills show a warning
   tooltip: "This filter was inherited from the dashboard's context. It
   won't be saved when saving the chart."
4. In Explore, edit the inherited Time Range pill to a different date range,
   click "Run query", then "Save" (overwrite).

Expected: the new time range is used for the query and is what gets
persisted to the chart's own `form_data` on save.

Actual: the query does pick up the new value (the live query is built
straight from `state.explore.form_data`, edits apply immediately), but the
value silently reverts once the chart is saved — the persisted chart keeps
either the value it had before the chart was ever opened from a dashboard,
or `"No filter"` if it had none. The user has no way to durably change a
time filter that arrived via dashboard context.

## Root Cause

`verified` (read source, traced the whole path, exercised it directly with
Jest against the real production modules — `getFormDataWithDashboardContext`,
`getControlsState`, `getSlicePayload` — and against the real chart-controls
mixin, not a rewritten stand-in).

Superset marks every adhoc filter that Explore inherits from a dashboard
with `isExtra: true` (`superset-frontend/src/explore/controlUtils/getFormDataWithDashboardContext.ts:98-101,149-152,180-186`).
At save time, `extractAdhocFiltersFromFormData`
(`superset-frontend/src/explore/actions/saveModalActions.ts:80-92`) strips
every `isExtra` filter out of the payload, and — specifically for a
`TEMPORAL_RANGE` filter — `getSlicePayload`
(`superset-frontend/src/explore/actions/saveModalActions.ts:110-154`,
introduced by #25877/#30581) then re-adds either the chart's pre-dashboard
value (from `formDataFromSlice`) or a hardcoded `"No filter"`. This is the
mechanism behind the tooltip's promise: an untouched inherited filter is not
saved.

The gap: nothing ever clears `isExtra` when the user deliberately edits that
same filter. `AdhocFilter.duplicateWith`
(`superset-frontend/src/explore/components/controls/FilterControl/AdhocFilter/index.ts:135-154`)
copies `isExtra: this.isExtra` into the new instance unless a caller
overrides it, and every edit handler in
`AdhocFilterEditPopoverSimpleTabContent`
(`superset-frontend/src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent/index.tsx`,
specifically `onSubjectChange:265-275`, `onOperatorChange:318-338`,
`onComparatorChange:340-347`, `clearOperator:348-355`, and
`onDatePickerChange:356-365` — the handler wired to the date-range picker
rendered inside the pill by `useDatePickerInAdhocFilter`) calls
`duplicateWith` without overriding `isExtra`. So a filter that arrived
`isExtra: true` from the dashboard is *still* `isExtra: true` after the user
edits it — it looks, to the save path, exactly like an untouched
dashboard-injected filter, and gets discarded and replaced by the stale
value the same way.

This was empirically confirmed with a Jest harness that ran the real
`getFormDataWithDashboardContext` → `AdhocFilter.duplicateWith` (simulating
the pill edit) → `getSlicePayload` pipeline end to end: the edited comparator
never reached the saved `params`.

A second, related filter class was checked and found to be **already
correctly handled** (`verified`): native "Value" filters on non-temporal
columns (e.g. the `country` filter in the original report) are tagged
`isExtra: true` via `mergeNativeFiltersToFormData`/`simpleFilterToAdhoc`
(`getFormDataWithDashboardContext.ts:112-172`, `src/utils/simpleFilterToAdhoc.ts:100-108`)
and correctly stripped by `extractAdhocFiltersFromFormData` when left
untouched — a Jest reproduction of the exact dashboard scenario (fresh Pie
chart, dashboard Time Range + `country` Value filter, save without touching
either pill) confirmed the saved payload contains neither filter. Git history
shows this half of the original 2022 report was fixed piecemeal by #22920,
#22984, #23239, and #25877/#30581 (all of which predate this ticket's most
recent activity). The remaining, still-open half is specifically "editing a
dashboard-inherited filter and expecting the edit to stick."

## Why It Wasn't Caught

`saveModalActions.test.ts` has dedicated coverage for the
strip-and-restore behavior of an *untouched* `isExtra` `TEMPORAL_RANGE`
filter (including the mixed-chart `adhoc_filters_b` case and the
save-as-new-chart case), but no test ever constructed the "user edited an
inherited filter" scenario — i.e. an `isExtra: true` filter whose comparator
no longer matches what a fresh dashboard merge would have produced. The
popover-level tests in `AdhocFilterEditPopoverSimpleTabContent.test.tsx`
asserted the *value* produced by each `onXChange` handler but never asserted
anything about `isExtra`, so nothing would fail when an edit preserved a
flag it should have cleared.

## The Fix

`superset-frontend/src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent/index.tsx`

Added `isExtra: false` to the `duplicateWith(...)` call in each of the five
handlers that represent the user deliberately changing a filter's
definition: `onSubjectChange`, `onOperatorChange` (both branches),
`onComparatorChange`, `clearOperator`, and `onDatePickerChange`. The moment
a user changes any part of an inherited filter, it stops being "the
dashboard's filter, not saved" and becomes the chart's own — exactly what
the "It won't be saved" tooltip implies is still up to the user to opt out
of by leaving the pill alone.

Before (excerpt, `onDatePickerChange`):
```ts
const onDatePickerChange = (columnName: string, timeRange: string) => {
  props.onChange(
    props.adhocFilter.duplicateWith({
      subject: columnName,
      operator: Operators.TemporalRange,
      comparator: timeRange,
      expressionType: ExpressionTypes.Simple,
    }),
  );
};
```

After:
```ts
const onDatePickerChange = (columnName: string, timeRange: string) => {
  props.onChange(
    props.adhocFilter.duplicateWith({
      subject: columnName,
      operator: Operators.TemporalRange,
      comparator: timeRange,
      expressionType: ExpressionTypes.Simple,
      isExtra: false,
    }),
  );
};
```

No changes were needed in `saveModalActions.ts` — the existing
strip/restore logic is correct for the "untouched" case and, once `isExtra`
is cleared on edit, correctly treats an edited filter as the chart's own
without any further change.

## Latent Bugs Found

- `AdhocFilterEditPopoverSqlTabContent`'s `onSqlExpressionClauseChange` /
  `onSqlExpressionChange` (`superset-frontend/src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSqlTabContent/index.tsx:60-76`)
  have the identical gap for the Custom SQL tab: editing a dashboard-inherited
  filter's SQL expression does not clear `isExtra` either. Not fixed here
  because the reported symptom and repro are specifically about the
  Simple-tab date picker / value editors; the Custom SQL path is a separate,
  lower-traffic surface with its own test file and deserves its own guard.
- `AdhocFilterEditPopover`'s deck.gl `layerFilterScope` correction
  (`superset-frontend/src/explore/components/controls/FilterControl/AdhocFilterEditPopover/index.tsx:269-274`)
  also calls `duplicateWith` without touching `isExtra`; left alone since it
  fires on every save regardless of whether the user changed anything
  filter-related, and forcing `isExtra: false` there would be overly broad.
- While tracing this, a separate asymmetry was found and ruled out as
  unrelated to the reported repro: the classic scalar `time_range` /
  `granularity` / `time_grain` / `time_column` / `time_compare` /
  `visible_deckgl_layers` fields (`EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS`,
  `superset-frontend/packages/superset-ui-core/src/query/constants.ts:42-53`)
  are copied from dashboard context straight onto the same top-level
  `form_data` keys a chart's own control would use, with no `isExtra`-style
  marker at all. For chart types whose "Time Range" is this classic scalar
  control rather than an embedded `TEMPORAL_RANGE` adhoc filter, a dashboard
  time override could persist to the chart's own saved config even without
  any edit. This is `inferred`, not `verified` end-to-end (it would require
  a chart type that still uses the legacy scalar `time_range` control control
  panel entry, which none of the currently-registered plugins do), and is
  out of scope for this fix — flagging for anyone touching that mapping.

## Prevention

Add `isExtra` assertions to the existing "edit a filter" test suites
(`AdhocFilterEditPopoverSimpleTabContent.test.tsx`,
`AdhocFilterEditPopoverSqlTabContent.test.tsx`) whenever a new edit handler
is introduced, so a future handler that forgets to clear `isExtra` fails
immediately rather than only surfacing as a "my dashboard filter got saved /
didn't save" report. The two guard tests added here
(`editing a dashboard-inherited time range filter clears isExtra...` and
`editing a dashboard-inherited filter comparator clears isExtra...`) cover
the Simple tab; the Custom SQL tab noted above still lacks equivalent
coverage.
