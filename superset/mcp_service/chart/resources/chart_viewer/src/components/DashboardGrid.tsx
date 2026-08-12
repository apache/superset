/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * A dashboard rendered as a composite visualization: a layout tree whose
 * leaves are ordinary charts, drawn with the SAME renderers a single chart
 * uses.
 *
 * Deliberately static. No native filters, no cross-filters, no shared
 * selection — composition and the interaction graph are separate capabilities
 * and only the first is prototyped here.
 *
 * Every cell renders something. A leaf with no data becomes a labelled
 * placeholder rather than a gap: a partial composite that silently omits cells
 * looks like a complete one, which is the failure mode most likely to make
 * this read as broken.
 */
import { useMemo, useState, type JSX } from 'react';
import type { DashboardCell, DashboardRender, ViewType } from '../types';
import type { ThemeTokens } from '../theme';
import {
  chartDataToEChartsOption,
  defaultViewForChartType,
  isEChartsView,
  isSubstitutedView,
} from '../adapter';
import { EChart } from './EChart';
import { BigNumber } from './BigNumber';
import { DataTable } from './DataTable';
import { stripUntrustedMarkers } from '../format';

function CellBody({
  cell,
  theme,
}: {
  cell: DashboardCell;
  theme: ThemeTokens;
}): JSX.Element {
  const data = cell.data ?? null;

  const view: ViewType | null = useMemo(
    () => (data ? defaultViewForChartType(data.chart_type, data) : null),
    [data],
  );

  if (!data || !view) {
    return (
      <div className="sv-cell-placeholder">
        <span className="sv-cell-placeholder-icon" aria-hidden="true">
          {cell.status === 'error' ? '!' : '—'}
        </span>
        <span>
          {stripUntrustedMarkers(cell.message ?? 'No data for this chart.')}
        </span>
      </div>
    );
  }

  // Same dispatch as the single-chart view (App.tsx), so a cell renders
  // exactly as it would on its own.
  if (view === 'big_number') return <BigNumber data={data} theme={theme} />;
  if (view === 'table' || !isEChartsView(view)) {
    return <DataTable data={data} />;
  }
  return (
    <EChart
      option={chartDataToEChartsOption(data, view, { theme })}
      scheme={theme.scheme}
    />
  );
}

/**
 * Says so when a cell is NOT the chart Superset draws.
 *
 * Without this the cell carries the real title and the real numbers in a
 * different encoding, which reads as a faithful reproduction. A treemap shown
 * as a bar chart is a wrong answer that looks right, and nothing else on
 * screen contradicts it.
 */
function SubstitutionNote({ cell }: { cell: DashboardCell }): JSX.Element | null {
  const data = cell.data;
  if (!data) return null;
  const view = defaultViewForChartType(data.chart_type, data);
  const native = isSubstitutedView(data.chart_type, view);
  if (!native) return null;
  return (
    <div className="sv-substitution">
      Shown as a {view} chart — Superset renders this as a {native}.
    </div>
  );
}

export function DashboardGrid({
  render,
  theme,
}: {
  render: DashboardRender;
  theme: ThemeTokens;
}): JSX.Element {
  // Tabs are presentational here: cells carry their tab id, so switching tabs
  // filters what is shown without re-querying anything.
  const tabs = render.tabs ?? [];

  // Counts only cells that actually have data. A tab full of `skipped`
  // placeholders is empty as far as the user is concerned — opening on one
  // shows a screen of "not queried" messages, which is the same symptom as
  // opening on a tab with no cells at all.
  const countFor = (id: string): number =>
    render.cells.filter((c) => c.tab_id === id && c.status === 'ok').length;

  /** Cells present at all, drawable or not — for "did we filter this out?" */
  const cellsIn = (id: string): number =>
    render.cells.filter((c) => c.tab_id === id).length;

  // Opening tab: the one that was explicitly requested, else the first tab
  // that actually HAS cells.
  //
  // Selecting tabs[0] blindly opened a guaranteed-empty tab whenever the
  // render was filtered to a different one — the full tab list is still
  // returned (correctly, so the user can switch), so tabs[0] can hold nothing.
  // "First non-empty" also covers an unfiltered dashboard whose first tab is
  // genuinely empty.
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    if (!tabs.length) return null;
    const requested = render.active_tab_id;
    if (requested && tabs.some((t) => t.id === requested)) return requested;
    return (tabs.find((t) => countFor(t.id) > 0) ?? tabs[0]).id;
  });

  const cells = activeTab
    ? render.cells.filter((c) => c.tab_id === activeTab)
    : render.cells;

  return (
    <div className="sv-dash">
      {tabs.length > 1 && (
        <div className="sv-dash-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === activeTab}
              className={`sv-chip${t.id === activeTab ? ' sv-chip--on' : ''}${
                countFor(t.id) === 0 ? ' sv-chip--empty' : ''
              }`}
              onClick={() => setActiveTab(t.id)}
              title={
                countFor(t.id) > 0
                  ? undefined
                  : cellsIn(t.id) > 0
                    ? 'Charts here were not queried — raise max_charts'
                    : 'Not included in this render'
              }
            >
              {stripUntrustedMarkers(t.name ?? 'Tab')}
            </button>
          ))}
        </div>
      )}
      <div className="sv-dash-grid">
        {cells.map((cell, i) => (
          <div
            className={`sv-dash-cell${
              cell.status === 'ok' ? '' : ' sv-dash-cell--empty'
            }`}
            key={`${cell.chart_id ?? 'cell'}-${i}`}
          >
            <div className="sv-dash-cell-title">
              {stripUntrustedMarkers(
                cell.title ?? cell.data?.chart_name ?? 'Chart',
              )}
            </div>
            <div className="sv-dash-cell-body">
              <CellBody cell={cell} theme={theme} />
            </div>
            {cell.data?.fidelity_warning && (
              <div className="sv-fidelity">
                <strong>Row order may differ.</strong>
              </div>
            )}
            <SubstitutionNote cell={cell} />
          </div>
        ))}
        {cells.length === 0 && (
          <div className="sv-cell-placeholder">
            This tab was not included in this render.
          </div>
        )}
      </div>
    </div>
  );
}
