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
import { FC, useMemo } from 'react';
import { t } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
import { ControlComponentProps, ColumnMeta } from '../../types';
import { ControlHeader } from '../../components/ControlHeader';

export interface GranularityControlValue {
  column_name: string;
  type?: string;
  is_dttm?: boolean;
}

export interface GranularityControlProps
  extends ControlComponentProps<GranularityControlValue | string> {
  columns?: ColumnMeta[];
  datasource?: {
    columns?: ColumnMeta[];
    verbose_map?: Record<string, string>;
  };
  clearable?: boolean;
  temporalColumnsOnly?: boolean;
}

const GranularityControl: FC<GranularityControlProps> = ({
  value,
  onChange,
  columns = [],
  datasource,
  clearable = false,
  temporalColumnsOnly = true,
  name,
  label,
  description,
  validationErrors,
  renderTrigger,
  ...props
}) => {
  const allColumns = useMemo(() => {
    const cols = columns.length > 0 ? columns : datasource?.columns || [];
    if (temporalColumnsOnly) {
      return cols.filter(col => col.is_dttm);
    }
    return cols;
  }, [columns, datasource?.columns, temporalColumnsOnly]);

  const options = useMemo(
    () =>
      allColumns.map(col => ({
        value: col.column_name,
        label:
          datasource?.verbose_map?.[col.column_name] ||
          col.verbose_name ||
          col.column_name,
      })),
    [allColumns, datasource?.verbose_map],
  );

  const currentValue = useMemo(() => {
    if (typeof value === 'string') {
      return value;
    }
    return value?.column_name;
  }, [value]);

  const handleChange = (newValue: string | undefined) => {
    if (onChange) {
      if (!newValue && clearable) {
        onChange(null as any);
      } else if (newValue) {
        const column = allColumns.find(col => col.column_name === newValue);
        if (column) {
          onChange({
            column_name: column.column_name,
            type: column.type,
            is_dttm: column.is_dttm,
          });
        }
      }
    }
  };

  return (
    <div>
      <ControlHeader
        name={name}
        label={label || t('Time Column')}
        description={
          description ||
          t(
            'The time column for the visualization. Note that you ' +
              'can define arbitrary expression that return a DATETIME ' +
              'column in the table. Also note that the ' +
              'filter below is applied against this column or ' +
              'expression',
          )
        }
        validationErrors={validationErrors}
        renderTrigger={renderTrigger}
      />
      <Select
        value={currentValue}
        onChange={handleChange}
        options={options}
        placeholder={t('Select a temporal column')}
        allowClear={clearable}
        showSearch
        css={{ width: '100%' }}
      />
    </div>
  );
};

export default GranularityControl;
