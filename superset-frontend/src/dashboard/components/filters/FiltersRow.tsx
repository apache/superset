import styled from '@superset-ui/style';
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch, Dispatch } from 'react-redux';
import ChartRenderer from '../../../chart/ChartRenderer';
import * as actions from '../../../chart/chartAction';
import { logEvent } from '../../../logger/actions';
import { FeatureFlag, isFeatureEnabled } from '../../../featureFlags';
import getFilterValuesByFilterId from '../../util/getFilterValuesByFilterId';
import { getActiveFilters } from '../../util/activeDashboardFilters';
import { LOG_ACTIONS_CHANGE_DASHBOARD_FILTER } from '../../../logger/LogUtils';
import { changeFilter } from '../../actions/dashboardFilters';
import Chart from '../../../types/Chart';
import { Button, Space } from 'src/common/components';
import { t } from '@superset-ui/translation/lib';

const EMPTY_FILTERS = {};

type Chart = {
  formData: {
    viz_type: string;
    datasource: string;
  };
  triggerQuery: boolean;
  id: number;
};

// @ts-ignore
const bindBatchOfActions = (funcs: object, dispatch: Dispatch) => {
  // console.log(Object.entries({ ...funcs }).reduce((a, c) => { console.log(a, c); return {} }, {}))
  return Object.entries({ ...funcs }).reduce(
    // @ts-ignore
    (acc, [funcName, func]) => ({
      ...acc,
      [funcName]:
        typeof func === 'function'
          ? (params: any) => {
              debugger;
              dispatch(func(params));
            }
          : func,
    }),
    {},
  );
};

const FiltersRow = () => {
  const charts: {
    [key: number]: Chart;
  } = useSelector(state => state.charts);

  const datasources = useSelector(state => state.datasources);
  const dashboardInfo = useSelector(state => state.dashboardInfo);
  // TODO: Save filters before click apply (may be move to redux)
  const [currentFilters, setCurrentFilters] = useState<{
    [key: number]: object;
  }>({});
  const dispatch = useDispatch();

  const filtersData = Object.values(charts).filter(
    chart => chart.formData.viz_type === 'filter_box',
  );

  useEffect(() => {
    filtersData.forEach(({ triggerQuery, id, formData }) => {
      if (triggerQuery) {
        const params = [
          formData,
          false,
          dashboardInfo.common.conf.SUPERSET_WEBSERVER_TIMEOUT,
          id,
          dashboardInfo.id,
        ];
        if (id > 0 && isFeatureEnabled(FeatureFlag.CLIENT_CACHE)) {
          // Load saved chart with a GET request
          actions.getSavedChart(...params);
          return;
        }
        // Create chart with POST request
        actions.postChartFormData(...params);
      }
    });
  });

  const filters = getActiveFilters() || EMPTY_FILTERS;

  const applyFilters = () => {
    Object.entries(currentFilters).forEach(([id, newSelectedValues]) => {
      dispatch(changeFilter(Number(id), newSelectedValues));
    });
  };

  return (
    <Space>
        {filtersData.map(
          // eslint-disable-next-line @typescript-eslint/camelcase
          ({ id, formData, ...otherProps }) => (
            <div>
              345
              <ChartRenderer
                {...otherProps}
                height={50}
                formData={formData}
                initialValues={getFilterValuesByFilterId({
                  activeFilters: filters,
                  filterId: id,
                })}
                // eslint-disable-next-line @typescript-eslint/camelcase
                vizType={formData.viz_type}
                addFilter={currentFilter =>
                  setCurrentFilters({
                    ...currentFilters,
                    [id]: currentFilter,
                  })
                }
                datasource={datasources[formData.datasource]}
                actions={{
                  ...bindBatchOfActions({ ...actions, logEvent }, dispatch),
                }}
              />
            </div>
          ),
        )}
      <Button onClick={applyFilters} type="primary">
        {t('Apply')}
      </Button>
    </Space>
  );
};

export default FiltersRow;
