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
import React, { useMemo, useState } from 'react';
import {
  ChartDataResponseResult,
  useTheme,
  t,
  GenericDataType,
} from '@superset-ui/core';
import ControlHeader from '../../../components/ControlHeader';
import { ControlComponentProps } from '../types';

import ColumnConfigItem from './ColumnConfigItem';
import {
  ColumnConfigInfo,
  ColumnConfig,
  ColumnConfigFormLayout,
} from './types';
import { DEFAULT_CONFIG_FORM_LAYOUT } from './constants';
import { COLUMN_NAME_ALIASES } from '../../../constants';

export type ColumnConfigControlProps<T extends ColumnConfig> =
  ControlComponentProps<Record<string, T>> & {
    queryResponse?: ChartDataResponseResult;
    configFormLayout?: ColumnConfigFormLayout;
    appliedColumnNames?: string[];
    emitFilter: boolean;
  };

/**
 * Max number of columns to show by default.
 */
const MAX_NUM_COLS = 10;

/**
 * Add per-column config to queried results.
 */
export default function ColumnConfigControl<T extends ColumnConfig>({
  queryResponse,
  appliedColumnNames = [],
  value,
  onChange,
  configFormLayout = DEFAULT_CONFIG_FORM_LAYOUT,
  emitFilter,
  ...props
}: ColumnConfigControlProps<T>) {
  if (emitFilter) {
    Object.values(configFormLayout).forEach(array_of_array => {
      if (!array_of_array.some(arr => arr.includes('emitTarget'))) {
        array_of_array.push(['emitTarget']);
      }
    });
  } else {
    Object.values(configFormLayout).forEach(array_of_array => {
      const index = array_of_array.findIndex(arr => arr.includes('emitTarget'));
      if (index > -1) {
        array_of_array.splice(index, 1);
      }
    });
  }

  const { colnames: _colnames, coltypes: _coltypes } = queryResponse || {};
  let colnames: string[] = [];
  let coltypes: GenericDataType[] = [];
  if (appliedColumnNames.length === 0) {
    colnames = _colnames || [];
    coltypes = _coltypes || [];
  } else {
    const appliedCol = new Set(appliedColumnNames);
    _colnames?.forEach((col, idx) => {
      if (appliedCol.has(col)) {
        colnames.push(col);
        coltypes.push(_coltypes?.[idx] as GenericDataType);
      }
    });
  }
  const theme = useTheme();
  const columnConfigs = useMemo(() => {
    const configs: Record<string, ColumnConfigInfo> = {};
    colnames?.forEach((col, idx) => {
      configs[col] = {
        name: COLUMN_NAME_ALIASES[col] || col,
        type: coltypes?.[idx],
        config: value?.[col] || {},
      };
    });
    return configs;
  }, [value, colnames, coltypes]);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const getColumnInfo = (col: string) => columnConfigs[col] || {};
  const setColumnConfig = (col: string, config: T) => {
    if (onChange) {
      // Only keep configs for known columns
      const validConfigs: Record<string, T> =
        colnames && value
          ? Object.fromEntries(
              Object.entries(value).filter(([key]) => colnames.includes(key)),
            )
          : { ...value };
      onChange({
        ...validConfigs,
        [col]: config,
      });
    }
  };

  if (!colnames || colnames.length === 0) return null;

  const needShowMoreButton = colnames.length > MAX_NUM_COLS + 2;
  const cols =
    needShowMoreButton && !showAllColumns
      ? colnames.slice(0, MAX_NUM_COLS)
      : colnames;

  return (
    <>
      <ControlHeader {...props} />
      <div
        css={{
          border: `1px solid ${theme.colors.grayscale.light2}`,
          borderRadius: theme.gridUnit,
        }}
      >
        {cols.map(col => (
          <ColumnConfigItem
            key={col}
            column={getColumnInfo(col)}
            onChange={config => setColumnConfig(col, config as T)}
            configFormLayout={configFormLayout}
          />
        ))}
        {needShowMoreButton && (
          <div
            role="button"
            tabIndex={-1}
            css={{
              padding: theme.gridUnit * 2,
              textAlign: 'center',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontSize: theme.typography.sizes.xs,
              color: theme.colors.text.label,
              ':hover': {
                backgroundColor: theme.colors.grayscale.light4,
              },
            }}
            onClick={() => setShowAllColumns(!showAllColumns)}
          >
            {showAllColumns ? (
              <>
                <i className="fa fa-angle-up" /> &nbsp; {t('Show less columns')}
              </>
            ) : (
              <>
                <i className="fa fa-angle-down" /> &nbsp;
                {t('Show all columns')}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
