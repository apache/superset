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
/* eslint-disable no-param-reassign */
import {
  DataMask,
  ExtraFormData,
  getClientErrorObject,
  JsonObject,
  JsonResponse,
  smartDateDetailedFormatter,
  styled,
  SupersetApiError,
  SupersetClient,
  t,
  useChangeEffect,
} from '@superset-ui/core';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useImmerReducer } from 'use-immer';
import AdhocFilterControl from 'src/explore/components/controls/FilterControl/AdhocFilterControl';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { PluginFilterAdhocProps } from './types';
import {
  StyledFormItem,
  FilterPluginStyle,
  StatusMessage,
} from '../common';
import { getDataRecordFormatter, getAdhocExtraFormData } from '../../utils';
import { cacheWrapper } from 'src/utils/cacheWrapper';
import { addDangerToast } from 'src/components/MessageToasts/actions';

type DataMaskAction =
  | { type: 'ownState'; ownState: JsonObject }
  | {
      type: 'filterState';
      __cache: JsonObject;
      extraFormData: ExtraFormData;
      filterState: {
        label?: string;
        filters?: AdhocFilter[];
        value?: AdhocFilter[] | null;
      };
    };

function reducer(
  draft: DataMask & { __cache?: JsonObject },
  action: DataMaskAction,
) {
  switch (action.type) {
    case 'ownState':
      draft.ownState = {
        ...draft.ownState,
        ...action.ownState,
      };
      return draft;
    case 'filterState':
      draft.extraFormData = action.extraFormData;
      // eslint-disable-next-line no-underscore-dangle
      draft.__cache = action.__cache;
      draft.filterState = { ...draft.filterState, ...action.filterState };
      return draft;
    default:
      return draft;
  }
}

const ControlContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  & > span,
  & > span:hover {
    border: 2px solid transparent;
    display: inline-block;
    border: ${({ theme, validateStatus }) =>
      validateStatus && `2px solid ${theme.colors[validateStatus]?.base}`};
  }
  &:focus {
    & > span {
      border: 2px solid
        ${({ theme, validateStatus }) =>
          validateStatus
            ? theme.colors[validateStatus]?.base
            : theme.colors.primary.base};
      outline: 0;
      box-shadow: 0 0 0 2px
        ${({ validateStatus }) =>
          validateStatus
            ? 'rgba(224, 67, 85, 12%)'
            : 'rgba(32, 167, 201, 0.2)'};
    }
  }
`;

export default function PluginFilterAdhoc(props: PluginFilterAdhocProps) {
  const {
    filterState,
    formData,
    height,
    width,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    appSection,
  } = props;
  const { enableEmptyFilter } = formData;
  const datasetId = useMemo(
    () => formData.datasource.split('_')[0],
    [formData.datasource],
  );
  const [datasetDetails, setDatasetDetails] = useState<Record<string, any>>();
  const [columns, setColumns] = useState();
  const [dataMask, dispatchDataMask] = useImmerReducer(reducer, {
    extraFormData: {},
    filterState,
  });
  const labelFormatter = useMemo(
    () =>
      getDataRecordFormatter({
        timeFormatter: smartDateDetailedFormatter,
      }),
    [],
  );

  const localCache = new Map<string, any>();

  const cachedSupersetGet = cacheWrapper(
    SupersetClient.get,
    localCache,
    ({ endpoint }) => endpoint || '',
  );

  useChangeEffect(datasetId, () => {
    if (datasetId) {
      cachedSupersetGet({
        endpoint: `/api/v1/dataset/${datasetId}`,
      })
        .then((response: JsonResponse) => {
          const dataset = response.json?.result;
          // modify the response to fit structure expected by AdhocFilterControl
          dataset.type = dataset.datasource_type;
          dataset.filter_select = true;
          setDatasetDetails(dataset);
        })
        .catch((response: SupersetApiError) => {
          addDangerToast(response.message);
        });
    }
  });

  useChangeEffect(datasetId, () => {
    if (datasetId != null) {
      cachedSupersetGet({
        endpoint: `/api/v1/dataset/${datasetId}`,
      }).then(
        ({ json: { result } }) => {
          setColumns(result.columns);
        },
        async badResponse => {
          const { error, message } = await getClientErrorObject(badResponse);
          let errorText = message || error || t('An error has occurred');
          if (message === 'Forbidden') {
            errorText = t('You do not have permission to access this dataset');
          }
          addDangerToast(errorText);
        },
      );
    }
  });

  const updateDataMask = useCallback(
    (adhoc_filters: AdhocFilter[]) => {
      const emptyFilter = enableEmptyFilter && !adhoc_filters?.length;

      dispatchDataMask({
        type: 'filterState',
        __cache: filterState,
        extraFormData: getAdhocExtraFormData(adhoc_filters, emptyFilter),
        filterState: {
          ...filterState,
          label: (adhoc_filters || [])
            .map(f =>
              f.sqlExpression ? String(f.sqlExpression) : f.getDefaultLabel(),
            )
            .join(', '),
          value: adhoc_filters?.length ? adhoc_filters : null,
          filters: adhoc_filters,
        },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      appSection,
      dispatchDataMask,
      enableEmptyFilter,
      JSON.stringify(filterState),
      labelFormatter,
    ],
  );

  useEffect(() => {
    updateDataMask(filterState.value);
  }, [JSON.stringify(filterState.value)]);

  useEffect(() => {
    setDataMask(dataMask);
  }, [JSON.stringify(dataMask)]);

  const formItemExtra = useMemo(() => {
    if (filterState.validateMessage) {
      return (
        <StatusMessage status={filterState.validateStatus}>
          {filterState.validateMessage}
        </StatusMessage>
      );
    }
    return undefined;
  }, [filterState.validateMessage, filterState.validateStatus]);

  return (
    <FilterPluginStyle height={height} width={width}>
      <StyledFormItem
        validateStatus={filterState.validateStatus}
        extra={formItemExtra}
      >
        <ControlContainer
          onMouseEnter={setFocusedFilter}
          onMouseLeave={unsetFocusedFilter}
          validateStatus={filterState.validateStatus}
        >
          <AdhocFilterControl
            columns={columns || []}
            savedMetrics={[]}
            datasource={datasetDetails}
            onChange={(filters: AdhocFilter[]) => {
              // New Adhoc Filters Selected
              updateDataMask(filters);
            }}
            value={filterState.filters || null}
            showAddButton
          />
        </ControlContainer>
      </StyledFormItem>
    </FilterPluginStyle>
  );
}
