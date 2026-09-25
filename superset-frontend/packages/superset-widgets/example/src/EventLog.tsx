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
  useWidgetEvent,
  type FilterValueChangedPayload,
} from '@apache-superset/widgets';

interface Entry {
  key: number;
  time: string;
  source: string;
  summary: string;
}

let nextKey = 0;

function summarize(payload: FilterValueChangedPayload | undefined): string {
  const resolved = payload?.resolved;
  if (!resolved) return 'cleared';
  return `${resolved.column} ${resolved.operator} ${JSON.stringify(resolved.value)}`;
}

/** Filter and cross-filter events coming back out of widgets (and the host's own filter). */
export function EventLog() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useWidgetEvent('valueChanged', event => {
    setEntries(current =>
      [
        {
          key: (nextKey += 1),
          time: new Date().toLocaleTimeString(),
          source: event.nodeId,
          summary: summarize(event.payload as FilterValueChangedPayload),
        },
        ...current,
      ].slice(0, 30),
    );
  });

  return (
    <section className="card event-log">
      <h2>Events from widgets</h2>
      {entries.length === 0 ? (
        <p className="hint">Pick a value in the filter or click a chart.</p>
      ) : (
        <ul>
          {entries.map(entry => (
            <li key={entry.key}>
              <time>{entry.time}</time> <code>{entry.source}</code>
              <div>{entry.summary}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
