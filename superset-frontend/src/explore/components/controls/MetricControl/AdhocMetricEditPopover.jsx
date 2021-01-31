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
/* eslint-disable camelcase */
import React from 'react';
import PropTypes from 'prop-types';
import { FormGroup } from 'react-bootstrap';
import Tabs from 'src/common/components/Tabs';
import Button from 'src/components/Button';
import { Select } from 'src/common/components/Select';
import { styled, t } from '@superset-ui/core';
import { ColumnOption } from '@superset-ui/chart-controls';

import FormLabel from 'src/components/FormLabel';
import { SQLEditor } from 'src/components/AsyncAceEditor';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { noOp } from 'src/utils/common';

import { AGGREGATES_OPTIONS } from 'src/explore/constants';
import columnType from 'src/explore/propTypes/columnType';
import savedMetricType from './savedMetricType';
import AdhocMetric, { EXPRESSION_TYPES } from './AdhocMetric';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  getCurrentTab: PropTypes.func,
  getCurrentLabel: PropTypes.func,
  columns: PropTypes.arrayOf(columnType),
  savedMetricsOptions: PropTypes.arrayOf(savedMetricType),
  savedMetric: savedMetricType,
  datasourceType: PropTypes.string,
};

const defaultProps = {
  columns: [],
  getCurrentTab: noOp,
};

const ResizeIcon = styled.i`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ColumnOptionStyle = styled.span`
  .option-label {
    display: inline;
  }
`;

export const SAVED_TAB_KEY = 'SAVED';

const startingWidth = 320;
const startingHeight = 240;

export default class AdhocMetricEditPopover extends React.PureComponent {
  // "Saved" is a default tab unless there are no saved metrics for dataset
  defaultActiveTabKey =
    (this.props.savedMetric.metric_name || this.props.adhocMetric.isNew) &&
    Array.isArray(this.props.savedMetricsOptions) &&
    this.props.savedMetricsOptions.length > 0
      ? SAVED_TAB_KEY
      : this.props.adhocMetric.expressionType;

  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onResetStateAndClose = this.onResetStateAndClose.bind(this);
    this.onColumnChange = this.onColumnChange.bind(this);
    this.onAggregateChange = this.onAggregateChange.bind(this);
    this.onSavedMetricChange = this.onSavedMetricChange.bind(this);
    this.onSqlExpressionChange = this.onSqlExpressionChange.bind(this);
    this.onDragDown = this.onDragDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onTabChange = this.onTabChange.bind(this);
    this.handleAceEditorRef = this.handleAceEditorRef.bind(this);
    this.refreshAceEditor = this.refreshAceEditor.bind(this);

    this.state = {
      adhocMetric: this.props.adhocMetric,
      savedMetric: this.props.savedMetric,
      width: startingWidth,
      height: startingHeight,
    };

    document.addEventListener('mouseup', this.onMouseUp);
  }

  componentDidMount() {
    this.props.getCurrentTab(this.defaultActiveTabKey);
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.adhocMetric?.sqlExpression !==
        this.state.adhocMetric?.sqlExpression ||
      prevState.adhocMetric?.aggregate !== this.state.adhocMetric?.aggregate ||
      prevState.adhocMetric?.column?.column_name !==
        this.state.adhocMetric?.column?.column_name ||
      prevState.savedMetric?.metric_name !== this.state.savedMetric?.metric_name
    ) {
      this.props.getCurrentLabel({
        savedMetricLabel:
          this.state.savedMetric?.verbose_name ||
          this.state.savedMetric?.metric_name,
        adhocMetricLabel: this.state.adhocMetric?.getDefaultLabel(),
      });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  onSave() {
    const { adhocMetric, savedMetric } = this.state;

    const metric = savedMetric?.metric_name ? savedMetric : adhocMetric;
    const oldMetric = this.props.savedMetric?.metric_name
      ? this.props.savedMetric
      : this.props.adhocMetric;
    this.props.onChange(
      {
        ...metric,
      },
      oldMetric,
    );
    this.props.onClose();
  }

  onResetStateAndClose() {
    this.setState(
      {
        adhocMetric: this.props.adhocMetric,
        savedMetric: this.props.savedMetric,
      },
      this.props.onClose,
    );
  }

  onColumnChange(columnId) {
    const column = this.props.columns.find(column => column.id === columnId);
    this.setState(prevState => ({
      adhocMetric: prevState.adhocMetric.duplicateWith({
        column,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
      savedMetric: undefined,
    }));
  }

  onAggregateChange(aggregate) {
    // we construct this object explicitly to overwrite the value in the case aggregate is null
    this.setState(prevState => ({
      adhocMetric: prevState.adhocMetric.duplicateWith({
        aggregate,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
      savedMetric: undefined,
    }));
  }

  onSavedMetricChange(savedMetricId) {
    const savedMetric = this.props.savedMetricsOptions.find(
      metric => metric.id === savedMetricId,
    );
    this.setState(prevState => ({
      savedMetric,
      adhocMetric: prevState.adhocMetric.duplicateWith({
        column: undefined,
        aggregate: undefined,
        sqlExpression: undefined,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    }));
  }

  onSqlExpressionChange(sqlExpression) {
    this.setState(prevState => ({
      adhocMetric: prevState.adhocMetric.duplicateWith({
        sqlExpression,
        expressionType: EXPRESSION_TYPES.SQL,
      }),
      savedMetric: undefined,
    }));
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

  onTabChange(tab) {
    this.refreshAceEditor();
    this.props.getCurrentTab(tab);
  }

  handleAceEditorRef(ref) {
    if (ref) {
      this.aceEditorRef = ref;
    }
  }

  refreshAceEditor() {
    setTimeout(() => {
      if (this.aceEditorRef) {
        this.aceEditorRef.editor.resize();
      }
    }, 0);
  }

  renderColumnOption(option) {
    const column = { ...option };
    if (column.metric_name && !column.verbose_name) {
      column.verbose_name = column.metric_name;
    }
    return (
      <ColumnOptionStyle>
        <ColumnOption column={column} showType />
      </ColumnOptionStyle>
    );
  }

  render() {
    const {
      adhocMetric: propsAdhocMetric,
      savedMetric: propsSavedMetric,
      columns,
      savedMetricsOptions,
      onChange,
      onClose,
      onResize,
      datasourceType,
      ...popoverProps
    } = this.props;

    const { adhocMetric, savedMetric } = this.state;
    const keywords = sqlKeywords.concat(
      columns.map(column => ({
        name: column.column_name,
        value: column.column_name,
        score: 50,
        meta: 'column',
      })),
    );

    const columnValue =
      (adhocMetric.column && adhocMetric.column.column_name) ||
      adhocMetric.inferSqlExpressionColumn();

    // autofocus on column if there's no value in column; otherwise autofocus on aggregate
    const columnSelectProps = {
      placeholder: t('%s column(s)', columns.length),
      value: columnValue,
      onChange: this.onColumnChange,
      allowClear: true,
      showSearch: true,
      autoFocus: !columnValue,
      filterOption: (input, option) =>
        option.filterBy.toLowerCase().indexOf(input.toLowerCase()) >= 0,
    };

    const aggregateSelectProps = {
      placeholder: t('%s aggregates(s)', AGGREGATES_OPTIONS.length),
      value: adhocMetric.aggregate || adhocMetric.inferSqlExpressionAggregate(),
      onChange: this.onAggregateChange,
      allowClear: true,
      autoFocus: !!columnValue,
      showSearch: true,
    };

    const savedSelectProps = {
      placeholder: t('%s saved metric(s)', savedMetricsOptions?.length ?? 0),
      value: savedMetric?.verbose_name || savedMetric?.metric_name,
      onChange: this.onSavedMetricChange,
      allowClear: true,
      showSearch: true,
      autoFocus: true,
      filterOption: (input, option) =>
        option.filterBy.toLowerCase().indexOf(input.toLowerCase()) >= 0,
    };

    if (this.props.datasourceType === 'druid') {
      aggregateSelectProps.options = aggregateSelectProps.options.filter(
        aggregate => aggregate !== 'AVG',
      );
    }

    const stateIsValid = adhocMetric.isValid() || savedMetric?.metric_name;
    const hasUnsavedChanges =
      !adhocMetric.equals(propsAdhocMetric) ||
      (!(
        typeof savedMetric?.metric_name === 'undefined' &&
        typeof propsSavedMetric?.metric_name === 'undefined'
      ) &&
        savedMetric?.metric_name !== propsSavedMetric?.metric_name);

    return (
      <div
        id="metrics-edit-popover"
        data-test="metrics-edit-popover"
        {...popoverProps}
      >
        <Tabs
          id="adhoc-metric-edit-tabs"
          data-test="adhoc-metric-edit-tabs"
          defaultActiveKey={this.defaultActiveTabKey}
          className="adhoc-metric-edit-tabs"
          style={{ height: this.state.height, width: this.state.width }}
          onChange={this.onTabChange}
          allowOverflow
        >
          <Tabs.TabPane key={SAVED_TAB_KEY} tab={t('Saved')}>
            <FormGroup>
              <FormLabel>
                <strong>{t('Saved metric')}</strong>
              </FormLabel>
              <Select
                {...savedSelectProps}
                name="select-saved"
                getPopupContainer={triggerNode => triggerNode.parentNode}
              >
                {Array.isArray(savedMetricsOptions) &&
                  savedMetricsOptions.map(savedMetric => (
                    <Select.Option
                      value={savedMetric.id}
                      filterBy={
                        savedMetric.verbose_name || savedMetric.metric_name
                      }
                      key={savedMetric.id}
                    >
                      {this.renderColumnOption(savedMetric)}
                    </Select.Option>
                  ))}
              </Select>
            </FormGroup>
          </Tabs.TabPane>
          <Tabs.TabPane key={EXPRESSION_TYPES.SIMPLE} tab={t('Simple')}>
            <FormGroup>
              <FormLabel>
                <strong>{t('column')}</strong>
              </FormLabel>
              <Select
                {...columnSelectProps}
                name="select-column"
                getPopupContainer={triggerNode => triggerNode.parentNode}
              >
                {columns.map(column => (
                  <Select.Option
                    value={column.id}
                    filterBy={column.verbose_name || column.column_name}
                    key={column.id}
                  >
                    {this.renderColumnOption(column)}
                  </Select.Option>
                ))}
              </Select>
            </FormGroup>
            <FormGroup>
              <FormLabel>
                <strong>{t('aggregate')}</strong>
              </FormLabel>
              <Select
                {...aggregateSelectProps}
                name="select-aggregate"
                getPopupContainer={triggerNode => triggerNode.parentNode}
              >
                {AGGREGATES_OPTIONS.map(option => (
                  <Select.Option value={option} key={option}>
                    {option}
                  </Select.Option>
                ))}
              </Select>
            </FormGroup>
          </Tabs.TabPane>
          <Tabs.TabPane
            key={EXPRESSION_TYPES.SQL}
            tab={t('Custom SQL')}
            data-test="adhoc-metric-edit-tab#custom"
          >
            {this.props.datasourceType !== 'druid' ? (
              <FormGroup data-test="sql-editor">
                <SQLEditor
                  showLoadingForImport
                  ref={this.handleAceEditorRef}
                  keywords={keywords}
                  height={`${this.state.height - 80}px`}
                  onChange={this.onSqlExpressionChange}
                  width="100%"
                  showGutter={false}
                  value={
                    adhocMetric.sqlExpression || adhocMetric.translateToSql()
                  }
                  editorProps={{ $blockScrolling: true }}
                  enableLiveAutocompletion
                  className="adhoc-filter-sql-editor"
                  wrapEnabled
                />
              </FormGroup>
            ) : (
              <div className="custom-sql-disabled-message">
                Custom SQL Metrics are not available on druid datasources
              </div>
            )}
          </Tabs.TabPane>
        </Tabs>
        <div>
          <Button
            buttonSize="small"
            onClick={this.onResetStateAndClose}
            data-test="AdhocMetricEdit#cancel"
            cta
          >
            {t('Close')}
          </Button>
          <Button
            disabled={!stateIsValid}
            buttonStyle={
              hasUnsavedChanges && stateIsValid ? 'primary' : 'default'
            }
            buttonSize="small"
            data-test="AdhocMetricEdit#save"
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
AdhocMetricEditPopover.propTypes = propTypes;
AdhocMetricEditPopover.defaultProps = defaultProps;
