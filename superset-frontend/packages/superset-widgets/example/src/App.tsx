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
import { useState } from 'react';
import {
  Chart,
  FilterSelect,
  MetricTile,
  SupersetProvider,
  Widget,
} from '@apache-superset/widgets';
// `?raw` loads this file's text for the source panel, not the module itself.
// eslint-disable-next-line import/no-self-import
import appSource from './App.tsx?raw';
import { config, fetchGuestToken } from './config';
import MinimalEmbed from './MinimalEmbed';
import minimalEmbedSource from './minimalEmbedSource';
import { EventLog } from './EventLog';
import { Gallery } from './Gallery';
import { HostFilterBar } from './HostFilterBar';
import {
  Frame,
  StructureProvider,
  StructureTree,
  useStructureVisible,
} from './structure';

const withoutLicense = (source: string) =>
  source.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '');

const binding = (metrics: string[], dimensions: string[], rowLimit = 1000) => ({
  datasetId: config.datasetId,
  metrics,
  dimensions,
  rowLimit,
});

function Page() {
  const [dark, setDark] = useState(false);
  const [showStructure, setShowStructure] = useStructureVisible();

  const appClass = ['app', dark && 'app-dark', showStructure && 'app-structure']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={appClass}>
      <header className="app-header">
        <div>
          <h1>Acme Operations</h1>
          <p>Superset widgets rendered in this app&apos;s own React tree.</p>
          {config.authMode === 'session' && (
            <p className="hint">
              Uses your Superset login, no backend. Not signed in?{' '}
              <a
                href={`${config.supersetUrl}/login/`}
                target="_blank"
                rel="noreferrer"
              >
                Log in to Superset
              </a>
              , then reload.
            </p>
          )}
        </div>
        <div className="toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={showStructure}
              onChange={event => setShowStructure(event.target.checked)}
            />
            Show structure
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={dark}
              onChange={event => setDark(event.target.checked)}
            />
            Dark
          </label>
        </div>
      </header>

      <section className="minimal-embed">
        <h2>Embed one widget</h2>
        <p className="hint">
          The whole integration: a provider and a widget. This is the file
          below, rendered live next to its source.
        </p>
        <div className="minimal-embed-body">
          <pre className="code-block">
            <code>{withoutLicense(minimalEmbedSource)}</code>
          </pre>
          <div className="card">
            <MinimalEmbed />
          </div>
        </div>
      </section>

      <SupersetProvider
        supersetDomain={config.supersetUrl}
        fetchGuestToken={
          config.authMode === 'guest' ? fetchGuestToken : undefined
        }
        themeMode={dark ? 'dark' : 'default'}
      >
        <Frame
          label="<SupersetProvider>"
          detail={`${config.supersetUrl} · ${
            config.authMode === 'guest'
              ? 'guest token from /api/guest-token'
              : 'your Superset login'
          }`}
          kind="superset"
          className="provider"
        >
          <Frame
            label="<HostFilterBar>"
            detail="useSupersetFilter('host-state')"
            kind="host"
          >
            <HostFilterBar />
          </Frame>
          <div className="app-body">
            <main>
              <Frame label="Inline widgets" kind="host" as="section">
                <h2>Inline widgets</h2>
                <p className="hint">
                  Defined here, validated and executed by Superset. They
                  cross-filter each other.
                </p>
                <div className="grid">
                  <Frame
                    label="<FilterSelect>"
                    code
                    detail={`datasetId=${config.datasetId} column=${config.category}`}
                    kind="superset"
                    className="card small"
                  >
                    <FilterSelect
                      datasetId={config.datasetId}
                      column={config.category}
                    />
                  </Frame>
                  <Frame
                    label="<MetricTile>"
                    code
                    detail={config.metric}
                    kind="superset"
                    className="card small"
                  >
                    <MetricTile
                      dataBinding={binding([config.metric], [])}
                      label={`Total ${config.metric}`}
                    />
                  </Frame>
                  <Frame
                    label="<Chart chartType=bar>"
                    code
                    detail={`${config.metric} by ${config.filterColumn}, top 10, crossFilter`}
                    kind="superset"
                    className="card"
                  >
                    <Chart
                      instanceId="by-dimension"
                      dataBinding={binding(
                        [config.metric],
                        [config.filterColumn],
                        10,
                      )}
                      chartType="bar"
                      crossFilter
                      chrome={{
                        titleText: `${config.metric} by ${config.filterColumn} (top 10)`,
                      }}
                      echartsOptions={{
                        tooltip: { trigger: 'axis' },
                        xAxis: {
                          type: 'category',
                          data: {
                            $bind: {
                              source: 'dimension',
                              alias: config.filterColumn,
                            },
                          },
                        },
                        yAxis: { type: 'value' },
                      }}
                    />
                  </Frame>
                  <Frame
                    label="<Chart> (pie)"
                    code
                    detail={`${config.metric} by ${config.category}, crossFilter`}
                    kind="superset"
                    className="card"
                  >
                    <Chart
                      instanceId="by-category"
                      dataBinding={binding([config.metric], [config.category])}
                      crossFilter
                      chrome={{
                        titleText: `${config.metric} by ${config.category}`,
                      }}
                      echartsOptions={{
                        tooltip: { trigger: 'item' },
                        series: [
                          {
                            type: 'pie',
                            radius: '60%',
                            data: {
                              $bind: {
                                source: 'records',
                                fields: {
                                  name: config.category,
                                  value: config.metric,
                                },
                              },
                            },
                          },
                        ],
                      }}
                    />
                  </Frame>
                </div>
              </Frame>

              <Frame label="Saved widgets" kind="host" as="section">
                <h2>Saved widgets</h2>
                {config.savedWidgetIds.length > 0 ? (
                  <div className="grid">
                    {config.savedWidgetIds.map(id => (
                      <Frame
                        key={id}
                        label="<Widget id>"
                        code
                        detail={id}
                        kind="superset"
                        className="card"
                      >
                        <Widget id={id} />
                      </Frame>
                    ))}
                  </div>
                ) : (
                  <p className="hint">
                    Set EMBED_WIDGET_IDS to saved widget uuids.
                  </p>
                )}
              </Frame>
            </main>
            <aside>
              <Frame
                label="<EventLog>"
                detail="useWidgetEvent('valueChanged')"
                kind="host"
              >
                <EventLog />
              </Frame>
              {showStructure && (
                <>
                  <section className="card structure-panel">
                    <h2>React tree</h2>
                    <StructureTree />
                  </section>
                  <details className="card structure-panel source">
                    <summary>App.tsx</summary>
                    <pre>{appSource}</pre>
                  </details>
                </>
              )}
            </aside>
          </div>
        </Frame>

        <Frame
          label="<Widget id>"
          code
          kind="superset"
          className="card demo-slot"
        >
          <Widget id="a4c570e0-6b2a-4b41-bd2c-99bc3c2c184c" />
        </Frame>

        <Frame
          label="<Widget id>"
          code
          kind="superset"
          className="card demo-slot"
        >
          <Widget id="a4d4c0aa-7d14-409d-81b7-8ee6266e2896" />
        </Frame>
      </SupersetProvider>

      <Gallery themeMode={dark ? 'dark' : 'default'} />
    </div>
  );
}

export default function App() {
  return (
    <StructureProvider>
      <Page />
    </StructureProvider>
  );
}
