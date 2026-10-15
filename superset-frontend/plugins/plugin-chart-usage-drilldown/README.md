# @superset-ui/plugin-chart-usage-drilldown

A Superset table chart that drills through a hierarchy of columns, for example
**Project → Workflow → API**. It shows one level at a time; clicking a row opens
the next level and a breadcrumb leads back up. Each row shows the metric, its
share of the current level (with a bar), and the number of child rows.

On the last level, rows can also show a badge (e.g. HTTP method), a sub-line
(e.g. system and endpoint path) and an average duration.

## Controls

| Control | Purpose |
| --- | --- |
| Drilldown levels (`groupby`) | Columns to drill through, in order |
| Metric (`metric`) | Value per row, e.g. `SUM(api_calls)` |
| Detail link column (`link_column`) | Optional URL or `<a href>` column; a "View detail" link is shown where a row maps to one link |
| Badge column (`badge_column`) | Optional badge on last-level rows |
| Sub-line columns (`subtitle_columns`) | Optional columns shown under last-level names |
| Duration column (`duration_column`) | Optional duration in ms; last-level rows show the average over runs that recorded one, in seconds |
| Title prefix (`title_prefix`) | Heading prefix, default "Usage by" |

Add `drilldown_from=<level>` to the dashboard URL (column name or label, e.g.
`workflow`) to start at that level; the embedded SDK passes it through
`dashboardUiConfig.urlParams`. Use it when the page is already scoped to one
value of the levels above.

The chart runs one query at the deepest level and aggregates upwards in the
browser, so drilling does not re-query the database.

## Usage Summary chart

The package also contains **Usage Summary** (`usage_summary`): a KPI card with
the total for the selected time range, one bar per day (or per few days), the
first and last date, and the From/To period. The range label and From/To show
the time filter's exact bounds, so "Last 3 hours" reads as 3 hours; ranges of
2 days or less get one bar per hour. Viewers switch the daily bucket size with
the toggle (e.g. 1d / 3d); the chart fetches hourly totals once and groups
them in the browser. Hovering a bar highlights it and shows its dates, value
and share of the period.

| Control | Purpose |
| --- | --- |
| Time column (`x_axis`) | Temporal column to bucket by day |
| Metric (`metric`) | Value per day, e.g. `SUM(api_calls)` |
| Filters (`adhoc_filters`) | Set the time range here, e.g. "Last week" |
| Header (`header`) | Label above the total; defaults to the metric name |
| Bucket sizes (`bucket_sizes`) | Toggle options in days, default `1, 3, 7`; the chart starts with the smallest size that gives at most 60 bars. Hidden for hourly ranges |
| Value unit (`value_unit`) | Word after the value in the bar tooltip, default `calls` |
| Bar color (`color_picker`) | Bar colour |
| Success / Failed metric (`success_metric`, `failed_metric`) | Optional; set both to show the status panel: each total with its share of the consumed total, and a strip of 50 bars (2% each) |
| Success / Failed color (`success_color`, `failed_color`) | Dot, pill and strip colours of the status panel |

The total is the sum of the daily values, so use an additive metric (SUM,
COUNT). Hours and days are bucketed and labelled in UTC.

## Registration

Registered in `superset-frontend/src/visualizations/presets/MainPreset.ts`:

```ts
import {
  UsageDrilldownChartPlugin,
  USAGE_DRILLDOWN_VIZ_TYPE,
  UsageSummaryChartPlugin,
  USAGE_SUMMARY_VIZ_TYPE,
} from '@superset-ui/plugin-chart-usage-drilldown';

new UsageDrilldownChartPlugin().configure({ key: USAGE_DRILLDOWN_VIZ_TYPE });
new UsageSummaryChartPlugin().configure({ key: USAGE_SUMMARY_VIZ_TYPE });
```

## Embedded dashboards

Guest-token users may only run a chart's saved query. Save the chart from
Explore (which stores its query context) after changing its controls.
