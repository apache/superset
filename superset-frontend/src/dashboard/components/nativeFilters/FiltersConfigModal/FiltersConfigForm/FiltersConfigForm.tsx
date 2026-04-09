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
import { ColumnMeta, Metric } from '@superset-ui/chart-controls';
import { t } from '@apache-superset/core/translation';
import {
  Behavior,
  ChartDataResponseResult,
  Column,
  DataMaskStateWithId,
  isFeatureEnabled,
  FeatureFlag,
  Filter,
  Divider,
  ChartCustomization,
  ChartCustomizationDivider,
  ChartCustomizationType,
  getChartMetadataRegistry,
  JsonResponse,
  NativeFilterType,
  SupersetApiError,
  ClientErrorObject,
  getClientErrorObject,
  getExtensionsRegistry,
} from '@superset-ui/core';
import { styled, useTheme, css } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import { debounce, isEqual } from 'lodash';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  RefObject,
  memo,
} from 'react';
import rison from 'rison';
import {
  PluginFilterSelectCustomizeProps,
  SelectFilterOperatorType,
} from 'src/filters/components/Select/types';
import { useSelector } from 'react-redux';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import {
  Constants,
  FormItem,
  type FormInstance,
  Collapse,
  Icons,
  Select,
  Tooltip,
  InfoTooltip,
  Flex,
  Input,
  Loading,
} from '@superset-ui/core/components';
import { BasicErrorAlert, ErrorMessageWithStackTrace } from 'src/components';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { Radio } from '@superset-ui/core/components/Radio';
import Tabs from '@superset-ui/core/components/Tabs';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import {
  Chart,
  ChartsState,
  DatasourcesState,
  LayoutItem,
  RootState,
} from 'src/dashboard/types';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import AdhocFilterControl from 'src/explore/components/controls/FilterControl/AdhocFilterControl';
import type AdhocFilterClass from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { waitForAsyncData } from 'src/middleware/asyncEvent';
import { SingleValueType } from 'src/filters/components/Range/SingleValueType';
import { RangeDisplayMode } from 'src/filters/components/Range/types';
import { ChartCustomizationPlugins } from 'src/constants';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import {
  getFormData,
  getFilterValueForDisplay,
  mergeExtraFormData,
} from 'src/dashboard/components/nativeFilters/utils';
import { DatasetSelectLabel } from 'src/features/datasets/DatasetSelectLabel';
import {
  ALLOW_DEPENDENCIES as TYPES_SUPPORT_DEPENDENCIES,
  getFiltersConfigModalTestId,
} from '../FiltersConfigModal';
import {
  ChartCustomizationsFormItem,
  FilterRemoval,
  NativeFiltersFormItem,
  NativeFiltersForm,
} from '../types';
import { isChartCustomizationId } from '../utils';
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
  isValidFilterValue,
  mostUsedDataset,
  setNativeFilterFieldValues,
  shouldShowTimeRangePicker,
  useForceUpdate,
} from './utils';
import {
  CHART_CUSTOMIZATION_SUPPORTED_TYPES,
  FILTER_SUPPORTED_TYPES,
  INPUT_WIDTH,
} from './constants';
import DependencyList from './DependencyList';
import { extractLabel } from '../../selectors';
import {
  canApplyDynamicTitleToScope,
  createDynamicTitleAlias,
  DYNAMIC_TITLE_CHART_TITLE_ALIAS,
  extractDynamicTitleAliases,
  findDynamicTitleScopeConflict,
  getDynamicTitleControlValues,
  hasSingleChartScope,
  isBuiltInDynamicTitleAlias,
  renderDynamicTitleTemplate,
  resolveChartsInScope,
  usesChartTitleToken,
  type DynamicTitleScopeCandidate,
  type DynamicTitleTokenMappings,
} from '../../../../util/dynamicTitle';

const FORM_ITEM_WIDTH = 260;

const StyledSettings = styled.div`
  ${({ theme }) => `
    .ant-form-item {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }
  `}
`;
const StyledContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: row-reverse;
    justify-content: space-between;
    padding: 0px ${theme.sizeUnit * 4}px;
  `}
`;

const StyledRowContainer = styled(Flex)`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const DynamicTitlePreview = styled.div`
  ${({ theme }) => `
    min-height: ${theme.sizeUnit * 8}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    background: ${theme.colorBgLayout};
    color: ${theme.colorText};
  `}
`;

const DynamicTitleHint = styled.div`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 2}px;
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const DynamicTitleFieldGroup = styled.div<{ expanded: boolean }>`
  ${({ expanded }) => `
    width: ${expanded ? '49%' : `${FORM_ITEM_WIDTH}px`};
  `}
`;

type ControlKey = keyof PluginFilterSelectCustomizeProps;
type DynamicTitleTokenOption = {
  value: string;
  label: string;
  alias: string;
  kind: 'built_in' | 'filter';
  filterId?: string;
};

const BUILT_IN_CHART_TITLE_TOKEN_VALUE =
  '__dynamic_title_builtin_chart_title__';

const controlsOrder: ControlKey[] = [
  'enableEmptyFilter',
  'defaultToFirstItem',
  'creatable',
  'multiSelect',
  'searchAllOptions',
  'inverseSelection',
];

export const StyledFormItem = styled(FormItem)<{ expanded: boolean }>`
  width: ${({ expanded }) => (expanded ? '49%' : `${FORM_ITEM_WIDTH}px`)};
`;

export const StyledRowFormItem = styled(FormItem)<{ expanded: boolean }>`
  min-width: ${({ expanded }) => (expanded ? '50%' : `${FORM_ITEM_WIDTH}px`)};
`;

export const StyledRowSubFormItem = styled(FormItem)<{ expanded: boolean }>`
  min-width: ${({ expanded }) => (expanded ? '50%' : `${FORM_ITEM_WIDTH}px`)};
`;

export const StyledLabel = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const DefaultValueContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
`;

const StyledAsterisk = styled.span`
  ${({ theme }) => `
  color: ${theme.colorError};
  font-size: ${theme.fontSizeSM}px;
  margin-left: ${theme.sizeUnit - 1}px;

  &:before {
    content: '*';
  `}
`;

const FilterTypeInfo = styled.div<{ expanded: boolean }>`
  ${({ theme, expanded }) => `
    width: ${expanded ? '49%' : `${FORM_ITEM_WIDTH}px`};
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    margin:
      ${theme.sizeUnit * 2}px
      0px
      ${theme.sizeUnit * 4}px
      ${theme.sizeUnit * 4}px;
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

export const CustomizationPanels = {
  configuration: {
    key: 'configuration',
    name: t('Display control configuration'),
  },
  settings: {
    key: 'settings',
    name: t('Display control settings'),
  },
};

export interface FiltersConfigFormHandle {
  changeTab: (tab: 'configuration' | 'scoping') => void;
}

export interface FiltersConfigFormProps {
  expanded: boolean;
  filterId: string;
  filterToEdit?: Filter;
  customizationToEdit?: ChartCustomization;
  nativeFilterIds: string[];
  nativeFilterConfigMap: Record<string, Filter | Divider>;
  removedNativeFilters: Record<string, FilterRemoval>;
  chartCustomizationConfigMap?: Record<
    string,
    ChartCustomization | ChartCustomizationDivider
  >;
  itemType?: 'filter' | 'chartCustomization';
  removedFilters: Record<string, FilterRemoval>;
  restoreFilter: (filterId: string) => void;
  onModifyFilter: (filterId: string) => void;
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
    expanded,
    filterId,
    filterToEdit,
    customizationToEdit,
    nativeFilterIds,
    nativeFilterConfigMap,
    removedNativeFilters,
    chartCustomizationConfigMap = {},
    itemType = 'filter',
    removedFilters,
    form,
    getAvailableFilters,
    activeFilterPanelKeys,
    restoreFilter,
    handleActiveFilterPanelChange,
    setErroredFilters,
    onModifyFilter,
    validateDependencies,
    getDependencySuggestion,
    isActive,
  }: FiltersConfigFormProps,
  ref: RefObject<FiltersConfigFormHandle>,
) => {
  const theme = useTheme();
  const isChartCustomization = itemType === 'chartCustomization';
  const isRemoved = !!removedFilters[filterId];
  const [error, setError] = useState<ClientErrorObject>();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string>(
    FilterTabs.configuration.key,
  );
  const dashboardId = useSelector<RootState, number>(
    state => state.dashboardInfo.id,
  );
  const dataMask = useSelector<RootState, DataMaskStateWithId>(
    state => state.dataMask,
  );
  const dashboardLayout = useSelector<
    RootState,
    RootState['dashboardLayout']['present']
  >(state => state.dashboardLayout.present);
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

  const handleModifyFilter = useCallback(() => {
    if (onModifyFilter) {
      onModifyFilter(filterId);
    }
  }, [onModifyFilter, filterId]);

  const dependencies: string[] =
    formFilter?.dependencies || filterToEdit?.cascadeParentIds || [];

  const nativeFilterAndCustomizationItems = getChartMetadataRegistry().items;
  const nativeFilterVizTypes = Object.entries(nativeFilterAndCustomizationItems)
    // @ts-expect-error
    .filter(([, { value }]) => value.behaviors?.includes(Behavior.NativeFilter))
    .map(([key]) => key as keyof typeof FILTER_SUPPORTED_TYPES);

  const chartCustomizationVizTypes = Object.entries(
    nativeFilterAndCustomizationItems,
  )
    // @ts-expect-error
    .filter(([, { value }]) =>
      value.behaviors?.includes(Behavior.ChartCustomization),
    )
    .map(([key]) => key as keyof typeof CHART_CUSTOMIZATION_SUPPORTED_TYPES);

  const loadedDatasets = useSelector<RootState, DatasourcesState>(
    ({ datasources }) => datasources,
  );

  const charts = useSelector<RootState, ChartsState>(({ charts }) => charts);
  const chartLayoutItems = useMemo(
    () =>
      Object.values(dashboardLayout).filter(
        (item): item is LayoutItem => item?.type === CHART_TYPE,
      ),
    [dashboardLayout],
  );
  const dashboardChartIds = useMemo(
    () =>
      chartLayoutItems
        .map(item => item.meta?.chartId)
        .filter((chartId): chartId is number => typeof chartId === 'number'),
    [chartLayoutItems],
  );

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
    return shouldShowTimeRangePicker(currentDataset);
  }, [formFilter?.dataset?.value, loadedDatasets]);

  const itemTypeField =
    formFilter?.filterType ||
    (isChartCustomization
      ? customizationToEdit?.filterType
      : filterToEdit?.filterType || 'filter_select');
  const isDynamicTitleCustomization =
    isChartCustomization &&
    itemTypeField === ChartCustomizationPlugins.DynamicTitle;

  const hasDataset =
    !isDynamicTitleCustomization &&
    // @ts-expect-error
    !!nativeFilterAndCustomizationItems[itemTypeField]?.value?.datasourceCount;

  const getDatasetId = () => {
    if (isDynamicTitleCustomization) {
      return undefined;
    }
    if (isChartCustomization) {
      if (formFilter?.dataset?.value) {
        return formFilter.dataset.value;
      }
      if (customizationToEdit?.targets?.[0]?.datasetId) {
        return customizationToEdit.targets[0].datasetId;
      }
      return mostUsedDataset(loadedDatasets, charts);
    }
    return (
      formFilter?.dataset?.value ??
      filterToEdit?.targets?.[0]?.datasetId ??
      mostUsedDataset(loadedDatasets, charts)
    );
  };

  const datasetId = getDatasetId();

  const formChanged = useCallback(() => {
    form.setFields([
      {
        name: 'changed',
        value: true,
      },
    ]);
    handleModifyFilter();
  }, [form, handleModifyFilter]);

  const debouncedFormChanged = useCallback(
    debounce(formChanged, Constants.SLOW_DEBOUNCE),
    [],
  );

  const { controlItems = {}, mainControlItems = {} } = formFilter
    ? isDynamicTitleCustomization
      ? {}
      : getControlItemsMap({
          expanded,
          datasetId,
          disabled: false,
          forceUpdate,
          formChanged,
          form,
          filterId,
          filterType: itemTypeField,
          filterToEdit,
          customizationToEdit,
          formFilter,
          removed: isRemoved,
        })
    : {};
  const hasColumn = !!mainControlItems.groupby;

  const nativeFilterItem =
    nativeFilterAndCustomizationItems[itemTypeField] ?? {};
  // @ts-expect-error
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
    setError(undefined);
    forceUpdate();
  };

  const setErrorWrapper = (error: ClientErrorObject) => {
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
      if (!hasDataset || !datasetId) {
        forceUpdate();
        return;
      }
      const formData = getFormData({
        datasetId,
        dashboardId,
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
      })
        .then(({ response, json }) => {
          if (isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
            // deal with getChartDataRequest transforming the response data
            const result = 'result' in json ? json.result[0] : json;

            if (response.status === 200) {
              setNativeFilterFieldValuesWrapper({
                defaultValueQueriesData: [result as ChartDataResponseResult],
              });
            } else if (response.status === 202) {
              waitForAsyncData(result as Parameters<typeof waitForAsyncData>[0])
                .then((asyncResult: ChartDataResponseResult[]) => {
                  setNativeFilterFieldValuesWrapper({
                    defaultValueQueriesData: asyncResult,
                  });
                })
                .catch((error: Response) => {
                  getClientErrorObject(error).then(clientErrorObject => {
                    setErrorWrapper(clientErrorObject);
                  });
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
          getClientErrorObject(error).then(clientErrorObject => {
            setError(clientErrorObject);
          });
        });
    },
    [
      datasetId,
      dashboardId,
      filterId,
      forceUpdate,
      form,
      formFilter,
      hasDataset,
      dependenciesText,
    ],
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
    useDefaultValue(formFilter, filterToEdit, customizationToEdit);

  const showDataset =
    !datasetId || datasetDetails || formFilter?.dataset?.label;

  const updateFormValues = useCallback(
    (values: Record<string, unknown>, triggerFormChange = true) => {
      setNativeFilterFieldValues(form, filterId, values);
      if (triggerFormChange) formChanged();
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
    typeof filterToEdit?.controlValues?.sortAscending === 'boolean' ||
    typeof customizationToEdit?.controlValues?.sortAscending === 'boolean';

  let sort =
    filterToEdit?.controlValues?.sortAscending ??
    customizationToEdit?.controlValues?.sortAscending;
  if (typeof formFilter?.controlValues?.sortAscending === 'boolean') {
    sort = formFilter.controlValues.sortAscending;
  }

  const showDefaultValue = isChartCustomization
    ? !hasDataset || !isDataDirty
    : !hasDataset ||
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

  const currentOperatorType: SelectFilterOperatorType =
    formFilter?.controlValues?.operatorType ??
    filterToEdit?.controlValues?.operatorType ??
    SelectFilterOperatorType.Exact;

  const selectedColumnIsString = useMemo(() => {
    const columnName = formFilter?.column;
    if (!columnName || !datasetDetails?.columns) return true;
    const colMeta = datasetDetails.columns.find(
      (c: { column_name: string }) => c.column_name === columnName,
    );
    if (!colMeta) return true;
    return colMeta.type_generic === GenericDataType.String;
  }, [formFilter?.column, datasetDetails?.columns]);

  const onOperatorTypeChanged = (value: SelectFilterOperatorType) => {
    const previous = form.getFieldValue('filters')?.[filterId].controlValues;
    setNativeFilterFieldValues(form, filterId, {
      controlValues: {
        ...previous,
        operatorType: value,
      },
      defaultDataMask: null,
    });
    formChanged();
    forceUpdate();
  };

  const prevColumnRef = useRef(formFilter?.column);
  const datasetLoaded = !!datasetDetails?.columns;
  useEffect(() => {
    const columnChanged = prevColumnRef.current !== formFilter?.column;
    if (
      (columnChanged || datasetLoaded) &&
      !selectedColumnIsString &&
      currentOperatorType !== SelectFilterOperatorType.Exact
    ) {
      onOperatorTypeChanged(SelectFilterOperatorType.Exact);
    }
    prevColumnRef.current = formFilter?.column;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formFilter?.column, selectedColumnIsString, datasetLoaded]);

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
    itemTypeField ===
    (isChartCustomization
      ? customizationToEdit?.filterType
      : filterToEdit?.filterType)
      ? isChartCustomization
        ? customizationToEdit?.defaultDataMask
        : filterToEdit?.defaultDataMask
      : null;

  const preFilterValidator = () => {
    if (hasTimeRange || hasAdhoc) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(t('Pre-filter is required')));
  };

  const availableFilters = useMemo(
    () => getAvailableFilters(filterId),
    [getAvailableFilters, filterId, filters],
  );
  const chartTitleById = useMemo(
    () =>
      chartLayoutItems.reduce<Record<number, string>>((acc, item) => {
        const chartId = item.meta?.chartId;
        if (typeof chartId === 'number') {
          acc[chartId] =
            item.meta?.sliceNameOverride ||
            item.meta?.sliceName ||
            t('Chart %s', chartId);
        }
        return acc;
      }, {}),
    [chartLayoutItems],
  );
  const getNativeFilterChartsInScope = useCallback(
    (nativeFilterId: string): number[] => {
      if (removedNativeFilters[nativeFilterId]) {
        return [];
      }

      const formNativeFilter = form.getFieldValue([
        'filters',
        nativeFilterId,
      ]) as NativeFiltersFormItem | undefined;
      const savedNativeFilter = nativeFilterConfigMap[nativeFilterId];
      const nativeFilter =
        formNativeFilter?.type === NativeFilterType.NativeFilter
          ? formNativeFilter
          : savedNativeFilter?.type === NativeFilterType.NativeFilter
            ? savedNativeFilter
            : undefined;

      if (!nativeFilter) {
        return [];
      }

      return resolveChartsInScope({
        scope: formNativeFilter?.scope ?? nativeFilter.scope,
        chartsInScope:
          'chartsInScope' in nativeFilter
            ? nativeFilter.chartsInScope
            : undefined,
        dashboardChartIds,
        chartLayoutItems,
        preferScope: Boolean(formNativeFilter?.scope),
      });
    },
    [
      chartLayoutItems,
      dashboardChartIds,
      form,
      nativeFilterConfigMap,
      removedNativeFilters,
    ],
  );
  const doesNativeFilterCoverCharts = useCallback(
    (nativeFilterId: string, chartIds: number[]) => {
      if (chartIds.length === 0) {
        return true;
      }

      const nativeFilterCharts = new Set(
        getNativeFilterChartsInScope(nativeFilterId),
      );
      return chartIds.every(chartId => nativeFilterCharts.has(chartId));
    },
    [getNativeFilterChartsInScope],
  );
  const hasAvailableFilters = availableFilters.length > 0;
  const hasTimeDependency = availableFilters
    .filter(filter => filter.type === 'filter_time')
    .some(filter => dependencies?.includes(filter.value));

  const extensionsRegistry = getExtensionsRegistry();

  const DateFilterControlExtension = extensionsRegistry.get(
    'filter.dateFilterControl',
  );

  const DateFilterComponent = DateFilterControlExtension ?? DateFilterControl;

  const getDynamicTitleScopeCandidate = useCallback(
    (customizationId: string): DynamicTitleScopeCandidate | undefined => {
      if (removedFilters[customizationId]) {
        return undefined;
      }

      const formCustomization = form.getFieldValue([
        'filters',
        customizationId,
      ]) as ChartCustomizationsFormItem | ChartCustomizationDivider | undefined;
      const savedCustomization = chartCustomizationConfigMap[customizationId];
      const filterType =
        formCustomization && 'filterType' in formCustomization
          ? formCustomization.filterType
          : savedCustomization && !('title' in savedCustomization)
            ? savedCustomization.filterType
            : undefined;

      if (filterType !== ChartCustomizationPlugins.DynamicTitle) {
        return undefined;
      }

      const scope =
        formCustomization && 'scope' in formCustomization
          ? formCustomization.scope
          : savedCustomization && !('title' in savedCustomization)
            ? savedCustomization.scope
            : undefined;
      const chartsInScope = resolveChartsInScope({
        scope,
        chartsInScope:
          savedCustomization && !('title' in savedCustomization)
            ? savedCustomization.chartsInScope
            : undefined,
        dashboardChartIds,
        chartLayoutItems,
        preferScope: Boolean(
          formCustomization &&
          'scope' in formCustomization &&
          formCustomization.scope,
        ),
      });
      const template =
        formCustomization &&
        'controlValues' in formCustomization &&
        formCustomization.controlValues?.template
          ? String(formCustomization.controlValues.template)
          : savedCustomization && !('title' in savedCustomization)
            ? getDynamicTitleControlValues(savedCustomization).template
            : undefined;

      return {
        id: customizationId,
        chartsInScope,
        template,
      };
    },
    [
      chartCustomizationConfigMap,
      chartLayoutItems,
      dashboardChartIds,
      form,
      removedFilters,
    ],
  );
  const currentDynamicTitleScopeCandidate = useMemo(
    () => getDynamicTitleScopeCandidate(filterId),
    [filterId, getDynamicTitleScopeCandidate],
  );
  const currentDynamicTitleChartIds =
    currentDynamicTitleScopeCandidate?.chartsInScope || [];
  const availableDynamicTitleFilters = useMemo(
    () =>
      nativeFilterIds
        .filter(id => !removedNativeFilters[id])
        .map(id => {
          const formFilter = filters?.[id];
          const savedFilter = nativeFilterConfigMap[id];
          const filter =
            formFilter?.type === NativeFilterType.NativeFilter
              ? formFilter
              : savedFilter?.type === NativeFilterType.NativeFilter
                ? savedFilter
                : undefined;

          if (!filter) {
            return null;
          }

          if (
            currentDynamicTitleChartIds.length > 0 &&
            !doesNativeFilterCoverCharts(id, currentDynamicTitleChartIds)
          ) {
            return null;
          }

          return {
            id,
            name: filter.name || t('[untitled]'),
          };
        })
        .filter((filter): filter is { id: string; name: string } => !!filter)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [
      currentDynamicTitleChartIds,
      doesNativeFilterCoverCharts,
      filters,
      nativeFilterConfigMap,
      nativeFilterIds,
      removedNativeFilters,
    ],
  );
  const dynamicTitleTokenOptions = useMemo<DynamicTitleTokenOption[]>(
    () => [
      {
        value: BUILT_IN_CHART_TITLE_TOKEN_VALUE,
        label: t('Current chart title'),
        alias: DYNAMIC_TITLE_CHART_TITLE_ALIAS,
        kind: 'built_in',
      },
      ...availableDynamicTitleFilters.map(filter => ({
        value: filter.id,
        label: filter.name,
        alias: filter.name,
        kind: 'filter' as const,
        filterId: filter.id,
      })),
    ],
    [availableDynamicTitleFilters],
  );
  const dynamicTitleControlValues = getDynamicTitleControlValues(
    isDynamicTitleCustomization ? customizationToEdit : undefined,
  );
  const dynamicTitleTemplate =
    formFilter?.controlValues?.template ??
    dynamicTitleControlValues.template ??
    '';
  const dynamicTitleTokenMappings = useMemo(
    () =>
      (formFilter?.controlValues?.tokenMappings ??
        dynamicTitleControlValues.tokenMappings ??
        {}) as DynamicTitleTokenMappings,
    [
      formFilter?.controlValues?.tokenMappings,
      dynamicTitleControlValues.tokenMappings,
    ],
  );
  const dynamicTitleFilterIds = useMemo(
    () => new Set(availableDynamicTitleFilters.map(filter => filter.id)),
    [availableDynamicTitleFilters],
  );
  const dynamicTitleUsesChartTitleToken =
    usesChartTitleToken(dynamicTitleTemplate);

  const currentDynamicTitleScopeLabel = useMemo(() => {
    const chartsInScope =
      currentDynamicTitleScopeCandidate?.chartsInScope || [];
    if (chartsInScope.length === 0) {
      return t('No charts selected');
    }
    if (chartsInScope.length === 1) {
      return chartTitleById[chartsInScope[0]] || t('1 chart selected');
    }
    return t('%s charts selected', chartsInScope.length);
  }, [chartTitleById, currentDynamicTitleScopeCandidate?.chartsInScope]);
  const previewChartTitle = useMemo(() => {
    const scopedChartIds =
      currentDynamicTitleScopeCandidate?.chartsInScope || [];
    if (scopedChartIds.length === 1) {
      return chartTitleById[scopedChartIds[0]] || t('Chart title');
    }
    return t('Chart title');
  }, [chartTitleById, currentDynamicTitleScopeCandidate?.chartsInScope]);

  const dynamicTitlePreview = useMemo(() => {
    if (!dynamicTitleTemplate) {
      return '';
    }

    const aliasValues = {
      ...Object.entries(dynamicTitleTokenMappings).reduce<
        Record<string, string | undefined>
      >((acc, [alias, mappedFilterId]) => {
        const filter = nativeFilterConfigMap[mappedFilterId];
        if (
          removedNativeFilters[mappedFilterId] ||
          !filter ||
          filter.type !== NativeFilterType.NativeFilter
        ) {
          acc[alias] = undefined;
          return acc;
        }

        if (
          currentDynamicTitleChartIds.length > 0 &&
          !doesNativeFilterCoverCharts(
            mappedFilterId,
            currentDynamicTitleChartIds,
          )
        ) {
          acc[alias] = undefined;
          return acc;
        }

        const label = extractLabel(dataMask[mappedFilterId]?.filterState);
        acc[alias] =
          label ||
          getFilterValueForDisplay(
            dataMask[mappedFilterId]?.filterState?.value,
          ) ||
          undefined;
        return acc;
      }, {}),
      [DYNAMIC_TITLE_CHART_TITLE_ALIAS]: previewChartTitle,
    };

    return renderDynamicTitleTemplate(dynamicTitleTemplate, aliasValues);
  }, [
    currentDynamicTitleChartIds,
    dataMask,
    doesNativeFilterCoverCharts,
    dynamicTitleTemplate,
    dynamicTitleTokenMappings,
    nativeFilterConfigMap,
    previewChartTitle,
    removedNativeFilters,
  ]);

  const validateDynamicTitleScopeOverlap = useCallback(async () => {
    const currentCustomization = getDynamicTitleScopeCandidate(filterId);

    if (!currentCustomization) {
      return;
    }

    if (
      !canApplyDynamicTitleToScope(
        currentCustomization.template,
        currentCustomization.chartsInScope,
      )
    ) {
      throw new Error(
        t(
          'Target exactly one chart, or include {{chart_title}} to keep each chart title.',
        ),
      );
    }

    const formCustomizationIds = Object.keys(
      form.getFieldValue('filters') || {},
    ).filter(isChartCustomizationId);
    const existingCustomizationIds = Object.keys(chartCustomizationConfigMap);
    const customizationIds = Array.from(
      new Set([...existingCustomizationIds, ...formCustomizationIds]),
    );
    const conflictingCustomization = findDynamicTitleScopeConflict(
      currentCustomization,
      customizationIds
        .map(getDynamicTitleScopeCandidate)
        .filter(
          (customization): customization is DynamicTitleScopeCandidate =>
            customization !== undefined,
        ),
    );

    if (conflictingCustomization) {
      throw new Error(t('A chart can only have one dynamic title.'));
    }
  }, [
    chartCustomizationConfigMap,
    filterId,
    form,
    getDynamicTitleScopeCandidate,
  ]);

  const updateDynamicTitleControlValues = useCallback(
    (nextValues: Record<string, unknown>) => {
      const previousControlValues =
        form.getFieldValue('filters')?.[filterId]?.controlValues ||
        dynamicTitleControlValues;
      setNativeFilterFieldValues(form, filterId, {
        controlValues: {
          ...previousControlValues,
          ...nextValues,
        },
      });
      forceUpdate();
      formChanged();
    },
    [dynamicTitleControlValues, filterId, forceUpdate, form, formChanged],
  );

  const insertDynamicTitleFilterToken = useCallback(
    (selectedTokenValue?: string) => {
      if (!selectedTokenValue) {
        return;
      }

      const selectedToken = dynamicTitleTokenOptions.find(
        tokenOption => tokenOption.value === selectedTokenValue,
      );
      if (!selectedToken) {
        return;
      }

      const template = (
        form.getFieldValue('filters')?.[filterId]?.controlValues?.template ||
        dynamicTitleTemplate
      ).trim();
      const token = `{{${selectedToken.alias}}}`;

      if (selectedToken.kind === 'built_in') {
        updateDynamicTitleControlValues({
          template: template ? `${template} ${token}` : token,
        });
        return;
      }

      const existingMappings =
        (form.getFieldValue('filters')?.[filterId]?.controlValues
          ?.tokenMappings as DynamicTitleTokenMappings | undefined) ||
        dynamicTitleTokenMappings;
      const existingAlias = Object.entries(existingMappings).find(
        ([, mappedFilterId]) => mappedFilterId === selectedToken.filterId,
      )?.[0];
      const alias =
        existingAlias ||
        createDynamicTitleAlias(
          selectedToken.label,
          Object.keys(existingMappings),
        );

      updateDynamicTitleControlValues({
        template: template ? `${template} {{${alias}}}` : `{{${alias}}}`,
        tokenMappings: {
          ...existingMappings,
          [alias]: selectedToken.filterId,
        },
      });
    },
    [
      dynamicTitleTemplate,
      dynamicTitleTokenMappings,
      dynamicTitleTokenOptions,
      filterId,
      form,
      updateDynamicTitleControlValues,
    ],
  );

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
            'columns.type_generic',
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
    const shouldRefresh = isChartCustomization
      ? hasDataset && hasDefaultValue && isDataDirty
      : hasDataset && hasFilledDataset && hasDefaultValue && isDataDirty;

    if (shouldRefresh) {
      refreshHandler();
    }
  }, [
    hasDataset,
    hasFilledDataset,
    hasDefaultValue,
    isDataDirty,
    refreshHandler,
    showDataset,
    isChartCustomization,
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
    JSON.stringify(Object.values(charts).map(chart => chart.id)),
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
      expanded={expanded}
      name={['filters', filterId, 'granularity_sqla']}
      label={
        <>
          <StyledLabel>{t('Time column')}</StyledLabel>&nbsp;
          <InfoTooltip
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
          // We need reset default value when column changed
          setNativeFilterFieldValues(form, filterId, {
            granularity_sqla: column,
          });
          forceUpdate();
          formChanged();
        }}
      />
    </StyledRowFormItem>
  );
  return (
    <Tabs
      allowOverflow={false}
      contentHeight={`calc(100vh - ${theme.sizeUnit * 55}px)`}
      contentPadding={css`
        padding-top: ${theme.sizeUnit * 4}px;
      `}
      activeKey={activeTabKey}
      onChange={activeKey => setActiveTabKey(activeKey)}
      items={[
        {
          key: FilterTabs.configuration.key,
          label: FilterTabs.configuration.name,
          forceRender: true,
          children: (
            <>
              <StyledSettings>
                <StyledContainer>
                  <StyledFormItem
                    expanded={expanded}
                    name={['filters', filterId, 'name']}
                    label={
                      <StyledLabel>
                        {isChartCustomization
                          ? t('Internal name')
                          : t('Filter name')}
                      </StyledLabel>
                    }
                    initialValue={
                      isChartCustomization
                        ? customizationToEdit?.name
                        : filterToEdit?.name
                    }
                    rules={[
                      { required: !isRemoved, message: t('Name is required') },
                    ]}
                  >
                    <Input
                      {...getFiltersConfigModalTestId('name-input')}
                      onChange={debouncedFormChanged}
                    />
                  </StyledFormItem>
                  {isChartCustomization ? (
                    <StyledFormItem
                      expanded={expanded}
                      name={['filters', filterId, 'filterType']}
                      rules={[
                        {
                          required: !isRemoved,
                          message: t('Type is required'),
                        },
                      ]}
                      initialValue={customizationToEdit?.filterType}
                      label={
                        <StyledLabel>{t('Display control type')}</StyledLabel>
                      }
                    >
                      <Select
                        ariaLabel={t('Customization type')}
                        options={[
                          ...chartCustomizationVizTypes.map(pluginKey => {
                            const registryItem =
                              nativeFilterAndCustomizationItems[pluginKey];
                            const name =
                              registryItem && 'value' in registryItem
                                ? registryItem.value.name
                                : undefined;
                            return {
                              value: pluginKey,
                              label: name || pluginKey,
                            };
                          }),
                          {
                            value: ChartCustomizationPlugins.DynamicTitle,
                            label: t('Chart title template'),
                          },
                        ]}
                        onChange={value => {
                          setNativeFilterFieldValues(form, filterId, {
                            filterType: value,
                            controlValues: {},
                            defaultDataMask: null,
                            column: null,
                            dataset: null,
                            datasetInfo: undefined,
                          });
                          forceUpdate();
                          formChanged();
                        }}
                      />
                    </StyledFormItem>
                  ) : (
                    <StyledFormItem
                      expanded={expanded}
                      name={['filters', filterId, 'filterType']}
                      rules={[
                        {
                          required: !isRemoved,
                          message: t('Name is required'),
                        },
                      ]}
                      initialValue={filterToEdit?.filterType || 'filter_select'}
                      label={<StyledLabel>{t('Filter Type')}</StyledLabel>}
                      {...getFiltersConfigModalTestId('filter-type')}
                    >
                      <Select
                        ariaLabel={t('Filter type')}
                        options={nativeFilterVizTypes.map(filterType => {
                          const name =
                            // @ts-expect-error
                            nativeFilterAndCustomizationItems[filterType]?.value
                              .name;
                          const mappedName = name
                            ? FILTER_TYPE_NAME_MAPPING[name]
                            : undefined;
                          const isDisabled =
                            FILTER_SUPPORTED_TYPES[filterType]?.length === 1 &&
                            FILTER_SUPPORTED_TYPES[filterType]?.includes(
                              GenericDataType.Temporal,
                            ) &&
                            !doLoadedDatasetsHaveTemporalColumns;
                          return {
                            value: filterType,
                            label: isDisabled ? (
                              <Tooltip
                                title={t(
                                  'Datasets do not contain a temporal column',
                                )}
                              >
                                {mappedName || name}
                              </Tooltip>
                            ) : (
                              mappedName || name
                            ),
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
                          formChanged();
                        }}
                      />
                    </StyledFormItem>
                  )}
                </StyledContainer>
                {formFilter?.filterType === 'filter_time' && (
                  <FilterTypeInfo expanded={expanded}>
                    {t(`Dashboard time range filters apply to temporal columns defined in
          the filter section of each chart. Add temporal columns to the chart
          filters to have this dashboard filter impact those charts.`)}
                  </FilterTypeInfo>
                )}
                {hasDataset && (
                  <StyledRowContainer justify="space-between">
                    {showDataset ? (
                      <StyledFormItem
                        expanded={expanded}
                        name={['filters', filterId, 'dataset']}
                        label={<StyledLabel>{t('Dataset')}</StyledLabel>}
                        initialValue={
                          datasetDetails
                            ? {
                                label: DatasetSelectLabel({
                                  id: datasetDetails.id,
                                  table_name: datasetDetails.table_name,
                                  schema: datasetDetails.schema,
                                  database: {
                                    database_name:
                                      datasetDetails.database.database_name,
                                  },
                                }),
                                value: datasetDetails.id,
                              }
                            : undefined
                        }
                        rules={[
                          {
                            required: !isRemoved,
                            message: t('Dataset is required'),
                          },
                        ]}
                        {...getFiltersConfigModalTestId('datasource-input')}
                      >
                        <DatasetSelect
                          onChange={(value: {
                            label: string | React.ReactNode;
                            value: number;
                          }) => {
                            if (value.value !== datasetId) {
                              setNativeFilterFieldValues(form, filterId, {
                                dataset: value,
                                datasetInfo: value,
                                defaultDataMask: null,
                                column: null,
                              });
                            }
                            forceUpdate();
                            formChanged();
                          }}
                        />
                      </StyledFormItem>
                    ) : (
                      <StyledFormItem
                        expanded={expanded}
                        label={<StyledLabel>{t('Dataset')}</StyledLabel>}
                      >
                        <Loading position="inline-centered" />
                      </StyledFormItem>
                    )}
                    {hasDataset &&
                      !isChartCustomization &&
                      Object.keys(mainControlItems).map(
                        key => mainControlItems[key].element,
                      )}
                  </StyledRowContainer>
                )}
                <Collapse
                  modalMode
                  defaultActiveKey={activeFilterPanelKeys}
                  onChange={key => {
                    handleActiveFilterPanelChange(key);
                  }}
                  expandIconPosition="end"
                  key={`native-filter-config-${filterId}`}
                  items={[
                    ...(itemTypeField !== 'filter_time'
                      ? [
                          {
                            key: `${filterId}-${FilterPanels.configuration.key}`,
                            forceRender: true,
                            label: isChartCustomization
                              ? CustomizationPanels.configuration.name
                              : FilterPanels.configuration.name,
                            children: (
                              <>
                                {isDynamicTitleCustomization && (
                                  <>
                                    <FormItem
                                      name={[
                                        'filters',
                                        filterId,
                                        'controlValues',
                                        'tokenMappings',
                                      ]}
                                      hidden
                                      initialValue={dynamicTitleTokenMappings}
                                    />
                                    <StyledRowContainer justify="space-between">
                                      <StyledFormItem
                                        expanded={expanded}
                                        label={
                                          <StyledLabel>
                                            {t('Insert token')}
                                          </StyledLabel>
                                        }
                                      >
                                        <Select
                                          allowClear
                                          ariaLabel={t('Insert token')}
                                          placeholder={t('Select a token')}
                                          options={dynamicTitleTokenOptions.map(
                                            tokenOption => ({
                                              value: tokenOption.value,
                                              label: tokenOption.label,
                                            }),
                                          )}
                                          onChange={value => {
                                            insertDynamicTitleFilterToken(
                                              value as string | undefined,
                                            );
                                          }}
                                        />
                                      </StyledFormItem>
                                      <DynamicTitleFieldGroup
                                        expanded={expanded}
                                      >
                                        <StyledFormItem
                                          expanded={expanded}
                                          name={[
                                            'filters',
                                            filterId,
                                            'controlValues',
                                            'template',
                                          ]}
                                          initialValue={dynamicTitleTemplate}
                                          label={
                                            <>
                                              <StyledLabel>
                                                {t('Template')}
                                              </StyledLabel>
                                              &nbsp;
                                              <InfoTooltip
                                                placement="top"
                                                tooltip={t(
                                                  'Use {{chart_title}} to keep each chart title, and filter tokens like {{country}} to append dashboard context.',
                                                )}
                                              />
                                            </>
                                          }
                                          rules={[
                                            {
                                              required: !isRemoved,
                                              message: t(
                                                'Template is required',
                                              ),
                                            },
                                            {
                                              validator: async (_, value) => {
                                                const aliases =
                                                  extractDynamicTitleAliases(
                                                    value,
                                                  );
                                                const missingAliases =
                                                  aliases.filter(
                                                    alias =>
                                                      !isBuiltInDynamicTitleAlias(
                                                        alias,
                                                      ) &&
                                                      !dynamicTitleTokenMappings[
                                                        alias
                                                      ],
                                                  );
                                                if (missingAliases.length > 0) {
                                                  throw new Error(
                                                    t(
                                                      'Insert tokens for: %s',
                                                      missingAliases.join(', '),
                                                    ),
                                                  );
                                                }

                                                const invalidAliases =
                                                  aliases.filter(alias => {
                                                    const mappedFilterId =
                                                      dynamicTitleTokenMappings[
                                                        alias
                                                      ];
                                                    return (
                                                      !!mappedFilterId &&
                                                      !dynamicTitleFilterIds.has(
                                                        mappedFilterId,
                                                      )
                                                    );
                                                  });
                                                if (invalidAliases.length > 0) {
                                                  throw new Error(
                                                    t(
                                                      'Update or remove invalid tokens: %s',
                                                      invalidAliases.join(', '),
                                                    ),
                                                  );
                                                }

                                                await validateDynamicTitleScopeOverlap();
                                              },
                                            },
                                          ]}
                                        >
                                          <Input.TextArea
                                            aria-label={t('Template')}
                                            rows={4}
                                            value={dynamicTitleTemplate}
                                            placeholder={t(
                                              'Example: {{chart_title}} - {{country}}',
                                            )}
                                            onChange={event => {
                                              updateDynamicTitleControlValues({
                                                template: event.target.value,
                                              });
                                            }}
                                          />
                                        </StyledFormItem>
                                        <DynamicTitleHint>
                                          {t(
                                            'Applied to: %s. Use {{chart_title}} when the scope includes multiple charts.',
                                            currentDynamicTitleScopeLabel,
                                          )}
                                        </DynamicTitleHint>
                                        {!dynamicTitleUsesChartTitleToken &&
                                          !hasSingleChartScope(
                                            currentDynamicTitleScopeCandidate?.chartsInScope,
                                          ) && (
                                            <DynamicTitleHint>
                                              {t(
                                                'Multi-chart scope needs {{chart_title}} so each chart keeps its own base title.',
                                              )}
                                            </DynamicTitleHint>
                                          )}
                                      </DynamicTitleFieldGroup>
                                    </StyledRowContainer>
                                    <StyledRowContainer justify="space-between">
                                      <StyledFormItem
                                        expanded={expanded}
                                        label={
                                          <StyledLabel>
                                            {t('Preview')}
                                          </StyledLabel>
                                        }
                                      >
                                        <DynamicTitlePreview>
                                          {dynamicTitlePreview ||
                                            t(
                                              'Preview updates when referenced dashboard filters have values.',
                                            )}
                                        </DynamicTitlePreview>
                                        <DynamicTitleHint>
                                          {t(
                                            'Preview uses %s as the current chart title.',
                                            previewChartTitle,
                                          )}
                                        </DynamicTitleHint>
                                      </StyledFormItem>
                                    </StyledRowContainer>
                                  </>
                                )}
                                {!isDynamicTitleCustomization && (
                                  <>
                                    {canDependOnOtherFilters &&
                                      (hasAvailableFilters ||
                                        dependencies.length > 0) && (
                                        <StyledRowFormItem
                                          expanded={expanded}
                                          name={[
                                            'filters',
                                            filterId,
                                            'dependencies',
                                          ]}
                                          initialValue={dependencies}
                                        >
                                          <DependencyList
                                            availableFilters={availableFilters}
                                            dependencies={dependencies}
                                            onDependenciesChange={dependencies => {
                                              setNativeFilterFieldValues(
                                                form,
                                                filterId,
                                                {
                                                  dependencies,
                                                },
                                              );
                                              forceUpdate();
                                              validateDependencies();
                                              formChanged();
                                            }}
                                            getDependencySuggestion={() =>
                                              getDependencySuggestion(filterId)
                                            }
                                          >
                                            {hasTimeDependency
                                              ? timeColumn
                                              : undefined}
                                          </DependencyList>
                                        </StyledRowFormItem>
                                      )}
                                    {hasDataset && hasAdditionalFilters && (
                                      <FormItem
                                        name={[
                                          'filters',
                                          filterId,
                                          'preFilter',
                                        ]}
                                      >
                                        <CollapsibleControl
                                          initialValue={hasPreFilter}
                                          title={t(
                                            'Pre-filter available values',
                                          )}
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
                                            expanded={expanded}
                                            name={[
                                              'filters',
                                              filterId,
                                              'adhoc_filters',
                                            ]}
                                            css={{ width: INPUT_WIDTH }}
                                            initialValue={
                                              filterToEdit?.adhoc_filters
                                            }
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
                                                  (c: ColumnMeta) =>
                                                    c.filterable,
                                                ) || []
                                              }
                                              savedMetrics={
                                                datasetDetails?.metrics || []
                                              }
                                              datasource={datasetDetails}
                                              onChange={(
                                                filters: AdhocFilterClass[],
                                              ) => {
                                                setNativeFilterFieldValues(
                                                  form,
                                                  filterId,
                                                  {
                                                    adhoc_filters: filters,
                                                  },
                                                );
                                                forceUpdate();
                                                formChanged();
                                                validatePreFilter();
                                              }}
                                              label={
                                                <span>
                                                  <StyledLabel>
                                                    {t('Pre-filter')}
                                                  </StyledLabel>
                                                  {!hasTimeRange && (
                                                    <StyledAsterisk />
                                                  )}
                                                </span>
                                              }
                                            />
                                          </StyledRowSubFormItem>
                                          {showTimeRangePicker && (
                                            <StyledRowFormItem
                                              expanded={expanded}
                                              name={[
                                                'filters',
                                                filterId,
                                                'time_range',
                                              ]}
                                              label={
                                                <StyledLabel>
                                                  {t('Time range')}
                                                </StyledLabel>
                                              }
                                              initialValue={
                                                filterToEdit?.time_range ||
                                                t('No filter')
                                              }
                                              required={!hasAdhoc}
                                              rules={[
                                                {
                                                  validator: preFilterValidator,
                                                },
                                              ]}
                                            >
                                              <DateFilterComponent
                                                name="time_range"
                                                onChange={timeRange => {
                                                  setNativeFilterFieldValues(
                                                    form,
                                                    filterId,
                                                    {
                                                      time_range: timeRange,
                                                    },
                                                  );
                                                  forceUpdate();
                                                  formChanged();
                                                  validatePreFilter();
                                                }}
                                              />
                                            </StyledRowFormItem>
                                          )}
                                          {hasTimeRange && !hasTimeDependency
                                            ? timeColumn
                                            : undefined}
                                        </CollapsibleControl>
                                      </FormItem>
                                    )}
                                    {itemTypeField !== 'filter_range' ? (
                                      <FormItem
                                        name={[
                                          'filters',
                                          filterId,
                                          'sortFilter',
                                        ]}
                                        initialValue={hasSorting}
                                      >
                                        <CollapsibleControl
                                          initialValue={hasSorting}
                                          title={
                                            isChartCustomization
                                              ? t('Sort display control values')
                                              : t('Sort filter values')
                                          }
                                          onChange={checked => {
                                            onSortChanged(checked || undefined);
                                            formChanged();
                                          }}
                                        >
                                          <StyledRowFormItem
                                            expanded={expanded}
                                            name={[
                                              'filters',
                                              filterId,
                                              'controlValues',
                                              'sortAscending',
                                            ]}
                                            initialValue={sort}
                                            label={
                                              <StyledLabel>
                                                {t('Sort type')}
                                              </StyledLabel>
                                            }
                                          >
                                            <Radio.GroupWrapper
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
                                              onChange={value => {
                                                onSortChanged(
                                                  value.target.value,
                                                );
                                                formChanged();
                                              }}
                                            />
                                          </StyledRowFormItem>
                                          {hasMetrics && (
                                            <StyledRowSubFormItem
                                              expanded={expanded}
                                              name={[
                                                'filters',
                                                filterId,
                                                'controlValues',
                                                'sortMetric',
                                              ]}
                                              initialValue={
                                                filterToEdit?.controlValues
                                                  ?.sortMetric ??
                                                customizationToEdit
                                                  ?.controlValues?.sortMetric
                                              }
                                              label={
                                                <>
                                                  <StyledLabel>
                                                    {t('Sort Metric')}
                                                  </StyledLabel>
                                                  &nbsp;
                                                  <InfoTooltip
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
                                                options={metrics.map(
                                                  (metric: Metric) => ({
                                                    value: metric.metric_name,
                                                    label:
                                                      metric.verbose_name ??
                                                      metric.metric_name,
                                                  }),
                                                )}
                                                onChange={value => {
                                                  if (value !== undefined) {
                                                    const previous =
                                                      form.getFieldValue(
                                                        'filters',
                                                      )?.[filterId]
                                                        .controlValues || {};
                                                    setNativeFilterFieldValues(
                                                      form,
                                                      filterId,
                                                      {
                                                        controlValues: {
                                                          ...previous,
                                                          sortMetric: value,
                                                        },
                                                      },
                                                    );
                                                    forceUpdate();
                                                  }
                                                  formChanged();
                                                }}
                                              />
                                            </StyledRowSubFormItem>
                                          )}
                                        </CollapsibleControl>
                                      </FormItem>
                                    ) : (
                                      <>
                                        <FormItem
                                          name={[
                                            'filters',
                                            filterId,
                                            'rangeFilter',
                                          ]}
                                        >
                                          <CollapsibleControl
                                            initialValue={hasEnableSingleValue}
                                            title={t('Single Value')}
                                            onChange={checked => {
                                              onEnableSingleValueChanged(
                                                checked
                                                  ? SingleValueType.Exact
                                                  : undefined,
                                              );
                                              formChanged();
                                            }}
                                          >
                                            <StyledRowFormItem
                                              expanded={expanded}
                                              name={[
                                                'filters',
                                                filterId,
                                                'controlValues',
                                                'enableSingleValue',
                                              ]}
                                              initialValue={enableSingleValue}
                                              label={
                                                <StyledLabel>
                                                  {t('Single value type')}
                                                </StyledLabel>
                                              }
                                            >
                                              <Radio.GroupWrapper
                                                onChange={value => {
                                                  onEnableSingleValueChanged(
                                                    value.target.value,
                                                  );
                                                  formChanged();
                                                }}
                                                options={[
                                                  {
                                                    label: t('Minimum'),
                                                    value:
                                                      SingleValueType.Minimum,
                                                  },
                                                  {
                                                    label: t('Exact'),
                                                    value:
                                                      SingleValueType.Exact,
                                                  },
                                                  {
                                                    label: t('Maximum'),
                                                    value:
                                                      SingleValueType.Maximum,
                                                  },
                                                ]}
                                              />
                                            </StyledRowFormItem>
                                          </CollapsibleControl>
                                        </FormItem>

                                        <FormItem
                                          name={[
                                            'filters',
                                            filterId,
                                            'rangeType',
                                          ]}
                                        >
                                          <StyledRowFormItem
                                            expanded={expanded}
                                            name={[
                                              'filters',
                                              filterId,
                                              'controlValues',
                                              'rangeDisplayMode',
                                            ]}
                                            initialValue={
                                              formFilter?.controlValues
                                                ?.rangeDisplayMode ||
                                              filterToEdit?.controlValues
                                                ?.rangeDisplayMode ||
                                              RangeDisplayMode.SliderAndInput
                                            }
                                            label={
                                              <StyledLabel>
                                                {t('Range Type')}
                                              </StyledLabel>
                                            }
                                          >
                                            <Select
                                              ariaLabel={t('Range Type')}
                                              options={[
                                                {
                                                  value:
                                                    RangeDisplayMode.Slider,
                                                  label: t('Slider'),
                                                },
                                                {
                                                  value: RangeDisplayMode.Input,
                                                  label: t('Range Inputs'),
                                                },
                                                {
                                                  value:
                                                    RangeDisplayMode.SliderAndInput,
                                                  label: t(
                                                    'Slider and range input',
                                                  ),
                                                },
                                              ]}
                                              onChange={value => {
                                                const previous =
                                                  form.getFieldValue(
                                                    'filters',
                                                  )?.[filterId].controlValues ||
                                                  {};
                                                const rangeDisplayMode =
                                                  value ||
                                                  RangeDisplayMode.SliderAndInput;
                                                setNativeFilterFieldValues(
                                                  form,
                                                  filterId,
                                                  {
                                                    controlValues: {
                                                      ...previous,
                                                      rangeDisplayMode,
                                                    },
                                                  },
                                                );

                                                forceUpdate();
                                                formChanged();
                                              }}
                                            />
                                          </StyledRowFormItem>
                                        </FormItem>
                                      </>
                                    )}
                                  </>
                                )}
                              </>
                            ),
                          },
                        ]
                      : []),
                    {
                      label: isChartCustomization
                        ? CustomizationPanels.settings.name
                        : FilterPanels.settings.name,
                      key: `${filterId}-${FilterPanels.settings.key}`,
                      forceRender: true,
                      children: (
                        <>
                          <StyledFormItem
                            expanded={expanded}
                            name={['filters', filterId, 'description']}
                            initialValue={
                              isChartCustomization
                                ? customizationToEdit?.description
                                : filterToEdit?.description
                            }
                            label={
                              <StyledLabel>{t('Description')}</StyledLabel>
                            }
                          >
                            <Input.TextArea onChange={debouncedFormChanged} />
                          </StyledFormItem>
                          <FormItem
                            name={['filters', filterId, 'type']}
                            hidden
                            initialValue={
                              isChartCustomization
                                ? ChartCustomizationType.ChartCustomization
                                : NativeFilterType.NativeFilter
                            }
                          />
                          <FormItem
                            name={[
                              'filters',
                              filterId,
                              'defaultValueQueriesData',
                            ]}
                            hidden
                            initialValue={null}
                          />
                          {!isChartCustomization &&
                            itemTypeField === 'filter_select' && (
                              <StyledRowFormItem
                                expanded={expanded}
                                name={[
                                  'filters',
                                  filterId,
                                  'controlValues',
                                  'operatorType',
                                ]}
                                initialValue={currentOperatorType}
                                label={
                                  <>
                                    <StyledLabel>{t('Match type')}</StyledLabel>
                                    &nbsp;
                                    <InfoTooltip
                                      placement="top"
                                      tooltip={t(
                                        'Warning: ILIKE queries may be slow on large datasets as they cannot use indexes effectively.',
                                      )}
                                    />
                                  </>
                                }
                              >
                                <Select
                                  ariaLabel={t('Match type')}
                                  options={[
                                    {
                                      value: SelectFilterOperatorType.Exact,
                                      label: t('Exact match (IN)'),
                                    },
                                    ...(selectedColumnIsString
                                      ? [
                                          {
                                            value:
                                              SelectFilterOperatorType.Contains,
                                            label: t(
                                              'Contains text (ILIKE %x%)',
                                            ),
                                          },
                                          {
                                            value:
                                              SelectFilterOperatorType.StartsWith,
                                            label: t('Starts with (ILIKE x%)'),
                                          },
                                          {
                                            value:
                                              SelectFilterOperatorType.EndsWith,
                                            label: t('Ends with (ILIKE %x)'),
                                          },
                                        ]
                                      : []),
                                  ]}
                                  onChange={value => {
                                    onOperatorTypeChanged(
                                      value as SelectFilterOperatorType,
                                    );
                                  }}
                                />
                              </StyledRowFormItem>
                            )}
                          {!isDynamicTitleCustomization && (
                            <FormItem
                              name={['filters', filterId, 'defaultValue']}
                            >
                              <CollapsibleControl
                                checked={hasDefaultValue}
                                disabled={isRequired || defaultToFirstItem}
                                initialValue={hasDefaultValue}
                                title={
                                  isChartCustomization
                                    ? t('Display control has default value')
                                    : t('Filter has default value')
                                }
                                tooltip={defaultValueTooltip}
                                onChange={value => {
                                  setHasDefaultValue(value);
                                  if (!value) {
                                    setNativeFilterFieldValues(form, filterId, {
                                      defaultDataMask: null,
                                    });
                                  } else {
                                    if (
                                      formFilter?.filterType === 'filter_range'
                                    ) {
                                      setNativeFilterFieldValues(
                                        form,
                                        filterId,
                                        {
                                          defaultDataMask: {
                                            extraFormData: {},
                                            filterState: {
                                              value: [null, null],
                                            },
                                          },
                                        },
                                      );
                                    }
                                    form.validateFields([
                                      ['filters', filterId, 'defaultDataMask'],
                                    ]);
                                  }
                                  formChanged();
                                }}
                              >
                                {!isRemoved && (
                                  <StyledRowSubFormItem
                                    expanded={expanded}
                                    name={[
                                      'filters',
                                      filterId,
                                      'defaultDataMask',
                                    ]}
                                    initialValue={initialDefaultValue}
                                    data-test="default-input"
                                    label={
                                      <StyledLabel>
                                        {t('Default Value')}
                                      </StyledLabel>
                                    }
                                    required={hasDefaultValue}
                                    rules={[
                                      {
                                        validator: () => {
                                          const value =
                                            formFilter?.defaultDataMask
                                              ?.filterState?.value;
                                          const isRangeFilter =
                                            formFilter?.filterType ===
                                            'filter_range';
                                          const hasValidValue =
                                            isValidFilterValue(
                                              value,
                                              isRangeFilter,
                                            );

                                          if (hasValidValue) {
                                            const formValidationFields =
                                              form.getFieldsError();
                                            setErroredFilters(
                                              prevErroredFilters => {
                                                if (
                                                  prevErroredFilters.length &&
                                                  !formValidationFields.some(
                                                    f => f.errors.length > 0,
                                                  )
                                                ) {
                                                  return [];
                                                }
                                                return prevErroredFilters;
                                              },
                                            );
                                            return Promise.resolve();
                                          }

                                          setErroredFilters(
                                            prevErroredFilters => {
                                              if (
                                                prevErroredFilters.includes(
                                                  filterId,
                                                )
                                              ) {
                                                return prevErroredFilters;
                                              }
                                              return [
                                                ...prevErroredFilters,
                                                filterId,
                                              ];
                                            },
                                          );
                                          return Promise.reject(
                                            new Error(
                                              t('Please choose a valid value'),
                                            ),
                                          );
                                        },
                                      },
                                    ]}
                                  >
                                    {error || showDefaultValue ? (
                                      <DefaultValueContainer>
                                        {error ? (
                                          <ErrorMessageWithStackTrace
                                            error={error.errors?.[0]}
                                            fallback={
                                              <BasicErrorAlert
                                                title={t('Cannot load filter')}
                                                body={error.error}
                                                level="error"
                                              />
                                            }
                                          />
                                        ) : (
                                          <DefaultValue
                                            setDataMask={dataMask => {
                                              if (
                                                !isEqual(
                                                  initialDefaultValue
                                                    ?.filterState?.value,
                                                  dataMask?.filterState?.value,
                                                )
                                              ) {
                                                formChanged();
                                              }
                                              setNativeFilterFieldValues(
                                                form,
                                                filterId,
                                                {
                                                  defaultDataMask: dataMask,
                                                },
                                              );
                                              form.validateFields([
                                                [
                                                  'filters',
                                                  filterId,
                                                  'defaultDataMask',
                                                ],
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
                                          <Tooltip
                                            title={t(
                                              'Refresh the default values',
                                            )}
                                          >
                                            <Icons.SyncOutlined
                                              iconSize="xl"
                                              iconColor={theme.colorPrimary}
                                              css={css`
                                                margin-left: ${theme.sizeUnit *
                                                2}px;
                                                margin-top: ${theme.sizeUnit *
                                                1.5}px;
                                              `}
                                              onClick={() =>
                                                refreshHandler(true)
                                              }
                                            />
                                          </Tooltip>
                                        )}
                                      </DefaultValueContainer>
                                    ) : (
                                      t(
                                        'Fill all required fields to enable "Default Value"',
                                      )
                                    )}
                                  </StyledRowSubFormItem>
                                )}
                              </CollapsibleControl>
                            </FormItem>
                          )}
                          {Object.keys(controlItems)
                            .sort(
                              (a, b) =>
                                controlsOrder.indexOf(a as ControlKey) -
                                controlsOrder.indexOf(b as ControlKey),
                            )
                            .map(key => controlItems[key].element)}
                        </>
                      ),
                    },
                  ]}
                />
              </StyledSettings>
            </>
          ),
        },
        {
          key: FilterTabs.scoping.key,
          label: FilterTabs.scoping.name,
          forceRender: true,
          children: (
            <>
              {isDynamicTitleCustomization && (
                <StyledRowContainer>
                  <DynamicTitleHint>
                    {t(
                      'Chart title templates can target one chart, or multiple charts when the template includes {{chart_title}}.',
                    )}
                  </DynamicTitleHint>
                </StyledRowContainer>
              )}
              <FilterScope
                updateFormValues={updateFormValues}
                pathToFormValue={['filters', filterId]}
                forceUpdate={forceUpdate}
                filterScope={
                  isChartCustomization
                    ? customizationToEdit?.scope
                    : filterToEdit?.scope
                }
                formFilterScope={formFilter?.scope}
                initiallyExcludedCharts={initiallyExcludedCharts}
              />
            </>
          ),
        },
      ]}
    />
  );
};

export default memo(
  forwardRef<FiltersConfigFormHandle, FiltersConfigFormProps>(
    FiltersConfigForm,
  ),
);
