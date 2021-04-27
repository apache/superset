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
import {
  AdhocFilter,
  Behavior,
  ChartDataResponseResult,
  getChartMetadataRegistry,
  JsonResponse,
  styled,
  SupersetApiError,
  t,
} from '@superset-ui/core';
import {
  ColumnMeta,
  DatasourceMeta,
  Metric,
} from '@superset-ui/chart-controls';
import { FormInstance } from 'antd/lib/form';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Checkbox, Form, Input, Typography } from 'src/common/components';
import { Select } from 'src/components/Select';
import SupersetResourceSelect, {
  cachedSupersetGet,
} from 'src/components/SupersetResourceSelect';
import AdhocFilterControl from 'src/explore/components/controls/FilterControl/AdhocFilterControl';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { addDangerToast } from 'src/messageToasts/actions';
import { ClientErrorObject } from 'src/utils/getClientErrorObject';
import SelectControl from 'src/explore/components/controls/SelectControl';
import Button from 'src/components/Button';
import { getChartDataRequest } from 'src/chart/chartAction';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { waitForAsyncData } from 'src/middleware/asyncEvent';
import { ColumnSelect } from './ColumnSelect';
import { NativeFiltersForm } from '../types';
import {
  datasetToSelectOption,
  setNativeFilterFieldValues,
  useForceUpdate,
} from './utils';
import { useBackendFormUpdate } from './state';
import { getFormData } from '../../utils';
import { Filter } from '../../types';
import ControlItems from './ControlItems';
import FilterScope from './FilterScope/FilterScope';
import RemovedFilter from './RemovedFilter';
import DefaultValue from './DefaultValue';
import { getFiltersConfigModalTestId } from '../FiltersConfigModal';
// TODO: move styles from AdhocFilterControl to emotion and delete this ./main.less
import './main.less';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: row-reverse;
  justify-content: space-between;
`;

export const StyledFormItem = styled(Form.Item)`
  width: 49%;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

export const StyledCheckboxFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

export const StyledLabel = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  text-transform: uppercase;
`;

const CleanFormItem = styled(Form.Item)`
  margin-bottom: 0;
`;

export interface FiltersConfigFormProps {
  filterId: string;
  filterToEdit?: Filter;
  removed?: boolean;
  restoreFilter: (filterId: string) => void;
  form: FormInstance<NativeFiltersForm>;
  parentFilters: { id: string; title: string }[];
}

// TODO: Need to do with it something
const FILTERS_WITHOUT_COLUMN = [
  'filter_timegrain',
  'filter_timecolumn',
  'filter_groupby',
];
const FILTERS_WITH_ADHOC_FILTERS = ['filter_select', 'filter_range'];

/**
 * The configuration form for a specific filter.
 * Assigns field values to `filters[filterId]` in the form.
 */
export const FiltersConfigForm: React.FC<FiltersConfigFormProps> = ({
  filterId,
  filterToEdit,
  removed,
  restoreFilter,
  form,
  parentFilters,
}) => {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const forceUpdate = useForceUpdate();
  const [datasetDetails, setDatasetDetails] = useState<Record<string, any>>();

  // make sure the formFilter is populated
  if (!form.getFieldValue('filters')) {
    setNativeFilterFieldValues(form, filterId, filterToEdit || {});
    forceUpdate();
  }
  const formFilter = form.getFieldValue('filters')[filterId];

  useEffect(() => {
    setNativeFilterFieldValues(form, filterId, {
      defaultValue: filterToEdit?.defaultValue,
    });
    forceUpdate();
  }, [form, forceUpdate, filterId, filterToEdit?.defaultValue]);

  const nativeFilterItems = getChartMetadataRegistry().items;
  const nativeFilterVizTypes = Object.entries(nativeFilterItems)
    // @ts-ignore
    .filter(([, { value }]) =>
      value.behaviors?.includes(Behavior.NATIVE_FILTER),
    )
    .map(([key]) => key);

  const loadedDatasets = useSelector<any, DatasourceMeta>(
    ({ datasources }) => datasources,
  );

  // @ts-ignore
  const hasDataset = !!nativeFilterItems[formFilter?.filterType]?.value
    ?.datasourceCount;
  const hasColumn =
    hasDataset && !FILTERS_WITHOUT_COLUMN.includes(formFilter?.filterType);

  const datasetId = formFilter?.dataset?.value;

  useEffect(() => {
    if (datasetId && hasColumn) {
      cachedSupersetGet({
        endpoint: `/api/v1/dataset/${datasetId}`,
      })
        .then((response: JsonResponse) => {
          setMetrics(response.json?.result?.metrics);
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
  }, [datasetId, hasColumn]);

  const hasMetrics = hasColumn && !!metrics.length;

  const hasFilledDataset =
    !hasDataset || (datasetId && (formFilter?.column || !hasColumn));

  const hasAdditionalFilters = FILTERS_WITH_ADHOC_FILTERS.includes(
    formFilter?.filterType,
  );

  const isDataDirty = formFilter?.isDataDirty ?? true;

  useBackendFormUpdate(form, filterId);

  const refreshHandler = () => {
    if (!hasDataset || !formFilter?.dataset?.value) {
      forceUpdate();
      return;
    }
    const formData = getFormData({
      datasetId: formFilter?.dataset?.value,
      groupby: formFilter?.column,
      defaultValue: formFilter?.defaultValue,
      ...formFilter,
    });
    setNativeFilterFieldValues(form, filterId, {
      defaultValueQueriesData: null,
      isDataDirty: false,
    });
    forceUpdate();
    getChartDataRequest({
      formData,
      force: false,
      requestParams: { dashboardId: 0 },
    }).then(response => {
      if (isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) {
        // deal with getChartDataRequest transforming the response data
        const result = 'result' in response ? response.result[0] : response;
        waitForAsyncData(result)
          .then((asyncResult: ChartDataResponseResult[]) => {
            setNativeFilterFieldValues(form, filterId, {
              defaultValueQueriesData: asyncResult,
            });
            forceUpdate();
          })
          .catch((error: ClientErrorObject) => {
            // TODO: show error once this logic is moved into new NativeFilter
            //  component
            console.error(
              error.message || error.error || t('Check configuration'),
            );
          });
      } else {
        setNativeFilterFieldValues(form, filterId, {
          defaultValueQueriesData: response.result,
        });
        forceUpdate();
      }
    });
  };

  const defaultDatasetSelectOptions = Object.values(loadedDatasets).map(
    datasetToSelectOption,
  );
  const initialDatasetId =
    filterToEdit?.targets[0]?.datasetId ??
    (defaultDatasetSelectOptions.length === 1
      ? defaultDatasetSelectOptions[0].value
      : undefined);
  const initColumn = filterToEdit?.targets[0]?.column?.name;
  const newFormData = getFormData({
    datasetId,
    groupby: hasColumn ? formFilter?.column : undefined,
    defaultValue: formFilter?.defaultValue,
    ...formFilter,
  });

  const onDatasetSelectError = useCallback(
    ({ error, message }: ClientErrorObject) => {
      let errorText = message || error || t('An error has occurred');
      if (message === 'Forbidden') {
        errorText = t('You do not have permission to edit this dashboard');
      }
      addDangerToast(errorText);
    },
    [],
  );

  if (removed) {
    return <RemovedFilter onClick={() => restoreFilter(filterId)} />;
  }

  const parentFilterOptions = parentFilters.map(filter => ({
    value: filter.id,
    label: filter.title,
  }));

  return (
    <>
      <Typography.Title level={5}>{t('Settings')}</Typography.Title>
      <StyledContainer>
        <StyledFormItem
          name={['filters', filterId, 'name']}
          label={<StyledLabel>{t('Filter name')}</StyledLabel>}
          initialValue={filterToEdit?.name}
          rules={[{ required: !removed, message: t('Name is required') }]}
        >
          <Input {...getFiltersConfigModalTestId('name-input')} />
        </StyledFormItem>
        <StyledFormItem
          name={['filters', filterId, 'filterType']}
          rules={[{ required: !removed, message: t('Name is required') }]}
          initialValue={filterToEdit?.filterType || 'filter_select'}
          label={<StyledLabel>{t('Filter Type')}</StyledLabel>}
          {...getFiltersConfigModalTestId('filter-type')}
        >
          <Select
            options={nativeFilterVizTypes.map(filterType => ({
              value: filterType,
              // @ts-ignore
              label: nativeFilterItems[filterType]?.value.name,
            }))}
            onChange={({ value }: { value: string }) => {
              setNativeFilterFieldValues(form, filterId, {
                filterType: value,
                defaultValue: null,
              });
              forceUpdate();
            }}
          />
        </StyledFormItem>
      </StyledContainer>
      {hasDataset && (
        <>
          <StyledFormItem
            name={['filters', filterId, 'dataset']}
            initialValue={{ value: initialDatasetId }}
            label={<StyledLabel>{t('Dataset')}</StyledLabel>}
            rules={[{ required: !removed, message: t('Dataset is required') }]}
            {...getFiltersConfigModalTestId('datasource-input')}
          >
            <SupersetResourceSelect
              initialId={initialDatasetId}
              resource="dataset"
              searchColumn="table_name"
              transformItem={datasetToSelectOption}
              isMulti={false}
              onError={onDatasetSelectError}
              defaultOptions={Object.values(loadedDatasets).map(
                datasetToSelectOption,
              )}
              onChange={e => {
                // We need reset column when dataset changed
                if (datasetId && e?.value !== datasetId) {
                  setNativeFilterFieldValues(form, filterId, {
                    defaultValue: null,
                    column: null,
                  });
                }
                forceUpdate();
              }}
            />
          </StyledFormItem>
          {hasColumn && (
            <StyledFormItem
              // don't show the column select unless we have a dataset
              // style={{ display: datasetId == null ? undefined : 'none' }}
              name={['filters', filterId, 'column']}
              initialValue={initColumn}
              label={<StyledLabel>{t('Column')}</StyledLabel>}
              rules={[{ required: !removed, message: t('Field is required') }]}
              data-test="field-input"
            >
              <ColumnSelect
                form={form}
                filterId={filterId}
                datasetId={datasetId}
                onChange={e => {
                  // We need reset default value when when column changed
                  setNativeFilterFieldValues(form, filterId, {
                    defaultValue: null,
                  });
                  forceUpdate();
                }}
              />
            </StyledFormItem>
          )}
          {hasAdditionalFilters && (
            <>
              <StyledFormItem
                name={['filters', filterId, 'adhoc_filters']}
                initialValue={filterToEdit?.adhoc_filters}
              >
                <AdhocFilterControl
                  columns={
                    datasetDetails?.columns?.filter(
                      (c: ColumnMeta) => c.filterable,
                    ) || []
                  }
                  savedMetrics={datasetDetails?.metrics || []}
                  datasource={datasetDetails}
                  onChange={(filters: AdhocFilter[]) => {
                    setNativeFilterFieldValues(form, filterId, {
                      adhoc_filters: filters,
                    });
                    forceUpdate();
                  }}
                  label={<StyledLabel>{t('Adhoc filters')}</StyledLabel>}
                />
              </StyledFormItem>
              <StyledFormItem
                name={['filters', filterId, 'time_range']}
                label={<StyledLabel>{t('Time range')}</StyledLabel>}
                initialValue={filterToEdit?.time_range || 'No filter'}
              >
                <DateFilterControl
                  name="time_range"
                  onChange={timeRange => {
                    setNativeFilterFieldValues(form, filterId, {
                      time_range: timeRange,
                    });
                    forceUpdate();
                  }}
                />
              </StyledFormItem>
            </>
          )}
        </>
      )}
      {hasFilledDataset && (
        <CleanFormItem
          name={['filters', filterId, 'defaultValueFormData']}
          hidden
          initialValue={newFormData}
        />
      )}
      <CleanFormItem
        name={['filters', filterId, 'defaultValueQueriesData']}
        hidden
        initialValue={null}
      />
      <StyledFormItem
        name={['filters', filterId, 'parentFilter']}
        label={<StyledLabel>{t('Parent filter')}</StyledLabel>}
        initialValue={parentFilterOptions.find(
          ({ value }) => value === filterToEdit?.cascadeParentIds[0],
        )}
        data-test="parent-filter-input"
      >
        <Select
          placeholder={t('None')}
          options={parentFilterOptions}
          isClearable
        />
      </StyledFormItem>
      <StyledContainer>
        <StyledFormItem className="bottom" label={<StyledLabel />}>
          {hasDataset && hasFilledDataset && (
            <Button onClick={refreshHandler}>
              {isDataDirty ? t('Populate') : t('Refresh')}
            </Button>
          )}
        </StyledFormItem>
        <StyledFormItem
          name={['filters', filterId, 'defaultValue']}
          initialValue={filterToEdit?.defaultValue}
          data-test="default-input"
          label={<StyledLabel>{t('Default Value')}</StyledLabel>}
        >
          {!isDataDirty && (hasFilledDataset || !hasDataset) && (
            <DefaultValue
              setDataMask={({ filterState }) => {
                setNativeFilterFieldValues(form, filterId, {
                  defaultValue: filterState?.value,
                });
                forceUpdate();
              }}
              filterId={filterId}
              hasDataset={hasDataset}
              form={form}
              formData={newFormData}
            />
          )}
        </StyledFormItem>
      </StyledContainer>
      <StyledCheckboxFormItem
        name={['filters', filterId, 'isInstant']}
        initialValue={filterToEdit?.isInstant || false}
        valuePropName="checked"
        colon={false}
      >
        <Checkbox data-test="apply-changes-instantly-checkbox">
          {t('Apply changes instantly')}
        </Checkbox>
      </StyledCheckboxFormItem>
      <ControlItems
        filterToEdit={filterToEdit}
        formFilter={formFilter}
        filterId={filterId}
        form={form}
        forceUpdate={forceUpdate}
      />
      {hasMetrics && (
        <StyledFormItem
          // don't show the column select unless we have a dataset
          // style={{ display: datasetId == null ? undefined : 'none' }}
          name={['filters', filterId, 'sortMetric']}
          initialValue={filterToEdit?.sortMetric}
          label={<StyledLabel>{t('Sort Metric')}</StyledLabel>}
          data-test="field-input"
        >
          <SelectControl
            form={form}
            filterId={filterId}
            name="sortMetric"
            options={metrics.map((metric: Metric) => ({
              value: metric.metric_name,
              label: metric.verbose_name ?? metric.metric_name,
            }))}
            onChange={(value: string | null): void => {
              if (value !== undefined) {
                setNativeFilterFieldValues(form, filterId, {
                  sortMetric: value,
                });
                forceUpdate();
              }
            }}
          />
        </StyledFormItem>
      )}
      <FilterScope
        updateFormValues={(values: any) =>
          setNativeFilterFieldValues(form, filterId, values)
        }
        pathToFormValue={['filters', filterId]}
        forceUpdate={forceUpdate}
        scope={filterToEdit?.scope}
        formScope={formFilter?.scope}
        formScoping={formFilter?.scoping}
      />
    </>
  );
};

export default FiltersConfigForm;
