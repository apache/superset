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
import { useSupersetFilter } from '@apache-superset/widgets';
import { config } from './config';

/** A filter owned by the host app, pushed into every widget on the dataset. */
export function HostFilterBar() {
  const setFilter = useSupersetFilter('host-state');
  const [selected, setSelected] = useState<string[]>([]);

  const apply = (next: string[]) => {
    setSelected(next);
    setFilter(
      next.length
        ? {
            datasetId: config.datasetId,
            column: config.filterColumn,
            operator: 'IN',
            value: next,
          }
        : null,
    );
  };

  return (
    <fieldset className="filter-bar">
      <legend className="filter-label">{config.filterColumn}</legend>
      {config.filterValues.map(value => {
        const active = selected.includes(value);
        return (
          <button
            type="button"
            key={value}
            className={active ? 'chip chip-active' : 'chip'}
            aria-pressed={active}
            onClick={() =>
              apply(
                active
                  ? selected.filter(v => v !== value)
                  : [...selected, value],
              )
            }
          >
            {value}
          </button>
        );
      })}
      <button
        type="button"
        className="chip"
        disabled={!selected.length}
        onClick={() => apply([])}
      >
        Clear
      </button>
    </fieldset>
  );
}
