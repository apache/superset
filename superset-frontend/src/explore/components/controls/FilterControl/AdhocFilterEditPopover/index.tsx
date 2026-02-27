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
import { createRef, Component, type RefObject } from 'react';
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

interface AdhocFilterEditPopoverState {
  adhocFilter: AdhocFilter;
  width: number;
  height: number;
  activeKey: string;
  isSimpleTabValid: boolean;
  selectedLayers: LayerOption[];
  layerOptions: LayerOption[];
  hasLayerFilterScopeChanged: boolean;
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

export default class AdhocFilterEditPopover extends Component<
  AdhocFilterEditPopoverProps,
  AdhocFilterEditPopoverState
> {
  popoverContentRef: RefObject<HTMLDivElement>;

  dragStartX = 0;

  dragStartY = 0;

  dragStartWidth = 0;

  dragStartHeight = 0;

  constructor(props: AdhocFilterEditPopoverProps) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onDragDown = this.onDragDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onAdhocFilterChange = this.onAdhocFilterChange.bind(this);
    this.setSimpleTabIsValid = this.setSimpleTabIsValid.bind(this);
    this.adjustHeight = this.adjustHeight.bind(this);
    this.onTabChange = this.onTabChange.bind(this);
    this.loadLayerOptions = this.loadLayerOptions.bind(this);
    this.onLayerChange = this.onLayerChange.bind(this);

    this.state = {
      adhocFilter: this.props.adhocFilter,
      width: POPOVER_INITIAL_WIDTH,
      height: POPOVER_INITIAL_HEIGHT,
      activeKey: this.props?.adhocFilter?.expressionType || 'SIMPLE',
      isSimpleTabValid: true,
      selectedLayers: [{ id: null, value: -1, label: 'All' }],
      layerOptions: [],
      hasLayerFilterScopeChanged: false,
    };

    this.popoverContentRef = createRef();
  }

  componentDidMount() {
    document.addEventListener('mouseup', this.onMouseUp);

    // Load layer options if deck_slices exist
    const deckSlices = this.props.adhocFilter?.deck_slices as
      | number[]
      | undefined;
    if (deckSlices && deckSlices.length > 0) {
      this.loadLayerOptions(0, 100).then(result => {
        this.setState({ layerOptions: result.data });
        const layerFilterScope = this.props.adhocFilter?.layerFilterScope as
          | number[]
          | undefined;
        if (layerFilterScope) {
          const selectedLayers = layerFilterScope.map(item => {
            const layerOption = result.data.find(
              option => option.value === item,
            );
            return layerOption;
          });
          this.setState({
            selectedLayers: selectedLayers.filter(Boolean) as LayerOption[],
          });
        }
      });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  onAdhocFilterChange(adhocFilter: AdhocFilter): void {
    this.setState({ adhocFilter });
  }

  setSimpleTabIsValid(isValid: boolean): void {
    this.setState({ isSimpleTabValid: isValid });
  }

  onSave() {
    const deckSlices = this.state.adhocFilter.deck_slices as
      | number[]
      | undefined;
    const hasDeckSlices = deckSlices && deckSlices.length > 0;

    if (!hasDeckSlices) {
      this.props.onChange(this.state.adhocFilter);
      this.props.onClose();
      return;
    }
    // Update layer filter scope for deck multi
    const selectedLayers = this.state.selectedLayers.map(item => {
      if (isObject(item)) {
        return item.value;
      }
      return item;
    });
    const correctedAdhocFilter = this.state.adhocFilter.duplicateWith({
      layerFilterScope: selectedLayers,
    });
    this.setState({ hasLayerFilterScopeChanged: false });
    this.props.onChange(correctedAdhocFilter);
    this.props.onClose();
  }

  onDragDown(e: React.MouseEvent): void {
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartWidth = this.state.width;
    this.dragStartHeight = this.state.height;
    document.addEventListener('mousemove', this.onMouseMove);
  }

  onMouseMove(e: MouseEvent): void {
    this.props.onResize();
    this.setState({
      width: Math.max(
        this.dragStartWidth + (e.clientX - this.dragStartX),
        POPOVER_INITIAL_WIDTH,
      ),
      height: Math.max(
        this.dragStartHeight + (e.clientY - this.dragStartY),
        POPOVER_INITIAL_HEIGHT,
      ),
    });
  }

  onMouseUp() {
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  onTabChange(activeKey: string) {
    this.setState({
      activeKey,
    });
  }

  adjustHeight(heightDifference: number) {
    this.setState(state => ({ height: state.height + heightDifference }));
  }

  loadLayerOptions(page: number, pageSize: number) {
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

      const deckSlices = (this.props.adhocFilter?.deck_slices ||
        []) as number[];

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
  }

  onLayerChange(selectedValue: LayerOption[] | number[] | null) {
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

    this.setState({ selectedLayers: updatedSelectedLayers });
    this.setState({ hasLayerFilterScopeChanged: true });
  }

  render() {
    const {
      adhocFilter: propsAdhocFilter,
      options,
      onChange,
      onClose,
      onResize,
      datasource,
      partitionColumn,
      theme,
      operators,
      requireSave,
      ...popoverProps
    } = this.props;

    const { adhocFilter, selectedLayers, hasLayerFilterScopeChanged } =
      this.state;
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
        ref={this.popoverContentRef}
      >
        <Tabs
          id="adhoc-filter-edit-tabs"
          defaultActiveKey={adhocFilter.expressionType}
          className="adhoc-filter-edit-tabs"
          data-test="adhoc-filter-edit-tabs"
          style={{ minHeight: this.state.height, width: this.state.width }}
          allowOverflow
          onChange={this.onTabChange}
          items={[
            {
              key: ExpressionTypes.Simple,
              label: t('Simple'),
              children: (
                <ErrorBoundary>
                  <AdhocFilterEditPopoverSimpleTabContent
                    operators={operators as Operators[] | undefined}
                    adhocFilter={this.state.adhocFilter}
                    onChange={this.onAdhocFilterChange}
                    options={options as ColumnType[]}
                    datasource={datasource as unknown as Dataset}
                    onHeightChange={this.adjustHeight}
                    partitionColumn={partitionColumn}
                    popoverRef={this.popoverContentRef.current}
                    validHandler={this.setSimpleTabIsValid}
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
                    adhocFilter={this.state.adhocFilter}
                    onChange={this.onAdhocFilterChange}
                    options={this.props.options}
                    height={this.state.height}
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
              options={this.state.layerOptions}
              onChange={
                this.onLayerChange as unknown as (value: unknown) => void
              }
              value={selectedLayers}
              mode="multiple"
            />
          </LayerSelectContainer>
        )}

        <FilterActionsContainer>
          <Button
            buttonStyle="secondary"
            buttonSize="small"
            onClick={this.props.onClose}
            cta
          >
            {t('Close')}
          </Button>
          <Button
            data-test="adhoc-filter-edit-popover-save-button"
            disabled={
              !stateIsValid ||
              !this.state.isSimpleTabValid ||
              !hasUnsavedChanges
            }
            buttonStyle="primary"
            buttonSize="small"
            onClick={this.onSave}
            cta
          >
            {t('Save')}
          </Button>
          <Icons.ArrowsAltOutlined
            role="button"
            aria-label={t('Resize')}
            tabIndex={0}
            onMouseDown={this.onDragDown}
            className="edit-popover-resize"
          />
        </FilterActionsContainer>
      </FilterPopoverContentContainer>
    );
  }
}
