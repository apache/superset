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
import React, {
  useCallback,
  useEffect,
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useSelector } from 'react-redux';
import { FormItem } from 'src/components/Form';
import { Checkbox, Input } from 'src/common/components';
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
import getControlItemsMap from './getControlItemsMap';
import FilterScope from './FilterScope/FilterScope';
import RemovedFilter from './RemovedFilter';
import DefaultValue from './DefaultValue';
import { CollapsibleControl } from './CollapsibleControl';
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
    padding-bottom: 0px;
  }

  & .ant-form-item-control-input {
    min-height: ${({ theme }) => theme.gridUnit * 10}px;
  }
`;

export const StyledRowFormItem = styled(FormItem)`
  margin-bottom: 0px;
  padding-bottom: 0px;
  min-width: 50%;

  & .ant-form-item-label {
    padding-bottom: 0px;
  }

  .ant-form-item-control-input-content > div > div {
    height: auto;
  }

  & .ant-form-item-control-input {
    min-height: ${({ theme }) => theme.gridUnit * 10}px;
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

  .ant-collapse-content-box {
    padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  }

  &.ant-collapse > .ant-collapse-item {
    border: 0px;
    border-radius: 0px;
  }
`;

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav {
    position: sticky;
    margin-left: ${({ theme }) => theme.gridUnit * -4}px;
    margin-right: ${({ theme }) => theme.gridUnit * -4}px;
    top: 0px;
    background: white;
    z-index: 1;
  }

  .ant-tabs-nav-list {
    padding: 0px;
  }

  .ant-form-item-label {
    padding-bottom: 0px;
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

// TODO: Need to do with it something
const FILTERS_WITHOUT_COLUMN = [
  'filter_timegrain',
  'filter_timecolumn',
  'filter_groupby',
];

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
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string>(
    FilterTabs.configuration.key,
  );
  const [activeFilterPanelKey, setActiveFilterPanelKey] = useState<
    string | string[]
  >(FilterPanels.basic.key);
  const [hasDefaultValue, setHasDefaultValue] = useState(
    !!filterToEdit?.defaultDataMask?.filterState?.value,
  );
  const forceUpdate = useForceUpdate();
  const [datasetDetails, setDatasetDetails] = useState<Record<string, any>>();
  const defaultFormFilter = useMemo(() => {}, []);
  const formFilter =
    form.getFieldValue('filters')?.[filterId] || defaultFormFilter;
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

  const refreshHandler = useCallback(() => {
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
  }, [filterId, forceUpdate, form, formFilter, hasDataset]);

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
  ]);

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

  const showDefaultValue = !hasDataset || (!isDataDirty && hasFilledDataset);

  const controlItems = formFilter
    ? getControlItemsMap({
        disabled: false,
        forceUpdate,
        form,
        filterId,
        filterType: formFilter.filterType,
        filterToEdit,
        formFilter,
      })
    : {};

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
              options={nativeFilterVizTypes.map(filterType => {
                // @ts-ignore
                const name = nativeFilterItems[filterType]?.value.name;
                const mappedName = name
                  ? FILTER_TYPE_NAME_MAPPING[name]
                  : undefined;
                return {
                  value: filterType,
                  label: mappedName || name,
                };
              })}
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
          <StyledRowContainer>
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
                  { required: !removed, message: t('Column is required') },
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
            <CollapsibleControl
              title={t('Filter has default value')}
              checked={hasDefaultValue}
              onChange={value => setHasDefaultValue(value)}
            >
              <StyledRowFormItem
                name={['filters', filterId, 'defaultDataMask']}
                initialValue={filterToEdit?.defaultDataMask}
                data-test="default-input"
                label={<StyledLabel>{t('Default Value')}</StyledLabel>}
                required
                rules={[
                  {
                    required: true,
                  },
                  {
                    validator: (rule, value) => {
                      const hasValue = !!value?.filterState?.value;
                      if (
                        hasValue ||
                        // TODO: do more generic
                        formFilter.controlValues?.defaultToFirstItem
                      ) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error(t('Default value is required')),
                      );
                    },
                  },
                ]}
              >
                {showDefaultValue ? (
                  <DefaultValue
                    setDataMask={dataMask => {
                      setNativeFilterFieldValues(form, filterId, {
                        defaultDataMask: dataMask,
                      });
                      form.validateFields([
                        ['filters', filterId, 'defaultDataMask'],
                      ]);
                      forceUpdate();
                    }}
                    filterId={filterId}
                    hasDataset={hasDataset}
                    form={form}
                    formData={newFormData}
                    enableNoResults={enableNoResults}
                  />
                ) : (
                  t('Fill all required fields to enable "Default Value"')
                )}
              </StyledRowFormItem>
            </CollapsibleControl>
            {Object.keys(controlItems)
              .filter(key => BASIC_CONTROL_ITEMS.includes(key))
              .map(key => controlItems[key].element)}
            <StyledRowFormItem
              name={['filters', filterId, 'isInstant']}
              initialValue={filterToEdit?.isInstant || false}
              valuePropName="checked"
              colon={false}
            >
              <Checkbox data-test="apply-changes-instantly-checkbox">
                {t('Apply changes instantly')}
              </Checkbox>
            </StyledRowFormItem>
          </Collapse.Panel>
          {((hasDataset && hasAdditionalFilters) || hasMetrics) && (
            <Collapse.Panel
              forceRender
              header={FilterPanels.advanced.name}
              key={FilterPanels.advanced.key}
            >
              {isCascadingFilter && (
                <CollapsibleControl
                  title={t('Filter is hierarchical')}
                  checked={hasParentFilter}
                  onChange={checked => {
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
                  <StyledRowFormItem
                    name={['filters', filterId, 'parentFilter']}
                    label={<StyledLabel>{t('Parent filter')}</StyledLabel>}
                    initialValue={parentFilter}
                    data-test="parent-filter-input"
                    required
                    rules={[
                      {
                        required: true,
                        message: t('Parent filter is required'),
                      },
                    ]}
                  >
                    <Select
                      placeholder={t('None')}
                      options={parentFilterOptions}
                      isClearable
                    />
                  </StyledRowFormItem>
                </CollapsibleControl>
              )}
              {Object.keys(controlItems)
                .filter(key => !BASIC_CONTROL_ITEMS.includes(key))
                .map(key => controlItems[key].element)}
              {hasDataset && hasAdditionalFilters && (
                <CollapsibleControl
                  title={t('Pre-filter available values')}
                  checked={hasPreFilter}
                  onChange={checked => {
                    if (checked) {
                      validatePreFilter();
                    }
                  }}
                >
                  <StyledRowFormItem
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
                  </StyledRowFormItem>
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
                </CollapsibleControl>
              )}
              {formFilter?.filterType !== 'filter_range' && (
                <CollapsibleControl
                  title={t('Sort filter values')}
                  onChange={checked => onSortChanged(checked || undefined)}
                  checked={hasSorting}
                >
                  <StyledRowContainer>
                    <StyledFormItem
                      name={[
                        'filters',
                        filterId,
                        'controlValues',
                        'sortAscending',
                      ]}
                      initialValue={filterToEdit?.controlValues?.sortAscending}
                      label={<StyledLabel>{t('Sort type')}</StyledLabel>}
                    >
                      <Select
                        form={form}
                        filterId={filterId}
                        name="sortAscending"
                        options={[
                          {
                            value: true,
                            label: t('Sort ascending'),
                          },
                          {
                            value: false,
                            label: t('Sort descending'),
                          },
                        ]}
                        onChange={({ value }: { value: boolean }) =>
                          onSortChanged(value)
                        }
                      />
                    </StyledFormItem>
                    {hasMetrics && (
                      <StyledFormItem
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
                  </StyledRowContainer>
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
  );
};

export default forwardRef<typeof FiltersConfigForm, FiltersConfigFormProps>(
  FiltersConfigForm,
);
