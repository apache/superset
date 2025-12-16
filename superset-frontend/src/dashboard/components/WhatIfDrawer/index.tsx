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
import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { css, styled, Alert, useTheme } from '@apache-superset/core/ui';
import { Button, Select } from '@superset-ui/core/components';
import Slider from '@superset-ui/core/components/Slider';
import { Icons } from '@superset-ui/core/components/Icons';
import { setWhatIfModifications } from 'src/dashboard/actions/dashboardState';
import {
  triggerQuery,
  saveOriginalChartData,
} from 'src/components/Chart/chartAction';
import { getNumericColumnsForDashboard } from 'src/dashboard/util/whatIf';
import { RootState, WhatIfColumn } from 'src/dashboard/types';

export const WHAT_IF_PANEL_WIDTH = 300;

const SLIDER_MIN = -50;
const SLIDER_MAX = 50;
const SLIDER_DEFAULT = 0;

const PanelContainer = styled.div<{ topOffset: number }>`
  grid-column: 2;
  grid-row: 1 / -1; /* Span all rows */
  width: ${WHAT_IF_PANEL_WIDTH}px;
  min-width: ${WHAT_IF_PANEL_WIDTH}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  border-left: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: sticky;
  top: ${({ topOffset }) => topOffset}px;
  height: calc(100vh - ${({ topOffset }) => topOffset}px);
  align-self: start;
  z-index: 10;
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.sizeUnit * 3}px
    ${({ theme }) => theme.sizeUnit * 4}px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
`;

const PanelTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSizeLG}px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${({ theme }) => theme.sizeUnit}px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colorTextSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;

  &:hover {
    background-color: ${({ theme }) => theme.colorBgTextHover};
    color: ${({ theme }) => theme.colorText};
  }
`;

const PanelContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const Label = styled.label`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme }) => theme.colorText};
`;

const SliderContainer = styled.div`
  padding: 0 ${({ theme }) => theme.sizeUnit}px;
`;

const ApplyButton = styled(Button)`
  width: 100%;
`;

interface WhatIfPanelProps {
  onClose: () => void;
  topOffset: number;
}

const WhatIfPanel = ({ onClose, topOffset }: WhatIfPanelProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [sliderValue, setSliderValue] = useState<number>(SLIDER_DEFAULT);

  const charts = useSelector((state: RootState) => state.charts);
  const datasources = useSelector((state: RootState) => state.datasources);

  const numericColumns = useMemo(
    () => getNumericColumnsForDashboard(charts, datasources),
    [charts, datasources],
  );

  const columnOptions = useMemo(
    () =>
      numericColumns.map(col => ({
        value: col.columnName,
        label: col.columnName,
      })),
    [numericColumns],
  );

  // Create a map from column name to affected chart IDs
  const columnToChartIds = useMemo(() => {
    const map = new Map<string, number[]>();
    numericColumns.forEach((col: WhatIfColumn) => {
      map.set(col.columnName, col.usedByChartIds);
    });
    return map;
  }, [numericColumns]);

  const handleColumnChange = useCallback((value: string | null) => {
    setSelectedColumn(value);
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
  }, []);

  const handleApply = useCallback(() => {
    if (!selectedColumn) return;

    const multiplier = 1 + sliderValue / 100;

    // Get affected chart IDs
    const affectedChartIds = columnToChartIds.get(selectedColumn) || [];

    // Save original chart data before applying what-if modifications
    affectedChartIds.forEach(chartId => {
      dispatch(saveOriginalChartData(chartId));
    });

    // Set the what-if modifications in Redux state
    dispatch(
      setWhatIfModifications([
        {
          column: selectedColumn,
          multiplier,
        },
      ]),
    );

    // Trigger queries for all charts that use the selected column
    affectedChartIds.forEach(chartId => {
      dispatch(triggerQuery(true, chartId));
    });
  }, [dispatch, selectedColumn, sliderValue, columnToChartIds]);

  const isApplyDisabled = !selectedColumn || sliderValue === SLIDER_DEFAULT;
  const isSliderDisabled = !selectedColumn;

  const sliderMarks = {
    [SLIDER_MIN]: `${SLIDER_MIN}%`,
    0: '0%',
    [SLIDER_MAX]: `+${SLIDER_MAX}%`,
  };

  return (
    <PanelContainer data-test="what-if-panel" topOffset={topOffset}>
      <PanelHeader>
        <PanelTitle>
          <Icons.StarFilled
            iconSize="m"
            css={css`
              color: ${theme.colorWarning};
            `}
          />
          {t('What-if playground')}
        </PanelTitle>
        <CloseButton onClick={onClose} aria-label={t('Close')}>
          <Icons.CloseOutlined iconSize="m" />
        </CloseButton>
      </PanelHeader>
      <PanelContent>
        <FormSection>
          <Label>{t('Select column to adjust')}</Label>
          <Select
            value={selectedColumn}
            onChange={handleColumnChange}
            options={columnOptions}
            placeholder={t('Choose a column...')}
            allowClear
            showSearch
            ariaLabel={t('Select column to adjust')}
          />
        </FormSection>

        <FormSection>
          <Label>{t('Adjust value')}</Label>
          <SliderContainer>
            <Slider
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              value={sliderValue}
              onChange={handleSliderChange}
              disabled={isSliderDisabled}
              marks={sliderMarks}
              tooltip={{
                formatter: (value?: number) =>
                  value !== undefined ? `${value > 0 ? '+' : ''}${value}%` : '',
              }}
            />
          </SliderContainer>
        </FormSection>

        <ApplyButton
          buttonStyle="primary"
          onClick={handleApply}
          disabled={isApplyDisabled}
        >
          <Icons.StarFilled iconSize="s" />
          {t('See what if')}
        </ApplyButton>

        <Alert
          type="info"
          message={t(
            'Select a column above to simulate changes and preview how it would impact your dashboard in real-time.',
          )}
          showIcon
        />
      </PanelContent>
    </PanelContainer>
  );
};

export default WhatIfPanel;
