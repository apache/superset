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
import { Button, Icons } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { styled, t } from '@superset-ui/core';

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

    this.state = {
      adhocFilter: this.props.adhocFilter,
      width: POPOVER_INITIAL_WIDTH,
      height: POPOVER_INITIAL_HEIGHT,
      activeKey: this.props?.adhocFilter?.expressionType || 'SIMPLE',
      isSimpleTabValid: true,
    };

    this.popoverContentRef = createRef();
  }

  componentDidMount() {
    document.addEventListener('mouseup', this.onMouseUp);
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
    this.props.onChange(this.state.adhocFilter);
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

    const { adhocFilter } = this.state;
    const stateIsValid = adhocFilter.isValid();
    const hasUnsavedChanges =
      requireSave || !adhocFilter.equals(propsAdhocFilter);

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
