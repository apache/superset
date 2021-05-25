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
import { Checkbox, Form, Input } from 'src/common/components';
import { Select } from 'src/components/Select';
import SupersetResourceSelect, {
  cachedSupersetGet,
} from 'src/components/SupersetResourceSelect';
import AdhocFilterControl from 'src/explore/components/controls/FilterControl/AdhocFilterControl';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { addDangerToast } from 'src/messageToasts/actions';
import { ClientErrorObject } from 'src/utils/getClientErrorObject';
import SelectControl from 'src/explore/components/controls/SelectControl';
import Collapse from 'src/components/Collapse';
import Button from 'src/components/Button';
import { getChartDataRequest } from 'src/chart/chartAction';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { waitForAsyncData } from 'src/middleware/asyncEvent';
import Tabs from 'src/components/Tabs';
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
import {
  CASCADING_FILTERS,
  getFiltersConfigModalTestId,
} from '../FiltersConfigModal';

const { TabPane } = Tabs;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: row-reverse;
  justify-content: space-between;
`;

const StyledDatasetContainer = styled.div`
  display: flex;
  flex-direction: row;
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

const StyledCollapse = styled(Collapse)`
  margin-left: ${({ theme }) => theme.gridUnit * -4 - 1}px;
  margin-right: ${({ theme }) => theme.gridUnit * -4}px;
  border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 0px;

  .ant-collapse-header {
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    margin-top: -1px;
    border-radius: 0px;
  }

  .ant-collapse-content {
    border: 0px;
  }

  &.ant-collapse > .ant-collapse-item {
    border: 0px;
    border-radius: 0px;
  }
`;

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav-list {
    padding: 0px;
  }
`;

const FilterTabs = {
  configuration: {
    key: 'configuration',
    name: t('Configuration'),
  },
  scoping: {
    key: 'scoping',
    name: t('Scoping'),
  },
};

const FilterPanels = {
  basic: {
    key: 'basic',
    name: t('Basic'),
  },
  advanced: {
    key: 'advanced',
    name: t('Advanced'),
  },
};

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
  const formFilter = form.getFieldValue('filters')?.[filterId] || {};
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
  // @ts-ignore
  const enableNoResults = !!nativeFilterItems[formFilter?.filterType]?.value
    ?.enableNoResults;
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

  const isCascadingFilter = CASCADING_FILTERS.includes(formFilter?.filterType);

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

  const showDefaultValue = !hasDataset || (!isDataDirty && hasFilledDataset);

  return (
    <>
      <StyledTabs defaultActiveKey={FilterTabs.configuration.key} centered>
        <TabPane
          tab={FilterTabs.configuration.name}
          key={FilterTabs.configuration.key}
          forceRender
        >
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
                    defaultDataMask: null,
                  });
                  forceUpdate();
                }}
              />
            </StyledFormItem>
          </StyledContainer>
          {hasDataset && (
            <StyledDatasetContainer>
              <StyledFormItem
                name={['filters', filterId, 'dataset']}
                initialValue={{ value: initialDatasetId }}
                label={<StyledLabel>{t('Dataset')}</StyledLabel>}
                rules={[
                  { required: !removed, message: t('Dataset is required') },
                ]}
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
                        defaultDataMask: null,
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
                  rules={[
                    { required: !removed, message: t('Field is required') },
                  ]}
                  data-test="field-input"
                >
                  <ColumnSelect
                    form={form}
                    filterId={filterId}
                    datasetId={datasetId}
                    onChange={() => {
                      // We need reset default value when when column changed
                      setNativeFilterFieldValues(form, filterId, {
                        defaultDataMask: null,
                      });
                      forceUpdate();
                    }}
                  />
                </StyledFormItem>
              )}
            </StyledDatasetContainer>
          )}
          <StyledCollapse>
            <Collapse.Panel
              header={FilterPanels.basic.name}
              key={FilterPanels.basic.key}
            >
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
              {isCascadingFilter && (
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
              )}
              <StyledContainer>
                <StyledFormItem className="bottom" label={<StyledLabel />}>
                  {hasDataset && hasFilledDataset && (
                    <Button onClick={refreshHandler}>
                      {isDataDirty ? t('Populate') : t('Refresh')}
                    </Button>
                  )}
                </StyledFormItem>
                <StyledFormItem
                  name={['filters', filterId, 'defaultDataMask']}
                  initialValue={filterToEdit?.defaultDataMask}
                  data-test="default-input"
                  label={<StyledLabel>{t('Default Value')}</StyledLabel>}
                >
                  {showDefaultValue ? (
                    <DefaultValue
                      setDataMask={dataMask => {
                        setNativeFilterFieldValues(form, filterId, {
                          defaultDataMask: dataMask,
                        });
                        forceUpdate();
                      }}
                      filterId={filterId}
                      hasDataset={hasDataset}
                      form={form}
                      formData={newFormData}
                      enableNoResults={enableNoResults}
                    />
                  ) : hasFilledDataset ? (
                    t('Click "Populate" to get "Default Value" ->')
                  ) : (
                    t('Fill all required fields to enable "Default Value"')
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
                disabled={!showDefaultValue}
                filterToEdit={filterToEdit}
                formFilter={formFilter}
                filterId={filterId}
                form={form}
                forceUpdate={forceUpdate}
              />
            </Collapse.Panel>
            {((hasDataset && hasAdditionalFilters) || hasMetrics) && (
              <Collapse.Panel
                header={FilterPanels.advanced.name}
                key={FilterPanels.advanced.key}
              >
                {hasDataset && hasAdditionalFilters && (
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
              </Collapse.Panel>
            )}
          </StyledCollapse>
        </TabPane>
        <TabPane
          tab={FilterTabs.scoping.name}
          key={FilterTabs.scoping.key}
          forceRender
        >
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
        </TabPane>
      </StyledTabs>
    </>
  );
};

export default FiltersConfigForm;
