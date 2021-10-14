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

import ErrorBoundary from 'src/components/ErrorBoundary';
import Tabs from 'src/components/Tabs';
import adhocMetricType from 'src/explore/components/controls/MetricControl/adhocMetricType';
import AdhocFilter, {
  EXPRESSION_TYPES,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopoverSimpleTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopoverSqlTabContent';
import columnType from 'src/explore/components/controls/FilterControl/columnType';

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
};

const ResizeIcon = styled.i`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const startingWidth = 320;
const startingHeight = 240;
const SectionWrapper = styled.div`
  .ant-select {
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }
`;

const FilterPopoverContentContainer = styled.div`
  .adhoc-filter-edit-tabs > .nav-tabs {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;

    & > li > a {
      padding: ${({ theme }) => theme.gridUnit}px;
    }
  }

  #filter-edit-popover {
    max-width: none;
  }

  .filter-edit-clause-info {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
    padding-left: ${({ theme }) => theme.gridUnit}px;
  }

  .filter-edit-clause-section {
    display: inline-flex;
  }

  .adhoc-filter-simple-column-dropdown {
    margin-top: ${({ theme }) => theme.gridUnit * 5}px;
  }
`;

export default class AdhocFilterEditPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onDragDown = this.onDragDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onAdhocFilterChange = this.onAdhocFilterChange.bind(this);
    this.adjustHeight = this.adjustHeight.bind(this);
    this.onTabChange = this.onTabChange.bind(this);

    this.state = {
      adhocFilter: this.props.adhocFilter,
      width: startingWidth,
      height: startingHeight,
      activeKey: this.props?.adhocFilter?.expressionType || 'SIMPLE',
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
      sections = ['SIMPLE', 'CUSTOM_SQL'],
      theme,
      operators,
      ...popoverProps
    } = this.props;

    const { adhocFilter } = this.state;

    const resultSections =
      datasource?.type === 'druid'
        ? sections.filter(s => s !== 'CUSTOM_SQL')
        : sections;

    const stateIsValid = adhocFilter.isValid();
    const hasUnsavedChanges = !adhocFilter.equals(propsAdhocFilter);

    const sectionRenders = {};

    sectionRenders.CUSTOM_SQL = (
      <ErrorBoundary>
        <AdhocFilterEditPopoverSqlTabContent
          adhocFilter={this.state.adhocFilter}
          onChange={this.onAdhocFilterChange}
          options={this.props.options}
          height={this.state.height}
          activeKey={this.state.activeKey}
        />
      </ErrorBoundary>
    );

    sectionRenders.SIMPLE = (
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
        />
      </ErrorBoundary>
    );

    return (
      <FilterPopoverContentContainer
        id="filter-edit-popover"
        {...popoverProps}
        data-test="filter-edit-popover"
        ref={this.popoverContentRef}
      >
        {resultSections.length > 1 ? (
          <Tabs
            id="adhoc-filter-edit-tabs"
            defaultActiveKey={adhocFilter.expressionType}
            className="adhoc-filter-edit-tabs"
            data-test="adhoc-filter-edit-tabs"
            style={{ minHeight: this.state.height, width: this.state.width }}
            allowOverflow
            onChange={this.onTabChange}
          >
            {resultSections.includes('SIMPLE') && (
              <Tabs.TabPane
                className="adhoc-filter-edit-tab"
                key={EXPRESSION_TYPES.SIMPLE}
                tab={t('Simple')}
              >
                {sectionRenders.SIMPLE}
              </Tabs.TabPane>
            )}
            {resultSections.includes('CUSTOM_SQL') && (
              <Tabs.TabPane
                className="adhoc-filter-edit-tab"
                key={EXPRESSION_TYPES.SQL}
                tab={t('Custom SQL')}
              >
                {sectionRenders.CUSTOM_SQL}
              </Tabs.TabPane>
            )}
          </Tabs>
        ) : (
          <SectionWrapper>{sectionRenders[resultSections[0]]}</SectionWrapper>
        )}
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
      </FilterPopoverContentContainer>
    );
  }
}

AdhocFilterEditPopover.propTypes = propTypes;
