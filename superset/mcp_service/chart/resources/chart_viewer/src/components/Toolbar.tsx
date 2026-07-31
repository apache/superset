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
import type { JSX } from 'react';
import type { DataColumn, ViewType } from '../types';
import { CATEGORICAL_PALETTE } from '../theme';

const VIEW_LABELS: Record<ViewType, string> = {
  line: 'Line',
  bar: 'Bar',
  area: 'Area',
  pie: 'Pie',
  scatter: 'Scatter',
  table: 'Table',
  big_number: 'Big Number',
};

interface Props {
  views: ViewType[];
  activeView: ViewType;
  onViewChange: (v: ViewType) => void;
  metricColumns: DataColumn[];
  activeMetrics: string[];
  onToggleMetric: (name: string) => void;
  exploreUrl?: string;
  onOpenInSuperset?: () => void;
}

/** Compact toolbar: view switcher chips, metric toggles, "Open in Superset". */
export function Toolbar({
  views,
  activeView,
  onViewChange,
  metricColumns,
  activeMetrics,
  onToggleMetric,
  exploreUrl,
  onOpenInSuperset,
}: Props): JSX.Element {
  // Scatter consumes two measures positionally (x and y), so toggling one off
  // would not narrow the plot, it would break it.
  const showMetricChips =
    metricColumns.length > 1 &&
    activeView !== 'big_number' &&
    activeView !== 'table' &&
    activeView !== 'scatter';

  return (
    <div className="sv-toolbar">
      {views.length > 1 && (
        <div className="sv-chip-group" role="group" aria-label="View type">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              className="sv-chip"
              aria-pressed={activeView === v}
              onClick={() => onViewChange(v)}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      )}

      {showMetricChips && (
        <div className="sv-chip-group" role="group" aria-label="Metrics">
          {metricColumns.map((col, i) => {
            const active = activeMetrics.includes(col.name);
            return (
              <button
                key={col.name}
                type="button"
                className="sv-chip sv-metric-chip"
                aria-pressed={active}
                onClick={() => onToggleMetric(col.name)}
                style={{ opacity: active ? 1 : 0.5 }}
              >
                <span
                  className="sv-metric-swatch"
                  style={{ background: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length] }}
                />
                {col.display_name || col.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="sv-spacer" />

      {exploreUrl && (
        <button type="button" className="sv-btn" onClick={onOpenInSuperset}>
          <OpenIcon />
          Open in Superset
        </button>
      )}
    </div>
  );
}

function OpenIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 3h7v7M21 3l-9 9M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
