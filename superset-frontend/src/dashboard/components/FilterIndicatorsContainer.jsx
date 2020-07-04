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
import React from 'react';
import PropTypes from 'prop-types';
import { isEmpty, isNil } from 'lodash';

import FilterIndicator from './FilterIndicator';
import FilterIndicatorGroup from './FilterIndicatorGroup';
import { FILTER_INDICATORS_DISPLAY_LENGTH } from '../util/constants';
import { getChartIdsInFilterScope } from '../util/activeDashboardFilters';
import { getDashboardFilterKey } from '../util/getDashboardFilterKey';
import { getFilterColorMap } from '../util/dashboardFiltersColorMap';
import { TIME_FILTER_MAP } from '../../visualizations/FilterBox/FilterBox';

const propTypes = {
  // from props
  dashboardFilters: PropTypes.object.isRequired,
  chartId: PropTypes.number.isRequired,
  chartStatus: PropTypes.string,

  // from redux
  datasources: PropTypes.object.isRequired,
  setDirectPathToChild: PropTypes.func.isRequired,
  filterFieldOnFocus: PropTypes.object.isRequired,
};

const defaultProps = {
  chartStatus: 'loading',
};

const TIME_GRANULARITY_FIELDS = [
  TIME_FILTER_MAP.granularity,
  TIME_FILTER_MAP.time_grain_sqla,
];

function sortByIndicatorLabel(indicator1, indicator2) {
  const s1 = (indicator1.label || indicator1.name).toLowerCase();
  const s2 = (indicator2.label || indicator2.name).toLowerCase();
  if (s1 < s2) {
    return -1;
  }
  if (s1 > s2) {
    return 1;
  }
  return 0;
}

export default class FilterIndicatorsContainer extends React.PureComponent {
  getFilterIndicators() {
    const {
      datasources = {},
      dashboardFilters,
      chartId: currentChartId,
      filterFieldOnFocus,
    } = this.props;

    if (Object.keys(dashboardFilters).length === 0) {
      return [];
    }

    const dashboardFiltersColorMap = getFilterColorMap();
    const sortIndicatorsByEmptiness = Object.values(dashboardFilters).reduce(
      (indicators, dashboardFilter) => {
        const {
          chartId,
          componentId,
          datasourceId,
          directPathToFilter,
          isDateFilter,
          isInstantFilter,
          columns,
          labels,
          scopes,
        } = dashboardFilter;
        const datasource = datasources[datasourceId] || {};

        if (currentChartId !== chartId) {
          Object.keys(columns)
            .filter(name =>
              getChartIdsInFilterScope({ filterScope: scopes[name] }).includes(
                currentChartId,
              ),
            )
            .forEach(name => {
              const colorMapKey = getDashboardFilterKey({
                chartId,
                column: name,
              });

              // filter values could be single value or array of values
              const values =
                isNil(columns[name]) ||
                (isDateFilter && columns[name] === 'No filter') ||
                (Array.isArray(columns[name]) && columns[name].length === 0)
                  ? []
                  : [].concat(columns[name]);

              const indicator = {
                chartId,
                colorCode: dashboardFiltersColorMap[colorMapKey],
                componentId,
                directPathToFilter: directPathToFilter.concat(`LABEL-${name}`),
                isDateFilter,
                isInstantFilter,
                name,
                label: labels[name] || name,
                values,
                isFilterFieldActive:
                  chartId === filterFieldOnFocus.chartId &&
                  name === filterFieldOnFocus.column,
              };

              // map time granularity value to datasource configure
              if (isDateFilter && TIME_GRANULARITY_FIELDS.includes(name)) {
                const timeGranularityConfig =
                  (name === TIME_FILTER_MAP.time_grain_sqla
                    ? datasource.time_grain_sqla
                    : datasource.granularity) || [];
                const timeGranularityDisplayMapping = timeGranularityConfig.reduce(
                  (map, [key, value]) => ({
                    ...map,
                    [key]: value,
                  }),
                  {},
                );

                indicator.values = indicator.values.map(
                  value => timeGranularityDisplayMapping[value] || value,
                );
              }

              if (isEmpty(indicator.values)) {
                indicators[1].push(indicator);
              } else {
                indicators[0].push(indicator);
              }
            });
        }

        return indicators;
      },
      [[], []],
    );

    // cypress' electron don't support [].flat():
    return [
      ...sortIndicatorsByEmptiness[0].sort(sortByIndicatorLabel),
      ...sortIndicatorsByEmptiness[1].sort(sortByIndicatorLabel),
    ];
  }

  render() {
    const { chartStatus, setDirectPathToChild } = this.props;
    if (chartStatus === 'loading') {
      return null;
    }

    const indicators = this.getFilterIndicators();
    // if total indicators <= FILTER_INDICATORS_DISPLAY_LENGTH,
    // show indicator for each filter field.
    // else: show single group indicator.
    const showIndicatorsInGroup =
      indicators.length > FILTER_INDICATORS_DISPLAY_LENGTH;

    return (
      <div className="dashboard-filter-indicators-container">
        {!showIndicatorsInGroup &&
          indicators.map(indicator => (
            <FilterIndicator
              key={`${indicator.chartId}_${indicator.name}`}
              indicator={indicator}
              setDirectPathToChild={setDirectPathToChild}
            />
          ))}
        {showIndicatorsInGroup && (
          <FilterIndicatorGroup
            indicators={indicators}
            setDirectPathToChild={setDirectPathToChild}
          />
        )}
      </div>
    );
  }
}

FilterIndicatorsContainer.propTypes = propTypes;
FilterIndicatorsContainer.defaultProps = defaultProps;
