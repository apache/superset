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
import { FormGroup, Popover, Tab, Tabs } from 'react-bootstrap';
import Button from 'src/components/Button';
import Select from 'src/components/Select';
import { t, ThemeProvider } from '@superset-ui/core';
import { ColumnOption } from '@superset-ui/chart-controls';

import FormLabel from 'src/components/FormLabel';
import { SQLEditor } from 'src/components/AsyncAceEditor';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';

import { AGGREGATES_OPTIONS } from '../constants';
import AdhocMetricEditPopoverTitle from './AdhocMetricEditPopoverTitle';
import columnType from '../propTypes/columnType';
import AdhocMetric, { EXPRESSION_TYPES } from '../AdhocMetric';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  datasourceType: PropTypes.string,
  theme: PropTypes.object,
};

const defaultProps = {
  columns: [],
};

const startingWidth = 300;
const startingHeight = 180;

export default class AdhocMetricEditPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onColumnChange = this.onColumnChange.bind(this);
    this.onAggregateChange = this.onAggregateChange.bind(this);
    this.onSqlExpressionChange = this.onSqlExpressionChange.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.onDragDown = this.onDragDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.handleAceEditorRef = this.handleAceEditorRef.bind(this);
    this.refreshAceEditor = this.refreshAceEditor.bind(this);
    this.state = {
      adhocMetric: this.props.adhocMetric,
      width: startingWidth,
      height: startingHeight,
    };
    this.selectProps = {
      labelKey: 'label',
      isMulti: false,
      autosize: false,
      clearable: true,
    };
    document.addEventListener('mouseup', this.onMouseUp);
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  onSave() {
    this.props.onChange(this.state.adhocMetric);
    this.props.onClose();
  }

  onColumnChange(column) {
    this.setState(prevState => ({
      adhocMetric: prevState.adhocMetric.duplicateWith({
        column,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    }));
  }

  onAggregateChange(aggregate) {
    // we construct this object explicitly to overwrite the value in the case aggregate is null
    this.setState(prevState => ({
      adhocMetric: prevState.adhocMetric.duplicateWith({
        aggregate,
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
    }));
  }

  onLabelChange(e) {
    const label = e.target.value;
    this.setState(prevState => ({
      adhocMetric: prevState.adhocMetric.duplicateWith({
        label,
        hasCustomLabel: true,
      }),
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
    return <ColumnOption column={option} showType />;
  }

  render() {
    const {
      adhocMetric: propsAdhocMetric,
      columns,
      onChange,
      onClose,
      onResize,
      datasourceType,
      theme,
      ...popoverProps
    } = this.props;

    const { adhocMetric } = this.state;
    const keywords = sqlKeywords.concat(
      columns.map(column => ({
        name: column.column_name,
        value: column.column_name,
        score: 50,
        meta: 'column',
      })),
    );

    const columnSelectProps = {
      placeholder: t('%s column(s)', columns.length),
      options: columns,
      value:
        (adhocMetric.column && adhocMetric.column.column_name) ||
        adhocMetric.inferSqlExpressionColumn(),
      onChange: this.onColumnChange,
      optionRenderer: this.renderColumnOption,
      valueKey: 'column_name',
    };

    const aggregateSelectProps = {
      placeholder: t('%s aggregates(s)', AGGREGATES_OPTIONS.length),
      options: AGGREGATES_OPTIONS,
      value: adhocMetric.aggregate || adhocMetric.inferSqlExpressionAggregate(),
      onChange: this.onAggregateChange,
    };

    if (this.props.datasourceType === 'druid') {
      aggregateSelectProps.options = aggregateSelectProps.options.filter(
        aggregate => aggregate !== 'AVG',
      );
    }

    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        adhocMetric={adhocMetric}
        onChange={this.onLabelChange}
      />
    );

    const stateIsValid = adhocMetric.isValid();
    const hasUnsavedChanges = !adhocMetric.equals(propsAdhocMetric);
    return (
      <Popover id="metrics-edit-popover" title={popoverTitle} {...popoverProps}>
        <ThemeProvider theme={theme}>
          <Tabs
            id="adhoc-metric-edit-tabs"
            defaultActiveKey={adhocMetric.expressionType}
            className="adhoc-metric-edit-tabs"
            style={{ height: this.state.height, width: this.state.width }}
            onSelect={this.refreshAceEditor}
            animation={false}
          >
            <Tab
              className="adhoc-metric-edit-tab"
              eventKey={EXPRESSION_TYPES.SIMPLE}
              title="Simple"
            >
              <FormGroup>
                <FormLabel>
                  <strong>column</strong>
                </FormLabel>
                <Select
                  name="select-column"
                  {...this.selectProps}
                  {...columnSelectProps}
                />
              </FormGroup>
              <FormGroup>
                <FormLabel>
                  <strong>aggregate</strong>
                </FormLabel>
                <Select
                  name="select-aggregate"
                  {...this.selectProps}
                  {...aggregateSelectProps}
                  autoFocus
                />
              </FormGroup>
            </Tab>
            <Tab
              className="adhoc-metric-edit-tab"
              eventKey={EXPRESSION_TYPES.SQL}
              title="Custom SQL"
              data-test="adhoc-metric-edit-tab#custom"
            >
              {this.props.datasourceType !== 'druid' ? (
                <FormGroup>
                  <SQLEditor
                    showLoadingForImport
                    ref={this.handleAceEditorRef}
                    keywords={keywords}
                    height={`${this.state.height - 43}px`}
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
            </Tab>
          </Tabs>
          <div>
            <Button
              disabled={!stateIsValid}
              buttonStyle={
                hasUnsavedChanges && stateIsValid ? 'primary' : 'default'
              }
              buttonSize="small"
              className="m-r-5"
              data-test="AdhocMetricEdit#save"
              onClick={this.onSave}
              cta
            >
              Save
            </Button>
            <Button
              buttonSize="small"
              onClick={this.props.onClose}
              data-test="AdhocMetricEdit#cancel"
              cta
            >
              Close
            </Button>
            <i
              role="button"
              aria-label="Resize"
              tabIndex={0}
              onMouseDown={this.onDragDown}
              className="fa fa-expand edit-popover-resize text-muted"
            />
          </div>
        </ThemeProvider>
      </Popover>
    );
  }
}
AdhocMetricEditPopover.propTypes = propTypes;
AdhocMetricEditPopover.defaultProps = defaultProps;
