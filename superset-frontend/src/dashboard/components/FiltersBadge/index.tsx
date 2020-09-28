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
import { connect, Dispatch } from 'react-redux';
import { bindActionCreators } from 'redux';
import { WarningFilled } from '@ant-design/icons';
import { useTheme } from '@superset-ui/core';
import { ReactComponent as FilterIcon } from 'images/icons/filter.svg';
import { Popover, Icon } from 'src/common/components';
import DetailsPanel, { Indicator } from './DetailsPanel';
import S from './Styles';
import { setDirectPathToChild } from '../../actions/dashboardState';
import { selectIndicatorsForChart, IndicatorStatus } from './selectors';

const mapDispatchToProps = (dispatch: Dispatch<any>) => {
  return bindActionCreators(
    {
      onHighlightFilterSource: setDirectPathToChild,
    },
    dispatch,
  );
};

interface FiltersBadgeProps {
  chartId: number;
}

const mapStateToProps = (
  { datasources, dashboardFilters, charts }: any,
  { chartId }: FiltersBadgeProps,
) => {
  const indicators = selectIndicatorsForChart(
    chartId,
    dashboardFilters,
    datasources,
    charts,
  );

  return {
    chartId,
    indicators,
  };
};

const FiltersBadge = ({
  indicators,
  onHighlightFilterSource,
}: {
  indicators: Indicator[];
  onHighlightFilterSource: (path: string) => void;
}) => {
  const theme = useTheme();
  const appliedIndicators = indicators.filter(
    indicator => indicator.status === IndicatorStatus.Applied,
  );
  const unsetIndicators = indicators.filter(
    indicator => indicator.status === IndicatorStatus.Unset,
  );
  const incompatibleIndicators = indicators.filter(
    indicator => indicator.status === IndicatorStatus.Incompatible,
  );

  if (!appliedIndicators.length && !incompatibleIndicators.length) {
    return null;
  }

  return (
    <Popover
      content={
        <DetailsPanel
          appliedIndicators={appliedIndicators}
          unsetIndicators={unsetIndicators}
          incompatibleIndicators={incompatibleIndicators}
          onHighlightFilterSource={onHighlightFilterSource}
        />
      }
      placement="bottomRight"
      trigger="click"
    >
      <S.Pill>
        <Icon component={FilterIcon} />{' '}
        <span className="indicator-count">
          {appliedIndicators.length + incompatibleIndicators.length}
        </span>
        {incompatibleIndicators.length ? (
          <span className="rejected-indicators">
            {' '}
            <WarningFilled style={{ color: theme.colors.warning.base }} />
          </span>
        ) : null}
      </S.Pill>
    </Popover>
  );
};

export default connect(mapStateToProps, mapDispatchToProps)(FiltersBadge);
