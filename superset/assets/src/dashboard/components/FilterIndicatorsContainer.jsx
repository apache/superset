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
import { isEmpty } from 'lodash';

import FilterIndicator from './FilterIndicator';
import FilterIndicatorGroup from './FilterIndicatorGroup';
import { FILTER_INDICATORS_DISPLAY_LENGTH } from '../util/constants';
import {
  getFilterColorKey,
  getFilterColorMap,
} from '../util/dashboardFiltersColorMap';

const propTypes = {
  // from props
  dashboardFilters: PropTypes.object.isRequired,
  chartId: PropTypes.number.isRequired,
  chartStatus: PropTypes.string,

  // from redux
  filterImmuneSlices: PropTypes.arrayOf(PropTypes.number).isRequired,
  filterImmuneSliceFields: PropTypes.object.isRequired,
  setDirectPathToChild: PropTypes.func.isRequired,
  filterFieldOnFocus: PropTypes.object.isRequired,
};

const defaultProps = {
  chartStatus: 'loading',
};

function sortByIndicatorLabel(indicator1, indicator2) {
  const s1 = (indicator1.label || indicator1.name).toLowerCase();
  const s2 = (indicator2.label || indicator2.name).toLowerCase();
  if (s1 < s2) {
    return -1;
  } else if (s1 > s2) {
    return 1;
  }
  return 0;
}

export default class FilterIndicatorsContainer extends React.PureComponent {
  getFilterIndicators() {
    const {
      dashboardFilters,
      chartId: currentChartId,
      filterImmuneSlices,
      filterImmuneSliceFields,
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
          directPathToFilter,
          scope,
          isDateFilter,
          isInstantFilter,
          columns,
          labels,
        } = dashboardFilter;

        // do not apply filter on filter_box itself
        // do not apply filter on filterImmuneSlices list
        if (
          currentChartId !== chartId &&
          !filterImmuneSlices.includes(currentChartId)
        ) {
          Object.keys(columns).forEach(name => {
            const colorMapKey = getFilterColorKey(chartId, name);
            const directPathToLabel = directPathToFilter.slice();
            directPathToLabel.push(`LABEL-${name}`);
            const indicator = {
              chartId,
              colorCode: dashboardFiltersColorMap[colorMapKey],
              componentId,
              directPathToFilter: directPathToLabel,
              scope,
              isDateFilter,
              isInstantFilter,
              name,
              label: labels[name] || name,
              values:
                isEmpty(columns[name]) ||
                (isDateFilter && columns[name] === 'No filter')
                  ? []
                  : [].concat(columns[name]),
              isFilterFieldActive:
                chartId === filterFieldOnFocus.chartId &&
                name === filterFieldOnFocus.column,
            };

            // do not apply filter on fields in the filterImmuneSliceFields map
            if (
              filterImmuneSliceFields[currentChartId] &&
              filterImmuneSliceFields[currentChartId].includes(name)
            ) {
              return;
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
