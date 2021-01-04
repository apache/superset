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
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import {
  selectIndicatorsForChart,
  IndicatorStatus,
  selectNativeIndicatorsForChart,
} from 'src/dashboard/components/FiltersBadge/selectors';
import FiltersBadge from 'src/dashboard/components/FiltersBadge';

export interface FiltersBadgeProps {
  chartId: number;
}

const mapDispatchToProps = (dispatch: Dispatch) =>
  bindActionCreators(
    {
      onHighlightFilterSource: setDirectPathToChild,
    },
    dispatch,
  );

const mapStateToProps = (
  { datasources, dashboardFilters, nativeFilters, charts }: any,
  { chartId }: FiltersBadgeProps,
) => {
  const dashboardIndicators = selectIndicatorsForChart(
    chartId,
    dashboardFilters,
    datasources,
    charts,
  );

  const nativeIndicators = selectNativeIndicatorsForChart(nativeFilters);

  const indicators = nativeIndicators.reduce((acc, indicator) => {
    const sameColumnIndicator = acc.find(
      ({ column }) => column === indicator.column,
    );
    // deduplicate unapplied filters for the same column
    if (sameColumnIndicator?.status !== IndicatorStatus.Applied) {
      return [...acc.filter(ind => ind !== sameColumnIndicator), indicator];
    }
    return [...acc, indicator];
  }, dashboardIndicators);

  const appliedIndicators = indicators.filter(
    indicator => indicator.status === IndicatorStatus.Applied,
  );
  const unsetIndicators = indicators.filter(
    indicator => indicator.status === IndicatorStatus.Unset,
  );
  const incompatibleIndicators = indicators.filter(
    indicator => indicator.status === IndicatorStatus.Incompatible,
  );

  return {
    chartId,
    appliedIndicators,
    unsetIndicators,
    incompatibleIndicators,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(FiltersBadge);
