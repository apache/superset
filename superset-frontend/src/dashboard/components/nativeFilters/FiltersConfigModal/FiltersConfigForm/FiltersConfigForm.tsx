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
  Column,
  GenericDataType,
  getChartMetadataRegistry,
  JsonResponse,
  styled,
  SupersetApiError,
  t,
  SupersetClient,
} from '@superset-ui/core';
import {
  ColumnMeta,
  InfoTooltipWithTrigger,
  Metric,
} from '@superset-ui/chart-controls';
import { FormInstance } from 'antd/lib/form';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { isEqual } from 'lodash';
import { FormItem } from 'src/components/Form';
import { Input } from 'src/common/components';
import { Select } from 'src/components';
import { cacheWrapper } from 'src/utils/cacheWrapper';
import AdhocFilterControl from 'src/explore/components/controls/FilterControl/AdhocFilterControl';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { ClientErrorObject } from 'src/utils/getClientErrorObject';
import Collapse from 'src/components/Collapse';
import { getChartDataRequest } from 'src/chart/chartAction';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { waitForAsyncData } from 'src/middleware/asyncEvent';
import Tabs from 'src/components/Tabs';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import { Radio } from 'src/components/Radio';
import BasicErrorAlert from 'src/components/ErrorMessage/BasicErrorAlert';
import {
  Chart,
  ChartsState,
  DatasourcesState,
  RootState,
} from 'src/dashboard/types';
import Loading from 'src/components/Loading';
import { ColumnSelect } from './ColumnSelect';
import { NativeFiltersForm } from '../types';
import {
  FILTER_SUPPORTED_TYPES,
  hasTemporalColumns,
  setNativeFilterFieldValues,
  useForceUpdate,
  mostUsedDataset,
} from './utils';
import { useBackendFormUpdate, useDefaultValue } from './state';
import { getFormData } from '../../utils';
import { Filter, NativeFilterType } from '../../types';
import getControlItemsMap from './getControlItemsMap';
import FilterScope from './FilterScope/FilterScope';
import RemovedFilter from './RemovedFilter';
import DefaultValue from './DefaultValue';
import { CollapsibleControl } from './CollapsibleControl';
import {
  CASCADING_FILTERS,
  getFiltersConfigModalTestId,
} from '../FiltersConfigModal';
import DatasetSelect from './DatasetSelect';

const { TabPane } = Tabs;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: row-reverse;
  justify-content: space-between;
`;

const StyledRowContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
`;

export const StyledFormItem = styled(FormItem)`
  width: 49%;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;

  & .ant-form-item-label {
    padding-bottom: 0;
  }

  & .ant-form-item-control-input {
    min-height: ${({ theme }) => theme.gridUnit * 10}px;
  }
`;

export const StyledRowFormItem = styled(FormItem)`
  margin-bottom: 0;
  padding-bottom: 0;
  min-width: 50%;

  & .ant-form-item-label {
    padding-bottom: 0;
  }

  .ant-form-item-control-input-content > div > div {
    height: auto;
  }

  & .ant-form-item-control-input {
    min-height: ${({ theme }) => theme.gridUnit * 10}px;
  }
`;

export const StyledRowSubFormItem = styled(FormItem)`
  min-width: 50%;

  & .ant-form-item-label {
    padding-bottom: 0;
  }

  .ant-form-item {
    margin-bottom: 0;
  }

  .ant-form-item-control-input-content > div > div {
    height: auto;
  }

  .ant-form-item-extra {
    display: none;
  }

  & .ant-form-item-control-input {
    height: auto;
  }
`;

export const StyledLabel = styled.span`
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  text-transform: uppercase;
`;

const CleanFormItem = styled(FormItem)`
  margin-bottom: 0;
`;

const DefaultValueContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const RefreshIcon = styled(Icons.Refresh)`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  color: ${({ theme }) => theme.colors.primary.base};
`;

const StyledCollapse = styled(Collapse)`
  margin-left: ${({ theme }) => theme.gridUnit * -4 - 1}px;
  margin-right: ${({ theme }) => theme.gridUnit * -4}px;
  border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 0;

  .ant-collapse-header {
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    margin-top: -1px;
    border-radius: 0;
  }

  .ant-collapse-content {
    border: 0;
  }

  .ant-collapse-content-box {
    padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  }

  &.ant-collapse > .ant-collapse-item {
    border: 0;
    border-radius: 0;
  }
`;

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav {
    position: sticky;
    margin-left: ${({ theme }) => theme.gridUnit * -4}px;
    margin-right: ${({ theme }) => theme.gridUnit * -4}px;
    top: 0;
    background: white;
    z-index: 1;
  }

  .ant-tabs-nav-list {
    padding: 0;
  }

  .ant-form-item-label {
    padding-bottom: 0;
  }
`;

const StyledAsterisk = styled.span`
  color: ${({ theme }) => theme.colors.error.base};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  margin-left: ${({ theme }) => theme.gridUnit - 1}px;
  &:before {
    content: '*';
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

const FILTERS_WITH_ADHOC_FILTERS = ['filter_select', 'filter_range'];

const BASIC_CONTROL_ITEMS = ['enableEmptyFilter', 'multiSelect'];

// TODO: Rename the filter plugins and remove this mapping
const FILTER_TYPE_NAME_MAPPING = {
  [t('Select filter')]: t('Value'),
  [t('Range filter')]: t('Numerical range'),
  [t('Time filter')]: t('Time range'),
  [t('Time column')]: t('Time column'),
  [t('Time grain')]: t('Time grain'),
  [t('Group By')]: t('Group by'),
};

const localCache = new Map<string, any>();

const cachedSupersetGet = cacheWrapper(
  SupersetClient.get,
  localCache,
  ({ endpoint }) => endpoint || '',
);

/**
 * The configuration form for a specific filter.
 * Assigns field values to `filters[filterId]` in the form.
 */
const FiltersConfigForm = (
  {
    filterId,
    filterToEdit,
    removed,
    restoreFilter,
    form,
    parentFilters,
  }: FiltersConfigFormProps,
  ref: React.RefObject<any>,
) => {
  const [error, setError] = useState<string>('');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string>(
    FilterTabs.configuration.key,
  );
  const [activeFilterPanelKey, setActiveFilterPanelKey] = useState<
    string | string[]
  >(FilterPanels.basic.key);

  const forceUpdate = useForceUpdate();
  const [datasetDetails, setDatasetDetails] = useState<Record<string, any>>();
  const defaultFormFilter = useMemo(() => ({}), []);
  const formFilter =
    form.getFieldValue('filters')?.[filterId] || defaultFormFilter;

  const nativeFilterItems = getChartMetadataRegistry().items;
  const nativeFilterVizTypes = Object.entries(nativeFilterItems)
    // @ts-ignore
    .filter(([, { value }]) =>
      value.behaviors?.includes(Behavior.NATIVE_FILTER),
    )
    .map(([key]) => key);

  const loadedDatasets = useSelector<RootState, DatasourcesState>(
    ({ datasources }) => datasources,
  );

  const charts = useSelector<RootState, ChartsState>(({ charts }) => charts);

  const doLoadedDatasetsHaveTemporalColumns = useMemo(
    () =>
      Object.values(loadedDatasets).some(dataset =>
        hasTemporalColumns(dataset),
      ),
    [loadedDatasets],
  );

  const showTimeRangePicker = useMemo(() => {
    const currentDataset = Object.values(loadedDatasets).find(
      dataset => dataset.id === formFilter.dataset?.value,
    );

    return currentDataset ? hasTemporalColumns(currentDataset) : true;
  }, [formFilter.dataset?.value, loadedDatasets]);

  // @ts-ignore
  const hasDataset = !!nativeFilterItems[formFilter?.filterType]?.value
    ?.datasourceCount;

  const datasetId =
    formFilter?.dataset?.value ??
    filterToEdit?.targets[0]?.datasetId ??
    mostUsedDataset(loadedDatasets, charts);

  const { controlItems = {}, mainControlItems = {} } = formFilter
    ? getControlItemsMap({
        datasetId,
        disabled: false,
        forceUpdate,
        form,
        filterId,
        filterType: formFilter.filterType,
        filterToEdit,
        formFilter,
        removed,
      })
    : {};
  const hasColumn = !!mainControlItems.groupby;

  const nativeFilterItem = nativeFilterItems[formFilter?.filterType] ?? {};
  // @ts-ignore
  const enableNoResults = !!nativeFilterItem.value?.enableNoResults;

  useEffect(() => {
    if (datasetId) {
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
  }, [datasetId]);

  useImperativeHandle(ref, () => ({
    changeTab(tab: 'configuration' | 'scoping') {
      setActiveTabKey(tab);
    },
  }));

  const hasMetrics = hasColumn && !!metrics.length;

  const hasFilledDataset =
    !hasDataset || (datasetId && (formFilter?.column || !hasColumn));

  const hasAdditionalFilters = FILTERS_WITH_ADHOC_FILTERS.includes(
    formFilter?.filterType,
  );

  const isCascadingFilter = CASCADING_FILTERS.includes(formFilter?.filterType);

  const isDataDirty = formFilter?.isDataDirty ?? true;

  useBackendFormUpdate(form, filterId);

  const setNativeFilterFieldValuesWrapper = (values: object) => {
    setNativeFilterFieldValues(form, filterId, values);
    setError('');
    forceUpdate();
  };

  const setErrorWrapper = (error: string) => {
    setNativeFilterFieldValues(form, filterId, {
      defaultValueQueriesData: null,
    });
    setError(error);
    forceUpdate();
  };

  const refreshHandler = useCallback(
    (force = false) => {
      if (!hasDataset || !formFilter?.dataset?.value) {
        forceUpdate();
        return;
      }
      const formData = getFormData({
        datasetId: formFilter?.dataset?.value,
        groupby: formFilter?.column,
        ...formFilter,
      });
      setNativeFilterFieldValuesWrapper({
        defaultValueQueriesData: null,
        isDataDirty: false,
      });
      getChartDataRequest({
        formData,
        force,
        requestParams: { dashboardId: 0 },
      })
        .then(({ response, json }) => {
          if (isFeatureEnabled(FeatureFlag.GLOBAL_ASYNC_QUERIES)) {
            // deal with getChartDataRequest transforming the response data
            const result = 'result' in json ? json.result[0] : json;

            if (response.status === 200) {
              setNativeFilterFieldValuesWrapper({
                defaultValueQueriesData: [result],
              });
            } else if (response.status === 202) {
              waitForAsyncData(result)
                .then((asyncResult: ChartDataResponseResult[]) => {
                  setNativeFilterFieldValuesWrapper({
                    defaultValueQueriesData: asyncResult,
                  });
                })
                .catch((error: ClientErrorObject) => {
                  setError(
                    error.message || error.error || t('Check configuration'),
                  );
                });
            } else {
              throw new Error(
                `Received unexpected response status (${response.status}) while fetching chart data`,
              );
            }
          } else {
            setNativeFilterFieldValuesWrapper({
              defaultValueQueriesData: json.result,
            });
          }
        })
        .catch((error: Response) => {
          error.json().then(body => {
            setErrorWrapper(
              body.message || error.statusText || t('Check configuration'),
            );
          });
        });
    },
    [filterId, forceUpdate, form, formFilter, hasDataset],
  );

  const newFormData = getFormData({
    datasetId,
    groupby: hasColumn ? formFilter?.column : undefined,
    ...formFilter,
  });

  const [
    hasDefaultValue,
    isRequired,
    defaultValueTooltip,
    setHasDefaultValue,
  ] = useDefaultValue(formFilter, filterToEdit);

  const showDataset =
    !datasetId || datasetDetails || formFilter?.dataset?.label;

  useEffect(() => {
    if (hasDataset && hasFilledDataset && hasDefaultValue && isDataDirty) {
      refreshHandler();
    }
  }, [
    hasDataset,
    hasFilledDataset,
    hasDefaultValue,
    formFilter,
    isDataDirty,
    refreshHandler,
    showDataset,
  ]);

  const formChanged = useCallback(() => {
    form.setFields([
      {
        name: 'changed',
        value: true,
      },
    ]);
  }, [form]);

  const updateFormValues = useCallback(
    (values: any) => {
      setNativeFilterFieldValues(form, filterId, values);
      formChanged();
    },
    [filterId, form, formChanged],
  );

  const parentFilterOptions = parentFilters.map(filter => ({
    value: filter.id,
    label: filter.title,
  }));

  const parentFilter = parentFilterOptions.find(
    ({ value }) => value === filterToEdit?.cascadeParentIds[0],
  );

  const hasParentFilter = !!parentFilter;

  const hasPreFilter =
    !!filterToEdit?.adhoc_filters || !!filterToEdit?.time_range;

  const hasSorting =
    typeof filterToEdit?.controlValues?.sortAscending === 'boolean';

  let sort = filterToEdit?.controlValues?.sortAscending;
  if (typeof formFilter?.controlValues?.sortAscending === 'boolean') {
    sort = formFilter.controlValues.sortAscending;
  }

  const showDefaultValue =
    !hasDataset ||
    (!isDataDirty && hasFilledDataset) ||
    !mainControlItems.groupby;

  const onSortChanged = (value: boolean | undefined) => {
    const previous = form.getFieldValue('filters')?.[filterId].controlValues;
    setNativeFilterFieldValues(form, filterId, {
      controlValues: {
        ...previous,
        sortAscending: value,
      },
    });
    forceUpdate();
  };

  const validatePreFilter = () =>
    setTimeout(
      () =>
        form.validateFields([
          ['filters', filterId, 'adhoc_filters'],
          ['filters', filterId, 'time_range'],
        ]),
      0,
    );

  const hasTimeRange =
    formFilter?.time_range && formFilter.time_range !== 'No filter';

  const hasAdhoc = formFilter?.adhoc_filters?.length > 0;

  const defaultToFirstItem = formFilter?.controlValues?.defaultToFirstItem;

  const hasAdvancedSection =
    formFilter?.filterType === 'filter_select' ||
    formFilter?.filterType === 'filter_range';

  const initialDefaultValue =
    formFilter.filterType === filterToEdit?.filterType
      ? filterToEdit?.defaultDataMask
      : null;

  const preFilterValidator = () => {
    if (hasTimeRange || hasAdhoc) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(t('Pre-filter is required')));
  };

  let hasCheckedAdvancedControl = hasParentFilter || hasPreFilter || hasSorting;
  if (!hasCheckedAdvancedControl) {
    hasCheckedAdvancedControl = Object.keys(controlItems)
      .filter(key => !BASIC_CONTROL_ITEMS.includes(key))
      .some(key => controlItems[key].checked);
  }

  useEffect(() => {
    const activeFilterPanelKey = [FilterPanels.basic.key];
    if (hasCheckedAdvancedControl) {
      activeFilterPanelKey.push(FilterPanels.advanced.key);
    }
    setActiveFilterPanelKey(activeFilterPanelKey);
  }, [hasCheckedAdvancedControl]);

  const initiallyExcludedCharts = useMemo(() => {
    const excluded: number[] = [];
    if (formFilter?.dataset?.value === undefined) {
      return [];
    }

    Object.values(charts).forEach((chart: Chart) => {
      const chartDatasetUid = chart.formData?.datasource;
      if (chartDatasetUid === undefined) {
        return;
      }
      if (loadedDatasets[chartDatasetUid]?.id !== formFilter?.dataset?.value) {
        excluded.push(chart.id);
      }
    });
    return excluded;
  }, [
    JSON.stringify(charts),
    formFilter?.dataset?.value,
    JSON.stringify(loadedDatasets),
  ]);

  const ParentSelect = ({
    value,
    ...rest
  }: {
    value?: { value: string | number };
  }) => (
    <Select
      ariaLabel={t('Parent filter')}
      placeholder={t('None')}
      options={parentFilterOptions}
      allowClear
      value={value?.value}
      {...rest}
    />
  );

  if (removed) {
    return <RemovedFilter onClick={() => restoreFilter(filterId)} />;
  }

  return (
    <StyledTabs
      activeKey={activeTabKey}
      onChange={activeKey => setActiveTabKey(activeKey)}
      centered
    >
      <TabPane
        tab={FilterTabs.configuration.name}
        key={FilterTabs.configuration.key}
        forceRender
      >
        <StyledContainer>
          <StyledFormItem
            name={['filters', filterId, 'type']}
            hidden
            initialValue={NativeFilterType.NATIVE_FILTER}
          >
            <Input />
          </StyledFormItem>
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
              ariaLabel={t('Filter type')}
              options={nativeFilterVizTypes.map(filterType => {
                // @ts-ignore
                const name = nativeFilterItems[filterType]?.value.name;
                const mappedName = name
                  ? FILTER_TYPE_NAME_MAPPING[name]
                  : undefined;
                const isDisabled =
                  FILTER_SUPPORTED_TYPES[filterType]?.length === 1 &&
                  FILTER_SUPPORTED_TYPES[filterType]?.includes(
                    GenericDataType.TEMPORAL,
                  ) &&
                  !doLoadedDatasetsHaveTemporalColumns;
                return {
                  value: filterType,
                  label: mappedName || name,
                  customLabel: isDisabled ? (
                    <Tooltip
                      title={t('Datasets do not contain a temporal column')}
                    >
                      {mappedName || name}
                    </Tooltip>
                  ) : undefined,
                  disabled: isDisabled,
                };
              })}
              onChange={value => {
                setNativeFilterFieldValues(form, filterId, {
                  filterType: value,
                  defaultDataMask: null,
                  column: null,
                });
                forceUpdate();
              }}
            />
          </StyledFormItem>
        </StyledContainer>
        {hasDataset && (
          <StyledRowContainer>
            {showDataset ? (
              <StyledFormItem
                name={['filters', filterId, 'dataset']}
                label={<StyledLabel>{t('Dataset')}</StyledLabel>}
                initialValue={
                  datasetDetails
                    ? {
                        label: datasetDetails.table_name,
                        value: datasetDetails.id,
                      }
                    : undefined
                }
                rules={[
                  { required: !removed, message: t('Dataset is required') },
                ]}
                {...getFiltersConfigModalTestId('datasource-input')}
              >
                <DatasetSelect
                  onChange={(value: { label: string; value: number }) => {
                    // We need to reset the column when the dataset has changed
                    if (value.value !== datasetId) {
                      setNativeFilterFieldValues(form, filterId, {
                        dataset: value,
                        defaultDataMask: null,
                        column: null,
                      });
                    }
                    forceUpdate();
                  }}
                />
              </StyledFormItem>
            ) : (
              <StyledFormItem label={<StyledLabel>{t('Dataset')}</StyledLabel>}>
                <Loading position="inline-centered" />
              </StyledFormItem>
            )}
            {hasDataset &&
              Object.keys(mainControlItems).map(
                key => mainControlItems[key].element,
              )}
          </StyledRowContainer>
        )}
        <StyledCollapse
          activeKey={activeFilterPanelKey}
          onChange={key => setActiveFilterPanelKey(key)}
          expandIconPosition="right"
        >
          <Collapse.Panel
            forceRender
            header={FilterPanels.basic.name}
            key={FilterPanels.basic.key}
          >
            <CleanFormItem
              name={['filters', filterId, 'defaultValueQueriesData']}
              hidden
              initialValue={null}
            />
            <CollapsibleControl
              title={t('Filter has default value')}
              initialValue={hasDefaultValue}
              disabled={isRequired || defaultToFirstItem}
              tooltip={defaultValueTooltip}
              checked={hasDefaultValue}
              onChange={value => {
                setHasDefaultValue(value);
                formChanged();
              }}
            >
              {formFilter.filterType && (
                <StyledRowSubFormItem
                  name={['filters', filterId, 'defaultDataMask']}
                  initialValue={initialDefaultValue}
                  data-test="default-input"
                  label={<StyledLabel>{t('Default Value')}</StyledLabel>}
                  required={hasDefaultValue}
                  rules={[
                    {
                      validator: () => {
                        if (formFilter?.defaultDataMask?.filterState?.value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(
                          new Error(t('Default value is required')),
                        );
                      },
                    },
                  ]}
                >
                  {error ? (
                    <BasicErrorAlert
                      title={t('Cannot load filter')}
                      body={error}
                      level="error"
                    />
                  ) : showDefaultValue ? (
                    <DefaultValueContainer>
                      <DefaultValue
                        setDataMask={dataMask => {
                          if (
                            !isEqual(
                              initialDefaultValue?.filterState?.value,
                              dataMask?.filterState?.value,
                            )
                          ) {
                            formChanged();
                          }
                          setNativeFilterFieldValues(form, filterId, {
                            defaultDataMask: dataMask,
                          });
                          form.validateFields([
                            ['filters', filterId, 'defaultDataMask'],
                          ]);
                          forceUpdate();
                        }}
                        hasDefaultValue={hasDefaultValue}
                        filterId={filterId}
                        hasDataset={hasDataset}
                        form={form}
                        formData={newFormData}
                        enableNoResults={enableNoResults}
                      />
                      {hasDataset && datasetId && (
                        <Tooltip title={t('Refresh the default values')}>
                          <RefreshIcon onClick={() => refreshHandler(true)} />
                        </Tooltip>
                      )}
                    </DefaultValueContainer>
                  ) : (
                    t('Fill all required fields to enable "Default Value"')
                  )}
                </StyledRowSubFormItem>
              )}
            </CollapsibleControl>
            {Object.keys(controlItems)
              .filter(key => BASIC_CONTROL_ITEMS.includes(key))
              .map(key => controlItems[key].element)}
          </Collapse.Panel>
          {hasAdvancedSection && (
            <Collapse.Panel
              forceRender
              header={FilterPanels.advanced.name}
              key={FilterPanels.advanced.key}
            >
              {isCascadingFilter && (
                <CollapsibleControl
                  title={t('Filter is hierarchical')}
                  initialValue={hasParentFilter}
                  onChange={checked => {
                    formChanged();
                    if (checked) {
                      // execute after render
                      setTimeout(
                        () =>
                          form.validateFields([
                            ['filters', filterId, 'parentFilter'],
                          ]),
                        0,
                      );
                    }
                  }}
                >
                  <StyledRowSubFormItem
                    name={['filters', filterId, 'parentFilter']}
                    label={<StyledLabel>{t('Parent filter')}</StyledLabel>}
                    initialValue={parentFilter}
                    normalize={value => (value ? { value } : undefined)}
                    data-test="parent-filter-input"
                    required
                    rules={[
                      {
                        required: true,
                        message: t('Parent filter is required'),
                      },
                    ]}
                  >
                    <ParentSelect />
                  </StyledRowSubFormItem>
                </CollapsibleControl>
              )}
              {Object.keys(controlItems)
                .filter(key => !BASIC_CONTROL_ITEMS.includes(key))
                .map(key => controlItems[key].element)}
              {hasDataset && hasAdditionalFilters && (
                <CollapsibleControl
                  title={t('Pre-filter available values')}
                  initialValue={hasPreFilter}
                  onChange={checked => {
                    formChanged();
                    if (checked) {
                      validatePreFilter();
                    }
                  }}
                >
                  <StyledRowSubFormItem
                    name={['filters', filterId, 'adhoc_filters']}
                    initialValue={filterToEdit?.adhoc_filters}
                    required
                    rules={[
                      {
                        validator: preFilterValidator,
                      },
                    ]}
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
                        validatePreFilter();
                      }}
                      label={
                        <span>
                          <StyledLabel>{t('Pre-filter')}</StyledLabel>
                          {!hasTimeRange && <StyledAsterisk />}
                        </span>
                      }
                    />
                  </StyledRowSubFormItem>
                  {showTimeRangePicker && (
                    <StyledRowFormItem
                      name={['filters', filterId, 'time_range']}
                      label={<StyledLabel>{t('Time range')}</StyledLabel>}
                      initialValue={filterToEdit?.time_range || 'No filter'}
                      required={!hasAdhoc}
                      rules={[
                        {
                          validator: preFilterValidator,
                        },
                      ]}
                    >
                      <DateFilterControl
                        name="time_range"
                        onChange={timeRange => {
                          setNativeFilterFieldValues(form, filterId, {
                            time_range: timeRange,
                          });
                          forceUpdate();
                          validatePreFilter();
                        }}
                      />
                    </StyledRowFormItem>
                  )}
                  {hasTimeRange && (
                    <StyledRowFormItem
                      name={['filters', filterId, 'granularity_sqla']}
                      label={
                        <>
                          <StyledLabel>{t('Time column')}</StyledLabel>&nbsp;
                          <InfoTooltipWithTrigger
                            placement="top"
                            tooltip={t(
                              'Optional time column if time range should apply to another column than the default time column',
                            )}
                          />
                        </>
                      }
                      initialValue={filterToEdit?.granularity_sqla}
                    >
                      <ColumnSelect
                        allowClear
                        form={form}
                        formField="granularity_sqla"
                        filterId={filterId}
                        filterValues={(column: Column) => !!column.is_dttm}
                        datasetId={datasetId}
                        onChange={column => {
                          // We need reset default value when when column changed
                          setNativeFilterFieldValues(form, filterId, {
                            granularity_sqla: column,
                          });
                          forceUpdate();
                        }}
                      />
                    </StyledRowFormItem>
                  )}
                </CollapsibleControl>
              )}
              {formFilter?.filterType !== 'filter_range' && (
                <CollapsibleControl
                  title={t('Sort filter values')}
                  onChange={checked => {
                    onSortChanged(checked || undefined);
                    formChanged();
                  }}
                  initialValue={hasSorting}
                >
                  <StyledRowFormItem
                    name={[
                      'filters',
                      filterId,
                      'controlValues',
                      'sortAscending',
                    ]}
                    initialValue={sort}
                    label={<StyledLabel>{t('Sort type')}</StyledLabel>}
                  >
                    <Radio.Group
                      onChange={value => {
                        onSortChanged(value.target.value);
                      }}
                    >
                      <Radio value>{t('Sort ascending')}</Radio>
                      <Radio value={false}>{t('Sort descending')}</Radio>
                    </Radio.Group>
                  </StyledRowFormItem>
                  {hasMetrics && (
                    <StyledRowSubFormItem
                      name={['filters', filterId, 'sortMetric']}
                      initialValue={filterToEdit?.sortMetric}
                      label={
                        <>
                          <StyledLabel>{t('Sort Metric')}</StyledLabel>&nbsp;
                          <InfoTooltipWithTrigger
                            placement="top"
                            tooltip={t(
                              'If a metric is specified, sorting will be done based on the metric value',
                            )}
                          />
                        </>
                      }
                      data-test="field-input"
                    >
                      <Select
                        allowClear
                        ariaLabel={t('Sort metric')}
                        name="sortMetric"
                        options={metrics.map((metric: Metric) => ({
                          value: metric.metric_name,
                          label: metric.verbose_name ?? metric.metric_name,
                        }))}
                        onChange={value => {
                          if (value !== undefined) {
                            setNativeFilterFieldValues(form, filterId, {
                              sortMetric: value,
                            });
                            forceUpdate();
                          }
                        }}
                      />
                    </StyledRowSubFormItem>
                  )}
                </CollapsibleControl>
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
          updateFormValues={updateFormValues}
          pathToFormValue={['filters', filterId]}
          forceUpdate={forceUpdate}
          filterScope={filterToEdit?.scope}
          formFilterScope={formFilter?.scope}
          formScopingType={formFilter?.scoping}
          initiallyExcludedCharts={initiallyExcludedCharts}
        />
      </TabPane>
    </StyledTabs>
  );
};

export default forwardRef<typeof FiltersConfigForm, FiltersConfigFormProps>(
  FiltersConfigForm,
);
