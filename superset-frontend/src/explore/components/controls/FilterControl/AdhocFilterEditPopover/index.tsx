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
import type React from 'react';
import { useRef, useState, useCallback, useEffect } from 'react';
import type { SupersetTheme } from '@apache-superset/core/ui';
import { Button, Icons, Select } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';

import Tabs from '@superset-ui/core/components/Tabs';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopoverSimpleTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSqlTabContent';
import type { Dataset } from '@superset-ui/chart-controls';
import type { ColumnType } from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent';
import {
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
  Operators,
} from 'src/explore/constants';
import rison from 'rison';
import { isObject } from 'lodash';
import { ExpressionTypes } from '../types';

interface LayerOption {
  id: number | null;
  value: number;
  label: string;
}

interface FilterOption {
  column_name?: string;
  saved_metric_name?: string;
  [key: string]: unknown;
}

interface AdhocFilterEditPopoverProps {
  adhocFilter: AdhocFilter;
  onChange: (filter: AdhocFilter) => void;
  onClose: () => void;
  onResize: () => void;
  options: FilterOption[];
  datasource?: Record<string, unknown>;
  partitionColumn?: string;
  theme?: SupersetTheme;
  sections?: string[];
  operators?: string[];
  requireSave?: boolean;
}

const FilterPopoverContentContainer = styled.div`
  .adhoc-filter-edit-tabs > .nav-tabs {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;

    & > li > a {
      padding: ${({ theme }) => theme.sizeUnit}px;
    }
  }

  #filter-edit-popover {
    max-width: none;
  }

  .filter-edit-clause-info {
    font-size: ${({ theme }) => theme.fontSizeXS}px;
  }

  .filter-edit-clause-section {
    display: flex;
    flex-direction: row;
    gap: ${({ theme }) => theme.sizeUnit * 5}px;
  }

  .adhoc-filter-simple-column-dropdown {
    margin-top: ${({ theme }) => theme.sizeUnit * 5}px;
  }
`;

const FilterActionsContainer = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const LayerSelectContainer = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 12}px;
`;

function AdhocFilterEditPopover({
  adhocFilter: propsAdhocFilter,
  onChange,
  onClose,
  onResize,
  options,
  datasource,
  partitionColumn,
  operators,
  requireSave,
  ...popoverProps
}: AdhocFilterEditPopoverProps) {
  const popoverContentRef = useRef<HTMLDivElement>(null);

  const dragStartRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const [adhocFilter, setAdhocFilter] = useState<AdhocFilter>(propsAdhocFilter);
  const [width, setWidth] = useState(POPOVER_INITIAL_WIDTH);
  const [height, setHeight] = useState(POPOVER_INITIAL_HEIGHT);
  const [isSimpleTabValid, setIsSimpleTabValid] = useState(true);
  const [selectedLayers, setSelectedLayers] = useState<LayerOption[]>([
    { id: null, value: -1, label: 'All' },
  ]);
  const [layerOptions, setLayerOptions] = useState<LayerOption[]>([]);
  const [hasLayerFilterScopeChanged, setHasLayerFilterScopeChanged] =
    useState(false);

  const loadLayerOptions = useCallback(
    (page: number, pageSize: number) => {
      const query = rison.encode({
        columns: ['id', 'slice_name', 'viz_type'],
        filters: [{ col: 'viz_type', opr: 'sw', value: 'deck' }],
        page,
        page_size: pageSize,
        order_column: 'slice_name',
        order_direction: 'asc',
      });

      return SupersetClient.get({
        endpoint: `/api/v1/chart/?q=${query}`,
      }).then(response => {
        if (!response?.json?.result) {
          return {
            data: [
              {
                id: null,
                value: -1,
                label: 'All',
              },
            ],
            totalCount: 1,
          };
        }

        const deckSlices = (propsAdhocFilter?.deck_slices || []) as number[];

        const list = [
          {
            id: null,
            value: -1,
            label: 'All',
          },
          ...response.json.result
            .map((item: { id: number; slice_name: string }) => {
              const sliceIndex = deckSlices.indexOf(item.id);
              return {
                id: item.id,
                value: sliceIndex >= 0 ? sliceIndex : item.id,
                label: item.slice_name,
                sliceIndex,
              };
            })
            .filter((item: { sliceIndex: number }) => item.sliceIndex !== -1)
            .map(
              ({
                sliceIndex,
                ...item
              }: {
                sliceIndex: number;
                id: number;
                value: number;
                label: string;
              }) => item,
            ),
        ];

        return {
          data: list,
          totalCount: list.length,
        };
      });
    },
    [propsAdhocFilter?.deck_slices],
  );

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      onResize();
      setWidth(
        Math.max(
          dragStartRef.current.width + (e.clientX - dragStartRef.current.x),
          POPOVER_INITIAL_WIDTH,
        ),
      );
      setHeight(
        Math.max(
          dragStartRef.current.height + (e.clientY - dragStartRef.current.y),
          POPOVER_INITIAL_HEIGHT,
        ),
      );
    },
    [onResize],
  );

  const onMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', onMouseMove);
  }, [onMouseMove]);

  useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);

    // Load layer options if deck_slices exist
    const deckSlices = propsAdhocFilter?.deck_slices as number[] | undefined;
    if (deckSlices && deckSlices.length > 0) {
      loadLayerOptions(0, 100).then(result => {
        setLayerOptions(result.data);
        const layerFilterScope = propsAdhocFilter?.layerFilterScope as
          | number[]
          | undefined;
        if (layerFilterScope) {
          const layers = layerFilterScope
            .map(item => result.data.find(option => option.value === item))
            .filter(Boolean) as LayerOption[];
          setSelectedLayers(layers);
        }
      });
    }

    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, [loadLayerOptions, onMouseMove, onMouseUp, propsAdhocFilter]);

  const onAdhocFilterChange = useCallback((filter: AdhocFilter) => {
    setAdhocFilter(filter);
  }, []);

  const setSimpleTabIsValid = useCallback((isValid: boolean) => {
    setIsSimpleTabValid(isValid);
  }, []);

  const onSave = useCallback(() => {
    const deckSlices = adhocFilter.deck_slices as number[] | undefined;
    const hasDeckSlices = deckSlices && deckSlices.length > 0;

    if (!hasDeckSlices) {
      onChange(adhocFilter);
      onClose();
      return;
    }
    // Update layer filter scope for deck multi
    const layers = selectedLayers.map(item => {
      if (isObject(item)) {
        return item.value;
      }
      return item;
    });
    const correctedAdhocFilter = adhocFilter.duplicateWith({
      layerFilterScope: layers,
    });
    setHasLayerFilterScopeChanged(false);
    onChange(correctedAdhocFilter);
    onClose();
  }, [adhocFilter, onChange, onClose, selectedLayers]);

  const onDragDown = useCallback(
    (e: React.MouseEvent) => {
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width,
        height,
      };
      document.addEventListener('mousemove', onMouseMove);
    },
    [width, height, onMouseMove],
  );

  const adjustHeight = useCallback((heightDifference: number) => {
    setHeight(prevHeight => prevHeight + heightDifference);
  }, []);

  const onLayerChange = useCallback(
    (selectedValue: LayerOption[] | number[] | null) => {
      let updatedSelectedLayers: LayerOption[] =
        (selectedValue as LayerOption[]) || [];

      if (!selectedValue || selectedValue.length === 0) {
        updatedSelectedLayers = [{ id: null, value: -1, label: 'All' }];
      } else if (
        selectedValue.length > 1 &&
        selectedValue.some(
          (item: LayerOption | number) =>
            (typeof item === 'object' && item.value === -1) || item === -1,
        )
      ) {
        const lastItem = selectedValue[selectedValue.length - 1];
        if (
          (typeof lastItem === 'object' && lastItem.value === -1) ||
          lastItem === -1
        ) {
          updatedSelectedLayers = [{ id: null, value: -1, label: 'All' }];
        } else {
          updatedSelectedLayers = (selectedValue as LayerOption[]).filter(
            (item: LayerOption) => item.value !== -1,
          );
        }
      }

      setSelectedLayers(updatedSelectedLayers);
      setHasLayerFilterScopeChanged(true);
    },
    [],
  );

  const stateIsValid = adhocFilter.isValid();
  const hasUnsavedChanges =
    requireSave ||
    !adhocFilter.equals(propsAdhocFilter) ||
    hasLayerFilterScopeChanged;

  const renderDeckSlices = adhocFilter.deck_slices as number[] | undefined;
  const hasDeckSlices = renderDeckSlices && renderDeckSlices.length > 0;

  return (
    <FilterPopoverContentContainer
      id="filter-edit-popover"
      {...popoverProps}
      data-test="filter-edit-popover"
      ref={popoverContentRef}
    >
      <Tabs
        id="adhoc-filter-edit-tabs"
        defaultActiveKey={adhocFilter.expressionType}
        className="adhoc-filter-edit-tabs"
        data-test="adhoc-filter-edit-tabs"
        style={{ minHeight: height, width }}
        allowOverflow
        items={[
          {
            key: ExpressionTypes.Simple,
            label: t('Simple'),
            children: (
              <ErrorBoundary>
                <AdhocFilterEditPopoverSimpleTabContent
                  operators={operators as Operators[] | undefined}
                  adhocFilter={adhocFilter}
                  onChange={onAdhocFilterChange}
                  options={options as ColumnType[]}
                  datasource={datasource as unknown as Dataset}
                  onHeightChange={adjustHeight}
                  partitionColumn={partitionColumn}
                  popoverRef={popoverContentRef.current}
                  validHandler={setSimpleTabIsValid}
                />
              </ErrorBoundary>
            ),
          },
          {
            key: ExpressionTypes.Sql,
            label: t('Custom SQL'),
            children: (
              <ErrorBoundary>
                <AdhocFilterEditPopoverSqlTabContent
                  adhocFilter={adhocFilter}
                  onChange={onAdhocFilterChange}
                  options={options}
                  height={height}
                  datasource={datasource}
                />
              </ErrorBoundary>
            ),
          },
        ]}
      />
      {hasDeckSlices && (
        <LayerSelectContainer>
          <Select
            options={layerOptions}
            onChange={onLayerChange as unknown as (value: unknown) => void}
            value={selectedLayers}
            mode="multiple"
          />
        </LayerSelectContainer>
      )}

      <FilterActionsContainer>
        <Button
          buttonStyle="secondary"
          buttonSize="small"
          onClick={onClose}
          cta
        >
          {t('Close')}
        </Button>
        <Button
          data-test="adhoc-filter-edit-popover-save-button"
          disabled={!stateIsValid || !isSimpleTabValid || !hasUnsavedChanges}
          buttonStyle="primary"
          buttonSize="small"
          onClick={onSave}
          cta
        >
          {t('Save')}
        </Button>
        <Icons.ArrowsAltOutlined
          role="button"
          aria-label={t('Resize')}
          tabIndex={0}
          onMouseDown={onDragDown}
          className="edit-popover-resize"
        />
      </FilterActionsContainer>
    </FilterPopoverContentContainer>
  );
}

export default AdhocFilterEditPopover;
