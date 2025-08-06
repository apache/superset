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
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import {
  AdhocColumn,
  isAdhocColumn,
  t,
  styled,
  css,
  DatasourceType,
  Metric,
  QueryFormMetric,
  // useTheme,
} from '@superset-ui/core';
import { ColumnMeta, isSavedExpression } from '@superset-ui/chart-controls';
import Tabs from '@superset-ui/core/components/Tabs';
import {
  Button,
  Form,
  FormItem,
  Select,
  SQLEditor,
  EmptyState,
} from '@superset-ui/core/components';

import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { getColumnKeywords } from 'src/explore/controlUtils/getColumnKeywords';
import { StyledColumnOption } from 'src/explore/components/optionRenderers';
import {
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
} from 'src/explore/constants';
import { ExplorePageState } from 'src/explore/types';
import useResizeButton from './useResizeButton';

const TABS_KEYS = {
  SAVED: 'saved',
  SIMPLE: 'simple',
  SQL_EXPRESSION: 'sqlExpression',
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

const MetricOptionContainer = styled.div`
  display: flex;
  align-items: center;
`;

const MetricIcon = styled.span`
  margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }) => theme.colorSuccess};
`;

const MetricLabel = styled.span`
  color: ${({ theme }) => theme.colorText};
`;

export interface ColumnSelectPopoverProps {
  columns: ColumnMeta[];
  editedColumn?: ColumnMeta | AdhocColumn;
  onChange: (column: ColumnMeta | AdhocColumn | Metric) => void;
  onClose: () => void;
  hasCustomLabel: boolean;
  setLabel: (title: string) => void;
  getCurrentTab: (tab: string) => void;
  label: string;
  isTemporal?: boolean;
  setDatasetModal?: Dispatch<SetStateAction<boolean>>;
  disabledTabs?: Set<string>;
  metrics?: Metric[];
  selectedMetrics?: QueryFormMetric[];
}

const getInitialColumnValues = (
  editedColumn?: ColumnMeta | AdhocColumn,
): [AdhocColumn?, ColumnMeta?, ColumnMeta?] => {
  if (!editedColumn) {
    return [undefined, undefined, undefined];
  }
  if (isAdhocColumn(editedColumn)) {
    return [editedColumn, undefined, undefined];
  }
  if (isSavedExpression(editedColumn)) {
    return [undefined, editedColumn, undefined];
  }
  return [undefined, undefined, editedColumn];
};

const ColumnSelectPopover = ({
  columns,
  editedColumn,
  getCurrentTab,
  hasCustomLabel,
  isTemporal,
  label,
  onChange,
  onClose,
  setDatasetModal,
  setLabel,
  disabledTabs = new Set<'saved' | 'simple' | 'sqlExpression'>(),
  metrics = [],
  selectedMetrics = [],
}: ColumnSelectPopoverProps) => {
  // const theme = useTheme(); // Unused variable
  const datasourceType = useSelector<ExplorePageState, string | undefined>(
    state => state.explore.datasource.type,
  );
  const [initialLabel] = useState(label);
  const [initialAdhocColumn, initialCalculatedColumn, initialSimpleColumn] =
    getInitialColumnValues(editedColumn);

  const [adhocColumn, setAdhocColumn] = useState<AdhocColumn | undefined>(
    initialAdhocColumn,
  );
  const [selectedCalculatedColumn, setSelectedCalculatedColumn] = useState<
    ColumnMeta | undefined
  >(initialCalculatedColumn);
  const [selectedSimpleColumn, setSelectedSimpleColumn] = useState<
    ColumnMeta | undefined
  >(initialSimpleColumn);
  const [selectedMetric, setSelectedMetric] = useState<Metric | undefined>(
    undefined,
  );
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const [resizeButton, width, height] = useResizeButton(
    POPOVER_INITIAL_WIDTH,
    POPOVER_INITIAL_HEIGHT,
  );

  const sqlEditorRef = useRef(null);

  const [calculatedColumns, simpleColumns] = useMemo(
    () =>
      columns?.reduce(
        (acc: [ColumnMeta[], ColumnMeta[]], column: ColumnMeta) => {
          if (column.expression) {
            acc[0].push(column);
          } else {
            acc[1].push(column);
          }
          return acc;
        },
        [[], []],
      ),
    [columns],
  );

  // Filter metrics that are already selected in the chart
  const availableMetrics = useMemo(() => {
    if (!metrics?.length) return [];
    const selectedMetricsSet = new Set(selectedMetrics);
    return metrics.filter(metric => selectedMetricsSet.has(metric.metric_name));
  }, [metrics, selectedMetrics]);

  const columnMap = useMemo(
    () => Object.fromEntries(simpleColumns.map(col => [col.column_name, col])),
    [simpleColumns],
  );
  const metricMap = useMemo(
    () =>
      Object.fromEntries(
        availableMetrics.map(metric => [metric.metric_name, metric]),
      ),
    [availableMetrics],
  );

  const onSqlExpressionChange = useCallback(
    sqlExpression => {
      setAdhocColumn({ label, sqlExpression, expressionType: 'SQL' });
      setSelectedSimpleColumn(undefined);
      setSelectedCalculatedColumn(undefined);
      setSelectedMetric(undefined);
    },
    [label],
  );

  const onCalculatedColumnChange = useCallback(
    selectedColumnName => {
      const selectedColumn = calculatedColumns.find(
        col => col.column_name === selectedColumnName,
      );
      setSelectedCalculatedColumn(selectedColumn);
      setSelectedSimpleColumn(undefined);
      setSelectedMetric(undefined);
      setAdhocColumn(undefined);
      setLabel(
        selectedColumn?.verbose_name || selectedColumn?.column_name || '',
      );
    },
    [calculatedColumns, setLabel],
  );

  const onSimpleColumnChange = useCallback(
    selectedColumnName => {
      const selectedColumn = simpleColumns.find(
        col => col.column_name === selectedColumnName,
      );
      setSelectedCalculatedColumn(undefined);
      setSelectedSimpleColumn(selectedColumn);
      setSelectedMetric(undefined);
      setAdhocColumn(undefined);
      setLabel(
        selectedColumn?.verbose_name || selectedColumn?.column_name || '',
      );
    },
    [setLabel, simpleColumns],
  );

  const onSimpleMetricChange = useCallback(
    selectedMetricName => {
      const selectedMetric = availableMetrics.find(
        metric => metric.metric_name === selectedMetricName,
      );
      setSelectedCalculatedColumn(undefined);
      setSelectedSimpleColumn(undefined);
      setSelectedMetric(selectedMetric);
      setAdhocColumn(undefined);
      setLabel(
        selectedMetric?.verbose_name || selectedMetric?.metric_name || '',
      );
    },
    [setLabel, availableMetrics],
  );

  const onSimpleItemChange = useCallback(
    selectedValue => {
      const selectedColumn = columnMap[selectedValue];
      if (selectedColumn) {
        onSimpleColumnChange(selectedValue);
        return;
      }

      const selectedMetric = metricMap[selectedValue];
      if (selectedMetric) {
        onSimpleMetricChange(selectedValue);
      }
    },
    [columnMap, metricMap, onSimpleColumnChange, onSimpleMetricChange],
  );

  const defaultActiveTabKey = initialAdhocColumn
    ? 'sqlExpression'
    : selectedCalculatedColumn
      ? 'saved'
      : 'simple';

  useEffect(() => {
    getCurrentTab(defaultActiveTabKey);
    setSelectedTab(defaultActiveTabKey);
  }, [defaultActiveTabKey, getCurrentTab, setSelectedTab]);

  useEffect(() => {
    /* if the adhoc column is not set (because it was never edited) but the
     * tab is selected and the label has changed, then we need to set the
     * adhoc column manually */
    if (
      adhocColumn === undefined &&
      selectedTab === 'sqlExpression' &&
      hasCustomLabel
    ) {
      const sqlExpression =
        selectedSimpleColumn?.column_name ||
        selectedCalculatedColumn?.expression ||
        '';
      setAdhocColumn({ label, sqlExpression, expressionType: 'SQL' });
    }
  }, [
    adhocColumn,
    defaultActiveTabKey,
    hasCustomLabel,
    getCurrentTab,
    label,
    selectedCalculatedColumn,
    selectedSimpleColumn,
    selectedTab,
  ]);

  const onSave = useCallback(() => {
    if (adhocColumn && adhocColumn.label !== label) {
      adhocColumn.label = label;
    }
    const selectedColumn =
      adhocColumn || selectedCalculatedColumn || selectedSimpleColumn;
    const selectedItem = selectedColumn || selectedMetric;
    if (!selectedItem) {
      return;
    }
    onChange(selectedItem);
    onClose();
  }, [
    adhocColumn,
    label,
    onChange,
    onClose,
    selectedCalculatedColumn,
    selectedSimpleColumn,
    selectedMetric,
  ]);

  const onResetStateAndClose = useCallback(() => {
    setSelectedCalculatedColumn(initialCalculatedColumn);
    setSelectedSimpleColumn(initialSimpleColumn);
    setSelectedMetric(undefined);
    setAdhocColumn(initialAdhocColumn);
    onClose();
  }, [
    initialAdhocColumn,
    initialCalculatedColumn,
    initialSimpleColumn,
    onClose,
  ]);

  const onTabChange = useCallback(
    tab => {
      getCurrentTab(tab);
      setSelectedTab(tab);
      // @ts-ignore
      sqlEditorRef.current?.editor.focus();
    },
    [getCurrentTab],
  );

  const onSqlEditorFocus = useCallback(() => {
    // @ts-ignore
    sqlEditorRef.current?.editor.resize();
  }, []);

  const setDatasetAndClose = () => {
    if (setDatasetModal) {
      setDatasetModal(true);
    }
    onClose();
  };

  const stateIsValid =
    adhocColumn ||
    selectedCalculatedColumn ||
    selectedSimpleColumn ||
    selectedMetric;
  const hasUnsavedChanges =
    initialLabel !== label ||
    selectedCalculatedColumn?.column_name !==
      initialCalculatedColumn?.column_name ||
    selectedSimpleColumn?.column_name !== initialSimpleColumn?.column_name ||
    selectedMetric?.metric_name !== undefined ||
    adhocColumn?.sqlExpression !== initialAdhocColumn?.sqlExpression;

  const savedExpressionsLabel = t('Saved expressions');
  const simpleColumnsLabel = t('Columns and metrics');
  const keywords = useMemo(
    () => sqlKeywords.concat(getColumnKeywords(columns)),
    [columns],
  );

  return (
    <Form layout="vertical" id="metrics-edit-popover">
      <Tabs
        id="adhoc-metric-edit-tabs"
        defaultActiveKey={defaultActiveTabKey}
        onChange={onTabChange}
        className="adhoc-metric-edit-tabs"
        allowOverflow
        css={css`
          height: ${height}px;
          width: ${width}px;
        `}
        items={[
          // Only show Saved tab if not disabled
          ...(disabledTabs.has('saved')
            ? []
            : [
                {
                  key: TABS_KEYS.SAVED,
                  label: t('Saved'),
                  children: (
                    <>
                      {calculatedColumns.length > 0 ? (
                        <FormItem label={savedExpressionsLabel}>
                          <StyledSelect
                            ariaLabel={savedExpressionsLabel}
                            value={selectedCalculatedColumn?.column_name}
                            onChange={onCalculatedColumnChange}
                            allowClear
                            autoFocus={!selectedCalculatedColumn}
                            placeholder={t(
                              '%s column(s)',
                              calculatedColumns.length,
                            )}
                            options={calculatedColumns.map(
                              calculatedColumn => ({
                                value: calculatedColumn.column_name,
                                label: (
                                  <StyledColumnOption
                                    column={calculatedColumn}
                                    showType
                                  />
                                ),
                                key: calculatedColumn.column_name,
                              }),
                            )}
                          />
                        </FormItem>
                      ) : datasourceType === DatasourceType.Table ? (
                        <EmptyState
                          image="empty.svg"
                          size="small"
                          title={
                            isTemporal
                              ? t('No temporal columns found')
                              : t('No saved expressions found')
                          }
                          description={
                            isTemporal
                              ? t(
                                  'Add calculated temporal columns to dataset in "Edit datasource" modal',
                                )
                              : t(
                                  'Add calculated columns to dataset in "Edit datasource" modal',
                                )
                          }
                        />
                      ) : (
                        <EmptyState
                          image="empty.svg"
                          size="small"
                          title={
                            isTemporal
                              ? t('No temporal columns found')
                              : t('No saved expressions found')
                          }
                          description={
                            isTemporal ? (
                              <>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={setDatasetAndClose}
                                >
                                  {t('Create a dataset')}
                                </span>{' '}
                                {t(' to mark a column as a time column')}
                              </>
                            ) : (
                              <>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={setDatasetAndClose}
                                >
                                  {t('Create a dataset')}
                                </span>{' '}
                                {t(' to add calculated columns')}
                              </>
                            )
                          }
                        />
                      )}
                    </>
                  ),
                },
              ]),
          {
            key: TABS_KEYS.SIMPLE,
            label: t('Simple'),
            children: (
              <>
                {isTemporal && simpleColumns.length === 0 ? (
                  <EmptyState
                    image="empty.svg"
                    size="small"
                    title={t('No temporal columns found')}
                    description={
                      datasourceType === DatasourceType.Table ? (
                        t(
                          'Mark a column as temporal in "Edit datasource" modal',
                        )
                      ) : (
                        <>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={setDatasetAndClose}
                          >
                            {t('Create a dataset')}
                          </span>{' '}
                          {t(' to mark a column as a time column')}
                        </>
                      )
                    }
                  />
                ) : (
                  <FormItem label={simpleColumnsLabel}>
                    <Select
                      ariaLabel={simpleColumnsLabel}
                      value={
                        selectedSimpleColumn?.column_name ||
                        selectedMetric?.metric_name
                      }
                      onChange={onSimpleItemChange}
                      allowClear
                      autoFocus={!selectedSimpleColumn && !selectedMetric}
                      placeholder={t(
                        '%s item(s)',
                        simpleColumns.length + availableMetrics.length,
                      )}
                      options={[
                        ...simpleColumns.map(simpleColumn => ({
                          value: simpleColumn.column_name,
                          label: (
                            <StyledColumnOption
                              column={simpleColumn}
                              showType
                            />
                          ),
                          key: `column-${simpleColumn.column_name}`,
                        })),
                        ...availableMetrics.map(metric => ({
                          value: metric.metric_name,
                          label: (
                            <MetricOptionContainer>
                              <MetricIcon>ƒ</MetricIcon>
                              <MetricLabel>
                                {metric.verbose_name || metric.metric_name}
                              </MetricLabel>
                            </MetricOptionContainer>
                          ),
                          key: `metric-${metric.metric_name}`,
                        })),
                      ]}
                    />
                  </FormItem>
                )}
              </>
            ),
          },
          // Only show Custom SQL tab if not disabled
          ...(disabledTabs.has('sqlExpression')
            ? []
            : [
                {
                  key: TABS_KEYS.SQL_EXPRESSION,
                  label: t('Custom SQL'),
                  children: (
                    <>
                      <SQLEditor
                        value={
                          adhocColumn?.sqlExpression ||
                          selectedSimpleColumn?.column_name ||
                          selectedCalculatedColumn?.expression
                        }
                        onFocus={onSqlEditorFocus}
                        showLoadingForImport
                        onChange={onSqlExpressionChange}
                        width="100%"
                        height={`${height - 80}px`}
                        showGutter={false}
                        editorProps={{ $blockScrolling: true }}
                        enableLiveAutocompletion
                        className="filter-sql-editor"
                        wrapEnabled
                        ref={sqlEditorRef}
                        keywords={keywords}
                      />
                    </>
                  ),
                },
              ]),
        ]}
      />

      <div>
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={onResetStateAndClose}
          cta
        >
          {t('Close')}
        </Button>
        <Button
          disabled={!stateIsValid || !hasUnsavedChanges}
          buttonStyle="primary"
          buttonSize="small"
          onClick={onSave}
          data-test="ColumnEdit#save"
          cta
        >
          {t('Save')}
        </Button>
        {resizeButton}
      </div>
    </Form>
  );
};

export default ColumnSelectPopover;
