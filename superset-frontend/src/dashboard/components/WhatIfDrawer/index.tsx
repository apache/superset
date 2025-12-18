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
  Tag,
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

export const WHAT_IF_PANEL_WIDTH = 340;

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
  gap: ${({ theme }) => theme.sizeUnit * 5}px;
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const Label = styled.label`
  color: ${({ theme }) => theme.colorText};
`;

const SliderContainer = styled.div`
  padding: 0 ${({ theme }) => theme.sizeUnit}px;
  & .ant-slider-mark {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }
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
  gap: ${({ theme }) => theme.sizeUnit * 5}px;
`;

const ModificationTagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const AIBadge = styled.span`
  font-size: 10px;
  padding: 0 4px;
  background-color: ${({ theme }) => theme.colorInfo};
  color: ${({ theme }) => theme.colorWhite};
  border-radius: 16px;
  line-height: 1.2;
`;

const AIReasoningSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const AIReasoningToggle = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${({ theme }) => theme.colorTextTertiary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;

  &:hover {
    color: ${({ theme }) => theme.colorText};
  }
`;

const AIReasoningContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit}px;
  padding-left: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const AIReasoningItem = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
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
  // Counter that increments each time Apply is clicked, used as key to reset AI insights
  const [applyCounter, setApplyCounter] = useState(0);
  const [showAIReasoning, setShowAIReasoning] = useState(false);

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

    // Immediately clear previous results and increment counter to reset AI insights component
    setAppliedModifications([]);
    setAffectedChartIds([]);
    setApplyCounter(c => c + 1);

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
    // This sets chart status to 'loading', which is important for AI insights timing
    chartIdsArray.forEach(chartId => {
      dispatch(triggerQuery(true, chartId));
    });

    // Set affected chart IDs AFTER Redux updates and query triggers
    // This ensures WhatIfAIInsights mounts when charts are already loading,
    // preventing it from immediately fetching with stale data
    setAffectedChartIds(chartIdsArray);
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
            <ModificationTagsContainer>
              {appliedModifications.map((mod, idx) => (
                <Tag
                  key={idx}
                  css={css`
                    display: inline-flex;
                    align-items: center;
                    gap: ${theme.sizeUnit}px;
                    margin: 0;
                  `}
                >
                  <span>{mod.column}</span>
                  {mod.isAISuggested && <AIBadge>{t('AI')}</AIBadge>}
                  <span
                    css={css`
                      font-weight: ${theme.fontWeightStrong};
                      color: ${mod.multiplier >= 1
                        ? theme.colorSuccess
                        : theme.colorError};
                    `}
                  >
                    {formatPercentage(mod.multiplier)}
                  </span>
                </Tag>
              ))}
            </ModificationTagsContainer>
            {appliedModifications.some(mod => mod.reasoning) && (
              <AIReasoningSection>
                <AIReasoningToggle
                  onClick={() => setShowAIReasoning(!showAIReasoning)}
                >
                  {showAIReasoning ? (
                    <Icons.DownOutlined iconSize="xs" />
                  ) : (
                    <Icons.RightOutlined iconSize="xs" />
                  )}
                  {t('How AI chose these')}
                </AIReasoningToggle>
                {showAIReasoning && (
                  <AIReasoningContent>
                    {appliedModifications
                      .filter(mod => mod.reasoning)
                      .map((mod, idx) => (
                        <AIReasoningItem key={idx}>
                          <strong>{mod.column}:</strong> {mod.reasoning}
                        </AIReasoningItem>
                      ))}
                  </AIReasoningContent>
                )}
              </AIReasoningSection>
            )}
          </ModificationsSection>
        )}

        {affectedChartIds.length > 0 && (
          <WhatIfAIInsights
            key={applyCounter}
            affectedChartIds={affectedChartIds}
            modifications={appliedModifications.map(mod => ({
              column: mod.column,
              multiplier: mod.multiplier,
              filters: mod.filters,
            }))}
          />
        )}
      </PanelContent>
    </PanelContainer>
  );
};

export default WhatIfPanel;
