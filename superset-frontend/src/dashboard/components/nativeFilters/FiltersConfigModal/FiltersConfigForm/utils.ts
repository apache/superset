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
import { flatMapDeep } from 'lodash';
import { FormInstance } from 'antd/lib/form';
import React from 'react';
import { CustomControlItem, DatasourceMeta } from '@superset-ui/chart-controls';
import { Column, ensureIsArray, GenericDataType } from '@superset-ui/core';

const FILTERS_FIELD_NAME = 'filters';

export const FILTER_GROUPS = {
  TIME: ['filter_time', 'filter_timegrain', 'filter_timecolumn'],
  NUMERIC: ['filter_range'],
};

export const useForceUpdate = () => {
  const [, updateState] = React.useState({});
  return React.useCallback(() => updateState({}), []);
};

export const setNativeFilterFieldValues = (
  form: FormInstance,
  filterId: string,
  values: object,
) => {
  const formFilters = form.getFieldValue(FILTERS_FIELD_NAME) || {};
  form.setFields([
    {
      name: FILTERS_FIELD_NAME,
      value: {
        ...formFilters,
        [filterId]: {
          ...formFilters[filterId],
          ...values,
        },
      },
    },
  ]);
};

export const getControlItems = (
  controlConfig: { [key: string]: any } = {},
): CustomControlItem[] =>
  (flatMapDeep(controlConfig.controlPanelSections)?.reduce(
    (acc: any, { controlSetRows = [] }: any) => [
      ...acc,
      ...flatMapDeep(controlSetRows),
    ],
    [],
  ) as CustomControlItem[]) ?? [];

type DatasetSelectValue = {
  value: number;
  label: string;
};

export const datasetToSelectOption = (
  item: DatasourceMeta & { table_name: string },
): DatasetSelectValue => ({
  value: item.id,
  label: item.table_name,
});

// TODO: add column_types field to DatasourceMeta
// We return true if column_types is undefined or empty as a precaution against backend failing to return column_types
export const hasTemporalColumns = (
  dataset: DatasourceMeta & { column_types: GenericDataType[] },
) => {
  const columnTypes = ensureIsArray(dataset?.column_types);
  return (
    columnTypes.length === 0 || columnTypes.includes(GenericDataType.TEMPORAL)
  );
};

export const isColumnOfType = (column: Column, type: GenericDataType) =>
  column.type_generic === type;

export const doesColumnMatchFilterType = (
  filterType: string,
  column: Column,
) => {
  if (FILTER_GROUPS.NUMERIC.includes(filterType)) {
    return isColumnOfType(column, GenericDataType.NUMERIC);
  }
  return true;
};
