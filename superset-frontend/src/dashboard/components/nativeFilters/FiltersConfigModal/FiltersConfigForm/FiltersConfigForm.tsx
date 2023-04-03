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
/* eslint-disable react-hooks/rules-of-hooks */
import {
  ColumnMeta,
  InfoTooltipWithTrigger,
  Metric,
} from '@superset-ui/chart-controls';
import {
  AdhocFilter,
  Behavior,
  ChartDataResponseResult,
  Column,
  FeatureFlag,
  Filter,
  GenericDataType,
  getChartMetadataRegistry,
  JsonResponse,
  NativeFilterType,
  styled,
  SupersetApiError,
  t,
} from '@superset-ui/core';
import { isEqual } from 'lodash';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import rison from 'rison';
import { PluginFilterSelectCustomizeProps } from 'src/filters/components/Select/types';
import { useSelector } from 'react-redux';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { Input, TextArea } from 'src/components/Input';
import { Select, FormInstance } from 'src/components';
import Collapse from 'src/components/Collapse';
import BasicErrorAlert from 'src/components/ErrorMessage/BasicErrorAlert';
import { FormItem } from 'src/components/Form';
import Icons from 'src/components/Icons';
import Loading from 'src/components/Loading';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { Radio } from 'src/components/Radio';
import Tabs from 'src/components/Tabs';
import { Tooltip } from 'src/components/Tooltip';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import {
  Chart,
  ChartsState,
  DatasourcesState,
  RootState,
} from 'src/dashboard/types';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import AdhocFilterControl from 'src/explore/components/controls/FilterControl/AdhocFilterControl';
import { isFeatureEnabled } from 'src/featureFlags';
import { waitForAsyncData } from 'src/middleware/asyncEvent';
import { ClientErrorObject } from 'src/utils/getClientErrorObject';
import { SingleValueType } from 'src/filters/components/Range/SingleValueType';
import {
  getFormData,
  mergeExtraFormData,
} from 'src/dashboard/components/nativeFilters/utils';
import {
  ALLOW_DEPENDENCIES as TYPES_SUPPORT_DEPENDENCIES,
  getFiltersConfigModalTestId,
} from '../FiltersConfigModal';
import { FilterRemoval, NativeFiltersForm } from '../types';
import { CollapsibleControl } from './CollapsibleControl';
import { ColumnSelect } from './ColumnSelect';
import DatasetSelect from './DatasetSelect';
import DefaultValue from './DefaultValue';
import FilterScope from './FilterScope/FilterScope';
import getControlItemsMap from './getControlItemsMap';
import RemovedFilter from './RemovedFilter';
import { useBackendFormUpdate, useDefaultValue } from './state';
import {
  hasTemporalColumns,
  mostUsedDataset,
  setNativeFilterFieldValues,
  useForceUpdate,
} from './utils';
import { FILTER_SUPPORTED_TYPES, INPUT_WIDTH } from './constants';
import DependencyList from './DependencyList';

const TabPane = styled(Tabs.TabPane)`
  padding: ${({ theme }) => theme.gridUnit * 4}px 0px;
`;

const StyledContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row-reverse;
    justify-content: space-between;
    padding: 0px ${theme.gridUnit * 4}px;
  `}
`;

const StyledRowContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  padding: 0px ${({ theme }) => theme.gridUnit * 4}px;
`;

type ControlKey = keyof PluginFilterSelectCustomizeProps;

const controlsOrder: ControlKey[] = [
  'enableEmptyFilter',
  'defaultToFirstItem',
  'multiSelect',
  'searchAllOptions',
  'inverseSelection',
];

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
  border-left: 0;
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
    top: 0;
    background: ${({ theme }) => theme.colors.grayscale.light5};
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

const FilterTypeInfo = styled.div`
  ${({ theme }) => `
    width: 49%;
    font-size: ${theme.typography.sizes.s}px;
    color: ${theme.colors.grayscale.light1};
    margin:
      ${-theme.gridUnit * 2}px
      0px
      ${theme.gridUnit * 4}px
      ${theme.gridUnit * 4}px;
  `}
`;

const FilterTabs = {
  configuration: {
    key: 'configuration',
    name: t('Settings'),
  },
  scoping: {
    key: 'scoping',
    name: t('Scoping'),
  },
};

export const FilterPanels = {
  configuration: {
    key: 'configuration',
    name: t('Filter Configuration'),
  },
  settings: {
    key: 'settings',
    name: t('Filter Settings'),
  },
};

export interface FiltersConfigFormProps {
  filterId: string;
  filterToEdit?: Filter;
  removedFilters: Record<string, FilterRemoval>;
  restoreFilter: (filterId: string) => void;
  form: FormInstance<NativeFiltersForm>;
  getAvailableFilters: (
    filterId: string,
  ) => { label: string; value: string; type: string | undefined }[];
  handleActiveFilterPanelChange: (activeFilterPanel: string | string[]) => void;
  activeFilterPanelKeys: string | string[];
  isActive: boolean;
  setErroredFilters: (f: (filters: string[]) => string[]) => void;
  validateDependencies: () => void;
  getDependencySuggestion: (filterId: string) => string;
}

const FILTERS_WITH_ADHOC_FILTERS = ['filter_select', 'filter_range'];

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
    removedFilters,
    form,
    getAvailableFilters,
    activeFilterPanelKeys,
    restoreFilter,
    handleActiveFilterPanelChange,
    setErroredFilters,
    validateDependencies,
    getDependencySuggestion,
    isActive,
  }: FiltersConfigFormProps,
  ref: React.RefObject<any>,
) => {
  const isRemoved = !!removedFilters[filterId];
  const [error, setError] = useState<string>('');
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string>(
    FilterTabs.configuration.key,
  );

  const [undoFormValues, setUndoFormValues] = useState<Record<
    string,
    any
  > | null>(null);
  const forceUpdate = useForceUpdate(isActive);
  const [datasetDetails, setDatasetDetails] = useState<Record<string, any>>();
  const defaultFormFilter = useMemo(() => ({}), []);
  const filters = form.getFieldValue('filters');
  const formValues = filters?.[filterId];
  const formFilter = formValues || undoFormValues || defaultFormFilter;

  const dependencies: string[] =
    formFilter?.dependencies || filterToEdit?.cascadeParentIds || [];

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
      dataset => dataset.id === formFilter?.dataset?.value,
    );

    return currentDataset ? hasTemporalColumns(currentDataset) : true;
  }, [formFilter?.dataset?.value, loadedDatasets]);

  const hasDataset =
    // @ts-ignore
    !!nativeFilterItems[formFilter?.filterType]?.value?.datasourceCount;

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
        filterType: formFilter?.filterType,
        filterToEdit,
        formFilter,
        removed: isRemoved,
      })
    : {};
  const hasColumn = !!mainControlItems.groupby;

  const nativeFilterItem = nativeFilterItems[formFilter?.filterType] ?? {};
  // @ts-ignore
  const enableNoResults = !!nativeFilterItem.value?.enableNoResults;

  const hasMetrics = hasColumn && !!metrics.length;

  const hasFilledDataset =
    !hasDataset || (datasetId && (formFilter?.column || !hasColumn));

  const hasAdditionalFilters = FILTERS_WITH_ADHOC_FILTERS.includes(
    formFilter?.filterType,
  );

  const canDependOnOtherFilters = TYPES_SUPPORT_DEPENDENCIES.includes(
    formFilter?.filterType,
  );

  const isDataDirty = formFilter?.isDataDirty ?? true;

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

  // Calculates the dependencies default values to be used
  // to extract the available values to the filter
  let dependenciesDefaultValues = {};
  if (dependencies && dependencies.length > 0 && filters) {
    dependencies.forEach(dependency => {
      const extraFormData = filters[dependency]?.defaultDataMask?.extraFormData;
      dependenciesDefaultValues = mergeExtraFormData(
        dependenciesDefaultValues,
        extraFormData,
      );
    });
  }

  const dependenciesText = JSON.stringify(dependenciesDefaultValues);

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

      formData.extra_form_data = dependenciesDefaultValues;

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
    [filterId, forceUpdate, form, formFilter, hasDataset, dependenciesText],
  );

  // TODO: refreshHandler changes itself because of the dependencies. Needs refactor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => refreshHandler(), [dependenciesText]);

  const newFormData = getFormData({
    datasetId,
    groupby: hasColumn ? formFilter?.column : undefined,
    ...formFilter,
  });
  newFormData.extra_form_data = dependenciesDefaultValues;

  const [hasDefaultValue, isRequired, defaultValueTooltip, setHasDefaultValue] =
    useDefaultValue(formFilter, filterToEdit);

  const showDataset =
    !datasetId || datasetDetails || formFilter?.dataset?.label;

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

  const hasPreFilter =
    !!formFilter?.adhoc_filters ||
    !!formFilter?.time_range ||
    !!filterToEdit?.adhoc_filters?.length ||
    !!filterToEdit?.time_range;

  const hasEnableSingleValue =
    formFilter?.controlValues?.enableSingleValue !== undefined ||
    filterToEdit?.controlValues?.enableSingleValue !== undefined;

  let enableSingleValue = filterToEdit?.controlValues?.enableSingleValue;
  if (formFilter?.controlValues?.enableSingleMaxValue !== undefined) {
    ({ enableSingleValue } = formFilter.controlValues);
  }

  const hasSorting =
    typeof formFilter?.controlValues?.sortAscending === 'boolean' ||
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

  const onEnableSingleValueChanged = (value: SingleValueType | undefined) => {
    const previous = form.getFieldValue('filters')?.[filterId].controlValues;
    setNativeFilterFieldValues(form, filterId, {
      controlValues: {
        ...previous,
        enableSingleValue: value,
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

  const initialDefaultValue =
    formFilter?.filterType === filterToEdit?.filterType
      ? filterToEdit?.defaultDataMask
      : null;

  const preFilterValidator = () => {
    if (hasTimeRange || hasAdhoc) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(t('Pre-filter is required')));
  };

  const availableFilters = getAvailableFilters(filterId);
  const hasAvailableFilters = availableFilters.length > 0;
  const hasTimeDependency = availableFilters
    .filter(filter => filter.type === 'filter_time')
    .some(filter => dependencies.includes(filter.value));

  useEffect(() => {
    if (datasetId) {
      cachedSupersetGet({
        endpoint: `/api/v1/dataset/${datasetId}?q=${rison.encode({
          columns: [
            'columns.column_name',
            'columns.expression',
            'columns.filterable',
            'columns.is_dttm',
            'columns.type',
            'columns.verbose_name',
            'database.id',
            'database.database_name',
            'datasource_type',
            'filter_select_enabled',
            'id',
            'is_sqllab_view',
            'main_dttm_col',
            'metrics.metric_name',
            'metrics.verbose_name',
            'schema',
            'sql',
            'table_name',
          ],
        })}`,
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

  useBackendFormUpdate(form, filterId);

  useEffect(() => {
    if (hasDataset && hasFilledDataset && hasDefaultValue && isDataDirty) {
      refreshHandler();
    }
  }, [
    hasDataset,
    hasFilledDataset,
    hasDefaultValue,
    isDataDirty,
    refreshHandler,
    showDataset,
  ]);

  const initiallyExcludedCharts = useMemo(() => {
    const excluded: number[] = [];
    if (formFilter?.dataset?.value === undefined) {
      return [];
    }

    Object.values(charts).forEach((chart: Chart) => {
      const chartDatasetUid = chart.form_data?.datasource;
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

  useEffect(() => {
    // just removed, saving current form items for eventual undo
    if (isRemoved) {
      setUndoFormValues(formValues);
    }
  }, [isRemoved]);

  useEffect(() => {
    // the filter was just restored after undo
    if (undoFormValues && !isRemoved) {
      setNativeFilterFieldValues(form, filterId, undoFormValues);
      setUndoFormValues(null);
    }
  }, [formValues, filterId, form, isRemoved, undoFormValues]);

  if (isRemoved) {
    return <RemovedFilter onClick={() => restoreFilter(filterId)} />;
  }

  const timeColumn = (
    <StyledRowFormItem
      name={['filters', filterId, 'granularity_sqla']}
      label={
        <>
          <StyledLabel>{t('Time column')}</StyledLabel>&nbsp;
          <InfoTooltipWithTrigger
            placement="top"
            tooltip={
              hasTimeDependency
                ? t('Time column to apply dependent temporal filter to')
                : t('Time column to apply time range to')
            }
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
  );

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
            rules={[{ required: !isRemoved, message: t('Name is required') }]}
          >
            <Input {...getFiltersConfigModalTestId('name-input')} />
          </StyledFormItem>
          <StyledFormItem
            name={['filters', filterId, 'filterType']}
            rules={[{ required: !isRemoved, message: t('Name is required') }]}
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
        {formFilter?.filterType === 'filter_time' && (
          <FilterTypeInfo>
            {t(`Dashboard time range filters apply to temporal columns defined in
          the filter section of each chart. Add temporal columns to the chart
          filters to have this dashboard filter impact those charts.`)}
          </FilterTypeInfo>
        )}
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
                  { required: !isRemoved, message: t('Dataset is required') },
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
          defaultActiveKey={activeFilterPanelKeys}
          onChange={key => {
            handleActiveFilterPanelChange(key);
          }}
          expandIconPosition="right"
          key={`native-filter-config-${filterId}`}
        >
          {formFilter?.filterType !== 'filter_time' && (
            <Collapse.Panel
              forceRender
              header={FilterPanels.configuration.name}
              key={`${filterId}-${FilterPanels.configuration.key}`}
            >
              {canDependOnOtherFilters && hasAvailableFilters && (
                <StyledRowFormItem
                  name={['filters', filterId, 'dependencies']}
                  initialValue={dependencies}
                >
                  <DependencyList
                    availableFilters={availableFilters}
                    dependencies={dependencies}
                    onDependenciesChange={dependencies => {
                      setNativeFilterFieldValues(form, filterId, {
                        dependencies,
                      });
                      forceUpdate();
                      validateDependencies();
                      formChanged();
                    }}
                    getDependencySuggestion={() =>
                      getDependencySuggestion(filterId)
                    }
                  >
                    {hasTimeDependency ? timeColumn : undefined}
                  </DependencyList>
                </StyledRowFormItem>
              )}
              {hasDataset && hasAdditionalFilters && (
                <CleanFormItem name={['filters', filterId, 'preFilter']}>
                  <CollapsibleControl
                    initialValue={hasPreFilter}
                    title={t('Pre-filter available values')}
                    tooltip={t(`Add filter clauses to control the filter's source query,
                    though only in the context of the autocomplete i.e., these conditions
                    do not impact how the filter is applied to the dashboard. This is useful
                    when you want to improve the query's performance by only scanning a subset
                    of the underlying data or limit the available values displayed in the filter.`)}
                    onChange={checked => {
                      formChanged();
                      if (checked) {
                        validatePreFilter();
                      }
                    }}
                  >
                    <StyledRowSubFormItem
                      name={['filters', filterId, 'adhoc_filters']}
                      css={{ width: INPUT_WIDTH }}
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
                        initialValue={
                          filterToEdit?.time_range || t('No filter')
                        }
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
                    {hasTimeRange && !hasTimeDependency
                      ? timeColumn
                      : undefined}
                  </CollapsibleControl>
                </CleanFormItem>
              )}
              {formFilter?.filterType !== 'filter_range' ? (
                <CleanFormItem name={['filters', filterId, 'sortFilter']}>
                  <CollapsibleControl
                    initialValue={hasSorting}
                    title={t('Sort filter values')}
                    onChange={checked => {
                      onSortChanged(checked || undefined);
                      formChanged();
                    }}
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
                </CleanFormItem>
              ) : (
                <CleanFormItem name={['filters', filterId, 'rangeFilter']}>
                  <CollapsibleControl
                    initialValue={hasEnableSingleValue}
                    title={t('Single Value')}
                    onChange={checked => {
                      onEnableSingleValueChanged(
                        checked ? SingleValueType.Exact : undefined,
                      );
                      formChanged();
                    }}
                  >
                    <StyledRowFormItem
                      name={[
                        'filters',
                        filterId,
                        'controlValues',
                        'enableSingleValue',
                      ]}
                      initialValue={enableSingleValue}
                      label={
                        <StyledLabel>{t('Single value type')}</StyledLabel>
                      }
                    >
                      <Radio.Group
                        onChange={value =>
                          onEnableSingleValueChanged(value.target.value)
                        }
                      >
                        <Radio value={SingleValueType.Minimum}>
                          {t('Minimum')}
                        </Radio>
                        <Radio value={SingleValueType.Exact}>
                          {t('Exact')}
                        </Radio>
                        <Radio value={SingleValueType.Maximum}>
                          {t('Maximum')}
                        </Radio>
                      </Radio.Group>
                    </StyledRowFormItem>
                  </CollapsibleControl>
                </CleanFormItem>
              )}
            </Collapse.Panel>
          )}
          <Collapse.Panel
            forceRender
            header={FilterPanels.settings.name}
            key={`${filterId}-${FilterPanels.settings.key}`}
          >
            <StyledFormItem
              name={['filters', filterId, 'description']}
              initialValue={filterToEdit?.description}
              label={<StyledLabel>{t('Description')}</StyledLabel>}
            >
              <TextArea />
            </StyledFormItem>
            <CleanFormItem
              name={['filters', filterId, 'defaultValueQueriesData']}
              hidden
              initialValue={null}
            />
            <CleanFormItem name={['filters', filterId, 'defaultValue']}>
              <CollapsibleControl
                checked={hasDefaultValue}
                disabled={isRequired || defaultToFirstItem}
                initialValue={hasDefaultValue}
                title={t('Filter has default value')}
                tooltip={defaultValueTooltip}
                onChange={value => {
                  setHasDefaultValue(value);
                  if (!value) {
                    setNativeFilterFieldValues(form, filterId, {
                      defaultDataMask: null,
                    });
                  }
                  formChanged();
                }}
              >
                {!isRemoved && (
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
                            // requires managing the error as the DefaultValue
                            // component does not use an Antdesign compatible input
                            const formValidationFields = form.getFieldsError();
                            setErroredFilters(prevErroredFilters => {
                              if (
                                prevErroredFilters.length &&
                                !formValidationFields.find(
                                  f => f.errors.length > 0,
                                )
                              ) {
                                return [];
                              }
                              return prevErroredFilters;
                            });
                            return Promise.resolve();
                          }
                          setErroredFilters(prevErroredFilters => {
                            if (prevErroredFilters.includes(filterId)) {
                              return prevErroredFilters;
                            }
                            return [...prevErroredFilters, filterId];
                          });
                          return Promise.reject(
                            new Error(t('Default value is required')),
                          );
                        },
                      },
                    ]}
                  >
                    {error || showDefaultValue ? (
                      <DefaultValueContainer>
                        {error ? (
                          <BasicErrorAlert
                            title={t('Cannot load filter')}
                            body={error}
                            level="error"
                          />
                        ) : (
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
                        )}
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
            </CleanFormItem>
            {Object.keys(controlItems)
              .sort(
                (a, b) =>
                  controlsOrder.indexOf(a as ControlKey) -
                  controlsOrder.indexOf(b as ControlKey),
              )
              .map(key => controlItems[key].element)}
          </Collapse.Panel>
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

export default React.memo(
  forwardRef<typeof FiltersConfigForm, FiltersConfigFormProps>(
    FiltersConfigForm,
  ),
);
