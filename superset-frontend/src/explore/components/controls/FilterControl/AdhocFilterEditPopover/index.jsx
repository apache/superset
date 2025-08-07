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
import { createRef, Component } from 'react';
import PropTypes from 'prop-types';
import { Button, Icons, Select } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { styled, t, SupersetClient } from '@superset-ui/core';

import Tabs from '@superset-ui/core/components/Tabs';
import adhocMetricType from 'src/explore/components/controls/MetricControl/adhocMetricType';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopoverSimpleTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSqlTabContent';
import columnType from 'src/explore/components/controls/FilterControl/columnType';
import {
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
} from 'src/explore/constants';
import rison from 'rison';
import { isObject } from 'lodash';
import { ExpressionTypes } from '../types';

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      columnType,
      PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
      adhocMetricType,
    ]),
  ).isRequired,
  datasource: PropTypes.object,
  partitionColumn: PropTypes.string,
  theme: PropTypes.object,
  sections: PropTypes.arrayOf(PropTypes.string),
  operators: PropTypes.arrayOf(PropTypes.string),
  requireSave: PropTypes.bool,
};

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

export default class AdhocFilterEditPopover extends Component {
  constructor(props) {
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
    if (
      this.props.adhocFilter?.deck_slices &&
      this.props.adhocFilter.deck_slices.length > 0
    ) {
      this.loadLayerOptions(0, 100).then(result => {
        this.setState({ layerOptions: result.data });
        const layerFilterScope = this.props.adhocFilter?.layerFilterScope;
        if (layerFilterScope) {
          const selectedLayers = layerFilterScope.map(item => {
            const layerOption = result.data.find(
              option => option.value === item,
            );
            return layerOption;
          });
          this.setState({ selectedLayers });
        }
      });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  onAdhocFilterChange(adhocFilter) {
    this.setState({ adhocFilter });
  }

  setSimpleTabIsValid(isValid) {
    this.setState({ isSimpleTabValid: isValid });
  }

  onSave() {
    const hasDeckSlices =
      this.state.adhocFilter.deck_slices &&
      this.state.adhocFilter.deck_slices.length > 0;

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
    const correctedAdhocFilter = {
      ...this.state.adhocFilter,
      layerFilterScope: selectedLayers,
    };
    this.setState({ hasLayerFilterScopeChanged: false });
    this.props.onChange(correctedAdhocFilter);
    this.props.onClose();
  }

  onDragDown(e) {
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartWidth = this.state.width;
    this.dragStartHeight = this.state.height;
    document.addEventListener('mousemove', this.onMouseMove);
  }

  onMouseMove(e) {
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

  onTabChange(activeKey) {
    this.setState({
      activeKey,
    });
  }

  adjustHeight(heightDifference) {
    this.setState(state => ({ height: state.height + heightDifference }));
  }

  loadLayerOptions(page, pageSize) {
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

      const deckSlices = this.props.adhocFilter?.deck_slices || [];

      const list = [
        {
          id: null,
          value: -1,
          label: 'All',
        },
        ...response.json.result
          .map(item => {
            const sliceIndex = deckSlices.indexOf(item.id);
            return {
              id: item.id,
              value: sliceIndex >= 0 ? sliceIndex : item.id,
              label: item.slice_name,
              sliceIndex,
            };
          })
          .filter(item => item.sliceIndex !== -1)
          .map(({ sliceIndex, ...item }) => item),
      ];

      return {
        data: list,
        totalCount: list.length,
      };
    });
  }

  onLayerChange(selectedValue) {
    let updatedSelectedLayers = selectedValue;

    if (!selectedValue || selectedValue.length === 0) {
      updatedSelectedLayers = [{ id: null, value: -1, label: 'All' }];
    } else if (
      selectedValue.length > 1 &&
      selectedValue.some(item => item.value === -1 || item === -1)
    ) {
      if (
        selectedValue[selectedValue.length - 1].value === -1 ||
        selectedValue[selectedValue.length - 1] === -1
      ) {
        updatedSelectedLayers = [{ id: null, value: -1, label: 'All' }];
      } else {
        updatedSelectedLayers = selectedValue
          .filter(item => item.value !== -1)
          .filter(item => item !== -1);
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

    const hasDeckSlices =
      adhocFilter.deck_slices && adhocFilter.deck_slices.length > 0;

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
                    operators={operators}
                    adhocFilter={this.state.adhocFilter}
                    onChange={this.onAdhocFilterChange}
                    options={options}
                    datasource={datasource}
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
                    activeKey={this.state.activeKey}
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
              onChange={this.onLayerChange}
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
            aria-label="Resize"
            tabIndex={0}
            onMouseDown={this.onDragDown}
            className="edit-popover-resize"
          />
        </FilterActionsContainer>
      </FilterPopoverContentContainer>
    );
  }
}

AdhocFilterEditPopover.propTypes = propTypes;
