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
import { useState, useEffect, useRef } from 'react';
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
import { EmptyState } from 'src/components/EmptyState';
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
  handleDatasetModal: PropTypes.func,
};

const defaultProps = {
  columns: [],
  getCurrentTab: noOp,
  isNewMetric: false,
  handleDatasetModal: noOp,
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

const AdhocMetricEditPopover = props => {
  const {
    adhocMetric: propsAdhocMetric,
    savedMetric: propsSavedMetric,
    columns,
    savedMetricsOptions,
    onChange,
    onClose,
    onResize,
    getCurrentTab,
    getCurrentLabel,
    datasource,
    isNewMetric,
    isLabelModified,
    handleDatasetModal,
    ...popoverProps
  } = props;

  const [adhocMetric, setAdhocMetric] = useState(propsAdhocMetric);
  const [savedMetric, setSavedMetric] = useState(propsSavedMetric);
  const [width, setWidth] = useState(POPOVER_INITIAL_WIDTH);
  const [height, setHeight] = useState(POPOVER_INITIAL_HEIGHT);

  const aceEditorRef = useRef(null);
  const dragStartRef = useRef({
    x: 0,
    y: 0,
    width: POPOVER_INITIAL_WIDTH,
    height: POPOVER_INITIAL_HEIGHT,
  });

  // Helper functions
  const getDefaultTab = () => {
    if (
      isDefined(propsAdhocMetric.column) ||
      isDefined(propsAdhocMetric.sqlExpression)
    ) {
      return propsAdhocMetric.expressionType;
    }
    if (
      (isNewMetric || propsSavedMetric?.metric_name) &&
      Array.isArray(savedMetricsOptions) &&
      savedMetricsOptions.length > 0
    ) {
      return SAVED_TAB_KEY;
    }
    return propsAdhocMetric.expressionType;
  };

  // "Saved" is a default tab unless there are no saved metrics for dataset
  const defaultActiveTabKey = getDefaultTab();

  const onMouseMove = e => {
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
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
  };

  const refreshAceEditor = () => {
    setTimeout(() => {
      if (aceEditorRef.current) {
        aceEditorRef.current.editor?.resize?.();
      }
    }, 0);
  };

  useEffect(() => {
    getCurrentTab(defaultActiveTabKey);

    // Add mouseup event listener
    document.addEventListener('mouseup', onMouseUp);

    // Cleanup
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  useEffect(() => {
    getCurrentLabel({
      savedMetricLabel: savedMetric?.verbose_name || savedMetric?.metric_name,
      adhocMetricLabel: adhocMetric?.getDefaultLabel(),
    });
  }, [
    adhocMetric?.sqlExpression,
    adhocMetric?.aggregate,
    adhocMetric?.column?.column_name,
    savedMetric?.metric_name,
  ]);

  const onSave = () => {
    const metric = savedMetric?.metric_name ? savedMetric : adhocMetric;
    const oldMetric = propsSavedMetric?.metric_name
      ? propsSavedMetric
      : propsAdhocMetric;
    onChange(
      {
        ...metric,
      },
      oldMetric,
    );
    onClose();
  };

  const onResetStateAndClose = () => {
    setAdhocMetric(propsAdhocMetric);
    setSavedMetric(propsSavedMetric);
    onClose();
  };

  const onColumnChange = columnName => {
    const column = columns.find(column => column.column_name === columnName);
    setAdhocMetric(prevAdhocMetric =>
      prevAdhocMetric.duplicateWith({
        column,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    );
    setSavedMetric(undefined);
  };

  const onAggregateChange = aggregate => {
    // we construct this object explicitly to overwrite the value in the case aggregate is null
    setAdhocMetric(prevAdhocMetric =>
      prevAdhocMetric.duplicateWith({
        aggregate,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    );
    setSavedMetric(undefined);
  };

  const onSavedMetricChange = savedMetricName => {
    const newSavedMetric = savedMetricsOptions.find(
      metric => metric.metric_name === savedMetricName,
    );
    setSavedMetric(newSavedMetric);
    setAdhocMetric(prevAdhocMetric =>
      prevAdhocMetric.duplicateWith({
        column: undefined,
        aggregate: undefined,
        sqlExpression: undefined,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    );
  };

  const onSqlExpressionChange = sqlExpression => {
    setAdhocMetric(prevAdhocMetric =>
      prevAdhocMetric.duplicateWith({
        sqlExpression,
        expressionType: EXPRESSION_TYPES.SQL,
      }),
    );
    setSavedMetric(undefined);
  };

  const onDragDown = e => {
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width,
      height,
    };
    document.addEventListener('mousemove', onMouseMove);
  };

  // These functions are already defined above

  const onTabChange = tab => {
    refreshAceEditor();
    getCurrentTab(tab);
  };

  const handleAceEditorRef = ref => {
    if (ref) {
      aceEditorRef.current = ref;
    }
  };

  // This function is already defined above

  const renderColumnOption = option => {
    const column = { ...option };
    if (column.metric_name && !column.verbose_name) {
      column.verbose_name = column.metric_name;
    }
    return <StyledColumnOption column={column} showType />;
  };

  const renderMetricOption = metric => (
    <StyledMetricOption metric={metric} showType />
  );

  const keywords = sqlKeywords.concat(getColumnKeywords(columns));

  const columnValue =
    (adhocMetric.column && adhocMetric.column.column_name) ||
    adhocMetric.inferSqlExpressionColumn();

  // autofocus on column if there's no value in column; otherwise autofocus on aggregate
  const columnSelectProps = {
    ariaLabel: t('Select column'),
    placeholder: t('%s column(s)', columns.length),
    value: columnValue,
    onChange: onColumnChange,
    allowClear: true,
    autoFocus: !columnValue,
  };

  const aggregateSelectProps = {
    ariaLabel: t('Select aggregate options'),
    placeholder: t('%s aggregates(s)', AGGREGATES_OPTIONS.length),
    value: adhocMetric.aggregate || adhocMetric.inferSqlExpressionAggregate(),
    onChange: onAggregateChange,
    allowClear: true,
    autoFocus: !!columnValue,
  };

  const savedSelectProps = {
    ariaLabel: t('Select saved metrics'),
    placeholder: t('%s saved metric(s)', savedMetricsOptions?.length ?? 0),
    value: savedMetric?.metric_name,
    onChange: onSavedMetricChange,
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
        defaultActiveKey={defaultActiveTabKey}
        className="adhoc-metric-edit-tabs"
        style={{ height, width }}
        onChange={onTabChange}
        allowOverflow
      >
        <Tabs.TabPane key={SAVED_TAB_KEY} tab={t('Saved')}>
          {ensureIsArray(savedMetricsOptions).length > 0 ? (
            <FormItem label={t('Saved metric')}>
              <StyledSelect
                options={ensureIsArray(savedMetricsOptions).map(metric => ({
                  value: metric.metric_name,
                  label: metric.metric_name,
                  customLabel: renderMetricOption(metric),
                  key: metric.id,
                }))}
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
                      handleDatasetModal(true);
                      onClose();
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
                customLabel: renderColumnOption(column),
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
            ref={handleAceEditorRef}
            keywords={keywords}
            height={`${height - 80}px`}
            onChange={onSqlExpressionChange}
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
          onClick={onResetStateAndClose}
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
          onClick={onSave}
          cta
        >
          {t('Save')}
        </Button>
        {/* TODO: Remove fa-icon */}
        {/* eslint-disable-next-line icons/no-fa-icons-usage */}
        <i
          role="button"
          aria-label="Resize"
          tabIndex={0}
          onMouseDown={onDragDown}
          className="fa fa-expand edit-popover-resize text-muted"
        />
      </div>
    </Form>
  );
};

AdhocMetricEditPopover.propTypes = propTypes;
AdhocMetricEditPopover.defaultProps = defaultProps;

export default AdhocMetricEditPopover;
