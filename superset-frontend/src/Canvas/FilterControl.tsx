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

import { CSSProperties, useEffect, useState } from 'react';
import { Select } from '@superset-ui/core/components';
import { CdlFilter, Primitive } from './types';
import { ActiveFilter, useFilters, useQueryRunner } from './runtime';

interface Option {
  value: string | number;
  label: string;
}

export interface FilterControlProps {
  filterId: string;
  column: string;
  datasetId?: number;
  label?: string;
  multiple?: boolean;
  op?: CdlFilter['op'];
  options?: Option[];
  style?: CSSProperties;
}

/**
 * A canvas filter: renders a (multi)select of a column's distinct values and
 * writes the selection into the canvas-global filter store, which every bound
 * chart on the same dataset merges into its query.
 */
export function FilterControl({
  filterId,
  column,
  datasetId,
  label,
  multiple,
  op,
  options: provided,
  style,
}: FilterControlProps) {
  const runner = useQueryRunner();
  const { setFilter } = useFilters();
  const [options, setOptions] = useState<Option[]>(provided ?? []);
  const [value, setValue] = useState<Primitive | Primitive[] | undefined>(
    multiple ? [] : undefined,
  );

  // Auto-populate options with the column's distinct values (COUNT(*) works on
  // any dataset without needing a saved metric).
  useEffect(() => {
    if (provided?.length || datasetId == null || !column) {
      return undefined;
    }
    let live = true;
    runner
      .run({ datasetId, metrics: ['COUNT(*)'], groupby: [column] })
      .then(result => {
        if (!live) return;
        const seen = new Set<string>();
        const opts: Option[] = [];
        result.records.forEach(row => {
          const raw = row[column];
          const key = String(raw);
          if (raw != null && !seen.has(key)) {
            seen.add(key);
            opts.push({ value: raw as string | number, label: key });
          }
        });
        setOptions(opts);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [runner, datasetId, column, provided]);

  const handleChange = (next: unknown) => {
    const selected = next as Primitive | Primitive[] | undefined;
    setValue(selected);
    const isEmpty =
      selected == null ||
      selected === '' ||
      (Array.isArray(selected) && selected.length === 0);
    const active: ActiveFilter | null = isEmpty
      ? null
      : {
          datasetId,
          filter: {
            col: column,
            op: op ?? (multiple ? 'IN' : '=='),
            val: selected as CdlFilter['val'],
          },
        };
    setFilter(filterId, active);
  };

  return (
    <div style={style}>
      <Select
        ariaLabel={label ?? column}
        header={label ?? column}
        placeholder={label ?? column}
        mode={multiple ? 'multiple' : undefined}
        options={options}
        value={value as string | number | (string | number)[] | undefined}
        onChange={handleChange}
        allowClear
      />
    </div>
  );
}
