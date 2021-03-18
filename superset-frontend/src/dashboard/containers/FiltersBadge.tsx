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
import { uniqWith } from 'lodash';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import {
  selectIndicatorsForChart,
  Indicator,
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

const sortByStatus = (indicators: Indicator[]): Indicator[] => {
  const statuses = [
    IndicatorStatus.Applied,
    IndicatorStatus.Unset,
    IndicatorStatus.Incompatible,
  ];
  return indicators.sort(
    (a, b) =>
      statuses.indexOf(a.status as IndicatorStatus) -
      statuses.indexOf(b.status as IndicatorStatus),
  );
};

const mapStateToProps = (
  {
    datasources,
    dashboardFilters,
    nativeFilters,
    dashboardInfo,
    charts,
    dataMask,
    dashboardLayout: { present },
  }: any,
  { chartId }: FiltersBadgeProps,
) => {
  const dashboardIndicators = selectIndicatorsForChart(
    chartId,
    dashboardFilters,
    datasources,
    charts,
  );

  const nativeIndicators = selectNativeIndicatorsForChart(
    nativeFilters,
    dataMask,
    chartId,
    charts,
    present,
    dashboardInfo.metadata?.chart_configuration,
  );

  const indicators = uniqWith(
    sortByStatus([...dashboardIndicators, ...nativeIndicators]),
    (ind1, ind2) =>
      ind1.column === ind2.column &&
      ind1.name === ind2.name &&
      (ind1.status !== IndicatorStatus.Applied ||
        ind2.status !== IndicatorStatus.Applied),
  );

  const appliedCrossFilterIndicators = indicators.filter(
    indicator => indicator.status === IndicatorStatus.CrossFilterApplied,
  );
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
    appliedCrossFilterIndicators,
    unsetIndicators,
    incompatibleIndicators,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(FiltersBadge);
