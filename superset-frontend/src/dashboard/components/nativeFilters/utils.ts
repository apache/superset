// DODO was here
import {
  AdhocFilter,
  Behavior,
  DataMaskStateWithId,
  EXTRA_FORM_DATA_APPEND_KEYS,
  EXTRA_FORM_DATA_OVERRIDE_KEYS,
  ExtraFormData,
  isFeatureEnabled,
  FeatureFlag,
  Filter,
  getChartMetadataRegistry,
  QueryFormData,
  t,
  PlainObject, // DODO added 44211759
} from '@superset-ui/core';
import { DashboardLayout } from 'src/dashboard/types';
import extractUrlParams from 'src/dashboard/util/extractUrlParams';
import { CHART_TYPE, TAB_TYPE } from '../../util/componentTypes';
import { DASHBOARD_GRID_ID, DASHBOARD_ROOT_ID } from '../../util/constants';
import getBootstrapData from '../../../utils/getBootstrapData';

const getDefaultRowLimit = (): number => {
  const bootstrapData = getBootstrapData();
  const nativeFilterDefaultRowLimit =
    bootstrapData?.common?.conf?.NATIVE_FILTER_DEFAULT_ROW_LIMIT;
  return nativeFilterDefaultRowLimit || 1000;
};

export const getFormData = ({
  datasetId,
  dependencies = {},
  groupby,
  groupbyid, // DODO added 44211759
  groupbyRu, // DODO added 44211759
  selectTopValue, // DODO added 44211759
  defaultDataMask,
  controlValues,
  filterType,
  sortMetric,
  adhoc_filters,
  time_range,
  granularity_sqla,
  type,
  dashboardId,
  id,
}: Partial<Filter> & {
  dashboardId: number;
  datasetId?: number;
  dependencies?: object;
  groupby?: string;
  groupbyid?: string; // DODO added 44211759
  groupbyRu?: string; // DODO added 44211759
  adhoc_filters?: AdhocFilter[];
  time_range?: string;
}): Partial<QueryFormData> => {
  const otherProps: {
    datasource?: string;
    groupby?: string[];
    sortMetric?: string;
  } = {};
  if (datasetId) {
    otherProps.datasource = `${datasetId}__table`;
  }
  if (groupby) {
    otherProps.groupby = [groupby];
  }
  // DODO added start 44211759
  if (groupbyRu) {
    otherProps.groupby?.push(groupbyRu);
  }
  if (groupbyid) {
    otherProps.groupby?.push(groupbyid);
  }
  // DODO added stop 44211759
  if (sortMetric) {
    otherProps.sortMetric = sortMetric;
  }
  return {
    ...controlValues,
    ...otherProps,
    adhoc_filters: adhoc_filters ?? [],
    extra_filters: [],
    extra_form_data: dependencies,
    granularity_sqla,
    metrics: ['count'],
    // row_limit: getDefaultRowLimit(),
    row_limit: selectTopValue || getDefaultRowLimit(), // DODO changed 44211759
    showSearch: true,
    defaultValue: defaultDataMask?.filterState?.value,
    time_range,
    url_params: extractUrlParams('regular'),
    inView: true,
    viz_type: filterType,
    type,
    dashboardId,
    native_filter_id: id,
  };
};

export function mergeExtraFormData(
  originalExtra: ExtraFormData = {},
  newExtra: ExtraFormData = {},
  locale?: string, // DODO added 44211759
): ExtraFormData {
  const mergedExtra: ExtraFormData = {};
  EXTRA_FORM_DATA_APPEND_KEYS.forEach((key: string) => {
    const mergedValues = [
      ...(originalExtra[key] || []),
      ...(newExtra[key] || []),
    ];
    if (mergedValues.length) {
      // mergedExtra[key] = mergedValues; // DODO commented out 44211759
      // DODO added start 44211759
      const localisedMergedValues = mergedValues.map(value => {
        // filter select and filter select by id cases
        if (typeof value.val[0] !== 'object' || value.val[0] === null)
          return value;

        const columns = Object.keys(value.val[0] || {}); // [groupBy, groupbyRu, groupbyid] | [groupBy, groupbyRu]
        let columnOrder = 0;

        // filter select by id with translation case
        if (columns.length === 3) columnOrder = 2;
        // filter select with translation case
        else columnOrder = locale === 'en' ? 0 : 1;

        const column = columns[columnOrder];

        return {
          ...value,
          col: column,
          val: value.val.map((val: PlainObject) => val[column]),
        };
      });
      mergedExtra[key] = localisedMergedValues;
      // DODO added stop 44211759
    }
  });
  EXTRA_FORM_DATA_OVERRIDE_KEYS.forEach((key: string) => {
    const originalValue = originalExtra[key];
    if (originalValue !== undefined) {
      mergedExtra[key] = originalValue;
    }
    const newValue = newExtra[key];
    if (newValue !== undefined) {
      mergedExtra[key] = newValue;
    }
  });
  return mergedExtra;
}

export function isCrossFilter(vizType: string) {
  // @ts-ignore need export from superset-ui `ItemWithValue`
  return getChartMetadataRegistry().items[vizType]?.value.behaviors?.includes(
    Behavior.InteractiveChart,
  );
}

export function getExtraFormData(
  dataMask: DataMaskStateWithId,
  filterIdsAppliedOnChart: string[],
  locale: string, // DODO added 44211759
): ExtraFormData {
  let extraFormData: ExtraFormData = {};
  filterIdsAppliedOnChart.forEach(key => {
    extraFormData = mergeExtraFormData(
      extraFormData,
      dataMask[key]?.extraFormData ?? {},
      locale, // DODO added 44211759
    );
  });
  return extraFormData;
}

export function nativeFilterGate(behaviors: Behavior[]): boolean {
  return (
    !behaviors.includes(Behavior.NativeFilter) ||
    (isFeatureEnabled(FeatureFlag.DashboardCrossFilters) &&
      behaviors.includes(Behavior.InteractiveChart))
  );
}

const isComponentATab = (
  dashboardLayout: DashboardLayout,
  componentId: string,
) => dashboardLayout?.[componentId]?.type === TAB_TYPE;

const findTabsWithChartsInScopeHelper = (
  dashboardLayout: DashboardLayout,
  chartsInScope: number[],
  componentId: string,
  tabIds: string[],
  tabsToHighlight: Set<string>,
  visited: Set<string>,
) => {
  if (visited.has(componentId)) {
    return;
  }
  visited.add(componentId);
  if (
    dashboardLayout?.[componentId]?.type === CHART_TYPE &&
    chartsInScope.includes(dashboardLayout[componentId]?.meta?.chartId)
  ) {
    tabIds.forEach(tabsToHighlight.add, tabsToHighlight);
  }
  if (
    dashboardLayout?.[componentId]?.children?.length === 0 ||
    (isComponentATab(dashboardLayout, componentId) &&
      tabsToHighlight.has(componentId))
  ) {
    return;
  }
  dashboardLayout[componentId]?.children.forEach(childId =>
    findTabsWithChartsInScopeHelper(
      dashboardLayout,
      chartsInScope,
      childId,
      isComponentATab(dashboardLayout, childId) ? [...tabIds, childId] : tabIds,
      tabsToHighlight,
      visited,
    ),
  );
};

export const findTabsWithChartsInScope = (
  dashboardLayout: DashboardLayout,
  chartsInScope: number[],
) => {
  const dashboardRoot = dashboardLayout[DASHBOARD_ROOT_ID];
  const rootChildId = dashboardRoot.children[0];
  const hasTopLevelTabs = rootChildId !== DASHBOARD_GRID_ID;
  const tabsInScope = new Set<string>();
  const visited = new Set<string>();
  if (hasTopLevelTabs) {
    dashboardLayout[rootChildId]?.children?.forEach(tabId =>
      findTabsWithChartsInScopeHelper(
        dashboardLayout,
        chartsInScope,
        tabId,
        [tabId],
        tabsInScope,
        visited,
      ),
    );
  } else {
    Object.values(dashboardLayout)
      .filter(element => element?.type === TAB_TYPE)
      .forEach(element =>
        findTabsWithChartsInScopeHelper(
          dashboardLayout,
          chartsInScope,
          element.id,
          [element.id],
          tabsInScope,
          visited,
        ),
      );
  }
  return tabsInScope;
};

export const getFilterValueForDisplay = (
  value?: string[] | null | string | number | object,
): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return `${value}`;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return t('Unknown value');
};
