// DODO was here
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
} from '@superset-ui/core';
import { ColumnMeta, isSavedExpression } from '@superset-ui/chart-controls';
import Tabs from 'src/components/Tabs';
import Button from 'src/components/Button';
import { Select } from 'src/components';

import { Form, FormItem } from 'src/components/Form';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { SQLEditor } from 'src/components/AsyncAceEditor';
import { EmptyStateSmall } from 'src/components/EmptyState';
import { getColumnKeywords } from 'src/explore/controlUtils/getColumnKeywords';
import { StyledColumnOption } from 'src/explore/components/optionRenderers';
import {
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
} from 'src/explore/constants';
import { ExplorePageState } from 'src/explore/types';
import useResizeButton from './useResizeButton';

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

interface ColumnSelectPopoverPropsDodoExtended {
  // DODO added start 44120742
  setLabelEN: (title: string) => void;
  setLabelRU: (title: string) => void;
  labelEN: string;
  labelRU: string;
  // DODO added stop 44120742
}

export interface ColumnSelectPopoverProps
  extends ColumnSelectPopoverPropsDodoExtended {
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
  // DODO added start 44120742
  labelEN,
  labelRU,
  setLabelEN,
  setLabelRU, // DODO added stop 44120742
}: ColumnSelectPopoverProps) => {
  const datasourceType = useSelector<ExplorePageState, string | undefined>(
    state => state.explore.datasource.type,
  );
  const [initialLabel] = useState(label);
  const [initialLabelEN] = useState(labelEN); // DODO added 44120742
  const [initialLabelRU] = useState(labelRU); // DODO added 44120742
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

  const onSqlExpressionChange = useCallback(
    sqlExpression => {
      setAdhocColumn({
        label,
        sqlExpression,
        expressionType: 'SQL',
        labelEN, // DODO added 44120742
        labelRU, // DODO added 44120742
      });
      setSelectedSimpleColumn(undefined);
      setSelectedCalculatedColumn(undefined);
    },
    [label, labelEN, labelRU],
  );

  const onCalculatedColumnChange = useCallback(
    selectedColumnName => {
      const selectedColumn = calculatedColumns.find(
        col => col.column_name === selectedColumnName,
      );
      // DODO added 44120742
      const alteredSelectedColumn = selectedColumn
        ? {
            ...selectedColumn,
            verbose_name_en: selectedColumn?.verbose_name,
          }
        : undefined;
      setSelectedCalculatedColumn(selectedColumn);
      setSelectedSimpleColumn(undefined);
      setAdhocColumn(undefined);
      setLabel(
        alteredSelectedColumn?.verbose_name ||
          alteredSelectedColumn?.column_name ||
          '',
      );
      // DODO added start 44120742
      setLabelEN(
        alteredSelectedColumn?.verbose_name ||
          alteredSelectedColumn?.column_name ||
          '',
      );
      setLabelRU(
        alteredSelectedColumn?.verbose_name_ru ||
          alteredSelectedColumn?.column_name ||
          '',
      );
      // DODO added stop 44120742
    },
    [calculatedColumns, setLabel, setLabelEN, setLabelRU], // DODO changed 44120742
  );

  const onSimpleColumnChange = useCallback(
    selectedColumnName => {
      const selectedColumn = simpleColumns.find(
        col => col.column_name === selectedColumnName,
      );
      // DODO added 44120742
      const alteredSelectedColumn = selectedColumn
        ? {
            ...selectedColumn,
            verbose_name_en: selectedColumn?.verbose_name,
          }
        : undefined;
      setSelectedCalculatedColumn(undefined);
      setSelectedSimpleColumn(selectedColumn);
      setAdhocColumn(undefined);
      setLabel(
        alteredSelectedColumn?.verbose_name ||
          alteredSelectedColumn?.column_name ||
          '',
      );
      // DODO added start 44120742
      setLabelEN(
        alteredSelectedColumn?.verbose_name ||
          alteredSelectedColumn?.column_name ||
          '',
      );
      setLabelRU(
        alteredSelectedColumn?.verbose_name_ru ||
          alteredSelectedColumn?.column_name ||
          '',
      );
      // DODO added stop 44120742
    },
    [setLabel, setLabelEN, setLabelRU, simpleColumns], // DODO changed 44120742
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
      setAdhocColumn({
        label,
        sqlExpression,
        expressionType: 'SQL',
        labelEN, // DODO added 44120742
        labelRU, // DODO added 44120742
      });
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
      adhocColumn.labelEN = label; // DODO added 44120742
    }
    // DODO added 44120742
    if (adhocColumn && adhocColumn.labelRU !== labelRU) {
      adhocColumn.labelRU = labelRU;
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
    labelRU, // DODO added 44120742
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
    initialLabelRU !== labelRU || // DODO added 44120742
    initialLabelEN !== labelEN || // DODO added 44120742
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
      >
        <Tabs.TabPane
          key="saved"
          tab={t('Saved')}
          disabled={disabledTabs.has('saved')}
        >
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
                  label:
                    calculatedColumn.verbose_name ||
                    calculatedColumn.column_name,
                  customLabel: (
                    <StyledColumnOption column={calculatedColumn} showType />
                  ),
                  key: calculatedColumn.column_name,
                }))}
              />
            </FormItem>
          ) : datasourceType === DatasourceType.Table ? (
            <EmptyStateSmall
              image="empty.svg"
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
            <EmptyStateSmall
              image="empty.svg"
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
        </Tabs.TabPane>
        <Tabs.TabPane
          key="simple"
          tab={t('Simple')}
          disabled={disabledTabs.has('simple')}
        >
          {isTemporal && simpleColumns.length === 0 ? (
            <EmptyStateSmall
              image="empty.svg"
              title={t('No temporal columns found')}
              description={
                datasourceType === DatasourceType.Table ? (
                  t('Mark a column as temporal in "Edit datasource" modal')
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
                placeholder={t('%s column(s)', simpleColumns.length)}
                options={simpleColumns.map(simpleColumn => ({
                  value: simpleColumn.column_name,
                  label: simpleColumn.verbose_name || simpleColumn.column_name,
                  customLabel: (
                    <StyledColumnOption column={simpleColumn} showType />
                  ),
                  key: simpleColumn.column_name,
                }))}
              />
            </FormItem>
          )}
        </Tabs.TabPane>

        <Tabs.TabPane
          key="sqlExpression"
          tab={t('Custom SQL')}
          disabled={disabledTabs.has('sqlExpression')}
        >
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
        </Tabs.TabPane>
      </Tabs>
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
