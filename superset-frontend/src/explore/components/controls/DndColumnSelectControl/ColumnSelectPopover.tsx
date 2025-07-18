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
import { useSelector, useStore } from 'react-redux';
import {
  AdhocColumn,
  isAdhocColumn,
  t,
  styled,
  css,
  DatasourceType,
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
  Tooltip,
  Icons,
} from '@superset-ui/core/components';

import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { getColumnKeywords } from 'src/explore/controlUtils/getColumnKeywords';
import { StyledColumnOption } from 'src/explore/components/optionRenderers';
import { 
  collectQueryFields,
  callValidationAPI 
} from 'src/explore/components/controls/SemanticLayerVerification';
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

export interface ColumnSelectPopoverProps {
  columns: ColumnMeta[];
  editedColumn?: ColumnMeta | AdhocColumn;
  onChange: (column: ColumnMeta | AdhocColumn) => void;
  onClose: () => void;
  hasCustomLabel: boolean;
  setLabel: (title: string) => void;
  getCurrentTab: (tab: string) => void;
  label: string;
  isTemporal?: boolean;
  setDatasetModal?: Dispatch<SetStateAction<boolean>>;
  disabledTabs?: Set<string>;
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
}: ColumnSelectPopoverProps) => {
  const datasourceType = useSelector<ExplorePageState, string | undefined>(
    state => state.explore.datasource.type,
  );
  const datasource = useSelector<ExplorePageState, any>(
    state => state.explore.datasource,
  );
  const formData = useSelector<ExplorePageState, any>(
    state => state.explore.form_data,
  );
  const store = useStore();
  
  // Check if this is a semantic layer dataset
  const isSemanticLayer = useMemo(() => {
    if (!datasource || !('database' in datasource) || !datasource.database) {
      return false;
    }
    return Boolean(datasource.database.engine_information?.supports_dynamic_columns);
  }, [datasource]);
  
  // For semantic layers, disable Saved and Custom SQL tabs
  const effectiveDisabledTabs = useMemo(() => {
    const tabs = new Set(disabledTabs);
    if (isSemanticLayer) {
      tabs.add('saved');
      tabs.add('sqlExpression');
    }
    return tabs;
  }, [disabledTabs, isSemanticLayer]);
  
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
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [validDimensions, setValidDimensions] = useState<string[] | null>(null);
  const [isLoadingValidDimensions, setIsLoadingValidDimensions] = useState(false);
  const previousFormDataRef = useRef<string>('');

  const [resizeButton, width, height] = useResizeButton(
    POPOVER_INITIAL_WIDTH,
    POPOVER_INITIAL_HEIGHT,
  );

  const sqlEditorRef = useRef(null);

  const [calculatedColumns, simpleColumns] = useMemo(
    () => {
      const [calculated, simple] = columns?.reduce(
        (acc: [ColumnMeta[], ColumnMeta[]], column: ColumnMeta) => {
          if (column.expression) {
            acc[0].push(column);
          } else {
            acc[1].push(column);
          }
          return acc;
        },
        [[], []],
      ) || [[], []];

      // For semantic layer datasets, filter simple columns to show only valid dimensions
      // Show all columns while loading, then filter when API response is available
      if (isSemanticLayer && !isLoadingValidDimensions && validDimensions !== null) {
        const validDimensionNames = new Set(validDimensions);
        const filteredSimple = simple.filter(column =>
          validDimensionNames.has(column.column_name)
        );
        return [calculated, filteredSimple];
      }

      return [calculated, simple];
    },
    [columns, isSemanticLayer, validDimensions, isLoadingValidDimensions],
  );

  const onSqlExpressionChange = useCallback(
    sqlExpression => {
      setAdhocColumn({ label, sqlExpression, expressionType: 'SQL' });
      setSelectedSimpleColumn(undefined);
      setSelectedCalculatedColumn(undefined);
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
      setAdhocColumn(undefined);
      setLabel(
        selectedColumn?.verbose_name || selectedColumn?.column_name || '',
      );
    },
    [setLabel, simpleColumns],
  );

  const defaultActiveTabKey = useMemo(() => {
    // For semantic layer datasets, always default to Simple tab
    if (isSemanticLayer) {
      return TABS_KEYS.SIMPLE;
    }
    
    // Original logic for non-semantic layer datasets
    return initialAdhocColumn
      ? TABS_KEYS.SQL_EXPRESSION
      : selectedCalculatedColumn
        ? TABS_KEYS.SAVED
        : TABS_KEYS.SIMPLE;
  }, [isSemanticLayer, initialAdhocColumn, selectedCalculatedColumn]);

  useEffect(() => {
    getCurrentTab(defaultActiveTabKey);
    setSelectedTab(defaultActiveTabKey);
  }, [defaultActiveTabKey, getCurrentTab, setSelectedTab]);

  // Fetch valid dimensions for semantic layer datasets
  // Only trigger when actually needed (tab is Simple or modal opens after delay)
  useEffect(() => {
    console.log('=== COLUMN MODAL EFFECT TRIGGER ===');
    console.log('isSemanticLayer:', isSemanticLayer);
    console.log('formData exists:', !!formData);
    console.log('datasource exists:', !!datasource);
    console.log('selectedTab:', selectedTab);
    console.log('TABS_KEYS.SIMPLE:', TABS_KEYS.SIMPLE);
    console.log('Should trigger API?', isSemanticLayer && formData && datasource && 
        (selectedTab === TABS_KEYS.SIMPLE || selectedTab === null));
    
    // Temporarily disable column modal API calls to isolate main verification timing issue
    if (false && isSemanticLayer && formData && datasource && 
        (selectedTab === TABS_KEYS.SIMPLE || selectedTab === null)) {
      
      const fetchValidDimensions = async () => {
        setIsLoadingValidDimensions(true);
        
        try {
          // Wait for Redux state to settle after drag-and-drop operations
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Get the most current form data from store
          const currentState = store.getState() as ExplorePageState;
          let currentFormData = currentState.explore.form_data;
          
          // If we're in a table and don't have metrics/dimensions, try to get from controls state
          if ((!currentFormData.metrics && !currentFormData.groupby && !currentFormData.all_columns) ||
              (Array.isArray(currentFormData.metrics) && currentFormData.metrics.length === 0 &&
               Array.isArray(currentFormData.groupby) && currentFormData.groupby.length === 0)) {
            
            // Try to get from the controls state instead
            const controlsState = (currentState as any).explore?.controls;
            if (controlsState) {
              const enhancedFormData = { ...currentFormData };
              
              // Get metrics from controls
              if (controlsState.metrics?.value) {
                enhancedFormData.metrics = controlsState.metrics.value;
              }
              if (controlsState.percent_metrics?.value) {
                enhancedFormData.percent_metrics = controlsState.percent_metrics.value;
              }
              
              // Get dimensions from controls
              if (controlsState.groupby?.value) {
                enhancedFormData.groupby = controlsState.groupby.value;
              }
              if (controlsState.all_columns?.value) {
                enhancedFormData.all_columns = controlsState.all_columns.value;
              }
              
              console.log('=== ENHANCED FORM DATA FROM CONTROLS ===');
              console.log('Controls state metrics:', controlsState.metrics?.value);
              console.log('Controls state groupby:', controlsState.groupby?.value);
              console.log('Controls state all_columns:', controlsState.all_columns?.value);
              console.log('Enhanced form data:', enhancedFormData);
              
              currentFormData = enhancedFormData;
            }
          }
          
          console.log('=== COLUMN MODAL DEBUG ===');
          console.log('Column modal Redux state keys:', Object.keys(currentFormData));
          console.log('Column modal form data:', currentFormData);
          console.log('Column modal has metrics?', 'metrics' in currentFormData, currentFormData.metrics);
          console.log('Column modal has groupby?', 'groupby' in currentFormData, currentFormData.groupby);
          console.log('Column modal collected query fields:', collectQueryFields(currentFormData));
          console.log('=== END COLUMN MODAL DEBUG ===');
          
          const queryFields = collectQueryFields(currentFormData);
          const validationResult = await callValidationAPI(
            datasource,
            queryFields.dimensions,
            queryFields.metrics,
          );
          if (validationResult) {
            setValidDimensions(validationResult.dimensions);
          } else {
            setValidDimensions(null);
          }
        } catch (error) {
          console.warn('Failed to fetch valid dimensions:', error);
          setValidDimensions(null);
        } finally {
          setIsLoadingValidDimensions(false);
        }
      };
      
      // Trigger API call after a delay to ensure state is current
      const timeoutId = setTimeout(() => {
        fetchValidDimensions();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    } else {
      setValidDimensions(null);
      setIsLoadingValidDimensions(false);
    }
  }, [isSemanticLayer, selectedTab, datasource, store]);
  
  // Also trigger when form data changes (for subsequent updates)
  useEffect(() => {
    if (isSemanticLayer && validDimensions !== null && formData && datasource) {
      const currentFormDataString = JSON.stringify(formData);
      
      // Only make API call if form data actually changed and we already have loaded once
      if (currentFormDataString !== previousFormDataRef.current) {
        previousFormDataRef.current = currentFormDataString;
        
        const fetchValidDimensions = async () => {
          setIsLoadingValidDimensions(true);
          
          try {
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const currentState = store.getState() as ExplorePageState;
            const currentFormData = currentState.explore.form_data;
            
            const queryFields = collectQueryFields(currentFormData);
            const validationResult = await callValidationAPI(
              datasource,
              queryFields.dimensions,
              queryFields.metrics,
            );
            if (validationResult) {
              setValidDimensions(validationResult.dimensions);
            }
          } catch (error) {
            console.warn('Failed to fetch valid dimensions:', error);
          } finally {
            setIsLoadingValidDimensions(false);
          }
        };
        
        setTimeout(() => {
          fetchValidDimensions();
        }, 100);
      }
    }
  }, [isSemanticLayer, formData, datasource, store, validDimensions]);

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
    if (!selectedColumn) {
      return;
    }
    onChange(selectedColumn);
    onClose();
  }, [
    adhocColumn,
    label,
    onChange,
    onClose,
    selectedCalculatedColumn,
    selectedSimpleColumn,
  ]);

  const onResetStateAndClose = useCallback(() => {
    setSelectedCalculatedColumn(initialCalculatedColumn);
    setSelectedSimpleColumn(initialSimpleColumn);
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
    adhocColumn || selectedCalculatedColumn || selectedSimpleColumn;
  const hasUnsavedChanges =
    initialLabel !== label ||
    selectedCalculatedColumn?.column_name !==
      initialCalculatedColumn?.column_name ||
    selectedSimpleColumn?.column_name !== initialSimpleColumn?.column_name ||
    adhocColumn?.sqlExpression !== initialAdhocColumn?.sqlExpression;

  const savedExpressionsLabel = t('Saved expressions');
  const simpleColumnsLabel = t('Column');
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
          {
            key: TABS_KEYS.SAVED,
            label: isSemanticLayer && effectiveDisabledTabs.has('saved') ? (
              <Tooltip
                title={t('Saved expressions are not supported for semantic layer datasets')}
              >
                {t('Saved')}
              </Tooltip>
            ) : (
              t('Saved')
            ),
            disabled: effectiveDisabledTabs.has('saved'),
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
                      placeholder={t('%s column(s)', calculatedColumns.length)}
                      options={calculatedColumns.map(calculatedColumn => ({
                        value: calculatedColumn.column_name,
                        label: (
                          <StyledColumnOption
                            column={calculatedColumn}
                            showType
                          />
                        ),
                        key: calculatedColumn.column_name,
                      }))}
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
          {
            key: TABS_KEYS.SIMPLE,
            label: t('Simple'),
            disabled: effectiveDisabledTabs.has('simple'),
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
                      value={selectedSimpleColumn?.column_name}
                      onChange={onSimpleColumnChange}
                      allowClear
                      autoFocus={!selectedSimpleColumn}
                      loading={isSemanticLayer && isLoadingValidDimensions}
                      placeholder={
                        isSemanticLayer && isLoadingValidDimensions
                          ? t('Loading valid dimensions...')
                          : t('%s column(s)', simpleColumns.length)
                      }
                      options={simpleColumns.map(simpleColumn => ({
                        value: simpleColumn.column_name,
                        label: (
                          <StyledColumnOption column={simpleColumn} showType />
                        ),
                        key: simpleColumn.column_name,
                      }))}
                    />
                  </FormItem>
                )}
              </>
            ),
          },
          {
            key: TABS_KEYS.SQL_EXPRESSION,
            label: isSemanticLayer && effectiveDisabledTabs.has('sqlExpression') ? (
              <Tooltip
                title={t('Custom SQL expressions are not supported for semantic layer datasets')}
              >
                {t('Custom SQL')}
              </Tooltip>
            ) : (
              t('Custom SQL')
            ),
            disabled: effectiveDisabledTabs.has('sqlExpression'),
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
        ]}
      />

      <div>
        <Button buttonSize="small" onClick={onResetStateAndClose} cta>
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
