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

import { useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { Select } from '@superset-ui/core/components';
import { ControlHeader } from '@superset-ui/chart-controls';
import { useTileJsonProperties } from './tileJson';

export interface TilePropertyControlProps {
  name: string;
  label?: string;
  description?: string;
  value?: string[];
  onChange: (value: string[]) => void;
  tileJsonUrl?: string;
  sourceLayer?: string;
  /** [column_name, display name] pairs from the dataset, the fallback list. */
  datasetChoices: string[][];
}

/**
 * Multi-select of tile property names. Lists TileJSON properties when a
 * TileJSON URL loads, otherwise the dataset's columns.
 */
export default function TilePropertyControl({
  name,
  label,
  description,
  value = [],
  onChange,
  tileJsonUrl,
  sourceLayer,
  datasetChoices,
}: TilePropertyControlProps) {
  const { properties, loading, error } = useTileJsonProperties(
    tileJsonUrl,
    sourceLayer,
  );
  const useTileJson = Boolean(tileJsonUrl?.trim()) && !error;

  const options = useMemo(
    () =>
      useTileJson
        ? properties.map(property => ({
            value: property.name,
            label: property.name,
          }))
        : datasetChoices.map(([column, displayName]) => ({
            value: column,
            label: displayName,
          })),
    [useTileJson, properties, datasetChoices],
  );

  return (
    <Select
      ariaLabel={label ?? name}
      mode="multiple"
      allowNewOptions
      allowClear
      loading={loading}
      options={options}
      value={value}
      onChange={newValue => onChange(newValue as string[])}
      header={
        <ControlHeader
          name={name}
          label={label}
          description={description}
          warning={
            error
              ? t(
                  'Could not load TileJSON: %s. Showing dataset columns instead.',
                  error,
                )
              : undefined
          }
        />
      }
    />
  );
}
