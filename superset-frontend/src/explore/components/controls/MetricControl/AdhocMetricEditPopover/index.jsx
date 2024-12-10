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
import { PureComponent } from 'react';
import PropTypes from 'prop-types';
import {
  isDefined,
  t,
  styled,
  ensureIsArray,
  DatasourceType,
} from '@superset-ui/core';
import Tabs from 'src/components/Tabs';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import { EmptyStateSmall } from 'src/components/EmptyState';
import { Form, FormItem } from 'src/components/Form';
import { SQLEditor } from 'src/components/AsyncAceEditor';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { noOp } from 'src/utils/common';
import {
  AGGREGATES_OPTIONS,
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
} from 'src/explore/constants';
import columnType from 'src/explore/components/controls/MetricControl/columnType';
import savedMetricType from 'src/explore/components/controls/MetricControl/savedMetricType';
import AdhocMetric, {
  EXPRESSION_TYPES,
} from 'src/explore/components/controls/MetricControl/AdhocMetric';
import {
  StyledMetricOption,
  StyledColumnOption,
} from 'src/explore/components/optionRenderers';
import { getColumnKeywords } from 'src/explore/controlUtils/getColumnKeywords';

const propTypes = {
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  getCurrentTab: PropTypes.func,
  getCurrentLabel: PropTypes.func,
  adhocMetric: PropTypes.instanceOf(AdhocMetric).isRequired,
  columns: PropTypes.arrayOf(columnType),
  savedMetricsOptions: PropTypes.arrayOf(savedMetricType),
  savedMetric: savedMetricType,
  datasource: PropTypes.object,
  isNewMetric: PropTypes.bool,
  isLabelModified: PropTypes.bool,
};

const defaultProps = {
  columns: [],
  getCurrentTab: noOp,
  isNewMetric: false,
};

const StyledSelect = styled(Select)`
  .metric-option {
    & > svg {
      min-width: ${({ theme }) => `${theme.gridUnit * 4}px`};
    }
    & > .option-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

export const SAVED_TAB_KEY = 'SAVED';

export default class AdhocMetricEditPopover extends PureComponent {
  // "Saved" is a default tab unless there are no saved metrics for dataset
  defaultActiveTabKey = this.getDefaultTab();

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
    this.getDefaultTab = this.getDefaultTab.bind(this);

    this.state = {
      adhocMetric: this.props.adhocMetric,
      savedMetric: this.props.savedMetric,
      width: POPOVER_INITIAL_WIDTH,
      height: POPOVER_INITIAL_HEIGHT,
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

  getDefaultTab() {
    const { adhocMetric, savedMetric, savedMetricsOptions, isNewMetric } =
      this.props;
    if (isDefined(adhocMetric.column) || isDefined(adhocMetric.sqlExpression)) {
      return adhocMetric.expressionType;
    }
    if (
      (isNewMetric || savedMetric.metric_name) &&
      Array.isArray(savedMetricsOptions) &&
      savedMetricsOptions.length > 0
    ) {
      return SAVED_TAB_KEY;
    }
    return adhocMetric.expressionType;
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

  onColumnChange(columnName) {
    const column = this.props.columns.find(
      column => column.column_name === columnName,
    );
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

  onSavedMetricChange(savedMetricName) {
    const savedMetric = this.props.savedMetricsOptions.find(
      metric => metric.metric_name === savedMetricName,
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
        this.aceEditorRef.editor?.resize?.();
      }
    }, 0);
  }

  renderColumnOption(option) {
    const column = { ...option };
    if (column.metric_name && !column.verbose_name) {
      column.verbose_name = column.metric_name;
    }
    return <StyledColumnOption column={column} showType />;
  }

  renderMetricOption(savedMetric) {
    return <StyledMetricOption metric={savedMetric} showType />;
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
      datasource,
      isNewMetric,
      isLabelModified,
      ...popoverProps
    } = this.props;
    const { adhocMetric, savedMetric } = this.state;
    const keywords = sqlKeywords.concat(getColumnKeywords(columns));

    const columnValue =
      (adhocMetric.column && adhocMetric.column.column_name) ||
      adhocMetric.inferSqlExpressionColumn();

    // autofocus on column if there's no value in column; otherwise autofocus on aggregate
    const columnSelectProps = {
      ariaLabel: t('Select column'),
      placeholder: t('%s column(s)', columns.length),
      value: columnValue,
      onChange: this.onColumnChange,
      allowClear: true,
      autoFocus: !columnValue,
    };

    const aggregateSelectProps = {
      ariaLabel: t('Select aggregate options'),
      placeholder: t('%s aggregates(s)', AGGREGATES_OPTIONS.length),
      value: adhocMetric.aggregate || adhocMetric.inferSqlExpressionAggregate(),
      onChange: this.onAggregateChange,
      allowClear: true,
      autoFocus: !!columnValue,
    };

    const savedSelectProps = {
      ariaLabel: t('Select saved metrics'),
      placeholder: t('%s saved metric(s)', savedMetricsOptions?.length ?? 0),
      value: savedMetric?.metric_name,
      onChange: this.onSavedMetricChange,
      allowClear: true,
      autoFocus: true,
    };

    const stateIsValid = adhocMetric.isValid() || savedMetric?.metric_name;
    const hasUnsavedChanges =
      isLabelModified ||
      isNewMetric ||
      !adhocMetric.equals(propsAdhocMetric) ||
      (!(
        typeof savedMetric?.metric_name === 'undefined' &&
        typeof propsSavedMetric?.metric_name === 'undefined'
      ) &&
        savedMetric?.metric_name !== propsSavedMetric?.metric_name);

    let extra = {};
    if (datasource?.extra) {
      try {
        extra = JSON.parse(datasource.extra);
      } catch {} // eslint-disable-line no-empty
    }

    return (
      <Form
        layout="vertical"
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
            {ensureIsArray(savedMetricsOptions).length > 0 ? (
              <FormItem label={t('Saved metric')}>
                <StyledSelect
                  options={ensureIsArray(savedMetricsOptions).map(
                    savedMetric => ({
                      value: savedMetric.metric_name,
                      label: savedMetric.metric_name,
                      customLabel: this.renderMetricOption(savedMetric),
                      key: savedMetric.id,
                    }),
                  )}
                  {...savedSelectProps}
                />
              </FormItem>
            ) : datasource.type === DatasourceType.Table ? (
              <EmptyStateSmall
                image="empty.svg"
                title={t('No saved metrics found')}
                description={t(
                  'Add metrics to dataset in "Edit datasource" modal',
                )}
              />
            ) : (
              <EmptyStateSmall
                image="empty.svg"
                title={t('No saved metrics found')}
                description={
                  <>
                    <span
                      tabIndex={0}
                      role="button"
                      onClick={() => {
                        this.props.handleDatasetModal(true);
                        this.props.onClose();
                      }}
                    >
                      {t('Create a dataset')}
                    </span>
                    {t(' to add metrics')}
                  </>
                }
              />
            )}
          </Tabs.TabPane>
          <Tabs.TabPane
            key={EXPRESSION_TYPES.SIMPLE}
            tab={
              extra.disallow_adhoc_metrics ? (
                <Tooltip
                  title={t(
                    'Simple ad-hoc metrics are not enabled for this dataset',
                  )}
                >
                  {t('Simple')}
                </Tooltip>
              ) : (
                t('Simple')
              )
            }
            disabled={extra.disallow_adhoc_metrics}
          >
            <FormItem label={t('column')}>
              <Select
                options={columns.map(column => ({
                  value: column.column_name,
                  label: column.verbose_name || column.column_name,
                  key: column.id,
                  customLabel: this.renderColumnOption(column),
                }))}
                {...columnSelectProps}
              />
            </FormItem>
            <FormItem label={t('aggregate')}>
              <Select
                options={AGGREGATES_OPTIONS.map(option => ({
                  value: option,
                  label: option,
                  key: option,
                }))}
                {...aggregateSelectProps}
              />
            </FormItem>
          </Tabs.TabPane>
          <Tabs.TabPane
            key={EXPRESSION_TYPES.SQL}
            tab={
              extra.disallow_adhoc_metrics ? (
                <Tooltip
                  title={t(
                    'Custom SQL ad-hoc metrics are not enabled for this dataset',
                  )}
                >
                  {t('Custom SQL')}
                </Tooltip>
              ) : (
                t('Custom SQL')
              )
            }
            data-test="adhoc-metric-edit-tab#custom"
            disabled={extra.disallow_adhoc_metrics}
          >
            <SQLEditor
              data-test="sql-editor"
              showLoadingForImport
              ref={this.handleAceEditorRef}
              keywords={keywords}
              height={`${this.state.height - 80}px`}
              onChange={this.onSqlExpressionChange}
              width="100%"
              showGutter={false}
              value={
                adhocMetric.sqlExpression ||
                adhocMetric.translateToSql({ transformCountDistinct: true })
              }
              editorProps={{ $blockScrolling: true }}
              enableLiveAutocompletion
              className="filter-sql-editor"
              wrapEnabled
            />
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
            disabled={!stateIsValid || !hasUnsavedChanges}
            buttonStyle="primary"
            buttonSize="small"
            data-test="AdhocMetricEdit#save"
            onClick={this.onSave}
            cta
          >
            {t('Save')}
          </Button>
          <i
            role="button"
            aria-label="Resize"
            tabIndex={0}
            onMouseDown={this.onDragDown}
            className="fa fa-expand edit-popover-resize text-muted"
          />
        </div>
      </Form>
    );
  }
}
AdhocMetricEditPopover.propTypes = propTypes;
AdhocMetricEditPopover.defaultProps = defaultProps;
