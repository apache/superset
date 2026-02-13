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
import rison from 'rison';
import {
  useCallback,
  ReactNode,
  useState,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { connect, ConnectedProps } from 'react-redux';
import type { JsonObject } from '@superset-ui/core';
import type { AnyAction } from 'redux';
import type { ThunkDispatch } from 'redux-thunk';
import { Radio } from '@superset-ui/core/components/Radio';
import {
  isFeatureEnabled,
  FeatureFlag,
  SupersetClient,
  getClientErrorObject,
  getExtensionsRegistry,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  css,
  styled,
  themeObject,
  Alert,
  useTheme,
  t,
} from '@apache-superset/core/ui';
import Tabs from '@superset-ui/core/components/Tabs';
import WarningIconWithTooltip from '@superset-ui/core/components/WarningIconWithTooltip';
import TableSelector from 'src/components/TableSelector';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import TextControl from 'src/explore/components/controls/TextControl';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import withToasts from 'src/components/MessageToasts/withToasts';
import CurrencyControl from 'src/explore/components/controls/CurrencyControl';
import {
  AsyncSelect,
  Badge,
  Button,
  Card,
  CertifiedBadge,
  Col,
  Divider,
  EditableTitle,
  Flex,
  FormLabel,
  Icons,
  InfoTooltip,
  Loading,
  Row,
  Select,
  Typography,
  Label,
} from '@superset-ui/core/components';
import { FilterableTable } from 'src/components';
import {
  executeQuery,
  formatQuery,
  resetDatabaseState,
} from 'src/database/actions';
import Mousetrap from 'mousetrap';
import { clearDatasetCache } from 'src/utils/cachedSupersetGet';
import { makeUrl } from 'src/utils/pathUtils';
import { DatabaseSelector } from '../../../DatabaseSelector';
import CollectionTable from '../CollectionTable';
import Fieldset from '../Fieldset';
import Field from '../Field';
import { fetchSyncedColumns, updateColumns } from '../../utils';
import DatasetUsageTab from './components/DatasetUsageTab';
import {
  DEFAULT_COLUMNS_FOLDER_UUID,
  DEFAULT_METRICS_FOLDER_UUID,
} from '../../FoldersEditor/constants';
import { validateFolders } from '../../FoldersEditor/folderValidation';
import FoldersEditor from '../../FoldersEditor';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';

const extensionsRegistry = getExtensionsRegistry();

// Type definitions

interface Owner {
  id?: number;
  value?: number;
  label?: string;
  first_name?: string;
  last_name?: string;
}

interface Currency {
  symbol?: string;
  symbolPosition?: string;
}

interface Metric {
  id?: number;
  uuid?: string;
  metric_name: string;
  expression?: string;
  verbose_name?: string;
  description?: string;
  d3format?: string;
  currency?: Currency;
  certified_by?: string;
  certification_details?: string;
  warning_markdown?: string;
  extra?: string;
}

interface Column {
  id?: number;
  column_name: string;
  verbose_name?: string;
  description?: string;
  expression?: string;
  filterable?: boolean;
  groupby?: boolean;
  is_dttm?: boolean;
  type?: string;
  type_generic?: number;
  advanced_data_type?: string;
  python_date_format?: string;
  json?: string;
  certified_by?: string;
  certification_details?: string;
  is_certified?: boolean;
}

interface Database {
  id: number;
  database_name?: string;
  name?: string;
  backend?: string;
}

interface SpatialConfig {
  name: string;
  type: string;
  config: Record<string, unknown> | null;
}

interface DatasourceObject {
  id?: number;
  datasource_name?: string;
  database?: Database;
  catalog?: string;
  schema?: string;
  table_name?: string;
  sql?: string;
  columns: Column[];
  metrics?: Metric[];
  owners: Owner[];
  main_dttm_col?: string;
  currency_code_column?: string;
  filter_select_enabled?: boolean;
  fetch_values_predicate?: string;
  description?: string;
  default_endpoint?: string;
  extra?: string;
  datasource_type?: string;
  type?: string;
  offset?: number;
  cache_timeout?: number;
  normalize_columns?: boolean;
  always_filter_main_dttm?: boolean;
  template_params?: string;
  spatials?: SpatialConfig[];
  all_cols?: string[];
  folders?: DatasourceFolder[];
}

interface DatasourceEditorOwnProps {
  datasource: DatasourceObject;
  onChange?: (datasource: DatasourceObject, errors: string[]) => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  setIsEditing?: (isEditing: boolean) => void;
  currencies?: string[];
}

interface QueryResultColumn {
  name: string;
  type: string;
  is_dttm?: boolean;
  type_generic?: number;
  is_hidden?: boolean;
  column_name: string;
}

interface QueryResult {
  status?: string;
  query_id?: string;
  data?: Record<string, unknown>[];
  columns?: QueryResultColumn[];
  selected_columns?: QueryResultColumn[];
  expanded_columns?: QueryResultColumn[];
  query?: {
    id?: string;
  };
}

interface DatabaseState {
  clientId?: string;
  queryRunning?: boolean;
  isLoading?: boolean;
  error?: string;
  queryResult?: QueryResult;
}

interface RootState {
  database?: DatabaseState;
}

interface ChartUsageData {
  id: number;
  slice_name: string;
  url: string;
  certified_by?: string;
  certification_details?: string;
  description?: string;
  owners?: Owner[];
  changed_on_delta_humanized?: string;
  changed_on?: string;
  changed_by?: {
    first_name?: string;
    last_name?: string;
    id?: number;
  };
  dashboards?: Array<{
    id: number;
    dashboard_title: string;
    url: string;
  }>;
}

interface AbortControllers {
  formatQuery: AbortController | null;
  formatSql: AbortController | null;
  syncMetadata: AbortController | null;
  fetchUsageData: AbortController | null;
}

// Component props interfaces
interface CollectionTabTitleProps {
  title: string;
  collection?: unknown[] | { length: number };
}

interface ColumnCollectionTableProps {
  columns: Column[];
  datasource: DatasourceObject;
  onColumnsChange: (columns: Column[]) => void;
  onDatasourceChange: (datasource: DatasourceObject) => void;
  editableColumnName?: boolean;
  showExpression?: boolean;
  allowAddItem?: boolean;
  allowEditDataType?: boolean;
  className?: string;
  itemGenerator?: () => Partial<Column>;
  columnLabelTooltips?: Record<string, string>;
}

interface StackedFieldProps {
  label: string;
  formElement: ReactNode;
}

interface FormContainerProps {
  children: ReactNode;
}

interface OwnersSelectorProps {
  datasource: DatasourceObject;
  onChange: (owners: Owner[]) => void;
}

const DatasourceContainer = styled.div`
  .change-warning {
    margin: 16px 10px 0;
    color: ${({ theme }) => theme.colorWarning};
  }

  .change-warning .bold {
    font-weight: ${({ theme }) => theme.fontWeightStrong};
  }

  .form-group.has-feedback > .help-block {
    margin-top: 8px;
  }

  .form-group.form-group-md {
    margin-bottom: 8px;
  }
`;

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  svg {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const StyledTableTabs = styled(Tabs)`
  overflow: visible;
  .ant-tabs-content-holder {
    overflow: visible;
  }
`;

const StyledBadge = styled(Badge)`
  .ant-badge-count {
    line-height: ${({ theme }) => theme.sizeUnit * 4}px;
    height: ${({ theme }) => theme.sizeUnit * 4}px;
    margin-left: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const EditLockContainer = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  display: flex;
  align-items: center;
  a {
    padding: 0 10px;
  }
`;

const ColumnButtonWrapper = styled.div`
  text-align: right;
  ${({ theme }) => `margin-bottom: ${theme.sizeUnit * 2}px`}
`;

const StyledLabelWrapper = styled.div`
  display: flex;
  align-items: center;
  span {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const StyledTableTabWrapper = styled.div`
  .table > tbody > tr > td {
    vertical-align: middle;
  }

  .ant-tag {
    margin-top: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const DefaultColumnSettingsContainer = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

const DefaultColumnSettingsTitle = styled.h4`
  ${({ theme }) => css`
    margin: 0 0 ${theme.sizeUnit * 2}px 0;
    font-size: ${theme.fontSizeLG}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

const FieldLabelWithTooltip = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextLabel};
  `}
`;

const StyledButtonWrapper = styled.span`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 3}px;
    margin-left: ${theme.sizeUnit * 3}px;
    button>span>:first-of-type {
      margin-right: 0;
    }
  `}
`;

const checkboxGenerator = (
  d: boolean,
  onChange: (value: boolean) => void,
): ReactNode => <CheckboxControl value={d} onChange={onChange} />;
const DATA_TYPES = [
  { value: 'STRING', label: t('STRING') },
  { value: 'NUMERIC', label: t('NUMERIC') },
  { value: 'DATETIME', label: t('DATETIME') },
  { value: 'BOOLEAN', label: t('BOOLEAN') },
];

const TABS_KEYS = {
  SOURCE: 'SOURCE',
  METRICS: 'METRICS',
  COLUMNS: 'COLUMNS',
  CALCULATED_COLUMNS: 'CALCULATED_COLUMNS',
  USAGE: 'USAGE',
  FOLDERS: 'FOLDERS',
  SETTINGS: 'SETTINGS',
  SPATIAL: 'SPATIAL',
};

const DATASOURCE_TYPES_ARR = [
  { key: 'physical', label: t('Physical (table or view)') },
  { key: 'virtual', label: t('Virtual (SQL)') },
];
const DATASOURCE_TYPES: Record<string, { key: string; label: string }> = {};
DATASOURCE_TYPES_ARR.forEach(o => {
  DATASOURCE_TYPES[o.key] = o;
});

function CollectionTabTitle({
  title,
  collection,
}: CollectionTabTitleProps): JSX.Element {
  return (
    <div
      css={{ display: 'flex', alignItems: 'center' }}
      data-test={`collection-tab-${title}`}
    >
      {title}{' '}
      <StyledBadge count={collection ? collection.length : 0} showZero />
    </div>
  );
}

function ColumnCollectionTable({
  columns,
  datasource,
  onColumnsChange,
  onDatasourceChange,
  editableColumnName = false,
  showExpression = false,
  allowAddItem = false,
  allowEditDataType = false,
  itemGenerator = () => ({
    column_name: t('<new column>'),
    filterable: true,
    groupby: true,
  }),
  columnLabelTooltips,
}: ColumnCollectionTableProps): JSX.Element {
  return (
    <CollectionTable
      tableColumns={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? [
              'column_name',
              'advanced_data_type',
              'type',
              'is_dttm',
              'filterable',
              'groupby',
            ]
          : ['column_name', 'type', 'is_dttm', 'filterable', 'groupby']
      }
      sortColumns={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? [
              'column_name',
              'advanced_data_type',
              'type',
              'is_dttm',
              'filterable',
              'groupby',
            ]
          : ['column_name', 'type', 'is_dttm', 'filterable', 'groupby']
      }
      allowDeletes
      allowAddItem={allowAddItem}
      itemGenerator={itemGenerator}
      collection={columns}
      columnLabelTooltips={columnLabelTooltips}
      stickyHeader
      expandFieldset={
        <FormContainer>
          <Fieldset compact>
            {showExpression && (
              <Field
                fieldKey="expression"
                label={t('SQL expression')}
                control={
                  <TextAreaControl
                    language="sql"
                    offerEditInModal={false}
                    resize="vertical"
                  />
                }
              />
            )}
            <Field
              fieldKey="verbose_name"
              label={t('Label')}
              control={
                <TextControl
                  controlId="verbose_name"
                  placeholder={t('Label')}
                />
              }
            />
            <Field
              fieldKey="description"
              label={t('Description')}
              control={
                <TextControl
                  controlId="description"
                  placeholder={t('Description')}
                />
              }
            />
            {allowEditDataType && (
              <Field
                fieldKey="type"
                label={t('Data type')}
                control={
                  <Select
                    ariaLabel={t('Data type')}
                    header={<FormLabel>{t('Data type')}</FormLabel>}
                    options={DATA_TYPES}
                    name="type"
                    allowNewOptions
                    allowClear
                  />
                }
              />
            )}
            {isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes) ? (
              <Field
                fieldKey="advanced_data_type"
                label={t('Advanced data type')}
                control={
                  <TextControl
                    controlId="advanced_data_type"
                    placeholder={t('Advanced Data type')}
                  />
                }
              />
            ) : (
              <></>
            )}
            <Field
              fieldKey="python_date_format"
              label={t('Datetime format')}
              description={
                /* Note the fragmented translations may not work. */
                <div>
                  {t('The pattern of timestamp format. For strings use ')}
                  <Typography.Link href="https://docs.python.org/2/library/datetime.html#strftime-strptime-behavior">
                    {t('Python datetime string pattern')}
                  </Typography.Link>
                  {t(' expression which needs to adhere to the ')}
                  <Typography.Link href="https://en.wikipedia.org/wiki/ISO_8601">
                    {t('ISO 8601')}
                  </Typography.Link>
                  {t(` standard to ensure that the lexicographical ordering
                      coincides with the chronological ordering. If the
                      timestamp format does not adhere to the ISO 8601 standard
                      you will need to define an expression and type for
                      transforming the string into a date or timestamp. Note
                      currently time zones are not supported. If time is stored
                      in epoch format, put \`epoch_s\` or \`epoch_ms\`. If no pattern
                      is specified we fall back to using the optional defaults on a per
                      database/column name level via the extra parameter.`)}
                </div>
              }
              control={
                <TextControl
                  controlId="python_date_format"
                  placeholder="%Y-%m-%d"
                />
              }
            />
            <Field
              fieldKey="certified_by"
              label={t('Certified By')}
              description={t('Person or group that has certified this metric')}
              control={
                <TextControl
                  controlId="certified"
                  placeholder={t('Certified by')}
                />
              }
            />
            <Field
              fieldKey="certification_details"
              label={t('Certification details')}
              description={t('Details of the certification')}
              control={
                <TextControl
                  controlId="certificationDetails"
                  placeholder={t('Certification details')}
                />
              }
            />
          </Fieldset>
        </FormContainer>
      }
      columnLabels={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? {
              column_name: t('Column'),
              advanced_data_type: t('Advanced data type'),
              type: t('Data type'),
              groupby: t('Is dimension'),
              is_dttm: t('Is temporal'),
              filterable: t('Is filterable'),
            }
          : {
              column_name: t('Column'),
              type: t('Data type'),
              groupby: t('Is dimension'),
              is_dttm: t('Is temporal'),
              filterable: t('Is filterable'),
            }
      }
      onChange={onColumnsChange}
      itemRenderers={
        isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)
          ? {
              column_name: (v, onItemChange, _, record) =>
                editableColumnName ? (
                  <StyledLabelWrapper>
                    {record.is_certified && (
                      <CertifiedBadge
                        certifiedBy={record.certified_by}
                        details={record.certification_details}
                      />
                    )}
                    <EditableTitle
                      canEdit
                      title={v as string}
                      onSaveTitle={onItemChange}
                    />
                  </StyledLabelWrapper>
                ) : (
                  <StyledLabelWrapper>
                    {record.is_certified && (
                      <CertifiedBadge
                        certifiedBy={record.certified_by}
                        details={record.certification_details}
                      />
                    )}
                    {v}
                  </StyledLabelWrapper>
                ),
              type: d => (d ? <Label>{d}</Label> : null),
              advanced_data_type: d => <Label>{d as string}</Label>,
              is_dttm: checkboxGenerator,
              filterable: checkboxGenerator,
              groupby: checkboxGenerator,
            }
          : {
              column_name: (v, onItemChange, _, record) =>
                editableColumnName ? (
                  <StyledLabelWrapper>
                    {record.is_certified && (
                      <CertifiedBadge
                        certifiedBy={record.certified_by}
                        details={record.certification_details}
                      />
                    )}
                    <TextControl value={v as string} onChange={onItemChange} />
                  </StyledLabelWrapper>
                ) : (
                  <StyledLabelWrapper>
                    {record.is_certified && (
                      <CertifiedBadge
                        certifiedBy={record.certified_by}
                        details={record.certification_details}
                      />
                    )}
                    {v}
                  </StyledLabelWrapper>
                ),
              type: d => (d ? <Label>{d}</Label> : null),
              is_dttm: checkboxGenerator,
              filterable: checkboxGenerator,
              groupby: checkboxGenerator,
            }
      }
    />
  );
}

function StackedField({ label, formElement }: StackedFieldProps): JSX.Element {
  return (
    <div>
      <div>
        <strong>{label}</strong>
      </div>
      <div>{formElement}</div>
    </div>
  );
}

function FormContainer({ children }: FormContainerProps): JSX.Element {
  return (
    <Card padded style={{ backgroundColor: themeObject.theme.colorBgLayout }}>
      {children}
    </Card>
  );
}

function OwnersSelector({
  datasource,
  onChange,
}: OwnersSelectorProps): JSX.Element {
  const loadOptions = useCallback(
    (
      search = '',
      page: number,
      pageSize: number,
    ): Promise<{ data: Owner[]; totalCount: number }> => {
      const query = rison.encode({ filter: search, page, page_size: pageSize });
      return SupersetClient.get({
        endpoint: `/api/v1/dataset/related/owners?q=${query}`,
      }).then(response => ({
        data: (response.json.result as Array<JsonObject>)
          .filter(item => item.extra.active)
          .map(item => ({
            value: item.value as number,
            label: item.text as string,
          })),
        totalCount: response.json.count,
      }));
    },
    [],
  );

  return (
    <AsyncSelect
      ariaLabel={t('Select owners')}
      mode="multiple"
      name="owners"
      value={datasource.owners as { value: number; label: string }[]}
      options={loadOptions}
      onChange={value => onChange(value as Owner[])}
      header={<FormLabel>{t('Owners')}</FormLabel>}
      allowClear
    />
  );
}
const ResultTable =
  extensionsRegistry.get('sqleditor.extension.resultTable') ?? FilterableTable;

// Redux connector types
interface QueryPayload {
  client_id?: string;
  database_id: number;
  runAsync: boolean;
  catalog?: string;
  schema?: string;
  sql: string;
  tmp_table_name: string;
  select_as_cta: boolean;
  ctas_method: string;
  queryLimit: number;
  expand_data: boolean;
}

interface FormatQueryResponse {
  json: {
    result: string;
  };
}

const mapDispatchToProps = (
  dispatch: ThunkDispatch<RootState, unknown, AnyAction>,
) => ({
  runQuery: (payload: QueryPayload) =>
    dispatch(executeQuery(payload as Parameters<typeof executeQuery>[0])),
  resetQuery: () => dispatch(resetDatabaseState()),
  formatQuery: (
    sql: string,
    options: { signal: AbortSignal },
  ): Promise<FormatQueryResponse> =>
    dispatch(
      formatQuery(sql, options),
    ) as unknown as Promise<FormatQueryResponse>,
});

const mapStateToProps = (state: RootState) => ({
  database: state?.database,
});

const connector = connect(mapStateToProps, mapDispatchToProps);
type PropsFromRedux = ConnectedProps<typeof connector>;

type DatasourceEditorProps = DatasourceEditorOwnProps & PropsFromRedux;

function DatasourceEditor({
  datasource: propsDatasource,
  onChange = () => {},
  addSuccessToast,
  addDangerToast,
  setIsEditing = () => {},
  database,
  runQuery,
  resetQuery,
  formatQuery: formatQueryAction,
}: DatasourceEditorProps) {
  const theme = useTheme();
  const isComponentMounted = useRef(false);
  const abortControllers = useRef<AbortControllers>({
    formatQuery: null,
    formatSql: null,
    syncMetadata: null,
    fetchUsageData: null,
  });

  // Initialize datasource state with transformed owners and metrics
  const [datasource, setDatasource] = useState<DatasourceObject>(() => ({
    ...propsDatasource,
    owners: propsDatasource.owners.map(owner => ({
      value: owner.value || owner.id,
      label: owner.label || `${owner.first_name} ${owner.last_name}`,
    })),
    metrics: propsDatasource.metrics?.map(metric => {
      const {
        certified_by: certifiedByMetric,
        certification_details: certificationDetails,
      } = metric;
      const {
        certification: {
          details = undefined,
          certified_by: certifiedBy = undefined,
        } = {},
        warning_markdown: warningMarkdown,
      } = JSON.parse(metric.extra || '{}') || {};
      return {
        ...metric,
        certification_details: certificationDetails || details,
        warning_markdown: warningMarkdown || '',
        certified_by: certifiedBy || certifiedByMetric,
      };
    }),
  }));

  const [errors, setErrors] = useState<string[]>([]);
  const [isSqla] = useState(
    propsDatasource.datasource_type === 'table' ||
      propsDatasource.type === 'table',
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [databaseColumns, setDatabaseColumns] = useState<Column[]>(
    propsDatasource.columns.filter(col => !col.expression),
  );
  const [calculatedColumns, setCalculatedColumns] = useState<Column[]>(
    propsDatasource.columns.filter(col => !!col.expression),
  );
  const [folders, setFolders] = useState<DatasourceFolder[]>(
    propsDatasource.folders || [],
  );
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState(TABS_KEYS.SOURCE);
  const [datasourceType, setDatasourceType] = useState(
    propsDatasource.sql
      ? DATASOURCE_TYPES.virtual.key
      : DATASOURCE_TYPES.physical.key,
  );
  const [usageCharts, setUsageCharts] = useState<ChartUsageData[]>([]);
  const [usageChartsCount, setUsageChartsCount] = useState(0);

  const findDuplicates = useCallback(
    <T,>(arr: T[], accessor: (obj: T) => string): string[] => {
      const seen: Record<string, null> = {};
      const dups: string[] = [];
      arr.forEach((obj: T) => {
        const item = accessor(obj);
        if (item in seen) {
          dups.push(item);
        } else {
          seen[item] = null;
        }
      });
      return dups;
    },
    [],
  );

  const validate = useCallback(
    (callback: (validationErrors: string[]) => void) => {
      let validationErrors: string[] = [];
      let dups: string[];

      // Looking for duplicate column_name
      dups = findDuplicates(datasource.columns, obj => obj.column_name);
      validationErrors = validationErrors.concat(
        dups.map(name => t('Column name [%s] is duplicated', name)),
      );

      // Looking for duplicate metric_name
      dups = findDuplicates(datasource.metrics ?? [], obj => obj.metric_name);
      validationErrors = validationErrors.concat(
        dups.map(name => t('Metric name [%s] is duplicated', name)),
      );

      // Making sure calculatedColumns have an expression defined
      const noFilterCalcCols = calculatedColumns.filter(
        col => !col.expression && !col.json,
      );
      validationErrors = validationErrors.concat(
        noFilterCalcCols.map(col =>
          t('Calculated column [%s] requires an expression', col.column_name),
        ),
      );

      // validate currency code (skip 'AUTO' - it's a placeholder for auto-detection)
      try {
        datasource.metrics?.forEach(
          metric =>
            metric.currency?.symbol &&
            metric.currency.symbol !== 'AUTO' &&
            new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: metric.currency.symbol,
            }),
        );
      } catch {
        validationErrors = validationErrors.concat([
          t('Invalid currency code in saved metrics'),
        ]);
      }

      // Validate folders
      if (folders?.length > 0) {
        const folderValidation = validateFolders(folders);
        validationErrors = validationErrors.concat(folderValidation.errors);
      }

      setErrors(validationErrors);
      callback(validationErrors);
    },
    [datasource, calculatedColumns, folders, findDuplicates],
  );

  const onChangeInternal = useCallback(
    (validationErrors: string[] = errors) => {
      // Emptying SQL if "Physical" radio button is selected
      const sql =
        datasourceType === DATASOURCE_TYPES.physical.key ? '' : datasource.sql;

      const newDatasource = {
        ...datasource,
        sql,
        columns: [...databaseColumns, ...calculatedColumns],
        folders,
      };

      onChange(newDatasource, validationErrors);
    },
    [
      datasource,
      datasourceType,
      databaseColumns,
      calculatedColumns,
      folders,
      errors,
      onChange,
    ],
  );

  const validateAndChange = useCallback(() => {
    validate(onChangeInternal);
  }, [validate, onChangeInternal]);

  const onDatasourceChange = useCallback(
    (
      newDatasource: DatasourceObject,
      callback: () => void = validateAndChange,
    ) => {
      setDatasource(newDatasource);
      // Need to call callback after state update
      setTimeout(callback, 0);
    },
    [validateAndChange],
  );

  const onDatasourcePropChange = useCallback((attr: string, value: unknown) => {
    if (value === undefined) return;
    setDatasource(prev => {
      const newDatasource = { ...prev, [attr]: value };
      return newDatasource;
    });
  }, []);

  // Effect to trigger validation after datasource changes
  useEffect(() => {
    if (isComponentMounted.current) {
      validateAndChange();
    }
  }, [datasource]);

  const onChangeEditMode = useCallback(() => {
    setIsEditing(!isEditMode);
    setIsEditMode(prev => !prev);
  }, [isEditMode, setIsEditing]);

  const onDatasourceTypeChange = useCallback((newDatasourceType: string) => {
    setDatasourceType(newDatasourceType);
  }, []);

  // Effect to call onChange after datasourceType changes
  useEffect(() => {
    if (isComponentMounted.current) {
      onChangeInternal();
    }
  }, [datasourceType]);

  const handleFoldersChange = useCallback((newFolders: DatasourceFolder[]) => {
    const userMadeFolders = newFolders.filter(
      f =>
        f.uuid !== DEFAULT_METRICS_FOLDER_UUID &&
        f.uuid !== DEFAULT_COLUMNS_FOLDER_UUID &&
        (f.children?.length ?? 0) > 0,
    );
    setFolders(userMadeFolders);
    setDatasource(prev => ({ ...prev, folders: userMadeFolders }));
  }, []);

  const setColumns = useCallback(
    (
      obj: { databaseColumns?: Column[] } | { calculatedColumns?: Column[] },
    ) => {
      if ('databaseColumns' in obj && obj.databaseColumns) {
        setDatabaseColumns(obj.databaseColumns);
      }
      if ('calculatedColumns' in obj && obj.calculatedColumns) {
        setCalculatedColumns(obj.calculatedColumns);
      }
    },
    [],
  );

  // Effect to trigger validation after column changes
  useEffect(() => {
    if (isComponentMounted.current) {
      validateAndChange();
    }
  }, [databaseColumns, calculatedColumns]);

  const getSQLLabUrl = useCallback(() => {
    const queryParams = new URLSearchParams({
      dbid: String(datasource.database?.id ?? ''),
      sql: datasource.sql ?? '',
      name: datasource.datasource_name ?? '',
      schema: datasource.schema ?? '',
      autorun: 'true',
      isDataset: 'true',
    });
    return makeUrl(`/sqllab/?${queryParams.toString()}`);
  }, [datasource]);

  const openOnSqlLab = useCallback(() => {
    window.open(getSQLLabUrl(), '_blank', 'noopener,noreferrer');
  }, [getSQLLabUrl]);

  const onQueryRun = useCallback(async () => {
    const databaseId = datasource.database?.id;
    const { sql } = datasource;
    if (!databaseId || !sql) {
      return;
    }
    runQuery({
      client_id: database?.clientId,
      database_id: databaseId,
      runAsync: false,
      catalog: datasource.catalog,
      schema: datasource.schema,
      sql,
      tmp_table_name: '',
      select_as_cta: false,
      ctas_method: 'TABLE',
      queryLimit: 25,
      expand_data: true,
    });
  }, [datasource, database?.clientId, runQuery]);

  const onQueryFormat = useCallback(async () => {
    if (!datasource.sql || !isEditMode) {
      return;
    }

    // Abort previous formatQuery if still pending
    if (abortControllers.current.formatQuery) {
      abortControllers.current.formatQuery.abort();
    }

    abortControllers.current.formatQuery = new AbortController();
    const { signal } = abortControllers.current.formatQuery;

    try {
      const response = await formatQueryAction(datasource.sql, { signal });

      onDatasourcePropChange('sql', response.json.result);
      addSuccessToast(t('SQL was formatted'));
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') return;

      const { error: clientError, statusText } = await getClientErrorObject(
        error as Response,
      );

      addDangerToast(
        clientError ||
          statusText ||
          t('An error occurred while formatting SQL'),
      );
    } finally {
      abortControllers.current.formatQuery = null;
    }
  }, [
    datasource.sql,
    isEditMode,
    formatQueryAction,
    onDatasourcePropChange,
    addSuccessToast,
    addDangerToast,
  ]);

  const syncMetadata = useCallback(async () => {
    // Abort previous syncMetadata if still pending
    if (abortControllers.current.syncMetadata) {
      abortControllers.current.syncMetadata.abort();
    }

    abortControllers.current.syncMetadata = new AbortController();
    const { signal } = abortControllers.current.syncMetadata;

    setMetadataLoading(true);

    try {
      const newCols = await fetchSyncedColumns(datasource, signal);

      const columnChanges = updateColumns(
        datasource.columns,
        newCols,
        addSuccessToast,
      );
      setColumns({
        databaseColumns: columnChanges.finalColumns.filter(
          col => !col.expression,
        ) as Column[],
      });

      if (datasource.id !== undefined) {
        clearDatasetCache(datasource.id);
      }

      addSuccessToast(t('Metadata has been synced'));
      setMetadataLoading(false);
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        if (isComponentMounted.current) {
          setMetadataLoading(false);
        }
        return;
      }

      const { error: clientError, statusText } = await getClientErrorObject(
        error as Response,
      );

      addDangerToast(clientError || statusText || t('An error has occurred'));
      setMetadataLoading(false);
    } finally {
      abortControllers.current.syncMetadata = null;
    }
  }, [datasource, addSuccessToast, addDangerToast, setColumns]);

  const fetchUsageData = useCallback(
    async (
      page = 1,
      pageSize = 25,
      sortColumn = 'changed_on_delta_humanized',
      sortDirection = 'desc',
    ) => {
      // Abort previous fetchUsageData if still pending
      if (abortControllers.current.fetchUsageData) {
        abortControllers.current.fetchUsageData.abort();
      }

      abortControllers.current.fetchUsageData = new AbortController();
      const { signal } = abortControllers.current.fetchUsageData;

      try {
        const queryParams = rison.encode({
          columns: [
            'slice_name',
            'url',
            'certified_by',
            'certification_details',
            'description',
            'owners.first_name',
            'owners.last_name',
            'owners.id',
            'changed_on_delta_humanized',
            'changed_on',
            'changed_by.first_name',
            'changed_by.last_name',
            'changed_by.id',
            'dashboards.id',
            'dashboards.dashboard_title',
            'dashboards.url',
          ],
          filters: [
            {
              col: 'datasource_id',
              opr: 'eq',
              value: datasource.id,
            },
          ],
          order_column: sortColumn,
          order_direction: sortDirection,
          page: page - 1,
          page_size: pageSize,
        });

        const { json = {} } = await SupersetClient.get({
          endpoint: `/api/v1/chart/?q=${queryParams}`,
          signal,
        });

        const charts = json?.result || [];
        const ids = json?.ids || [];

        const chartsWithIds = charts.map(
          (chart: Omit<ChartUsageData, 'id'>, index: number) => ({
            ...chart,
            id: ids[index],
          }),
        );

        if (!signal.aborted && isComponentMounted.current) {
          setUsageCharts(chartsWithIds);
          setUsageChartsCount(json?.count || 0);
        }

        return {
          charts: chartsWithIds,
          count: json?.count || 0,
          ids,
        };
      } catch (error: unknown) {
        if ((error as Error).name === 'AbortError') throw error;

        const { error: clientError, statusText } = await getClientErrorObject(
          error as Response,
        );

        addDangerToast(
          clientError ||
            statusText ||
            t('An error occurred while fetching usage data'),
        );
        setUsageCharts([]);
        setUsageChartsCount(0);

        return {
          charts: [],
          count: 0,
          ids: [],
        };
      } finally {
        abortControllers.current.fetchUsageData = null;
      }
    },
    [datasource.id, addDangerToast],
  );

  const handleTabSelect = useCallback((key: string) => {
    setActiveTabKey(key);
  }, []);

  const sortMetrics = useCallback(
    (metrics: Metric[]) =>
      [...metrics].sort(
        ({ id: a }: { id?: number }, { id: b }: { id?: number }) =>
          (b ?? 0) - (a ?? 0),
      ),
    [],
  );

  // componentDidMount
  useEffect(() => {
    isComponentMounted.current = true;
    Mousetrap.bind('ctrl+shift+f', e => {
      e.preventDefault();
      if (isEditMode) {
        onQueryFormat();
      }
      return false;
    });
    fetchUsageData().catch(error => {
      if (error?.name !== 'AbortError') throw error;
    });

    // componentWillUnmount
    return () => {
      isComponentMounted.current = false;

      // Abort all pending requests
      Object.values(abortControllers.current).forEach(controller => {
        if (controller) controller.abort();
      });

      Mousetrap.unbind('ctrl+shift+f');
      resetQuery();
    };
  }, []);

  // Update Mousetrap binding when isEditMode changes
  useEffect(() => {
    Mousetrap.unbind('ctrl+shift+f');
    Mousetrap.bind('ctrl+shift+f', e => {
      e.preventDefault();
      if (isEditMode) {
        onQueryFormat();
      }
      return false;
    });
  }, [isEditMode, onQueryFormat]);

  // componentDidUpdate for props.datasource changes
  useEffect(() => {
    if (!isComponentMounted.current) return;

    const newCalculatedColumns = propsDatasource.columns.filter(
      col => !!col.expression,
    );

    if (newCalculatedColumns.length === calculatedColumns.length) {
      const orderedCalculatedColumns: Column[] = [];
      const usedIds = new Set<string | number>();

      calculatedColumns.forEach(currentCol => {
        const id = currentCol.id || currentCol.column_name;
        const updatedCol = newCalculatedColumns.find(
          newCol => (newCol.id || newCol.column_name) === id,
        );
        if (updatedCol) {
          orderedCalculatedColumns.push(updatedCol);
          usedIds.add(id);
        }
      });

      newCalculatedColumns.forEach(newCol => {
        const id = newCol.id || newCol.column_name;
        if (!usedIds.has(id)) {
          orderedCalculatedColumns.push(newCol);
        }
      });

      setCalculatedColumns(orderedCalculatedColumns);
      setDatabaseColumns(
        propsDatasource.columns.filter(col => !col.expression),
      );
    }
  }, [propsDatasource]);

  const renderSqlEditorOverlay = useCallback(
    () => (
      <div
        css={themeParam => css`
          position: absolute;
          background: ${themeParam.colorBgLayout};
          align-items: center;
          display: flex;
          height: 100%;
          width: 100%;
          justify-content: center;
        `}
      >
        <div>
          <Loading position="inline-centered" />
          <span
            css={themeParam => css`
              display: block;
              margin: ${themeParam.sizeUnit * 4}px auto;
              width: fit-content;
              color: ${themeParam.colorText};
            `}
          >
            {t('We are working on your query')}
          </span>
        </div>
      </div>
    ),
    [],
  );

  const renderOpenInSqlLabLink = useCallback(
    (isError = false) => (
      <a
        href={getSQLLabUrl()}
        target="_blank"
        rel="noopener noreferrer"
        css={themeParam => css`
          color: ${isError ? themeParam.colorErrorText : themeParam.colorText};
          font-size: ${themeParam.fontSizeSM}px;
          text-decoration: underline;
        `}
      >
        {t('Open in SQL lab')}
      </a>
    ),
    [getSQLLabUrl],
  );

  const renderSqlErrorMessage = useCallback(
    () => (
      <span
        css={themeParam => css`
          font-size: ${themeParam.fontSizeSM}px;
          color: ${themeParam.colorErrorText};
        `}
      >
        {database?.error && t('Error executing query. ')}
        {renderOpenInSqlLabLink(true)}
        {t(' to check for details.')}
      </span>
    ),
    [database?.error, renderOpenInSqlLabLink],
  );

  const renderDefaultColumnSettings = useCallback(() => {
    const allColumns = [...databaseColumns, ...calculatedColumns];

    const datetimeColumns = allColumns
      .filter(col => col.is_dttm)
      .map(col => ({
        value: col.column_name,
        label: col.verbose_name || col.column_name,
      }));

    const stringColumns = allColumns
      .filter(
        col =>
          col.type_generic === GenericDataType.String ||
          (col.expression && col.type_generic == null),
      )
      .map(col => ({
        value: col.column_name,
        label: col.verbose_name || col.column_name,
      }));

    return (
      <DefaultColumnSettingsContainer data-test="default-column-settings">
        <DefaultColumnSettingsTitle>
          {t('Default Column Settings')}
        </DefaultColumnSettingsTitle>
        <Flex vertical gap={(theme?.sizeUnit ?? 4) * 3}>
          <Flex vertical gap={theme?.sizeUnit ?? 4}>
            <FieldLabelWithTooltip>
              <span>{t('Default datetime column')}</span>
              <InfoTooltip
                tooltip={t(
                  'Sets the default temporal column for this dataset. Automatically selected as the time column when building charts that require a time dimension and used in dashboard level time filters.',
                )}
              />
            </FieldLabelWithTooltip>
            <Select
              ariaLabel={t('Default datetime column')}
              options={datetimeColumns}
              value={datasource.main_dttm_col}
              onChange={value =>
                onDatasourceChange({
                  ...datasource,
                  main_dttm_col: value as string | undefined,
                })
              }
              placeholder={t('Select datetime column')}
              allowClear
              data-test="default-datetime-column-select"
            />
          </Flex>
          <Flex vertical gap={theme?.sizeUnit ?? 4}>
            <FieldLabelWithTooltip>
              <span>{t('Currency code column')}</span>
              <InfoTooltip
                tooltip={t(
                  "Select the column containing currency codes such as USD, EUR, GBP, etc. Used when building charts when 'Auto-detect' currency formatting is enabled. If this column is not set or if a chart metric contains multiple currencies, charts will fall back to neutral numeric formatting.",
                )}
              />
            </FieldLabelWithTooltip>
            <Select
              ariaLabel={t('Currency code column')}
              options={stringColumns}
              value={datasource.currency_code_column}
              onChange={value =>
                onDatasourceChange({
                  ...datasource,
                  currency_code_column: value as string | undefined,
                })
              }
              placeholder={t('Select currency code column')}
              allowClear
              data-test="currency-code-column-select"
            />
          </Flex>
        </Flex>
      </DefaultColumnSettingsContainer>
    );
  }, [
    databaseColumns,
    calculatedColumns,
    theme?.sizeUnit,
    datasource,
    onDatasourceChange,
  ]);

  const renderSettingsFieldset = useCallback(
    () => (
      <Fieldset
        title={t('Basic')}
        item={datasource}
        onChange={onDatasourceChange}
      >
        <Field
          fieldKey="description"
          label={t('Description')}
          control={
            <TextAreaControl
              language="markdown"
              offerEditInModal={false}
              resize="vertical"
            />
          }
        />
        <Field
          fieldKey="default_endpoint"
          label={t('Default URL')}
          description={
            <>
              {t(
                'Default URL to redirect to when accessing from the dataset list page. Accepts relative URLs such as',
              )}{' '}
              <Typography.Text code>
                /superset/dashboard/{'{id}'}/
              </Typography.Text>
            </>
          }
          control={<TextControl controlId="default_endpoint" />}
        />
        <Field
          inline
          fieldKey="filter_select_enabled"
          label={t('Autocomplete filters')}
          description={t('Whether to populate autocomplete filters options')}
          control={<CheckboxControl />}
        />
        {isSqla && (
          <Field
            fieldKey="fetch_values_predicate"
            label={t('Autocomplete query predicate')}
            description={t(
              'When using "Autocomplete filters", this can be used to improve performance ' +
                'of the query fetching the values. Use this option to apply a ' +
                'predicate (WHERE clause) to the query selecting the distinct ' +
                'values from the table. Typically the intent would be to limit the scan ' +
                'by applying a relative time filter on a partitioned or indexed time-related field.',
            )}
            control={
              <TextAreaControl
                language="sql"
                controlId="fetch_values_predicate"
                minLines={5}
                resize="vertical"
              />
            }
          />
        )}
        {isSqla && (
          <Field
            fieldKey="extra"
            label={t('Extra')}
            description={t(
              'Extra data to specify table metadata. Currently supports ' +
                'metadata of the format: `{ "certification": { "certified_by": ' +
                '"Data Platform Team", "details": "This table is the source of truth." ' +
                '}, "warning_markdown": "This is a warning." }`.',
            )}
            control={
              <TextAreaControl
                controlId="extra"
                language="json"
                offerEditInModal={false}
                resize="vertical"
              />
            }
          />
        )}
        <OwnersSelector
          datasource={datasource}
          onChange={newOwners => {
            onDatasourceChange({ ...datasource, owners: newOwners });
          }}
        />
      </Fieldset>
    ),
    [datasource, onDatasourceChange, isSqla],
  );

  const renderAdvancedFieldset = useCallback(
    () => (
      <Fieldset
        title={t('Advanced')}
        item={datasource}
        onChange={onDatasourceChange}
      >
        <Field
          fieldKey="cache_timeout"
          label={t('Cache timeout')}
          description={t(
            'The duration of time in seconds before the cache is invalidated. Set to -1 to bypass the cache.',
          )}
          control={<TextControl controlId="cache_timeout" />}
        />
        <Field
          fieldKey="offset"
          label={t('Hours offset')}
          control={<TextControl controlId="offset" />}
          description={t(
            'The number of hours, negative or positive, to shift the time column. This can be used to move UTC time to local time.',
          )}
        />
        {isSqla && (
          <Field
            fieldKey="template_params"
            label={t('Template parameters')}
            description={t(
              'A set of parameters that become available in the query using Jinja templating syntax',
            )}
            control={<TextControl controlId="template_params" />}
          />
        )}
        <Field
          inline
          fieldKey="normalize_columns"
          label={t('Normalize column names')}
          description={t(
            'Allow column names to be changed to case insensitive format, if supported (e.g. Oracle, Snowflake).',
          )}
          control={<CheckboxControl />}
        />
        <Field
          inline
          fieldKey="always_filter_main_dttm"
          label={t('Always filter main datetime column')}
          description={t(
            `When the secondary temporal columns are filtered, apply the same filter to the main datetime column.`,
          )}
          control={<CheckboxControl />}
        />
      </Fieldset>
    ),
    [datasource, onDatasourceChange, isSqla],
  );

  const renderSourceFieldset = useCallback(
    () => (
      <div>
        <EditLockContainer>
          <span
            css={themeParam => css`
              color: ${themeParam.colorTextTertiary};
            `}
            role="button"
            tabIndex={0}
            onClick={onChangeEditMode}
          >
            {isEditMode ? (
              <Icons.UnlockOutlined
                iconSize="xl"
                css={themeParam => css`
                  margin: auto ${themeParam.sizeUnit}px auto 0;
                `}
              />
            ) : (
              <Icons.LockOutlined
                iconSize="xl"
                css={themeParam => ({
                  margin: `auto ${themeParam.sizeUnit}px auto 0`,
                })}
              />
            )}
          </span>
          {!isEditMode && <div>{t('Click the lock to make changes.')}</div>}
          {isEditMode && (
            <div>{t('Click the lock to prevent further changes.')}</div>
          )}
        </EditLockContainer>
        <div
          css={themeParam => css`
            margin-top: ${themeParam.sizeUnit * 3}px;
            display: flex;
            gap: ${themeParam.sizeUnit * 4}px;
          `}
        >
          {DATASOURCE_TYPES_ARR.map(type => (
            <Radio
              key={type.key}
              value={type.key}
              onChange={() => onDatasourceTypeChange(type.key)}
              checked={datasourceType === type.key}
              disabled={!isEditMode}
            >
              {type.label}
            </Radio>
          ))}
        </div>
        <Divider />
        <Fieldset item={datasource} onChange={onDatasourceChange} compact>
          {datasourceType === DATASOURCE_TYPES.virtual.key && (
            <div>
              {isSqla && (
                <>
                  <Col xs={24} md={12}>
                    <Field
                      fieldKey="databaseSelector"
                      label={t('Virtual')}
                      control={
                        <div css={{ marginTop: 8 }}>
                          <DatabaseSelector
                            db={
                              datasource?.database
                                ? {
                                    id: datasource.database.id,
                                    database_name:
                                      datasource.database.database_name ??
                                      datasource.database.name ??
                                      '',
                                    backend: datasource.database.backend,
                                  }
                                : null
                            }
                            catalog={datasource.catalog}
                            schema={datasource.schema}
                            onCatalogChange={catalog =>
                              isEditMode &&
                              onDatasourcePropChange('catalog', catalog)
                            }
                            onSchemaChange={schema =>
                              isEditMode &&
                              onDatasourcePropChange('schema', schema)
                            }
                            onDbChange={db =>
                              isEditMode &&
                              onDatasourcePropChange('database', db)
                            }
                            formMode={false}
                            handleError={addDangerToast}
                            readOnly={!isEditMode}
                          />
                        </div>
                      }
                    />
                    <div css={{ width: 'calc(100% - 34px)', marginTop: -16 }}>
                      <Field
                        fieldKey="table_name"
                        label={t('Name')}
                        control={
                          <TextControl
                            controlId="table_name"
                            onChange={table => {
                              onDatasourcePropChange('table_name', table);
                            }}
                            placeholder={t('Dataset name')}
                            disabled={!isEditMode}
                          />
                        }
                      />
                    </div>
                  </Col>
                  <Field
                    fieldKey="sql"
                    label={t('SQL')}
                    description={t(
                      'When specifying SQL, the datasource acts as a view. ' +
                        'Superset will use this statement as a subquery while grouping and filtering ' +
                        'on the generated parent queries.' +
                        'If changes are made to your SQL query, ' +
                        'columns in your dataset will be synced when saving the dataset.',
                    )}
                    control={
                      database?.isLoading ? (
                        <>
                          {renderSqlEditorOverlay()}
                          <TextAreaControl
                            hotkeys={[
                              {
                                name: 'formatQuery',
                                key: 'ctrl+shift+f',
                                func: () => {
                                  onQueryFormat();
                                },
                              },
                            ]}
                            language="sql"
                            offerEditInModal={false}
                            minLines={10}
                            maxLines={Infinity}
                            readOnly={!isEditMode}
                            resize="both"
                          />
                        </>
                      ) : (
                        <TextAreaControl
                          css={themeParam => css`
                            margin-top: ${themeParam.sizeUnit * 3}px;
                          `}
                          hotkeys={[
                            {
                              name: 'formatQuery',
                              key: 'ctrl+shift+f',
                              func: () => {
                                onQueryFormat();
                              },
                            },
                          ]}
                          language="sql"
                          offerEditInModal={false}
                          minLines={10}
                          maxLines={Infinity}
                          readOnly={!isEditMode}
                          resize="both"
                        />
                      )
                    }
                    additionalControl={
                      <div
                        css={css`
                          position: absolute;
                          right: 0;
                          top: 0;
                          z-index: 2;
                          display: flex;
                        `}
                      >
                        <Button
                          disabled={database?.isLoading}
                          tooltip={t('Open SQL Lab in a new tab')}
                          buttonStyle="secondary"
                          onClick={() => {
                            openOnSqlLab();
                          }}
                          icon={<Icons.ExportOutlined iconSize="s" />}
                        />
                        <Button
                          disabled={database?.isLoading}
                          tooltip={t('Run query')}
                          buttonStyle="primary"
                          onClick={() => {
                            onQueryRun();
                          }}
                          icon={<Icons.CaretRightFilled iconSize="s" />}
                        />
                      </div>
                    }
                  />
                  {database?.queryResult && (
                    <>
                      <div
                        css={themeParam => css`
                          margin-bottom: ${themeParam.sizeUnit}px;
                        `}
                      >
                        <span
                          css={themeParam => css`
                            color: ${themeParam.colorText};
                            font-size: ${themeParam.fontSizeSM}px;
                          `}
                        >
                          {t(
                            'In this view you can preview the first 25 rows. ',
                          )}
                        </span>
                        {renderOpenInSqlLabLink()}
                        <span
                          css={themeParam => css`
                            color: ${themeParam.colorText};
                            font-size: ${themeParam.fontSizeSM}px;
                          `}
                        >
                          {t(' to see details.')}
                        </span>
                      </div>
                      <ResultTable
                        data={database?.queryResult?.data ?? []}
                        queryId={database?.queryResult?.query?.id ?? ''}
                        orderedColumnKeys={
                          database?.queryResult?.columns?.map(
                            col => col.column_name,
                          ) ?? []
                        }
                        expandedColumns={database?.queryResult?.expanded_columns?.map(
                          col => col.column_name,
                        )}
                        height={300}
                        allowHTML
                      />
                    </>
                  )}
                  {database?.error && renderSqlErrorMessage()}
                </>
              )}
            </div>
          )}
          {datasourceType === DATASOURCE_TYPES.physical.key && (
            <Col xs={24} md={12}>
              {isSqla && (
                <Field
                  fieldKey="tableSelector"
                  label={t('Physical')}
                  control={
                    <div css={{ marginTop: 8 }}>
                      <TableSelector
                        clearable={false}
                        database={
                          datasource.database
                            ? {
                                id: datasource.database.id,
                                database_name:
                                  datasource.database.database_name ??
                                  datasource.database.name ??
                                  '',
                                backend: datasource.database.backend,
                              }
                            : null
                        }
                        handleError={addDangerToast}
                        catalog={datasource.catalog}
                        schema={datasource.schema}
                        tableValue={datasource.table_name}
                        onCatalogChange={
                          isEditMode
                            ? catalog =>
                                onDatasourcePropChange('catalog', catalog)
                            : undefined
                        }
                        onSchemaChange={
                          isEditMode
                            ? schema => onDatasourcePropChange('schema', schema)
                            : undefined
                        }
                        onDbChange={
                          isEditMode
                            ? db => onDatasourcePropChange('database', db)
                            : undefined
                        }
                        onTableSelectChange={
                          isEditMode
                            ? table =>
                                onDatasourcePropChange('table_name', table)
                            : undefined
                        }
                        readOnly={!isEditMode}
                      />
                    </div>
                  }
                  description={t(
                    'The pointer to a physical table (or view). Keep in mind that the chart is ' +
                      'associated to this Superset logical table, and this logical table points ' +
                      'the physical table referenced here.',
                  )}
                />
              )}
            </Col>
          )}
        </Fieldset>
      </div>
    ),
    [
      onChangeEditMode,
      isEditMode,
      datasourceType,
      onDatasourceTypeChange,
      datasource,
      onDatasourceChange,
      isSqla,
      addDangerToast,
      onDatasourcePropChange,
      database,
      renderSqlEditorOverlay,
      onQueryFormat,
      openOnSqlLab,
      onQueryRun,
      renderOpenInSqlLabLink,
      renderSqlErrorMessage,
    ],
  );

  const renderErrors = useCallback(() => {
    if (errors.length > 0) {
      return (
        <Alert
          css={themeParam => ({ marginBottom: themeParam.sizeUnit * 4 })}
          type="error"
          message={
            <>
              {errors.map(err => (
                <div key={err}>{err}</div>
              ))}
            </>
          }
        />
      );
    }
    return null;
  }, [errors]);

  const renderMetricCollection = useCallback(() => {
    const { metrics } = datasource;
    const sortedMetrics = metrics?.length ? sortMetrics(metrics) : [];
    return (
      <CollectionTable
        tableColumns={['metric_name', 'verbose_name', 'expression']}
        sortColumns={['metric_name', 'verbose_name', 'expression']}
        columnLabels={{
          metric_name: t('Metric Key'),
          verbose_name: t('Label'),
          expression: t('SQL expression'),
        }}
        columnLabelTooltips={{
          metric_name: t(
            'This field is used as a unique identifier to attach ' +
              'the metric to charts. It is also used as the alias in the ' +
              'SQL query.',
          ),
        }}
        expandFieldset={
          <FormContainer>
            <Fieldset compact>
              <Field
                fieldKey="description"
                label={t('Description')}
                control={
                  <TextControl
                    controlId="description"
                    placeholder={t('Description')}
                  />
                }
              />
              <Field
                fieldKey="d3format"
                label={t('D3 format')}
                control={
                  <TextControl controlId="d3format" placeholder="%y/%m/%d" />
                }
              />
              <Field
                fieldKey="currency"
                label={t('Metric currency')}
                control={
                  <CurrencyControl
                    onChange={() => {}}
                    currencySelectOverrideProps={{
                      placeholder: t('Select or type currency symbol'),
                    }}
                    symbolSelectAdditionalStyles={css`
                      max-width: 30%;
                    `}
                  />
                }
              />
              <Field
                label={t('Certified by')}
                fieldKey="certified_by"
                description={t(
                  'Person or group that has certified this metric',
                )}
                control={
                  <TextControl
                    controlId="certified_by"
                    placeholder={t('Certified by')}
                  />
                }
              />
              <Field
                label={t('Certification details')}
                fieldKey="certification_details"
                description={t('Details of the certification')}
                control={
                  <TextControl
                    controlId="certification_details"
                    placeholder={t('Certification details')}
                  />
                }
              />
              <Field
                label={t('Warning')}
                fieldKey="warning_markdown"
                description={t('Optional warning about use of this metric')}
                control={
                  <TextAreaControl
                    controlId="warning_markdown"
                    language="markdown"
                    offerEditInModal={false}
                    resize="vertical"
                  />
                }
              />
            </Fieldset>
          </FormContainer>
        }
        collection={sortedMetrics}
        allowAddItem
        onChange={(value: unknown) => onDatasourcePropChange('metrics', value)}
        itemGenerator={() => ({
          metric_name: t('<new metric>'),
          verbose_name: '',
          expression: '',
        })}
        itemCellProps={{
          expression: () => ({
            width: '240px',
          }),
        }}
        itemRenderers={{
          metric_name: (v, onItemChange, _, record) => (
            <FlexRowContainer>
              {record.is_certified && (
                <CertifiedBadge
                  certifiedBy={record.certified_by}
                  details={record.certification_details}
                />
              )}
              {record.warning_markdown && (
                <WarningIconWithTooltip
                  warningMarkdown={record.warning_markdown}
                />
              )}
              <EditableTitle
                canEdit
                title={v as string}
                onSaveTitle={onItemChange}
                maxWidth={300}
              />
            </FlexRowContainer>
          ),
          verbose_name: (v, onItemChange) => (
            <TextControl value={v as string} onChange={onItemChange} />
          ),
          expression: (v, onItemChange) => (
            <TextAreaControl
              canEdit
              initialValue={v as string}
              onChange={onItemChange}
              extraClasses={['datasource-sql-expression']}
              language="sql"
              offerEditInModal={false}
              minLines={5}
              textAreaStyles={{ minWidth: '200px', maxWidth: '450px' }}
              resize="both"
            />
          ),
          description: (v, onItemChange, label) => (
            <StackedField
              label={label}
              formElement={
                <TextControl value={v as string} onChange={onItemChange} />
              }
            />
          ),
          d3format: (v, onItemChange, label) => (
            <StackedField
              label={label}
              formElement={
                <TextControl value={v as string} onChange={onItemChange} />
              }
            />
          ),
        }}
        allowDeletes
        stickyHeader
      />
    );
  }, [datasource, sortMetrics, onDatasourcePropChange]);

  const sortedMetrics = useMemo(
    () => (datasource.metrics?.length ? sortMetrics(datasource.metrics) : []),
    [datasource.metrics, sortMetrics],
  );

  const tabItems = useMemo(
    () => [
      {
        key: TABS_KEYS.SOURCE,
        label: t('Source'),
        children: renderSourceFieldset(),
      },
      {
        key: TABS_KEYS.METRICS,
        label: (
          <CollectionTabTitle collection={sortedMetrics} title={t('Metrics')} />
        ),
        children: renderMetricCollection(),
      },
      {
        key: TABS_KEYS.COLUMNS,
        label: (
          <CollectionTabTitle
            collection={databaseColumns}
            title={t('Columns')}
          />
        ),
        children: (
          <StyledTableTabWrapper>
            {renderDefaultColumnSettings()}
            <DefaultColumnSettingsTitle>
              {t('Column Settings')}
            </DefaultColumnSettingsTitle>
            <ColumnButtonWrapper>
              <StyledButtonWrapper>
                <Button
                  buttonSize="small"
                  buttonStyle="tertiary"
                  onClick={syncMetadata}
                  className="sync-from-source"
                  disabled={isEditMode}
                >
                  <Icons.DatabaseOutlined iconSize="m" />
                  {t('Sync columns from source')}
                </Button>
              </StyledButtonWrapper>
            </ColumnButtonWrapper>
            <ColumnCollectionTable
              className="columns-table"
              columns={databaseColumns}
              datasource={datasource}
              onColumnsChange={cols => setColumns({ databaseColumns: cols })}
              onDatasourceChange={onDatasourceChange}
            />
            {metadataLoading && <Loading />}
          </StyledTableTabWrapper>
        ),
      },
      {
        key: TABS_KEYS.CALCULATED_COLUMNS,
        label: (
          <CollectionTabTitle
            collection={calculatedColumns}
            title={t('Calculated columns')}
          />
        ),
        children: (
          <StyledTableTabWrapper>
            {renderDefaultColumnSettings()}
            <DefaultColumnSettingsTitle>
              {t('Column Settings')}
            </DefaultColumnSettingsTitle>
            <ColumnCollectionTable
              columns={calculatedColumns}
              onColumnsChange={cols => setColumns({ calculatedColumns: cols })}
              columnLabelTooltips={{
                column_name: t(
                  'This field is used as a unique identifier to attach ' +
                    'the calculated dimension to charts. It is also used ' +
                    'as the alias in the SQL query.',
                ),
              }}
              onDatasourceChange={onDatasourceChange}
              datasource={datasource}
              editableColumnName
              showExpression
              allowAddItem
              allowEditDataType
              itemGenerator={() => ({
                column_name: t('<new column>'),
                filterable: true,
                groupby: true,
                expression: t('<enter SQL expression here>'),
                expanded: true,
              })}
            />
          </StyledTableTabWrapper>
        ),
      },
      {
        key: TABS_KEYS.USAGE,
        label: (
          <CollectionTabTitle
            collection={{ length: usageChartsCount }}
            title={t('Usage')}
          />
        ),
        children: (
          <StyledTableTabWrapper>
            <DatasetUsageTab
              datasourceId={datasource.id ?? 0}
              charts={
                usageCharts as React.ComponentProps<
                  typeof DatasetUsageTab
                >['charts']
              }
              totalCount={usageChartsCount}
              onFetchCharts={fetchUsageData}
              addDangerToast={addDangerToast}
            />
          </StyledTableTabWrapper>
        ),
      },
      ...(isFeatureEnabled(FeatureFlag.DatasetFolders)
        ? [
            {
              key: TABS_KEYS.FOLDERS,
              label: (
                <CollectionTabTitle collection={folders} title={t('Folders')} />
              ),
              children: (
                <FoldersEditor
                  folders={folders}
                  metrics={
                    sortedMetrics as unknown as import('@superset-ui/chart-controls').Metric[]
                  }
                  columns={databaseColumns}
                  onChange={handleFoldersChange}
                />
              ),
            },
          ]
        : []),
      {
        key: TABS_KEYS.SETTINGS,
        label: t('Settings'),
        children: (
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <FormContainer>{renderSettingsFieldset()}</FormContainer>
            </Col>
            <Col xs={24} md={12}>
              <FormContainer>{renderAdvancedFieldset()}</FormContainer>
            </Col>
          </Row>
        ),
      },
    ],
    [
      renderSourceFieldset,
      sortedMetrics,
      renderMetricCollection,
      databaseColumns,
      renderDefaultColumnSettings,
      syncMetadata,
      isEditMode,
      datasource,
      setColumns,
      onDatasourceChange,
      metadataLoading,
      calculatedColumns,
      usageChartsCount,
      usageCharts,
      fetchUsageData,
      addDangerToast,
      folders,
      handleFoldersChange,
      renderSettingsFieldset,
      renderAdvancedFieldset,
    ],
  );

  return (
    <DatasourceContainer data-test="datasource-editor">
      {renderErrors()}
      <Alert
        css={themeParam => ({ marginBottom: themeParam.sizeUnit * 4 })}
        type="warning"
        message={
          <>
            {' '}
            <strong>{t('Be careful.')} </strong>
            {t(
              'Changing these settings will affect all charts using this dataset, including charts owned by other people.',
            )}
          </>
        }
      />
      <StyledTableTabs
        id="table-tabs"
        data-test="edit-dataset-tabs"
        onChange={handleTabSelect}
        defaultActiveKey={activeTabKey}
        items={tabItems}
      />
    </DatasourceContainer>
  );
}

export default withToasts(connector(DatasourceEditor));
