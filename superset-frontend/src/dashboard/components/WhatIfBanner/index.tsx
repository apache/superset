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
import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { clearWhatIfModifications } from 'src/dashboard/actions/dashboardState';
import { restoreOriginalChartData } from 'src/components/Chart/chartAction';
import { getNumericColumnsForDashboard } from 'src/dashboard/util/whatIf';
import { RootState, WhatIfModification } from 'src/dashboard/types';

/**
 * Banner container positioned at top of dashboard content, next to the What-If panel.
 *
 * Layout strategy:
 * - Grid positioning: column 1, row 1 (above dashboard content, next to panel)
 * - position: sticky with top: topOffset to stick below the dashboard header
 * - z-index: 10 to stay above chart content while scrolling
 * - align-self: start prevents the banner from stretching vertically
 */
const BannerContainer = styled.div<{ topOffset: number }>`
  grid-column: 1;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  margin-bottom: 0;
  background-color: ${({ theme }) => theme.colorSuccessBg};
  border-bottom: 1px solid ${({ theme }) => theme.colorSuccessBorder};
  position: sticky;
  top: ${({ topOffset }) => topOffset}px;
  z-index: 10;
  align-self: start;
`;

const BannerContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorSuccess};
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

const Separator = styled.span`
  color: ${({ theme }) => theme.colorSuccess};
  opacity: 0.5;
`;

const ExitButton = styled(Button)`
  && {
    color: ${({ theme }) => theme.colorSuccess};
    border-color: ${({ theme }) => theme.colorSuccess};
    background-color: ${({ theme }) => theme.colorSuccessBg};

    &:hover {
      color: ${({ theme }) => theme.colorSuccessHover};
      border-color: ${({ theme }) => theme.colorSuccessHover};
      background-color: ${({ theme }) => theme.colorSuccessBgHover};
    }
  }
`;

const formatPercentageChange = (multiplier: number): string => {
  const percentChange = (multiplier - 1) * 100;
  const sign = percentChange >= 0 ? '+' : '';
  return `${sign}${Math.round(percentChange)}%`;
};

interface WhatIfBannerProps {
  topOffset: number;
}

const WhatIfBanner = ({ topOffset }: WhatIfBannerProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const whatIfModifications = useSelector<RootState, WhatIfModification[]>(
    state => state.dashboardState.whatIfModifications || [],
  );

  const charts = useSelector((state: RootState) => state.charts);
  const datasources = useSelector((state: RootState) => state.datasources);

  const numericColumns = useMemo(
    () => getNumericColumnsForDashboard(charts, datasources),
    [charts, datasources],
  );

  const columnToChartIds = useMemo(() => {
    const map = new Map<string, number[]>();
    numericColumns.forEach(col => {
      map.set(col.columnName, col.usedByChartIds);
    });
    return map;
  }, [numericColumns]);

  const handleExitWhatIf = useCallback(() => {
    const affectedChartIds = new Set<number>();
    whatIfModifications.forEach(mod => {
      const chartIds = columnToChartIds.get(mod.column) || [];
      chartIds.forEach(id => affectedChartIds.add(id));
    });

    // Clear what-if modifications
    dispatch(clearWhatIfModifications());

    // Restore original chart data from cache (instant, no re-query needed)
    affectedChartIds.forEach(chartId => {
      dispatch(restoreOriginalChartData(chartId));
    });
  }, [dispatch, whatIfModifications, columnToChartIds]);

  if (whatIfModifications.length === 0) {
    return null;
  }

  const modification = whatIfModifications[0];
  const percentageChange = formatPercentageChange(modification.multiplier);

  return (
    <BannerContainer data-test="what-if-banner" topOffset={topOffset}>
      <BannerContent>
        <Icons.ExperimentOutlined iconSize="m" iconColor={theme.colorSuccess} />
        <span>{t('What-if mode active')}</span>
        <Separator>|</Separator>
        <span>
          {t(
            'Showing simulated data with %s %s',
            modification.column,
            percentageChange,
          )}
        </span>
      </BannerContent>
      <ExitButton
        buttonSize="small"
        onClick={handleExitWhatIf}
        data-test="exit-what-if-button"
      >
        <Icons.CloseOutlined iconSize="s" />
        {t('Exit what-if mode')}
      </ExitButton>
    </BannerContainer>
  );
};

export default WhatIfBanner;
