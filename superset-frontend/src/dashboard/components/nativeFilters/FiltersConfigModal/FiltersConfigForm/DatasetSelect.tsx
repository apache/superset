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
import { useCallback, useMemo, ReactNode } from 'react';
import rison from 'rison';
import { t } from '@apache-superset/core/translation';
import {
  isFeatureEnabled,
  FeatureFlag,
  JsonResponse,
  ClientErrorObject,
  getClientErrorObject,
} from '@superset-ui/core';
import { AsyncSelect } from '@superset-ui/core/components';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import {
  Dataset,
  DatasetSelectLabel,
} from 'src/features/datasets/DatasetSelectLabel';
import {
  datasetLabel,
  datasetLabelLower,
  datasetsLabelLower,
} from 'src/utils/semanticLayerLabels';

interface DatasetSelectProps {
  onChange: (value: {
    label: string | ReactNode;
    value: number;
    kind?: string;
  }) => void;
  value?: { label: string | ReactNode; value: number; kind?: string };
  excludeDatasetIds?: number[];
}

const getErrorMessage = ({ error, message }: ClientErrorObject) => {
  let errorText = message || error || t('An error has occurred');
  if (message === 'Forbidden') {
    errorText = t('You do not have permission to edit this dashboard');
  }
  return errorText;
};

/**
 * Builds a unique select-option value for the combined datasource endpoint.
 * Datasets and semantic views have independent integer ID sequences, so we
 * prefix with a type tag to avoid collisions in AsyncSelect's dedup logic.
 */
const toCompositeValue = (id: number, kind?: string): string =>
  kind === 'semantic_view' ? `sv:${id}` : `ds:${id}`;

/** Extracts the numeric ID from a composite "sv:123" / "ds:456" string. */
const fromCompositeValue = (compositeValue: string | number): number =>
  typeof compositeValue === 'string'
    ? parseInt(compositeValue.split(':')[1], 10)
    : compositeValue;

/** Derives the `kind` value from a composite string prefix. */
const kindFromComposite = (compositeValue: string): string | undefined =>
  compositeValue.startsWith('sv:') ? 'semantic_view' : undefined;

const isExcludedDatasource = (
  item: Dataset,
  excludeDatasetIds: number[],
): boolean => {
  if (!excludeDatasetIds.includes(item.id)) {
    return false;
  }

  return item.kind !== 'semantic_view';
};

export const loadDatasetOptions = async (
  search: string,
  page: number,
  pageSize: number,
  excludeDatasetIds: number[] = [],
) => {
  const useSemanticLayers = isFeatureEnabled(FeatureFlag.SemanticLayers);
  const query = rison.encode({
    ...(useSemanticLayers
      ? {}
      : {
          columns: ['id', 'table_name', 'database.database_name', 'schema'],
        }),
    filters: [{ col: 'table_name', opr: 'ct', value: search }],
    page,
    page_size: pageSize,
    order_column: 'table_name',
    order_direction: 'asc',
  });
  const endpoint = useSemanticLayers
    ? `/api/v1/datasource/?q=${query}`
    : `/api/v1/dataset/?q=${query}`;
  return cachedSupersetGet({
    endpoint,
  })
    .then((response: JsonResponse) => {
      const filteredResult = response.json.result.filter(
        (item: Dataset) => !isExcludedDatasource(item, excludeDatasetIds),
      );

      const list: {
        label: string | ReactNode;
        value: string | number;
        table_name: string;
        kind?: string;
      }[] = filteredResult.map((item: Dataset) => ({
        ...item,
        label: DatasetSelectLabel(item),
        value: useSemanticLayers
          ? toCompositeValue(item.id, item.kind)
          : item.id,
        table_name: item.table_name,
        kind: item.kind,
      }));
      return {
        data: list,
        totalCount: response.json.count ?? 0,
      };
    })
    .catch(async error => {
      const errorMessage = getErrorMessage(await getClientErrorObject(error));
      throw new Error(errorMessage);
    });
};

const DatasetSelect = ({
  onChange,
  value,
  excludeDatasetIds = [],
}: DatasetSelectProps) => {
  const useSemanticLayers = isFeatureEnabled(FeatureFlag.SemanticLayers);

  const loadDatasetOptionsCallback = useCallback(
    (search: string, page: number, pageSize: number) =>
      loadDatasetOptions(search, page, pageSize, excludeDatasetIds),
    [excludeDatasetIds],
  );

  // Convert the external numeric value to the composite string format that
  // AsyncSelect needs for matching against the loaded options.
  const selectValue = useMemo(() => {
    if (!value || !useSemanticLayers) return value;
    return {
      ...value,
      value: toCompositeValue(value.value, value.kind),
    };
  }, [value, useSemanticLayers]);

  // Convert the composite string value from the selected option back to a
  // numeric ID before passing it to the external onChange handler.
  // AsyncSelect's first argument is a LabeledValue ({key, label, value}) and
  // does NOT include custom option fields like `kind`.  We derive `kind` from
  // the composite value prefix so consumers can distinguish datasource types.
  const handleChange = useCallback(
    (selected: {
      label: string | ReactNode;
      value: number | string;
      kind?: string;
    }) => {
      if (typeof selected.value === 'string') {
        onChange({
          ...selected,
          value: fromCompositeValue(selected.value),
          kind: kindFromComposite(selected.value),
        });
      } else {
        onChange(selected as Parameters<typeof onChange>[0]);
      }
    },
    [onChange],
  );

  return (
    <AsyncSelect
      ariaLabel={datasetLabel()}
      value={selectValue}
      options={loadDatasetOptionsCallback}
      onChange={useSemanticLayers ? handleChange : onChange}
      optionFilterProps={['table_name']}
      notFoundContent={t('No compatible %s found', datasetsLabelLower())}
      placeholder={t('Select a %s', datasetLabelLower())}
    />
  );
};

const MemoizedSelect = (props: DatasetSelectProps) =>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => <DatasetSelect {...props} />, []);

export default MemoizedSelect;
