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
import { useMemo, type ReactNode } from 'react';
import {
  Chart,
  FilterSelect,
  Markdown,
  MetricTile,
  SupersetProvider,
  Table,
  Widget,
  createWidgetBus,
  useSupersetFilter,
  useWidgetValue,
  type FilterValueChangedPayload,
  type ThemeModeName,
} from '@apache-superset/widgets';
import { config, fetchGuestToken } from './config';
import { Frame } from './structure';

const DATASET = config.datasetId;
const {
  category,
  filterColumn: DIMENSION,
  label,
  metric,
  secondMetric,
} = config;
const MISSING_WIDGET_ID = '00000000-0000-0000-0000-000000000000';

const byDimension = {
  xAxis: {
    type: 'category',
    data: { $bind: { source: 'dimension', alias: DIMENSION } },
  },
  yAxis: { type: 'value' },
};

const byCategory = {
  xAxis: {
    type: 'category',
    data: { $bind: { source: 'dimension', alias: category } },
  },
  yAxis: { type: 'value' },
};

function Card({
  title,
  children,
  note,
}: {
  title: string;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="gallery-card">
      <h3>{title}</h3>
      <p className="hint">{note}</p>
      {children}
    </section>
  );
}

function Demo({
  label,
  className = 'gallery-widget',
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Frame label={label} kind="superset" code className={className}>
      {children}
    </Frame>
  );
}

function SelectionReadout({ instanceId }: { instanceId: string }) {
  const value = useWidgetValue(instanceId) as
    FilterValueChangedPayload | undefined;
  const selection = value?.resolved?.value;
  return (
    <p className="hint">
      <code>useWidgetValue(&apos;{instanceId}&apos;)</code> →{' '}
      <strong>
        {selection === undefined
          ? 'nothing selected'
          : JSON.stringify(selection)}
      </strong>
    </p>
  );
}

function TargetedHostFilter() {
  const setFilter = useSupersetFilter('gallery-host-target');
  return (
    <div className="gallery-actions">
      <button
        type="button"
        className="chip"
        onClick={() =>
          setFilter({
            datasetId: DATASET,
            column: DIMENSION,
            operator: 'IN',
            value: config.filterValues.slice(0, 2),
            targets: ['gallery-host-left'],
          })
        }
      >
        Filter left chart to NY, CA
      </button>
      <button type="button" className="chip" onClick={() => setFilter(null)}>
        Clear
      </button>
    </div>
  );
}

function SharedBusProviders({ themeMode }: { themeMode: ThemeModeName }) {
  const bus = useMemo(() => createWidgetBus(), []);
  const auth =
    config.authMode === 'guest' ? { fetchGuestToken } : ({} as const);
  return (
    <div className="gallery-row">
      <SupersetProvider
        supersetDomain={config.supersetUrl}
        bus={bus}
        themeMode={themeMode}
        {...auth}
      >
        <Demo label="<FilterSelect> (provider A)" className="gallery-plain">
          <FilterSelect datasetId={DATASET} column={category} />
        </Demo>
      </SupersetProvider>
      <SupersetProvider
        supersetDomain={config.supersetUrl}
        bus={bus}
        themeMode={themeMode}
        themeConfig={{ token: { colorPrimary: '#7b3fe4' } }}
        {...auth}
      >
        <Demo label="<Chart> (provider B)">
          <Chart
            dataBinding={{
              datasetId: DATASET,
              metrics: [metric],
              dimensions: [DIMENSION],
              rowLimit: 8,
            }}
            echartsOptions={{
              ...byDimension,
              series: [
                {
                  type: 'bar',
                  data: { $bind: { source: 'metric', alias: metric } },
                  itemStyle: {
                    color: {
                      $bind: { source: 'theme', token: 'colorPrimary' },
                    },
                  },
                },
              ],
            }}
            chrome={{ titleText: 'Themed by provider B' }}
          />
        </Demo>
      </SupersetProvider>
    </div>
  );
}

/**
 * One small example per component and prop in the API reference. Runs under
 * its own provider, so its filters never touch the widgets above.
 */
export function Gallery({ themeMode }: { themeMode: ThemeModeName }) {
  const savedId = config.savedWidgetIds[0];

  return (
    <section className="gallery">
      <h2>Component gallery</h2>
      <p className="hint">
        One example per component and prop. Every widget has a{' '}
        <code>&lt;/&gt; Code</code> button. Not shown: <code>client</code> (the
        Claude-artifact MCP client), <code>guestTokenHeaderName</code> and{' '}
        <code>guestTokenFetchTimeoutMs</code> (guest-token mode only).
      </p>
      <SupersetProvider
        supersetDomain={config.supersetUrl}
        fetchGuestToken={
          config.authMode === 'guest' ? fetchGuestToken : undefined
        }
        themeMode={themeMode}
      >
        <div className="gallery-grid">
          <Card
            title="Generic <Widget type props>"
            note={
              <>
                Any widget type by name. <code>&lt;MetricTile …/&gt;</code> is
                shorthand for this.
              </>
            }
          >
            <Demo label="<Widget type>" className="gallery-widget short">
              <Widget
                type="metric-tile"
                props={{
                  dataBinding: {
                    datasetId: DATASET,
                    metrics: [secondMetric],
                    dimensions: [],
                  },
                  label: `${secondMetric} in dataset ${DATASET}`,
                }}
              />
            </Demo>
          </Card>

          <Card
            title="MetricTile formatting"
            note={
              <>
                <code>prefix</code>, <code>suffix</code>, <code>decimals</code>,
                with an aggregate metric object instead of a saved metric.
              </>
            }
          >
            <Demo label="<MetricTile>" className="gallery-widget short">
              <MetricTile
                dataBinding={{
                  datasetId: DATASET,
                  metrics: [
                    {
                      expressionType: 'SIMPLE',
                      aggregate: 'AVG',
                      column: { column_name: 'num' },
                      label: 'avg_num',
                    },
                  ],
                  dimensions: [],
                }}
                prefix="~"
                suffix=" births per row"
                decimals={2}
                label="Average of num"
              />
            </Demo>
          </Card>

          <Card
            title="Table"
            note={
              <>
                Query rows in AG Grid. <code>columnDefs</code> renames and sizes
                columns.
              </>
            }
          >
            <Demo label="<Table>">
              <Table
                dataBinding={{
                  datasetId: DATASET,
                  metrics: [metric],
                  dimensions: [label],
                  rowLimit: 25,
                }}
                columnDefs={[
                  { field: label, headerName: label, flex: 1 },
                  { field: metric, headerName: metric, width: 120 },
                ]}
              />
            </Demo>
          </Card>

          <Card title="Markdown" note={<>Static rich text, no query.</>}>
            <Demo label="<Markdown>" className="gallery-widget short">
              <Markdown
                content={'### Notes\nMarkdown **inside** the host app.'}
              />
            </Demo>
          </Card>

          <Card
            title="Chart customize + chrome"
            note={
              <>
                <code>customize.series</code> (keyed by metric label) and{' '}
                <code>chrome</code> legend, tooltip and axis names.
              </>
            }
          >
            <Demo label="<Chart customize chrome>">
              <Chart
                chartType="bar"
                dataBinding={{
                  datasetId: DATASET,
                  metrics: [metric, secondMetric],
                  dimensions: [category],
                }}
                echartsOptions={byCategory}
                customize={{
                  series: {
                    [metric]: { color: '#2f5d50', displayName: metric },
                    [secondMetric]: { visible: false },
                  },
                }}
                chrome={{
                  titleText: `${metric} by ${category}`,
                  legendShow: true,
                  legendPosition: 'bottom',
                  tooltipTrigger: 'axis',
                  xAxisName: category,
                  yAxisName: metric,
                }}
              />
            </Demo>
          </Card>

          <Card
            title="$bind sources"
            note={
              <>
                <code>metric</code> values, a <code>theme</code> token color,
                and <code>single: true</code> for one value (the first row).
              </>
            }
          >
            <Demo label="<Chart $bind>">
              <Chart
                dataBinding={{
                  datasetId: DATASET,
                  metrics: [metric],
                  dimensions: [category],
                }}
                echartsOptions={{
                  ...byCategory,
                  title: {
                    text: 'First row',
                    subtext: {
                      $bind: {
                        source: 'metric',
                        alias: metric,
                        single: true,
                      },
                    },
                  },
                  series: [
                    {
                      type: 'bar',
                      data: { $bind: { source: 'metric', alias: metric } },
                      itemStyle: {
                        color: {
                          $bind: { source: 'theme', token: 'colorSuccess' },
                        },
                      },
                    },
                  ],
                }}
                showTitle={false}
              />
            </Demo>
          </Card>

          <Card
            title="Filters baked into dataBinding"
            note={
              <>
                <code>dataBinding.filters</code> are part of the definition and
                combine with any active filters.
              </>
            }
          >
            <Demo label="<Chart dataBinding.filters>">
              <Chart
                chartType="bar"
                dataBinding={{
                  datasetId: DATASET,
                  metrics: [metric],
                  dimensions: [DIMENSION],
                  filters: [
                    {
                      expressionType: 'SIMPLE',
                      clause: 'WHERE',
                      subject: DIMENSION,
                      operator: 'IN',
                      comparator: config.filterValues.slice(0, 3),
                    },
                  ],
                }}
                echartsOptions={byDimension}
                chrome={{ titleText: 'CA, NY and TX only' }}
              />
            </Demo>
          </Card>

          <Card
            title="FilterSelect options, default and scope"
            note={
              <>
                Fixed <code>options</code>, a <code>defaultSelection</code>, and{' '}
                <code>scope.targets</code> so only the left chart listens. The
                readout uses <code>useWidgetValue</code>.
              </>
            }
          >
            <Demo label="<FilterSelect scope>" className="gallery-plain">
              <FilterSelect
                instanceId="gallery-category-filter"
                datasetId={DATASET}
                column={category}
                options={config.categoryValues}
                defaultSelection={config.categoryValues.slice(-1)}
                scope={{ targets: ['gallery-scoped'] }}
              />
            </Demo>
            <SelectionReadout instanceId="gallery-category-filter" />
            <div className="gallery-row">
              <Demo label="<Chart> targeted">
                <Chart
                  instanceId="gallery-scoped"
                  chartType="bar"
                  dataBinding={{
                    datasetId: DATASET,
                    metrics: [metric],
                    dimensions: [DIMENSION],
                    rowLimit: 5,
                  }}
                  echartsOptions={byDimension}
                  chrome={{ titleText: 'Targeted' }}
                />
              </Demo>
              <Demo label="<Chart> not targeted">
                <Chart
                  instanceId="gallery-unscoped"
                  chartType="bar"
                  dataBinding={{
                    datasetId: DATASET,
                    metrics: [metric],
                    dimensions: [DIMENSION],
                    rowLimit: 5,
                  }}
                  echartsOptions={byDimension}
                  chrome={{ titleText: 'Not targeted' }}
                />
              </Demo>
            </div>
          </Card>

          <Card
            title="Host filter targets"
            note={
              <>
                <code>useSupersetFilter</code> with <code>targets</code> narrows
                only the listed instance ids.
              </>
            }
          >
            <TargetedHostFilter />
            <div className="gallery-row">
              <Demo label="<Chart> left (target)">
                <Chart
                  instanceId="gallery-host-left"
                  chartType="bar"
                  dataBinding={{
                    datasetId: DATASET,
                    metrics: [metric],
                    dimensions: [DIMENSION],
                    rowLimit: 6,
                  }}
                  echartsOptions={byDimension}
                  chrome={{ titleText: 'Left' }}
                />
              </Demo>
              <Demo label="<Chart> right">
                <Chart
                  instanceId="gallery-host-right"
                  chartType="bar"
                  dataBinding={{
                    datasetId: DATASET,
                    metrics: [metric],
                    dimensions: [DIMENSION],
                    rowLimit: 6,
                  }}
                  echartsOptions={byDimension}
                  chrome={{ titleText: 'Right' }}
                />
              </Demo>
            </div>
          </Card>

          <Card
            title="Layout props"
            note={
              <>
                <code>className</code>, <code>style</code> and{' '}
                <code>showTitle</code> on the widget itself.
              </>
            }
          >
            <Demo label="<Chart className style>" className="gallery-plain">
              <Chart
                className="custom-widget-frame"
                style={{ height: 220 }}
                showTitle={false}
                chartType="bar"
                dataBinding={{
                  datasetId: DATASET,
                  metrics: [metric],
                  dimensions: [category],
                }}
                echartsOptions={byCategory}
                chrome={{ titleText: 'Title hidden by showTitle' }}
              />
            </Demo>
          </Card>

          <Card
            title="Loading and errors"
            note={
              <>
                <code>fallback</code> while a saved widget loads, and{' '}
                <code>renderError</code> for a widget id that does not exist.
              </>
            }
          >
            <div className="gallery-row">
              {savedId ? (
                <Demo label="<Widget fallback>">
                  <Widget
                    id={savedId}
                    fallback={<p className="hint">Loading saved widget…</p>}
                  />
                </Demo>
              ) : (
                <p className="hint">Set EMBED_WIDGET_IDS to show fallback.</p>
              )}
              <Demo label="<Widget renderError>">
                <Widget
                  id={MISSING_WIDGET_ID}
                  renderError={error => (
                    <div className="gallery-error" role="alert">
                      Custom error view: {error.message}
                    </div>
                  )}
                />
              </Demo>
            </div>
          </Card>

          <Card
            title="Providers sharing a bus, with themeConfig"
            note={
              <>
                Two separate <code>SupersetProvider</code>s given the same{' '}
                <code>bus</code> cross-filter; provider B sets{' '}
                <code>themeConfig</code>.
              </>
            }
          >
            <SharedBusProviders themeMode={themeMode} />
          </Card>
        </div>
      </SupersetProvider>
    </section>
  );
}
