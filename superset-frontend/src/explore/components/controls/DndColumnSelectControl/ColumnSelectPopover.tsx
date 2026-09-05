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
import { editors } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import {
  AdhocColumn,
  isAdhocColumn,
  DatasourceType,
  Metric,
  QueryFormMetric,
} from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/theme';
import {
  ColumnMeta,
  Dataset,
  isSavedExpression,
} from '@superset-ui/chart-controls';
import Tabs from '@superset-ui/core/components/Tabs';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Form,
  FormItem,
  Select,
  EmptyState,
} from '@superset-ui/core/components';

import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { getColumnKeywords } from 'src/explore/controlUtils/getColumnKeywords';
import { StyledColumnOption } from 'src/explore/components/optionRenderers';
import SQLEditorWithValidation from 'src/components/SQLEditorWithValidation';
import {
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
} from 'src/explore/constants';
import { ExplorePageState } from 'src/explore/types';
import {
  selectCompatibility,
  selectCompatibleDimensionNames,
  selectCompatibleMetricNames,
} from 'src/explore/selectors/compatibility';
import useResizeButton from './useResizeButton';
import { getColumnPickerCapabilities } from './utils/pickerCapabilities';

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

const inlineTextButtonCss = css`
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
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
  datasource?: Dataset | null;
}

const INVALID_SELECTION_FEEDBACK_ID = 'column-select-invalid-selection';

const getInitialColumnValues = (
  editedColumn: ColumnMeta | AdhocColumn | undefined,
  savedClassification: boolean,
): [AdhocColumn?, ColumnMeta?, ColumnMeta?] => {
  if (!editedColumn) {
    return [undefined, undefined, undefined];
  }
  if (isAdhocColumn(editedColumn)) {
    return [editedColumn, undefined, undefined];
  }
  // With Saved classification every datasource dimension is a Saved option,
  // so an edited dimension reopens on the Saved tab.
  if (isSavedExpression(editedColumn) || savedClassification) {
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
  datasource,
}: ColumnSelectPopoverProps) => {
  // const theme = useTheme(); // Unused variable
  const reduxDatasource = useSelector<
    ExplorePageState,
    ExplorePageState['explore']['datasource'] | undefined
  >(state => state.explore.datasource);
  const datasourceType = reduxDatasource?.type;
  const capabilities = useMemo(
    () => getColumnPickerCapabilities(reduxDatasource),
    [reduxDatasource],
  );
  const savedClassification = capabilities.dimensionClassification === 'saved';
  const compatibility = useSelector(selectCompatibility);
  const compatibleDimensions = useSelector(selectCompatibleDimensionNames);
  const compatibleMetrics = useSelector(selectCompatibleMetricNames);
  const [initialLabel] = useState(label);
  const [initialAdhocColumn, initialCalculatedColumn, initialSimpleColumn] =
    getInitialColumnValues(editedColumn, savedClassification);

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

  const sqlEditorRef = useRef<editors.EditorHandle>(null);

  const [calculatedColumns, simpleColumns] = useMemo(() => {
    const [calc, simple] = (columns ?? []).reduce(
      (acc: [ColumnMeta[], ColumnMeta[]], column: ColumnMeta) => {
        // Saved classification presents every dimension as a Saved option
        // without requiring (or mutating) an expression on its metadata.
        if (savedClassification || column.expression) {
          acc[0].push(column);
        } else {
          acc[1].push(column);
        }
        return acc;
      },
      [[], []],
    );
    const alpha = (a: ColumnMeta, b: ColumnMeta) =>
      (a.column_name ?? '').localeCompare(b.column_name ?? '');
    return [calc.sort(alpha), simple.sort(alpha)];
  }, [columns, savedClassification]);

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
    (sqlExpression: string) => {
      setAdhocColumn({ label, sqlExpression, expressionType: 'SQL' });
      setSelectedSimpleColumn(undefined);
      setSelectedCalculatedColumn(undefined);
      setSelectedMetric(undefined);
    },
    [label],
  );

  const onCalculatedColumnChange = useCallback(
    (selectedColumnName: string) => {
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
    (selectedColumnName: string) => {
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
    (selectedMetricName: string) => {
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

  // Full reset for the combined pickers' clear (×). antd's ``allowClear``
  // fires ``onChange(undefined)``, which the item dispatchers below can't map
  // to a column or metric, so an explicit clear branch is what returns the
  // control to empty: it drops every selection (column/metric/adhoc) and
  // resets the label.
  const resetSelection = useCallback(() => {
    setSelectedCalculatedColumn(undefined);
    setSelectedSimpleColumn(undefined);
    setSelectedMetric(undefined);
    setAdhocColumn(undefined);
    setLabel('');
  }, [setLabel]);

  const onSimpleItemChange = useCallback(
    (selectedValue?: string) => {
      if (!selectedValue) {
        resetSelection();
        return;
      }
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
    [
      columnMap,
      metricMap,
      onSimpleColumnChange,
      onSimpleMetricChange,
      resetSelection,
    ],
  );

  // With Saved classification the combined column/metric controls surface
  // their metrics in the Saved mode (Simple is disabled), so metric
  // selection keeps working there.
  const onSavedItemChange = useCallback(
    (selectedValue?: string) => {
      if (!selectedValue) {
        resetSelection();
        return;
      }
      if (calculatedColumns.some(col => col.column_name === selectedValue)) {
        onCalculatedColumnChange(selectedValue);
        return;
      }
      if (metricMap[selectedValue]) {
        onSimpleMetricChange(selectedValue);
      }
    },
    [
      calculatedColumns,
      metricMap,
      onCalculatedColumnChange,
      onSimpleMetricChange,
      resetSelection,
    ],
  );

  const effectiveDisabledTabs = useMemo(() => {
    const merged = new Set([...disabledTabs, ...capabilities.disabledModes]);
    // A legacy adhoc value must stay inspectable: keep Custom SQL reachable
    // for viewing even though such a value can no longer be saved.
    if (initialAdhocColumn && savedClassification) {
      merged.delete(TABS_KEYS.SQL_EXPRESSION);
    }
    return merged;
  }, [
    disabledTabs,
    capabilities.disabledModes,
    initialAdhocColumn,
    savedClassification,
  ]);

  const preferredTabKey = initialAdhocColumn
    ? savedClassification
      ? // A legacy adhoc value cannot be re-saved: open the supported mode.
        'saved'
      : 'sqlExpression'
    : selectedCalculatedColumn
      ? 'saved'
      : 'simple';
  const defaultActiveTabKey = !effectiveDisabledTabs.has(preferredTabKey)
    ? preferredTabKey
    : ([TABS_KEYS.SAVED, TABS_KEYS.SIMPLE, TABS_KEYS.SQL_EXPRESSION].find(
        key => !effectiveDisabledTabs.has(key),
      ) ?? preferredTabKey);

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
    // Saved-only datasources never commit adhoc values (legacy or edited);
    // the Save button is disabled in that state, this is a guard.
    if (savedClassification && adhocColumn) {
      return;
    }
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
    savedClassification,
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
    (tab: string) => {
      getCurrentTab(tab);
      setSelectedTab(tab);
      sqlEditorRef.current?.focus();
    },
    [getCurrentTab],
  );

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

  // With Saved classification, a value that can no longer be committed keeps
  // Save disabled until the user explicitly picks a compatible dimension.
  const invalidSelectionFeedback = useMemo(() => {
    if (!savedClassification) {
      return null;
    }
    if (adhocColumn) {
      return t(
        'Custom column values are not supported here. Select a saved dimension to replace this value.',
      );
    }
    if (
      selectedCalculatedColumn &&
      compatibleDimensions != null &&
      !compatibleDimensions.includes(selectedCalculatedColumn.column_name)
    ) {
      return t(
        'This dimension is not compatible with the current selections. Select a compatible dimension.',
      );
    }
    // A metric can be selected while verification is still in flight, so an
    // unfavourable result must also block Save (options are disabled too, but
    // only after the result arrives).
    if (
      selectedMetric &&
      compatibleMetrics != null &&
      !compatibleMetrics.includes(selectedMetric.metric_name)
    ) {
      return t(
        'This metric is not compatible with the current selections. Select a compatible metric.',
      );
    }
    return null;
  }, [
    savedClassification,
    adhocColumn,
    selectedCalculatedColumn,
    compatibleDimensions,
    selectedMetric,
    compatibleMetrics,
  ]);

  const showCompatibilityFailureWarning =
    capabilities.showCompatibilityFailure && compatibility.status === 'failed';

  const savedExpressionsLabel = savedClassification
    ? availableMetrics.length > 0
      ? t('Dimensions and metrics')
      : t('Dimensions')
    : t('Saved expressions');
  const simpleColumnsLabel = t('Columns and metrics');
  const keywords = useMemo(
    () => sqlKeywords.concat(getColumnKeywords(columns)),
    [columns],
  );

  return (
    <Form layout="vertical" id="metrics-edit-popover">
      {showCompatibilityFailureWarning && (
        // Alert renders role="alert" with a polite live region, satisfying
        // the accessible non-blocking feedback contract.
        <Alert
          type="warning"
          closable={false}
          data-test="compatibility-failure-warning"
        >
          {t(
            'Could not verify which dimensions are compatible. All dimensions are shown.',
          )}
        </Alert>
      )}
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
          ...(effectiveDisabledTabs.has('saved')
            ? []
            : [
                {
                  key: TABS_KEYS.SAVED,
                  label: t('Saved'),
                  children: (
                    <>
                      {calculatedColumns.length > 0 ||
                      (savedClassification && availableMetrics.length > 0) ? (
                        <FormItem label={savedExpressionsLabel}>
                          <StyledSelect
                            ariaLabel={savedExpressionsLabel}
                            value={
                              selectedCalculatedColumn?.column_name ||
                              (savedClassification
                                ? selectedMetric?.metric_name
                                : undefined)
                            }
                            onChange={
                              savedClassification
                                ? onSavedItemChange
                                : onCalculatedColumnChange
                            }
                            allowClear
                            autoFocus={
                              !selectedCalculatedColumn && !selectedMetric
                            }
                            placeholder={
                              savedClassification
                                ? t(
                                    '%s item(s)',
                                    calculatedColumns.length +
                                      availableMetrics.length,
                                  )
                                : t('%s column(s)', calculatedColumns.length)
                            }
                            options={[
                              ...calculatedColumns.map(calculatedColumn => ({
                                value: calculatedColumn.column_name,
                                label: (
                                  <StyledColumnOption
                                    column={calculatedColumn}
                                    showType
                                  />
                                ),
                                key: calculatedColumn.column_name,
                                column_name: calculatedColumn.column_name,
                                verbose_name:
                                  calculatedColumn.verbose_name ?? '',
                                disabled:
                                  savedClassification &&
                                  compatibleDimensions != null &&
                                  !compatibleDimensions.includes(
                                    calculatedColumn.column_name,
                                  ),
                              })),
                              ...(savedClassification
                                ? availableMetrics.map(metric => ({
                                    value: metric.metric_name,
                                    label: (
                                      <MetricOptionContainer>
                                        <MetricIcon>ƒ</MetricIcon>
                                        <MetricLabel>
                                          {metric.verbose_name ||
                                            metric.metric_name}
                                        </MetricLabel>
                                      </MetricOptionContainer>
                                    ),
                                    key: `metric-${metric.metric_name}`,
                                    metric_name: metric.metric_name,
                                    verbose_name: metric.verbose_name ?? '',
                                    disabled:
                                      compatibleMetrics != null &&
                                      !compatibleMetrics.includes(
                                        metric.metric_name,
                                      ),
                                  }))
                                : []),
                            ]}
                            optionFilterProps={[
                              'column_name',
                              'verbose_name',
                              'metric_name',
                            ]}
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
                                <button
                                  type="button"
                                  css={inlineTextButtonCss}
                                  onClick={setDatasetAndClose}
                                >
                                  {t('Create a dataset')}
                                </button>{' '}
                                {t(' to mark a column as a time column')}
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  css={inlineTextButtonCss}
                                  onClick={setDatasetAndClose}
                                >
                                  {t('Create a dataset')}
                                </button>{' '}
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
            disabled: effectiveDisabledTabs.has(TABS_KEYS.SIMPLE),
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
                          <button
                            type="button"
                            css={inlineTextButtonCss}
                            onClick={setDatasetAndClose}
                          >
                            {t('Create a dataset')}
                          </button>{' '}
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
                          column_name: simpleColumn.column_name,
                          verbose_name: simpleColumn.verbose_name ?? '',
                          disabled:
                            compatibleDimensions != null &&
                            !compatibleDimensions.includes(
                              simpleColumn.column_name,
                            ),
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
                          metric_name: metric.metric_name,
                          verbose_name: metric.verbose_name ?? '',
                          disabled:
                            compatibleDimensions != null &&
                            !compatibleDimensions.includes(metric.metric_name),
                        })),
                      ]}
                      optionFilterProps={[
                        'column_name',
                        'verbose_name',
                        'metric_name',
                      ]}
                    />
                  </FormItem>
                )}
              </>
            ),
          },
          {
            key: TABS_KEYS.SQL_EXPRESSION,
            label: t('Custom SQL'),
            disabled: effectiveDisabledTabs.has(TABS_KEYS.SQL_EXPRESSION),
            children: (
              <>
                <SQLEditorWithValidation
                  value={
                    adhocColumn?.sqlExpression ||
                    selectedSimpleColumn?.column_name ||
                    selectedCalculatedColumn?.expression ||
                    ''
                  }
                  ref={sqlEditorRef}
                  onChange={onSqlExpressionChange}
                  width="100%"
                  height={`${height - 120}px`}
                  lineNumbers={false}
                  wordWrap
                  keywords={keywords}
                  showValidation
                  expressionType="column"
                  datasourceId={datasource?.id}
                  datasourceType={datasourceType}
                />
              </>
            ),
          },
        ]}
      />

      <div>
        {invalidSelectionFeedback && (
          // ``output`` carries an implicit ``status`` role, announcing the
          // corrective message without stealing focus.
          <output
            id={INVALID_SELECTION_FEEDBACK_ID}
            css={(theme: { colorErrorText: string }) => css`
              display: block;
              color: ${theme.colorErrorText};
            `}
          >
            {invalidSelectionFeedback}
          </output>
        )}
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={onResetStateAndClose}
          cta
        >
          {t('Close')}
        </Button>
        <Button
          disabled={
            !stateIsValid ||
            !hasUnsavedChanges ||
            Boolean(invalidSelectionFeedback)
          }
          buttonStyle="primary"
          buttonSize="small"
          onClick={onSave}
          data-test="ColumnEdit#save"
          aria-describedby={
            invalidSelectionFeedback ? INVALID_SELECTION_FEEDBACK_ID : undefined
          }
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
