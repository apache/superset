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
import { t, logging } from '@superset-ui/core';
import { css, styled, Alert, useTheme } from '@apache-superset/core/ui';
import {
  Button,
  Select,
  Checkbox,
  Tooltip,
} from '@superset-ui/core/components';
import Slider from '@superset-ui/core/components/Slider';
import { Icons } from '@superset-ui/core/components/Icons';
import { setWhatIfModifications } from 'src/dashboard/actions/dashboardState';
import {
  triggerQuery,
  saveOriginalChartData,
} from 'src/components/Chart/chartAction';
import { getNumericColumnsForDashboard } from 'src/dashboard/util/whatIf';
import { RootState, Slice, WhatIfColumn } from 'src/dashboard/types';
import WhatIfAIInsights from './WhatIfAIInsights';
import { fetchRelatedColumnSuggestions } from './whatIfApi';
import { ExtendedWhatIfModification } from './types';

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
  min-height: 32px;
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const ModificationsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ModificationsSectionTitle = styled.div`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme }) => theme.colorText};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const ModificationCard = styled.div<{ isAISuggested?: boolean }>`
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  background-color: ${({ theme, isAISuggested }) =>
    isAISuggested ? theme.colorInfoBg : theme.colorBgLayout};
  border: 1px solid
    ${({ theme, isAISuggested }) =>
      isAISuggested ? theme.colorInfoBorder : theme.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;
`;

const ModificationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const ModificationColumn = styled.span`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme }) => theme.colorText};
`;

const ModificationValue = styled.span<{ isPositive: boolean }>`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme, isPositive }) =>
    isPositive ? theme.colorSuccess : theme.colorError};
`;

const AIBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizeXS}px;
  padding: 2px 6px;
  background-color: ${({ theme }) => theme.colorInfo};
  color: ${({ theme }) => theme.colorWhite};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

const ModificationReasoning = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  margin-top: ${({ theme }) => theme.sizeUnit}px;
  font-style: italic;
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
  const [affectedChartIds, setAffectedChartIds] = useState<number[]>([]);
  const [enableCascadingEffects, setEnableCascadingEffects] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [appliedModifications, setAppliedModifications] = useState<
    ExtendedWhatIfModification[]
  >([]);

  const slices = useSelector(
    (state: RootState) => state.sliceEntities.slices as { [id: number]: Slice },
  );
  const datasources = useSelector((state: RootState) => state.datasources);

  const numericColumns = useMemo(
    () => getNumericColumnsForDashboard(slices, datasources),
    [slices, datasources],
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

  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);

  const handleApply = useCallback(async () => {
    if (!selectedColumn) return;

    const multiplier = 1 + sliderValue / 100;

    // Base user modification
    const userModification: ExtendedWhatIfModification = {
      column: selectedColumn,
      multiplier,
      isAISuggested: false,
    };

    let allModifications: ExtendedWhatIfModification[] = [userModification];

    // If cascading effects enabled, fetch AI suggestions
    if (enableCascadingEffects) {
      setIsLoadingSuggestions(true);
      try {
        const suggestions = await fetchRelatedColumnSuggestions({
          selectedColumn,
          userMultiplier: multiplier,
          availableColumns: numericColumns.map(col => ({
            columnName: col.columnName,
            description: col.description,
            verboseName: col.verboseName,
            datasourceId: col.datasourceId,
          })),
          dashboardName: dashboardInfo?.dash_edit_perm
            ? dashboardInfo?.dashboard_title
            : undefined,
        });

        // Add AI suggestions to modifications
        const aiModifications: ExtendedWhatIfModification[] =
          suggestions.suggestedModifications.map(mod => ({
            column: mod.column,
            multiplier: mod.multiplier,
            isAISuggested: true,
            reasoning: mod.reasoning,
            confidence: mod.confidence,
          }));

        allModifications = [...allModifications, ...aiModifications];
      } catch (error) {
        logging.error('Failed to get AI suggestions:', error);
        // Continue with just user modification
      }
      setIsLoadingSuggestions(false);
    }

    setAppliedModifications(allModifications);

    // Collect all affected chart IDs from all modifications
    const allAffectedChartIds = new Set<number>();
    allModifications.forEach(mod => {
      const chartIds = columnToChartIds.get(mod.column) || [];
      chartIds.forEach(id => allAffectedChartIds.add(id));
    });
    const chartIdsArray = Array.from(allAffectedChartIds);

    // Save affected chart IDs for AI insights
    setAffectedChartIds(chartIdsArray);

    // Save original chart data before applying what-if modifications
    chartIdsArray.forEach(chartId => {
      dispatch(saveOriginalChartData(chartId));
    });

    // Set the what-if modifications in Redux state (all modifications)
    dispatch(
      setWhatIfModifications(
        allModifications.map(mod => ({
          column: mod.column,
          multiplier: mod.multiplier,
          filters: mod.filters,
        })),
      ),
    );

    // Trigger queries for all affected charts
    chartIdsArray.forEach(chartId => {
      dispatch(triggerQuery(true, chartId));
    });
  }, [
    dispatch,
    selectedColumn,
    sliderValue,
    columnToChartIds,
    enableCascadingEffects,
    numericColumns,
    dashboardInfo,
  ]);

  const isApplyDisabled =
    !selectedColumn || sliderValue === SLIDER_DEFAULT || isLoadingSuggestions;
  const isSliderDisabled = !selectedColumn;

  // Helper to format percentage change
  const formatPercentage = (multiplier: number): string => {
    const pct = (multiplier - 1) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

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

        <CheckboxContainer>
          <Checkbox
            checked={enableCascadingEffects}
            onChange={e => setEnableCascadingEffects(e.target.checked)}
          >
            {t('AI-powered cascading effects')}
          </Checkbox>
          <Tooltip
            title={t(
              'When enabled, AI will analyze column relationships and automatically suggest related columns that should also be modified.',
            )}
          >
            <Icons.InfoCircleOutlined
              iconSize="s"
              css={css`
                color: ${theme.colorTextSecondary};
                cursor: help;
              `}
            />
          </Tooltip>
        </CheckboxContainer>

        <ApplyButton
          buttonStyle="primary"
          onClick={handleApply}
          disabled={isApplyDisabled}
          loading={isLoadingSuggestions}
        >
          <Icons.StarFilled iconSize="s" />
          {isLoadingSuggestions
            ? t('Analyzing relationships...')
            : t('See what if')}
        </ApplyButton>

        {appliedModifications.length === 0 && (
          <Alert
            type="info"
            message={t(
              'Select a column above to simulate changes and preview how it would impact your dashboard in real-time.',
            )}
            showIcon
          />
        )}

        {appliedModifications.length > 0 && (
          <ModificationsSection>
            <ModificationsSectionTitle>
              {t('Applied Modifications')}
            </ModificationsSectionTitle>
            {appliedModifications.map((mod, idx) => (
              <ModificationCard key={idx} isAISuggested={mod.isAISuggested}>
                <ModificationHeader>
                  <ModificationColumn>{mod.column}</ModificationColumn>
                  <div
                    css={css`
                      display: flex;
                      align-items: center;
                      gap: ${theme.sizeUnit}px;
                    `}
                  >
                    <ModificationValue isPositive={mod.multiplier >= 1}>
                      {formatPercentage(mod.multiplier)}
                    </ModificationValue>
                    {mod.isAISuggested && <AIBadge>{t('AI')}</AIBadge>}
                  </div>
                </ModificationHeader>
                {mod.reasoning && (
                  <ModificationReasoning>{mod.reasoning}</ModificationReasoning>
                )}
              </ModificationCard>
            ))}
          </ModificationsSection>
        )}

        {affectedChartIds.length > 0 && (
          <WhatIfAIInsights affectedChartIds={affectedChartIds} />
        )}
      </PanelContent>
    </PanelContainer>
  );
};

export default WhatIfPanel;
