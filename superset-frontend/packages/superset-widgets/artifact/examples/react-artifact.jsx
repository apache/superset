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

/*
 * A claude.ai React artifact rendering real Superset widgets with no backend.
 * The artifact keeps its own React; the widgets bundle renders into the empty
 * elements below with its own React, and data comes from the viewer's
 * Superset connector.
 *
 * Replace {{SUPERSET_WIDGETS_URL}} with the published bundle URL (a CDN the
 * artifact host allows) and publish with this capabilities manifest:
 *   {"mcp": {"servers": [{"server": "Superset", "tools": ["query_dataset"]}]}}
 * For strategy "widget-tools" (saved widgets, every inline widget) list:
 *   ["get_widget_data", "get_widget_values", "get_saved_widget"]
 * MCP-backed artifacts cannot be shared publicly.
 */
import { useEffect, useRef, useState } from 'react';

const SUPERSET_WIDGETS_URL = '{{SUPERSET_WIDGETS_URL}}';
const SERVER = 'Superset';
const DATASET_ID = 17;
const STATES = ['CA', 'NY', 'TX', 'IL', 'FL'];

function loadSupersetWidgets(url) {
  if (window.SupersetWidgets) return Promise.resolve(window.SupersetWidgets);
  return new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), {
      src: url,
    });
    script.onload = () => resolve(window.SupersetWidgets);
    script.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.appendChild(script);
  });
}

function summarize(payload) {
  const resolved = payload && payload.resolved;
  return resolved
    ? `${resolved.column} ${resolved.operator} ${JSON.stringify(resolved.value)}`
    : 'cleared';
}

const card = {
  boxSizing: 'border-box',
  padding: 12,
  border: '1px solid #e4e2dc',
  borderRadius: 8,
  background: '#fff',
};

export default function BirthsDashboard() {
  const genderRef = useRef(null);
  const totalRef = useRef(null);
  const byStateRef = useRef(null);
  const sessionRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [problem, setProblem] = useState('');
  const [state, setState] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let off = () => {};

    (async () => {
      try {
        const W = await loadSupersetWidgets(SUPERSET_WIDGETS_URL);
        // null outside a published artifact, or when connectors are unavailable here.
        const mcp = window.claude?.use ? await window.claude.use('mcp') : null;
        if (cancelled) return;
        if (!W)
          throw new Error('The widgets bundle loaded without SupersetWidgets.');
        if (!mcp) {
          setStatus('no-connectors');
          return;
        }

        const session = W.createSession({
          server: SERVER,
          strategy: 'query-dataset',
          mcp,
        });
        sessionRef.current = session;

        session.mount(
          genderRef.current,
          {
            type: 'filter.select',
            props: { datasetId: DATASET_ID, column: 'gender' },
          },
          { instanceId: 'gender' },
        );
        session.mount(
          totalRef.current,
          {
            type: 'metric-tile',
            props: {
              dataBinding: { datasetId: DATASET_ID, metrics: ['sum__num'] },
              label: 'Total births',
            },
          },
          { instanceId: 'total' },
        );
        session.mount(
          byStateRef.current,
          {
            type: 'echarts',
            props: {
              chartType: 'bar',
              crossFilter: true,
              dataBinding: {
                datasetId: DATASET_ID,
                metrics: ['sum__num'],
                dimensions: ['state'],
                rowLimit: 10,
              },
              echartsOptions: {
                xAxis: {
                  type: 'category',
                  data: { $bind: { source: 'dimension', alias: 'state' } },
                },
                yAxis: { type: 'value' },
              },
              chrome: { titleText: 'Births by state (top 10)' },
            },
          },
          { instanceId: 'by-state' },
        );

        off = session.on('valueChanged', event => {
          setEvents(current =>
            [
              {
                key: `${Date.now()}-${Math.random()}`,
                source: event.nodeId,
                summary: summarize(event.payload),
              },
              ...current,
            ].slice(0, 20),
          );
        });
        setStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setProblem(error instanceof Error ? error.message : String(error));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      off();
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, []);

  const pickState = value => {
    setState(value);
    sessionRef.current?.setFilter(
      'state',
      value
        ? {
            datasetId: DATASET_ID,
            column: 'state',
            operator: 'IN',
            value: [value],
          }
        : null,
    );
  };

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: 16,
        background: '#f5f4f0',
      }}
    >
      <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>Births</h1>

      {status === 'loading' && <p>Loading Superset widgets…</p>}
      {status === 'no-connectors' && (
        <p>
          Open this page as a published Claude artifact, and add the {SERVER}{' '}
          connector in Claude settings, to see the data.
        </p>
      )}
      {status === 'error' && <p role="alert">{problem}</p>}

      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}
      >
        {STATES.map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={state === value}
            disabled={status !== 'ready'}
            onClick={() => pickState(state === value ? null : value)}
          >
            {value}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 280px',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          {/* The bundle owns these elements: never render children into them. */}
          <div ref={genderRef} style={{ ...card, height: 110 }} />
          <div ref={totalRef} style={{ ...card, height: 110 }} />
          <div
            ref={byStateRef}
            style={{ ...card, height: 340, gridColumn: '1 / -1' }}
          />
        </div>
        <section style={card}>
          <h2 style={{ fontSize: 14, margin: 0 }}>Events from widgets</h2>
          {events.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              Pick a value or click a bar.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 13 }}>
              {events.map(entry => (
                <li key={entry.key}>
                  <code>{entry.source}</code> {entry.summary}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
