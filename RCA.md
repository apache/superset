## What Happened

In SQL Lab, a query run in a new/second tab can display "Running" or
"Scheduled" in the Query History panel forever, even though the query has
long since finished and the Results pane / Redux store correctly show it as
succeeded (or failed). (verified — reproduced via the regression guard added
in this branch)

## Root Cause

`QueryHistory` (`superset-frontend/src/SqlLab/components/QueryHistory/index.tsx:85-103`)
merges two sources of truth for the query list of a tab:

- the live Redux `sqlLab.queries` slice, which `QueryAutoRefresh` keeps
  correctly up to date as a query transitions `running -> success`/`failed`
  (verified), and
- a one-shot snapshot fetched from the `useEditorQueriesQuery` RTK Query
  endpoint (`superset-frontend/src/hooks/apiResources/queries.ts:112-176`).

The merge `useMemo` computes, for any query id that appears in the backend
snapshot, `omit(liveQueries, snapshotIds).concat(snapshotResult)` — i.e. it
drops the live Redux copy for that id and renders the snapshot row instead
(verified, `index.tsx:88-95`). Because `editorQueries` (the query-history RTK
API slice, tag `EditorQueries`) is never invalidated anywhere in the codebase
— no mutation, action, or component calls `invalidateTags(['EditorQueries'])`,
and the endpoint has no `pollingInterval`, `refetchOnFocus`, or
`refetchOnMountOrArgChange` (verified, `queries.ts:110-175`) — the snapshot is
fetched exactly once when the tab/editor mounts and is cached by RTK Query for
the lifetime of that cache entry. Whatever status the backend happened to
report at that single GET is what renders in the State/Progress/Rows columns
for as long as the tab stays open, regardless of what Redux says afterward.

`QueryTable` (`superset-frontend/src/SqlLab/components/QueryTable/index.tsx:264`)
maps the (now-frozen) status to a label: `running` -> "Running", and both
`pending` and `scheduled` -> "Scheduled" (verified, `index.tsx:185-239`),
which is exactly the reported symptom.

This is most visible on a **new tab** because a freshly opened SQL Lab tab is
the case most likely to mount `QueryHistory` (and therefore fire the one-shot
snapshot fetch) at almost the same moment a query is started, maximizing the
odds that the snapshot is captured while the query is still `running`/
`pending`/`scheduled` before it ever gets a second chance to refresh
(inferred — consistent with the "stuck on new tab" framing of the symptom,
not independently reproduced against the mount-timing race itself).

## Why It Wasn't Caught

- The existing tests in `QueryHistory.test.tsx` only exercise the case where
  the backend snapshot and Redux state agree (same `client_id`, same
  `status`, same `rows`) or where they cover disjoint ids. None of them seed
  Redux with a *live, more-current* copy of a row that also appears in the
  mocked backend snapshot, which is the only shape that exposes this bug
  (verified — read the full pre-existing test file before adding the new
  test).
- `apache/superset#42896` fixed the Redux reducer to correctly allow a
  `Running -> Success` transition, which fixed the underlying Redux state.
  That fix is real and necessary, but it doesn't help here because
  `QueryHistory` doesn't render Redux state for any id the backend snapshot
  also mentions — it renders the snapshot's copy instead (verified).
- There is no integration/e2e test that opens a new tab, starts a query, and
  asserts the History panel status transitions all the way to a terminal
  state (inferred — no such test was found in the areas searched).

## The Fix

Not applied in this branch (see PR description / Critical boundary note).
Intended production change, to be made in a follow-up PR: in
`superset-frontend/src/SqlLab/components/QueryHistory/index.tsx`, the merge
should let the live Redux copy win over the backend snapshot for any id
present in both, e.g. build the merged list from
`data.result` overlaid with `queries` (live wins) rather than
`omit(queries, snapshotIds).concat(data.result)` (snapshot wins). The
`editorId`/`status` fields also need to come from Redux when a live entry
exists, not just `rows`/`progress`, since the State and Progress columns
render from the same merged object.

## Latent Bugs Found

The RCA panel identified the following issues while investigating this bug.
All are deliberately out of scope for this change and are recorded here for
future follow-up:

- `superset-frontend/src/hooks/apiResources/queries.ts` — the `merge`
  function (`currentCache.result.push(...newItems.result)`) always appends
  rather than replacing/de-duplicating by id. A refetch of a page whose
  underlying rows have changed (e.g. pagination re-fetch racing a mutation)
  would duplicate rows in the RTK Query cache rather than reconcile them.
- `superset-frontend/src/SqlLab/components/QueryHistory/index.tsx` — `pageIndex`
  state is not reset when `editorId` changes, so switching tabs after having
  scrolled to page N+1 on the previous tab carries the stale page index into
  the new tab's query.
- `superset-frontend/src/SqlLab/components/EditorAutoSync/index.tsx` — the
  periodic (5s) save timer that POSTs to `/tabstateview/` has no in-flight
  guard; a slow response can let a second save fire before the first
  resolves, creating a duplicate TabState.
- `superset-frontend/src/SqlLab/reducers/sqlLab.ts:119` — the
  `CLONE_QUERY_TO_NEW_TAB` reducer case handler is unreachable dead code: the
  corresponding thunk in `actions/sqlLab.ts` has drifted and no longer
  dispatches that action type, so the reducer branch never executes.
- `superset-frontend/src/SqlLab/components/QueryTable/index.tsx:335,340` —
  `progress.toFixed(0)` is called unguarded; a `null`/`undefined` `progress`
  value (as can occur on some query states) will throw.
- `syncQueryEditor` snapshots `queriesToMigrate` before awaiting the
  `POST /tabstateview/` call, so a query started inside that async window is
  never migrated. This is narrow and out of scope for the bug fixed here
  (`EditorAutoSync`'s save timer fires roughly every 5s, well after
  `autorun` would have started a query), but is a real, separate race.

## Prevention

- The added regression guard
  (`superset-frontend/src/SqlLab/components/QueryHistory/QueryHistory.test.tsx`)
  seeds Redux with a live, terminal-state copy of a query whose id also
  appears in a mocked in-flight backend snapshot, and asserts the live value
  renders. This is the minimal repro shape that would have caught this bug
  and will catch any regression of the same kind.
- Once the production fix lands, add an assertion (or a follow-up test) that
  the merged list also carries over the live `status`/`state`, not just
  `rows`, since a fix that only reconciles one field could reintroduce the
  same class of bug for the State/Progress columns.
- Consider invalidating the `EditorQueries` RTK Query tag whenever a query's
  Redux state reaches a terminal status, so the backend snapshot itself
  self-heals instead of relying solely on the client-side merge to paper over
  a stale cache entry.
