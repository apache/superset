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
import Tabs from '@superset-ui/core/components/Tabs';
import {
  Button,
  EmptyState,
  Form,
  FormItem,
  Icons,
  Select,
  Tooltip,
  SQLEditor,
} from '@superset-ui/core/components';
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
      min-width: ${({ theme }) => `${theme.sizeUnit * 4}px`};
    }
    & > .option-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

export const SAVED_TAB_KEY = 'SAVED';

export default class AdhocMetricEditPopover extends PureComponent {
  aceEditorRef: $TSFixMe;

  dragStartHeight: $TSFixMe;

  dragStartWidth: $TSFixMe;

  dragStartX: $TSFixMe;

  dragStartY: $TSFixMe;

  // "Saved" is a default tab unless there are no saved metrics for dataset
  defaultActiveTabKey = this.getDefaultTab();

  constructor(props: $TSFixMe) {
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
      // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      adhocMetric: this.props.adhocMetric,
      // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      savedMetric: this.props.savedMetric,
      width: POPOVER_INITIAL_WIDTH,
      height: POPOVER_INITIAL_HEIGHT,
    };
    document.addEventListener('mouseup', this.onMouseUp);
  }

  componentDidMount() {
    // @ts-expect-error TS(2339): Property 'getCurrentTab' does not exist on type 'R... Remove this comment to see the full error message
    this.props.getCurrentTab(this.defaultActiveTabKey);
  }

  componentDidUpdate(prevProps: $TSFixMe, prevState: $TSFixMe) {
    if (
      prevState.adhocMetric?.sqlExpression !==
        // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
        this.state.adhocMetric?.sqlExpression ||
      // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      prevState.adhocMetric?.aggregate !== this.state.adhocMetric?.aggregate ||
      prevState.adhocMetric?.column?.column_name !==
        // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
        this.state.adhocMetric?.column?.column_name ||
      // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      prevState.savedMetric?.metric_name !== this.state.savedMetric?.metric_name
    ) {
      // @ts-expect-error TS(2339): Property 'getCurrentLabel' does not exist on type ... Remove this comment to see the full error message
      this.props.getCurrentLabel({
        savedMetricLabel:
          // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
          this.state.savedMetric?.verbose_name ||
          // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
          this.state.savedMetric?.metric_name,
        // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
        adhocMetricLabel: this.state.adhocMetric?.getDefaultLabel(),
      });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  getDefaultTab() {
    // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
    const { adhocMetric, savedMetric } = this.state;

    const metric = savedMetric?.metric_name ? savedMetric : adhocMetric;
    // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
    const oldMetric = this.props.savedMetric?.metric_name
      ? // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
        this.props.savedMetric
      : // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
        this.props.adhocMetric;
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(
      {
        ...metric,
      },
      oldMetric,
    );
    // @ts-expect-error TS(2339): Property 'onClose' does not exist on type 'Readonl... Remove this comment to see the full error message
    this.props.onClose();
  }

  onResetStateAndClose() {
    this.setState(
      {
        // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
        adhocMetric: this.props.adhocMetric,
        // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
        savedMetric: this.props.savedMetric,
      },
      // @ts-expect-error TS(2339): Property 'onClose' does not exist on type 'Readonl... Remove this comment to see the full error message
      this.props.onClose,
    );
  }

  onColumnChange(columnName: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'columns' does not exist on type 'Readonl... Remove this comment to see the full error message
    const column = this.props.columns.find(
      (column: $TSFixMe) => column.column_name === columnName,
    );
    this.setState(prevState => ({
      // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      adhocMetric: prevState.adhocMetric.duplicateWith({
        column,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
      savedMetric: undefined,
    }));
  }

  onAggregateChange(aggregate: $TSFixMe) {
    // we construct this object explicitly to overwrite the value in the case aggregate is null
    this.setState(prevState => ({
      // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      adhocMetric: prevState.adhocMetric.duplicateWith({
        aggregate,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
      savedMetric: undefined,
    }));
  }

  onSavedMetricChange(savedMetricName: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'savedMetricsOptions' does not exist on t... Remove this comment to see the full error message
    const savedMetric = this.props.savedMetricsOptions.find(
      (metric: $TSFixMe) => metric.metric_name === savedMetricName,
    );
    this.setState(prevState => ({
      savedMetric,
      // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      adhocMetric: prevState.adhocMetric.duplicateWith({
        column: undefined,
        aggregate: undefined,
        sqlExpression: undefined,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    }));
  }

  onSqlExpressionChange(sqlExpression: $TSFixMe) {
    this.setState(prevState => ({
      // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      adhocMetric: prevState.adhocMetric.duplicateWith({
        sqlExpression,
        expressionType: EXPRESSION_TYPES.SQL,
      }),
      savedMetric: undefined,
    }));
  }

  onDragDown(e: $TSFixMe) {
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    // @ts-expect-error TS(2339): Property 'width' does not exist on type 'Readonly<... Remove this comment to see the full error message
    this.dragStartWidth = this.state.width;
    // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
    this.dragStartHeight = this.state.height;
    document.addEventListener('mousemove', this.onMouseMove);
  }

  onMouseMove(e: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'onResize' does not exist on type 'Readon... Remove this comment to see the full error message
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

  onTabChange(tab: $TSFixMe) {
    this.refreshAceEditor();
    // @ts-expect-error TS(2339): Property 'getCurrentTab' does not exist on type 'R... Remove this comment to see the full error message
    this.props.getCurrentTab(tab);
  }

  handleAceEditorRef(ref: $TSFixMe) {
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

  renderColumnOption(option: $TSFixMe) {
    const column = { ...option };
    if (column.metric_name && !column.verbose_name) {
      column.verbose_name = column.metric_name;
    }
    return <StyledColumnOption column={column} showType />;
  }

  renderMetricOption(savedMetric: $TSFixMe) {
    return <StyledMetricOption metric={savedMetric} showType />;
  }

  render() {
    const {
      // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      adhocMetric: propsAdhocMetric,
      // @ts-expect-error TS(2339): Property 'savedMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      savedMetric: propsSavedMetric,
      // @ts-expect-error TS(2339): Property 'columns' does not exist on type 'Readonl... Remove this comment to see the full error message
      columns,
      // @ts-expect-error TS(2339): Property 'savedMetricsOptions' does not exist on t... Remove this comment to see the full error message
      savedMetricsOptions,
      // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
      onChange,
      // @ts-expect-error TS(2339): Property 'onClose' does not exist on type 'Readonl... Remove this comment to see the full error message
      onClose,
      // @ts-expect-error TS(2339): Property 'onResize' does not exist on type 'Readon... Remove this comment to see the full error message
      onResize,
      // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
      datasource,
      // @ts-expect-error TS(2339): Property 'isNewMetric' does not exist on type 'Rea... Remove this comment to see the full error message
      isNewMetric,
      // @ts-expect-error TS(2339): Property 'isLabelModified' does not exist on type ... Remove this comment to see the full error message
      isLabelModified,
      ...popoverProps
    } = this.props;
    // @ts-expect-error TS(2339): Property 'adhocMetric' does not exist on type 'Rea... Remove this comment to see the full error message
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
          // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
          style={{ height: this.state.height, width: this.state.width }}
          onChange={this.onTabChange}
          allowOverflow
          items={[
            {
              key: SAVED_TAB_KEY,
              label: t('Saved'),
              children:
                ensureIsArray(savedMetricsOptions).length > 0 ? (
                  <FormItem label={t('Saved metric')}>
                    <StyledSelect
                      options={ensureIsArray(savedMetricsOptions).map(
                        savedMetric => ({
                          value: savedMetric.metric_name,
                          label: this.renderMetricOption(savedMetric),
                          key: savedMetric.id,
                        }),
                      )}
                      {...savedSelectProps}
                    />
                  </FormItem>
                ) : datasource.type === DatasourceType.Table ? (
                  <EmptyState
                    image="empty.svg"
                    size="small"
                    title={t('No saved metrics found')}
                    description={t(
                      'Add metrics to dataset in "Edit datasource" modal',
                    )}
                  />
                ) : (
                  <EmptyState
                    image="empty.svg"
                    size="small"
                    title={t('No saved metrics found')}
                    description={
                      <>
                        <span
                          tabIndex={0}
                          role="button"
                          onClick={() => {
                            // @ts-expect-error TS(2339): Property 'handleDatasetModal' does not exist on ty... Remove this comment to see the full error message
                            this.props.handleDatasetModal(true);
                            // @ts-expect-error TS(2339): Property 'onClose' does not exist on type 'Readonl... Remove this comment to see the full error message
                            this.props.onClose();
                          }}
                        >
                          {t('Create a dataset')}
                        </span>
                        {t(' to add metrics')}
                      </>
                    }
                  />
                ),
            },
            {
              key: EXPRESSION_TYPES.SIMPLE,
              // @ts-expect-error TS(2339): Property 'disallow_adhoc_metrics' does not exist o... Remove this comment to see the full error message
              label: extra.disallow_adhoc_metrics ? (
                <Tooltip
                  title={t(
                    'Simple ad-hoc metrics are not enabled for this dataset',
                  )}
                >
                  {t('Simple')}
                </Tooltip>
              ) : (
                t('Simple')
              ),
              // @ts-expect-error TS(2339): Property 'disallow_adhoc_metrics' does not exist o... Remove this comment to see the full error message
              disabled: extra.disallow_adhoc_metrics,
              children: (
                <>
                  <FormItem label={t('column')}>
                    <Select
                      options={columns.map((column: $TSFixMe) => ({
                        value: column.column_name,
                        key: column.id,
                        label: this.renderColumnOption(column),
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
                </>
              ),
            },
            {
              key: EXPRESSION_TYPES.SQL,
              // @ts-expect-error TS(2339): Property 'disallow_adhoc_metrics' does not exist o... Remove this comment to see the full error message
              label: extra.disallow_adhoc_metrics ? (
                <Tooltip
                  title={t(
                    'Custom SQL ad-hoc metrics are not enabled for this dataset',
                  )}
                >
                  {t('Custom SQL')}
                </Tooltip>
              ) : (
                t('Custom SQL')
              ),
              // @ts-expect-error TS(2339): Property 'disallow_adhoc_metrics' does not exist o... Remove this comment to see the full error message
              disabled: extra.disallow_adhoc_metrics,
              children: (
                <SQLEditor
                  data-test="sql-editor"
                  showLoadingForImport
                  ref={this.handleAceEditorRef}
                  keywords={keywords}
                  // @ts-expect-error TS(2339): Property 'height' does not exist on type 'Readonly... Remove this comment to see the full error message
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
              ),
            },
          ]}
        />
        <div>
          <Button
            buttonSize="small"
            buttonStyle="secondary"
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
          <Icons.ArrowsAltOutlined
            role="button"
            aria-label="Resize"
            tabIndex={0}
            onMouseDown={this.onDragDown}
            className="edit-popover-resize"
          />
        </div>
      </Form>
    );
  }
}
// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
AdhocMetricEditPopover.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
AdhocMetricEditPopover.defaultProps = defaultProps;
