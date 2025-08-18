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
import { useMemo, useState } from 'react';
import { useTheme, t, GenericDataType } from '@superset-ui/core';

import {
  COLUMN_NAME_ALIASES,
  ControlComponentProps,
} from '@superset-ui/chart-controls';
import { Icons } from '@superset-ui/core/components';
import ColumnConfigItem from './ColumnConfigItem';
import {
  ColumnConfigInfo,
  ColumnConfig,
  ColumnConfigFormLayout,
} from './types';
import { DEFAULT_CONFIG_FORM_LAYOUT } from './constants';
import ControlHeader from '../../ControlHeader';

export type ColumnConfigControlProps<T extends ColumnConfig> =
  ControlComponentProps<Record<string, T>> & {
    columnsPropsObject?: {
      colnames: string[];
      coltypes: GenericDataType[];
      childColumnMap?: Record<string, boolean>;
      timeComparisonColumnMap?: Record<string, boolean>;
    };
    configFormLayout?: ColumnConfigFormLayout;
    appliedColumnNames?: string[];
    width?: number | string;
    height?: number | string;
  };

/**
 * Max number of columns to show by default.
 */
const MAX_NUM_COLS = 10;

/**
 * Add per-column config to queried results.
 */
export default function ColumnConfigControl<T extends ColumnConfig>({
  columnsPropsObject,
  appliedColumnNames = [],
  value,
  onChange,
  configFormLayout = DEFAULT_CONFIG_FORM_LAYOUT,
  width,
  height,
  ...props
}: ColumnConfigControlProps<T>) {
  const { colnames: _colnames, coltypes: _coltypes } = columnsPropsObject || {};
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
        isChildColumn: columnsPropsObject?.childColumnMap?.[col] ?? false,
        isTimeComparisonColumn:
          columnsPropsObject?.timeComparisonColumnMap?.[col] ?? false,
      };
    });
    return configs;
  }, [value, colnames, coltypes, columnsPropsObject?.childColumnMap]);

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

  const columnsWithChildInfo = cols.map(col => getColumnInfo(col));

  return (
    <>
      <ControlHeader {...props} />
      <div
        css={{
          border: `1px solid ${theme.colorBorder}`,
          borderRadius: theme.borderRadius,
        }}
      >
        {columnsWithChildInfo.map(col => (
          <ColumnConfigItem
            key={col.name}
            column={col}
            onChange={config => setColumnConfig(col.name, config as T)}
            configFormLayout={
              col.isTimeComparisonColumn
                ? ({
                    [col.type ?? GenericDataType.String]: [
                      {
                        tab: 'General',
                        children: [
                          ['customColumnName'],
                          ['displayTypeIcon'],
                          ['visible'],
                        ],
                      },
                      ...(configFormLayout?.[
                        col.type ?? GenericDataType.String
                      ] ?? []),
                    ],
                  } as ColumnConfigFormLayout)
                : configFormLayout
            }
            width={width}
            height={height}
          />
        ))}
        {needShowMoreButton && (
          <div
            role="button"
            tabIndex={-1}
            css={{
              padding: theme.sizeUnit * 2,
              textAlign: 'center',
              cursor: 'pointer',
              fontSize: theme.fontSizeXS,
              color: theme.colorTextLabel,
              ':hover': {
                backgroundColor: theme.colorFillContentHover,
              },
            }}
            onClick={() => setShowAllColumns(!showAllColumns)}
          >
            {showAllColumns ? (
              <>
                <Icons.UpOutlined /> &nbsp; {t('Show less columns')}
              </>
            ) : (
              <>
                <Icons.DownOutlined /> &nbsp; {t('Show all columns')}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
