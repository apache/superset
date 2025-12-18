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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t, logging, formatTimeRangeLabel } from '@superset-ui/core';
import { css, styled, Alert, useTheme } from '@apache-superset/core/ui';
import {
  Button,
  Select,
  Checkbox,
  Tooltip,
  Tag,
  Popover,
} from '@superset-ui/core/components';
import Slider from '@superset-ui/core/components/Slider';
import { Icons } from '@superset-ui/core/components/Icons';
import { setWhatIfModifications } from 'src/dashboard/actions/dashboardState';
import {
  triggerQuery,
  saveOriginalChartData,
} from 'src/components/Chart/chartAction';
import { getNumericColumnsForDashboard } from 'src/dashboard/util/whatIf';
import {
  RootState,
  Slice,
  WhatIfColumn,
  WhatIfFilter,
  Datasource,
} from 'src/dashboard/types';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopover from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopover';
import { Clauses } from 'src/explore/components/controls/FilterControl/types';
import { OPERATOR_ENUM_TO_OPERATOR_TYPE } from 'src/explore/constants';
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
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
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

const ColumnSelectRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  align-items: flex-start;
`;

const ColumnSelectWrapper = styled.div`
  flex: 1;
  min-width: 0;
`;

const FilterButton = styled(Button)`
  flex-shrink: 0;
  padding: 0 ${({ theme }) => theme.sizeUnit * 2}px;
`;

const FilterPopoverContent = styled.div`
  .edit-popover-resize {
    transform: scaleX(-1);
    float: right;
    margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
    margin-right: ${({ theme }) => theme.sizeUnit * -1}px;
    color: ${({ theme }) => theme.colorIcon};
    cursor: nwse-resize;
  }
  .filter-sql-editor {
    border: ${({ theme }) => theme.colorBorder} solid thin;
  }
`;

const FiltersSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const FilterTagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.sizeUnit}px;
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

  // Filter state
  const [filters, setFilters] = useState<WhatIfFilter[]>([]);
  const [filterPopoverVisible, setFilterPopoverVisible] = useState(false);
  const [editingFilterIndex, setEditingFilterIndex] = useState<number | null>(
    null,
  );
  const [currentAdhocFilter, setCurrentAdhocFilter] =
    useState<AdhocFilter | null>(null);

  // AbortController for cancelling in-flight /suggest_related requests
  const suggestionsAbortControllerRef = useRef<AbortController | null>(null);

  // Cleanup: cancel any pending requests on unmount
  useEffect(
    () => () => {
      suggestionsAbortControllerRef.current?.abort();
    },
    [],
  );

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

  // Find the datasource for the selected column
  const selectedColumnInfo = useMemo(
    () => numericColumns.find(col => col.columnName === selectedColumn),
    [numericColumns, selectedColumn],
  );

  const selectedDatasource = useMemo((): Datasource | null => {
    if (!selectedColumnInfo) return null;
    // Find datasource by ID - keys are in format "id__type"
    const datasourceEntry = Object.entries(datasources).find(([key]) => {
      const [idStr] = key.split('__');
      return parseInt(idStr, 10) === selectedColumnInfo.datasourceId;
    });
    return datasourceEntry ? datasourceEntry[1] : null;
  }, [datasources, selectedColumnInfo]);

  // Get all columns from the selected datasource for filter options
  const filterColumnOptions = useMemo(() => {
    if (!selectedDatasource?.columns) return [];
    return selectedDatasource.columns;
  }, [selectedDatasource]);

  // Convert AdhocFilter to WhatIfFilter
  const adhocFilterToWhatIfFilter = useCallback(
    (adhocFilter: AdhocFilter): WhatIfFilter | null => {
      if (!adhocFilter.isValid()) return null;

      const { subject, operator, comparator } = adhocFilter;
      if (!subject || !operator) return null;

      // Map operator to WhatIfFilterOperator
      let op = operator as WhatIfFilter['op'];

      // Handle operator mapping
      if (operator === 'TEMPORAL_RANGE') {
        op = 'TEMPORAL_RANGE';
      } else if (operator === 'IN' || operator === 'in') {
        op = 'IN';
      } else if (operator === 'NOT IN' || operator === 'not in') {
        op = 'NOT IN';
      }

      return {
        col: subject,
        op,
        val: comparator,
      };
    },
    [],
  );

  // Convert WhatIfFilter to AdhocFilter for editing
  const whatIfFilterToAdhocFilter = useCallback(
    (filter: WhatIfFilter): AdhocFilter => {
      // Find the operatorId from the operator
      let operatorId: string | undefined;
      for (const [key, value] of Object.entries(
        OPERATOR_ENUM_TO_OPERATOR_TYPE,
      )) {
        if (value.operation === filter.op) {
          operatorId = key;
          break;
        }
      }

      return new AdhocFilter({
        expressionType: 'SIMPLE',
        subject: filter.col,
        operator: filter.op,
        operatorId,
        comparator: filter.val,
        clause: Clauses.Where,
      });
    },
    [],
  );

  const handleColumnChange = useCallback((value: string | null) => {
    setSelectedColumn(value);
    // Clear filters when column changes since they're tied to the datasource
    setFilters([]);
  }, []);

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
  }, []);

  // Filter handlers
  const handleOpenFilterPopover = useCallback(() => {
    // Create a new empty AdhocFilter
    const newFilter = new AdhocFilter({
      expressionType: 'SIMPLE',
      clause: Clauses.Where,
      subject: null,
      operator: null,
      comparator: null,
      isNew: true,
    });
    setCurrentAdhocFilter(newFilter);
    setEditingFilterIndex(null);
    setFilterPopoverVisible(true);
  }, []);

  const handleEditFilter = useCallback(
    (index: number) => {
      const filter = filters[index];
      const adhocFilter = whatIfFilterToAdhocFilter(filter);
      setCurrentAdhocFilter(adhocFilter);
      setEditingFilterIndex(index);
      setFilterPopoverVisible(true);
    },
    [filters, whatIfFilterToAdhocFilter],
  );

  const handleFilterChange = useCallback(
    (adhocFilter: AdhocFilter) => {
      const whatIfFilter = adhocFilterToWhatIfFilter(adhocFilter);
      if (!whatIfFilter) return;

      setFilters(prevFilters => {
        if (editingFilterIndex !== null) {
          // Update existing filter
          const newFilters = [...prevFilters];
          newFilters[editingFilterIndex] = whatIfFilter;
          return newFilters;
        }
        // Add new filter
        return [...prevFilters, whatIfFilter];
      });
      setFilterPopoverVisible(false);
      setCurrentAdhocFilter(null);
      setEditingFilterIndex(null);
    },
    [adhocFilterToWhatIfFilter, editingFilterIndex],
  );

  const handleRemoveFilter = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setFilters(prevFilters => prevFilters.filter((_, i) => i !== index));
    },
    [],
  );

  const handleFilterPopoverClose = useCallback(() => {
    setFilterPopoverVisible(false);
    setCurrentAdhocFilter(null);
    setEditingFilterIndex(null);
  }, []);

  // No-op handler for popover resize
  const handleFilterPopoverResize = useCallback(() => {}, []);

  const dashboardInfo = useSelector((state: RootState) => state.dashboardInfo);

  const handleApply = useCallback(async () => {
    if (!selectedColumn) return;

    // Cancel any in-flight suggestions request
    suggestionsAbortControllerRef.current?.abort();

    // Immediately clear previous results and increment counter to reset AI insights component
    setAppliedModifications([]);
    setAffectedChartIds([]);
    setApplyCounter(c => c + 1);

    const multiplier = 1 + sliderValue / 100;

    // Base user modification with filters
    const userModification: ExtendedWhatIfModification = {
      column: selectedColumn,
      multiplier,
      isAISuggested: false,
      filters: filters.length > 0 ? filters : undefined,
    };

    let allModifications: ExtendedWhatIfModification[] = [userModification];

    // If cascading effects enabled, fetch AI suggestions
    if (enableCascadingEffects) {
      // Create a new AbortController for this request
      const abortController = new AbortController();
      suggestionsAbortControllerRef.current = abortController;

      setIsLoadingSuggestions(true);
      try {
        const suggestions = await fetchRelatedColumnSuggestions(
          {
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
          },
          abortController.signal,
        );

        // Add AI suggestions to modifications (with same filters as user modification)
        const aiModifications: ExtendedWhatIfModification[] =
          suggestions.suggestedModifications.map(mod => ({
            column: mod.column,
            multiplier: mod.multiplier,
            isAISuggested: true,
            reasoning: mod.reasoning,
            confidence: mod.confidence,
            filters: filters.length > 0 ? filters : undefined,
          }));

        allModifications = [...allModifications, ...aiModifications];
      } catch (error) {
        // Don't log or update state if the request was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
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
    filters,
  ]);

  const isApplyDisabled =
    !selectedColumn || sliderValue === SLIDER_DEFAULT || isLoadingSuggestions;

  // Helper to format percentage change
  const formatPercentage = (multiplier: number): string => {
    const pct = (multiplier - 1) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  // Helper to format filter for display (matching Explore filter label format)
  const formatFilterLabel = (filter: WhatIfFilter): string => {
    const { col, op, val } = filter;

    // Special handling for TEMPORAL_RANGE to match Explore format
    if (op === 'TEMPORAL_RANGE' && typeof val === 'string') {
      return formatTimeRangeLabel(val, col);
    }

    let valStr: string;
    if (Array.isArray(val)) {
      valStr = val.join(', ');
    } else if (typeof val === 'boolean') {
      valStr = val ? 'true' : 'false';
    } else {
      valStr = String(val);
    }
    // Truncate long values
    if (valStr.length > 20) {
      valStr = `${valStr.substring(0, 17)}...`;
    }
    return `${col} ${op} ${valStr}`;
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
          <ColumnSelectRow>
            <ColumnSelectWrapper>
              <Select
                value={selectedColumn}
                onChange={handleColumnChange}
                options={columnOptions}
                placeholder={t('Choose a column...')}
                allowClear
                showSearch
                ariaLabel={t('Select column to adjust')}
              />
            </ColumnSelectWrapper>
            <Popover
              open={filterPopoverVisible}
              onOpenChange={setFilterPopoverVisible}
              trigger="click"
              placement="left"
              destroyOnHidden
              content={
                currentAdhocFilter && selectedDatasource ? (
                  <FilterPopoverContent>
                    <AdhocFilterEditPopover
                      adhocFilter={currentAdhocFilter}
                      options={filterColumnOptions}
                      datasource={selectedDatasource}
                      onChange={handleFilterChange}
                      onClose={handleFilterPopoverClose}
                      onResize={handleFilterPopoverResize}
                      requireSave
                    />
                  </FilterPopoverContent>
                ) : null
              }
            >
              <Tooltip
                title={
                  selectedColumn
                    ? t('Add filter to scope the modification')
                    : t('Select a column first')
                }
              >
                <FilterButton
                  onClick={handleOpenFilterPopover}
                  disabled={!selectedColumn || !selectedDatasource}
                  aria-label={t('Add filter')}
                  buttonStyle="tertiary"
                >
                  <Icons.FilterOutlined iconSize="m" />
                </FilterButton>
              </Tooltip>
            </Popover>
          </ColumnSelectRow>
          {filters.length > 0 && (
            <FiltersSection>
              <Label
                css={css`
                  font-size: ${theme.fontSizeSM}px;
                  color: ${theme.colorTextSecondary};
                `}
              >
                {t('Filters')}
              </Label>
              <FilterTagsContainer>
                {filters.map((filter, index) => (
                  <Tag
                    key={`${filter.col}-${filter.op}-${index}`}
                    closable
                    onClose={e => handleRemoveFilter(e, index)}
                    onClick={() => handleEditFilter(index)}
                    css={css`
                      cursor: pointer;
                      margin: 0;
                      &:hover {
                        opacity: 0.8;
                      }
                    `}
                  >
                    {formatFilterLabel(filter)}
                  </Tag>
                ))}
              </FilterTagsContainer>
            </FiltersSection>
          )}
        </FormSection>

        <FormSection>
          <Label>{t('Adjust value')}</Label>
          <SliderContainer>
            <Slider
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              value={sliderValue}
              onChange={handleSliderChange}
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
