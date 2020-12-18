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
import React from 'react';
import PropTypes from 'prop-types';
import Button from 'src/components/Button';
import { styled, t } from '@superset-ui/core';

import Tabs from 'src/common/components/Tabs';
import columnType from '../propTypes/columnType';
import adhocMetricType from '../propTypes/adhocMetricType';
import AdhocFilter, { EXPRESSION_TYPES } from '../AdhocFilter';
import AdhocFilterEditPopoverSimpleTabContent from './AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from './AdhocFilterEditPopoverSqlTabContent';

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
};

const ResizeIcon = styled.i`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const startingWidth = 320;
const startingHeight = 240;

export default class AdhocFilterEditPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onDragDown = this.onDragDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onAdhocFilterChange = this.onAdhocFilterChange.bind(this);
    this.adjustHeight = this.adjustHeight.bind(this);

    this.state = {
      adhocFilter: this.props.adhocFilter,
      width: startingWidth,
      height: startingHeight,
    };

    this.popoverContentRef = React.createRef();
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
        startingWidth,
      ),
      height: Math.max(
        this.dragStartHeight + (e.clientY - this.dragStartY) * 2,
        startingHeight,
      ),
    });
  }

  onMouseUp() {
    document.removeEventListener('mousemove', this.onMouseMove);
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
      ...popoverProps
    } = this.props;

    const { adhocFilter } = this.state;

    const stateIsValid = adhocFilter.isValid();
    const hasUnsavedChanges = !adhocFilter.equals(propsAdhocFilter);

    return (
      <div
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
          style={{ height: this.state.height, width: this.state.width }}
          allowOverflow
        >
          <Tabs.TabPane
            className="adhoc-filter-edit-tab"
            key={EXPRESSION_TYPES.SIMPLE}
            tab={t('Simple')}
          >
            <AdhocFilterEditPopoverSimpleTabContent
              adhocFilter={this.state.adhocFilter}
              onChange={this.onAdhocFilterChange}
              options={options}
              datasource={datasource}
              onHeightChange={this.adjustHeight}
              partitionColumn={partitionColumn}
              popoverRef={this.popoverContentRef.current}
            />
          </Tabs.TabPane>
          <Tabs.TabPane
            className="adhoc-filter-edit-tab"
            key={EXPRESSION_TYPES.SQL}
            tab={t('Custom SQL')}
          >
            {!this.props.datasource ||
            this.props.datasource.type !== 'druid' ? (
              <AdhocFilterEditPopoverSqlTabContent
                adhocFilter={this.state.adhocFilter}
                onChange={this.onAdhocFilterChange}
                options={this.props.options}
                height={this.state.height}
              />
            ) : (
              <div className="custom-sql-disabled-message">
                Custom SQL Filters are not available on druid datasources
              </div>
            )}
          </Tabs.TabPane>
        </Tabs>
        <div>
          <Button buttonSize="small" onClick={this.props.onClose} cta>
            {t('Close')}
          </Button>
          <Button
            data-test="adhoc-filter-edit-popover-save-button"
            disabled={!stateIsValid}
            buttonStyle={
              hasUnsavedChanges && stateIsValid ? 'primary' : 'default'
            }
            buttonSize="small"
            className="m-r-5"
            onClick={this.onSave}
            cta
          >
            {t('Save')}
          </Button>
          <ResizeIcon
            role="button"
            aria-label="Resize"
            tabIndex={0}
            onMouseDown={this.onDragDown}
            className="fa fa-expand edit-popover-resize text-muted"
          />
        </div>
      </div>
    );
  }
}

AdhocFilterEditPopover.propTypes = propTypes;
