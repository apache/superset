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
import { useSelector } from 'react-redux';
import { t } from '@superset-ui/core';
import { css, Alert, useTheme } from '@apache-superset/core/ui';
import {
  Select,
  Checkbox,
  Tooltip,
  Tag,
  CheckboxChangeEvent,
} from '@superset-ui/core/components';
import Slider from '@superset-ui/core/components/Slider';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useNumericColumns } from 'src/dashboard/util/useNumericColumns';
import { RootState, Datasource } from 'src/dashboard/types';
import WhatIfAIInsights from './WhatIfAIInsights';
import { useAllChartsLoaded } from './useChartComparison';
import HarryPotterWandLoader from './HarryPotterWandLoader';
import FilterButton from './FilterButton';
import ModificationsDisplay from './ModificationsDisplay';
import WhatIfHeaderMenu from './WhatIfHeaderMenu';
import SaveSimulationModal from './SaveSimulationModal';
import { useWhatIfFilters } from './useWhatIfFilters';
import { useWhatIfApply } from './useWhatIfApply';
import { WhatIfSimulation, fetchSimulations } from './whatIfApi';
import {
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_DEFAULT,
  SLIDER_MARKS,
  SLIDER_TOOLTIP_CONFIG,
  WHAT_IF_PANEL_WIDTH,
} from './constants';
import {
  PanelContainer,
  PanelHeader,
  PanelTitle,
  CloseButton,
  PanelContent,
  FormSection,
  Label,
  SliderContainer,
  ApplyButton,
  CheckboxContainer,
  ColumnSelectRow,
  ColumnSelectWrapper,
  FiltersSection,
  FilterTagsContainer,
  HeaderButtonsContainer,
} from './styles';

export { WHAT_IF_PANEL_WIDTH };

interface WhatIfPanelProps {
  visible: boolean;
  onClose: () => void;
  topOffset: number;
  initialSimulationId?: number | null;
}

const WhatIfPanel = ({
  visible,
  onClose,
  topOffset,
  initialSimulationId,
}: WhatIfPanelProps) => {
  const theme = useTheme();
  const { addSuccessToast, addDangerToast } = useToasts();

  // Get dashboard ID from Redux
  const dashboardId = useSelector((state: RootState) => state.dashboardInfo.id);

  // Local state for column selection and slider
  const [selectedColumn, setSelectedColumn] = useState<string | undefined>(
    undefined,
  );
  const [sliderValue, setSliderValue] = useState<number>(SLIDER_DEFAULT);
  const [enableCascadingEffects, setEnableCascadingEffects] = useState(false);

  // Simulation state
  const [selectedSimulation, setSelectedSimulation] =
    useState<WhatIfSimulation | null>(null);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [simulations, setSimulations] = useState<WhatIfSimulation[]>([]);
  const [simulationsLoading, setSimulationsLoading] = useState(false);

  // Track if initial simulation from URL has been loaded
  const initialSimulationLoadedRef = useRef(false);

  // Custom hook for filter management
  const {
    filters,
    filterPopoverVisible,
    currentAdhocFilter,
    setFilterPopoverVisible,
    setFilters,
    handleOpenFilterPopover,
    handleEditFilter,
    handleFilterChange,
    handleRemoveFilter,
    handleFilterPopoverClose,
    handleFilterPopoverResize,
    clearFilters,
    formatFilterLabel,
  } = useWhatIfFilters();

  // Custom hook for apply logic and modifications
  const {
    appliedModifications,
    affectedChartIds,
    isLoadingSuggestions,
    applyCounter,
    handleApply,
    handleDismissLoader,
    aiInsightsModifications,
    loadModificationsDirectly,
    clearModifications,
    interpretAbortRef,
  } = useWhatIfApply({
    selectedColumn,
    sliderValue,
    filters,
    enableCascadingEffects,
  });

  // Get numeric columns and datasources
  const { numericColumns, columnToChartIds } = useNumericColumns();
  const datasources = useSelector((state: RootState) => state.datasources);

  // Get all chart IDs that could be affected by what-if analysis
  const allDashboardChartIds = useMemo(() => {
    const chartIds = new Set<number>();
    columnToChartIds.forEach(ids => ids.forEach(id => chartIds.add(id)));
    return Array.from(chartIds);
  }, [columnToChartIds]);

  // Check if all dashboard charts have completed their initial load
  const initialChartsLoaded = useAllChartsLoaded(allDashboardChartIds);

  // Column options for the select dropdown
  const columnOptions = useMemo(
    () =>
      numericColumns.map(col => ({
        value: col.columnName,
        label: col.columnName,
      })),
    [numericColumns],
  );

  // Find info about the selected column
  const selectedColumnInfo = useMemo(
    () => numericColumns.find(col => col.columnName === selectedColumn),
    [numericColumns, selectedColumn],
  );

  // Find the datasource for the selected column
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

  // Handle column selection change - also clears filters
  const handleColumnChange = useCallback(
    (value: string | undefined) => {
      setSelectedColumn(value);
      // Clear filters when column changes since they're tied to the datasource
      clearFilters();
    },
    [clearFilters],
  );

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value);
  }, []);

  const handleCascadingEffectsChange = useCallback((e: CheckboxChangeEvent) => {
    setEnableCascadingEffects(e.target.checked);
  }, []);

  // Handle loading a saved simulation
  const handleLoadSimulation = useCallback(
    (simulation: WhatIfSimulation | null) => {
      setSelectedSimulation(simulation);
      if (simulation && simulation.modifications.length > 0) {
        const firstMod = simulation.modifications[0];
        setSelectedColumn(firstMod.column);
        setSliderValue((firstMod.multiplier - 1) * 100);
        setEnableCascadingEffects(simulation.cascadingEffectsEnabled);

        // Load filters from the first modification
        if (firstMod.filters && firstMod.filters.length > 0) {
          setFilters(firstMod.filters);
        } else {
          clearFilters();
        }

        // Convert to extended modifications with isAISuggested flag
        // First modification is the user's, rest are AI-suggested
        const extendedModifications = simulation.modifications.map(
          (mod, index) => ({
            column: mod.column,
            multiplier: mod.multiplier,
            filters: mod.filters,
            isAISuggested: index > 0,
          }),
        );

        // Load all modifications directly and trigger chart queries + /interpret
        loadModificationsDirectly(extendedModifications);
      } else if (!simulation) {
        // Clear state when deselecting
        setSelectedColumn(undefined);
        setSliderValue(SLIDER_DEFAULT);
        setEnableCascadingEffects(false);
        clearFilters();
        clearModifications();
      }
    },
    [clearFilters, setFilters, loadModificationsDirectly, clearModifications],
  );

  // Load simulations list from API
  const loadSimulations = useCallback(async () => {
    if (!dashboardId) return;
    setSimulationsLoading(true);
    try {
      const result = await fetchSimulations(dashboardId);
      setSimulations(result);
    } catch (error) {
      addDangerToast(t('Failed to load saved simulations'));
    } finally {
      setSimulationsLoading(false);
    }
  }, [dashboardId, addDangerToast]);

  // Fetch simulations when dashboard is ready
  useEffect(() => {
    if (dashboardId) {
      loadSimulations();
    }
  }, [dashboardId, loadSimulations]);

  // Load initial simulation from URL parameter
  // Wait until:
  // 1. simulations are loaded (from the earlier useEffect)
  // 2. columnToChartIds is populated (chart metadata is available)
  // 3. initialChartsLoaded is true (charts have finished their initial queries)
  // This ensures we can properly save original chart data before applying what-if modifications
  useEffect(() => {
    if (
      initialSimulationId &&
      !initialSimulationLoadedRef.current &&
      simulations.length > 0 &&
      columnToChartIds.size > 0 &&
      initialChartsLoaded
    ) {
      initialSimulationLoadedRef.current = true;
      const simulation = simulations.find(s => s.id === initialSimulationId);
      if (simulation) {
        handleLoadSimulation(simulation);
      } else {
        addDangerToast(t('Simulation not found'));
      }
    }
  }, [
    initialSimulationId,
    simulations,
    addDangerToast,
    columnToChartIds.size,
    initialChartsLoaded,
    handleLoadSimulation,
  ]);

  // Handle saving a simulation
  const handleSaveSimulation = useCallback(
    (simulation: WhatIfSimulation) => {
      setSelectedSimulation(simulation);
      // Refresh the simulations list to include the newly saved simulation
      loadSimulations();
    },
    [loadSimulations],
  );

  // Track if we're saving as new (vs updating existing)
  const [isSavingAsNew, setIsSavingAsNew] = useState(false);

  const handleOpenSaveModal = useCallback(() => {
    setIsSavingAsNew(false);
    setSaveModalVisible(true);
  }, []);

  const handleOpenSaveAsNewModal = useCallback(() => {
    setIsSavingAsNew(true);
    setSaveModalVisible(true);
  }, []);

  const handleCloseSaveModal = useCallback(() => {
    setSaveModalVisible(false);
    setIsSavingAsNew(false);
  }, []);

  const isApplyDisabled =
    !selectedColumn || sliderValue === SLIDER_DEFAULT || isLoadingSuggestions;

  return (
    <PanelContainer
      data-test="what-if-panel"
      topOffset={topOffset}
      visible={visible}
    >
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
        <HeaderButtonsContainer>
          <WhatIfHeaderMenu
            selectedSimulation={selectedSimulation}
            onSelectSimulation={handleLoadSimulation}
            onSaveClick={handleOpenSaveModal}
            onSaveAsNewClick={handleOpenSaveAsNewModal}
            hasModifications={appliedModifications.length > 0}
            simulations={simulations}
            simulationsLoading={simulationsLoading}
          />
          <CloseButton onClick={onClose} aria-label={t('Close')}>
            <Icons.CloseOutlined iconSize="m" />
          </CloseButton>
        </HeaderButtonsContainer>
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
            <FilterButton
              filterPopoverVisible={filterPopoverVisible}
              currentAdhocFilter={currentAdhocFilter}
              selectedColumn={selectedColumn}
              selectedDatasource={selectedDatasource}
              filterColumnOptions={filterColumnOptions}
              onOpenFilterPopover={handleOpenFilterPopover}
              onFilterPopoverVisibleChange={setFilterPopoverVisible}
              onFilterChange={handleFilterChange}
              onFilterPopoverClose={handleFilterPopoverClose}
              onFilterPopoverResize={handleFilterPopoverResize}
            />
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
              marks={SLIDER_MARKS}
              tooltip={SLIDER_TOOLTIP_CONFIG}
            />
          </SliderContainer>
        </FormSection>

        <CheckboxContainer>
          <Checkbox
            checked={enableCascadingEffects}
            onChange={handleCascadingEffectsChange}
          >
            {t('Show the bigger picture with AI')}
          </Checkbox>
          <Tooltip
            title={t(
              'Automatically includes related metrics and columns affected by this change. AI infers relationships based on how metrics and columns are used across the dashboard.',
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

        <ModificationsDisplay modifications={appliedModifications} />

        {affectedChartIds.length > 0 && (
          <WhatIfAIInsights
            key={applyCounter}
            affectedChartIds={affectedChartIds}
            modifications={aiInsightsModifications}
            abortRef={interpretAbortRef}
          />
        )}
      </PanelContent>

      {isLoadingSuggestions && (
        <HarryPotterWandLoader onDismiss={handleDismissLoader} />
      )}

      <SaveSimulationModal
        show={saveModalVisible}
        onHide={handleCloseSaveModal}
        onSaved={handleSaveSimulation}
        dashboardId={dashboardId}
        modifications={appliedModifications}
        cascadingEffectsEnabled={enableCascadingEffects}
        existingSimulation={isSavingAsNew ? null : selectedSimulation}
        addSuccessToast={addSuccessToast}
        addDangerToast={addDangerToast}
      />
    </PanelContainer>
  );
};

export default WhatIfPanel;
