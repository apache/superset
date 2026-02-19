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
import { PureComponent, useCallback, type ReactNode } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import type { JsonObject } from '@superset-ui/core';
import type { SupersetTheme } from '@apache-superset/core/ui';
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
  withTheme,
  t,
} from '@apache-superset/core/ui';
import Tabs from '@superset-ui/core/components/Tabs';
import WarningIconWithTooltip from '@superset-ui/core/components/WarningIconWithTooltip';
import TableSelector from 'src/components/TableSelector';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import TextControl from 'src/explore/components/controls/TextControl';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import SpatialControl from 'src/explore/components/controls/SpatialControl';
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
import {
  OwnerSelectLabel,
  OWNER_TEXT_LABEL_PROP,
  OWNER_EMAIL_PROP,
  OWNER_OPTION_FILTER_PROPS,
} from 'src/features/owners/OwnerSelectLabel';
import { DatabaseSelector } from '../../../DatabaseSelector';
import CollectionTable from '../CollectionTable';
import Fieldset from '../Fieldset';
import Field from '../Field';
import { fetchSyncedColumns, updateColumns } from '../../utils';
import DatasetUsageTab from './components/DatasetUsageTab';
import {
  DEFAULT_COLUMNS_FOLDER_UUID,
  DEFAULT_FOLDERS_COUNT,
  DEFAULT_METRICS_FOLDER_UUID,
} from '../../FoldersEditor/constants';
import { validateFolders } from '../../FoldersEditor/folderValidation';
import { countAllFolders } from '../../FoldersEditor/treeUtils';
import FoldersEditor from '../../FoldersEditor';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';

const extensionsRegistry = getExtensionsRegistry();

// Type definitions

interface Owner {
  id?: number;
  value?: number;
  label?: ReactNode;
  first_name?: string;
  last_name?: string;
  email?: string;
  [key: string]: unknown;
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
  theme?: SupersetTheme;
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

interface DatasourceEditorState {
  datasource: DatasourceObject;
  errors: string[];
  isSqla: boolean;
  isEditMode: boolean;
  databaseColumns: Column[];
  calculatedColumns: Column[];
  folders: DatasourceFolder[];
  folderCount: number;
  metadataLoading: boolean;
  activeTabKey: string;
  datasourceType: string;
  usageCharts: ChartUsageData[];
  usageChartsCount: number;
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
  count?: number;
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
  count,
}: CollectionTabTitleProps): JSX.Element {
  return (
    <div
      css={{ display: 'flex', alignItems: 'center' }}
      data-test={`collection-tab-${title}`}
    >
      {title}{' '}
      <StyledBadge
        count={count ?? (collection ? collection.length : 0)}
        showZero
      />
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
            label: OwnerSelectLabel({
              name: item.text as string,
              email: item.extra?.email as string | undefined,
            }),
            [OWNER_TEXT_LABEL_PROP]: item.text as string,
            [OWNER_EMAIL_PROP]: (item.extra?.email as string) ?? '',
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
      optionFilterProps={OWNER_OPTION_FILTER_PROPS}
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

type DatasourceEditorProps = DatasourceEditorOwnProps &
  PropsFromRedux & {
    theme?: SupersetTheme;
  };

class DatasourceEditor extends PureComponent<
  DatasourceEditorProps,
  DatasourceEditorState
> {
  private isComponentMounted: boolean;

  private abortControllers: AbortControllers;

  static defaultProps = {
    onChange: () => {},
    setIsEditing: () => {},
  };

  constructor(props: DatasourceEditorProps) {
    super(props);
    this.state = {
      datasource: {
        ...props.datasource,
        owners: props.datasource.owners.map(owner => {
          const ownerName =
            owner.label || `${owner.first_name} ${owner.last_name}`;
          return {
            value: owner.value || owner.id,
            label: OwnerSelectLabel({
              name: typeof ownerName === 'string' ? ownerName : '',
              email: owner.email,
            }),
            [OWNER_TEXT_LABEL_PROP]:
              typeof ownerName === 'string' ? ownerName : '',
            [OWNER_EMAIL_PROP]: owner.email ?? '',
          };
        }),
        metrics: props.datasource.metrics?.map(metric => {
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
      },
      errors: [],
      isSqla:
        props.datasource.datasource_type === 'table' ||
        props.datasource.type === 'table',
      isEditMode: false,
      databaseColumns: props.datasource.columns.filter(col => !col.expression),
      calculatedColumns: props.datasource.columns.filter(
        col => !!col.expression,
      ),
      folders: props.datasource.folders || [],
      folderCount:
        countAllFolders(props.datasource.folders || []) + DEFAULT_FOLDERS_COUNT,
      metadataLoading: false,
      activeTabKey: TABS_KEYS.SOURCE,
      datasourceType: props.datasource.sql
        ? DATASOURCE_TYPES.virtual.key
        : DATASOURCE_TYPES.physical.key,
      usageCharts: [],
      usageChartsCount: 0,
    };

    this.isComponentMounted = false;
    this.abortControllers = {
      formatQuery: null,
      formatSql: null,
      syncMetadata: null,
      fetchUsageData: null,
    };

    this.onChange = this.onChange.bind(this);
    this.onChangeEditMode = this.onChangeEditMode.bind(this);
    this.onDatasourcePropChange = this.onDatasourcePropChange.bind(this);
    this.onDatasourceChange = this.onDatasourceChange.bind(this);
    this.tableChangeAndSyncMetadata =
      this.tableChangeAndSyncMetadata.bind(this);
    this.syncMetadata = this.syncMetadata.bind(this);
    this.setColumns = this.setColumns.bind(this);
    this.validateAndChange = this.validateAndChange.bind(this);
    this.handleTabSelect = this.handleTabSelect.bind(this);
    this.formatSql = this.formatSql.bind(this);
    this.fetchUsageData = this.fetchUsageData.bind(this);
    this.handleFoldersChange = this.handleFoldersChange.bind(this);
  }

  onChange() {
    // Emptying SQL if "Physical" radio button is selected
    // Currently the logic to know whether the source is
    // physical or virtual is based on whether SQL is empty or not.
    const { datasourceType, datasource } = this.state;
    const sql =
      datasourceType === DATASOURCE_TYPES.physical.key ? '' : datasource.sql;

    const newDatasource = {
      ...this.state.datasource,
      sql,
      columns: [...this.state.databaseColumns, ...this.state.calculatedColumns],
      folders: this.state.folders,
    };

    this.props.onChange?.(newDatasource, this.state.errors);
  }

  onChangeEditMode() {
    this.props.setIsEditing?.(!this.state.isEditMode);
    this.setState(prevState => ({ isEditMode: !prevState.isEditMode }));
  }

  onDatasourceChange(
    datasource: DatasourceObject,
    callback: () => void = this.validateAndChange,
  ) {
    this.setState({ datasource }, callback);
  }

  onDatasourcePropChange(attr: string, value: unknown) {
    if (value === undefined) return; // if value is undefined do not update state
    const datasource = { ...this.state.datasource, [attr]: value };
    this.setState(
      prevState => ({
        datasource: { ...prevState.datasource, [attr]: value },
      }),
      () =>
        attr === 'table_name'
          ? this.onDatasourceChange(datasource, this.tableChangeAndSyncMetadata)
          : this.onDatasourceChange(datasource, this.validateAndChange),
    );
  }

  onDatasourceTypeChange(datasourceType: string) {
    // Call onChange after setting datasourceType to ensure
    // SQL is cleared when switching to a physical dataset
    this.setState({ datasourceType }, this.onChange);
  }

  handleFoldersChange(folders: DatasourceFolder[]) {
    const folderCount = countAllFolders(folders);
    const userMadeFolders = folders.filter(
      f =>
        f.uuid !== DEFAULT_METRICS_FOLDER_UUID &&
        f.uuid !== DEFAULT_COLUMNS_FOLDER_UUID &&
        (f.children?.length ?? 0) > 0,
    );
    this.setState({ folders: userMadeFolders, folderCount }, () => {
      this.onDatasourceChange({
        ...this.state.datasource,
        folders: userMadeFolders,
      });
    });
  }

  setColumns(
    obj: { databaseColumns?: Column[] } | { calculatedColumns?: Column[] },
  ) {
    // update calculatedColumns or databaseColumns
    this.setState(
      obj as Pick<
        DatasourceEditorState,
        'databaseColumns' | 'calculatedColumns'
      >,
      this.validateAndChange,
    );
  }

  validateAndChange() {
    this.validate(this.onChange);
  }

  async onQueryRun() {
    const databaseId = this.state.datasource.database?.id;
    const { sql } = this.state.datasource;
    if (!databaseId || !sql) {
      return;
    }
    this.props.runQuery({
      client_id: this.props.database?.clientId,
      database_id: databaseId,
      runAsync: false,
      catalog: this.state.datasource.catalog,
      schema: this.state.datasource.schema,
      sql,
      tmp_table_name: '',
      select_as_cta: false,
      ctas_method: 'TABLE',
      queryLimit: 25,
      expand_data: true,
    });
  }

  /**
   * Formats SQL query using the formatQuery action.
   * Aborts any pending format requests before starting a new one.
   */
  async onQueryFormat() {
    const { datasource } = this.state;
    if (!datasource.sql || !this.state.isEditMode) {
      return;
    }

    // Abort previous formatQuery if still pending
    if (this.abortControllers.formatQuery) {
      this.abortControllers.formatQuery.abort();
    }

    this.abortControllers.formatQuery = new AbortController();
    const { signal } = this.abortControllers.formatQuery;

    try {
      const response = await this.props.formatQuery(datasource.sql, { signal });

      this.onDatasourcePropChange('sql', response.json.result);
      this.props.addSuccessToast(t('SQL was formatted'));
    } catch (error) {
      if (error.name === 'AbortError') return;

      const { error: clientError, statusText } =
        await getClientErrorObject(error);

      this.props.addDangerToast(
        clientError ||
          statusText ||
          t('An error occurred while formatting SQL'),
      );
    } finally {
      this.abortControllers.formatQuery = null;
    }
  }

  getSQLLabUrl() {
    const queryParams = new URLSearchParams({
      dbid: String(this.state.datasource.database?.id ?? ''),
      sql: this.state.datasource.sql ?? '',
      name: this.state.datasource.datasource_name ?? '',
      schema: this.state.datasource.schema ?? '',
      autorun: 'true',
      isDataset: 'true',
    });
    return makeUrl(`/sqllab/?${queryParams.toString()}`);
  }

  openOnSqlLab() {
    window.open(this.getSQLLabUrl(), '_blank', 'noopener,noreferrer');
  }

  tableChangeAndSyncMetadata() {
    this.validate(() => {
      this.syncMetadata();
      this.onChange();
    });
  }

  /**
   * Formats SQL query using the SQL format API endpoint.
   * Aborts any pending format requests before starting a new one.
   */
  async formatSql() {
    const { datasource } = this.state;
    if (!datasource.sql) {
      return;
    }

    // Abort previous formatSql if still pending
    if (this.abortControllers.formatSql) {
      this.abortControllers.formatSql.abort();
    }

    this.abortControllers.formatSql = new AbortController();
    const { signal } = this.abortControllers.formatSql;

    try {
      const response = await SupersetClient.post({
        endpoint: '/api/v1/sql/format',
        body: JSON.stringify({ sql: datasource.sql }),
        headers: { 'Content-Type': 'application/json' },
        signal,
      });

      this.onDatasourcePropChange('sql', response.json.result);
      this.props.addSuccessToast(t('SQL was formatted'));
    } catch (error) {
      if (error.name === 'AbortError') return;

      const { error: clientError, statusText } =
        await getClientErrorObject(error);

      this.props.addDangerToast(
        clientError ||
          statusText ||
          t('An error occurred while formatting SQL'),
      );
    } finally {
      this.abortControllers.formatSql = null;
    }
  }

  /**
   * Syncs dataset columns with the database schema.
   * Fetches column metadata from the underlying table/view and updates the dataset.
   * Aborts any pending sync requests before starting a new one.
   */
  async syncMetadata() {
    const { datasource } = this.state;

    // Abort previous syncMetadata if still pending
    if (this.abortControllers.syncMetadata) {
      this.abortControllers.syncMetadata.abort();
    }

    this.abortControllers.syncMetadata = new AbortController();
    const { signal } = this.abortControllers.syncMetadata;

    this.setState({ metadataLoading: true });

    try {
      const newCols = await fetchSyncedColumns(datasource, signal);

      const columnChanges = updateColumns(
        datasource.columns,
        newCols,
        this.props.addSuccessToast,
      );
      this.setColumns({
        databaseColumns: columnChanges.finalColumns.filter(
          col => !col.expression, // remove calculated columns
        ) as Column[],
      });

      if (datasource.id !== undefined) {
        clearDatasetCache(datasource.id);
      }

      this.props.addSuccessToast(t('Metadata has been synced'));
      this.setState({ metadataLoading: false });
    } catch (error) {
      if (error.name === 'AbortError') {
        // Only update state if still mounted (abort may happen during unmount)
        if (this.isComponentMounted) {
          this.setState({ metadataLoading: false });
        }
        return;
      }

      const { error: clientError, statusText } =
        await getClientErrorObject(error);

      this.props.addDangerToast(
        clientError || statusText || t('An error has occurred'),
      );
      this.setState({ metadataLoading: false });
    } finally {
      this.abortControllers.syncMetadata = null;
    }
  }

  /**
   * Fetches chart usage data for this dataset (which charts use this dataset).
   * Aborts any pending fetch requests before starting a new one.
   *
   * @param {number} page - Page number (1-indexed)
   * @param {number} pageSize - Number of results per page
   * @param {string} sortColumn - Column to sort by
   * @param {string} sortDirection - Sort direction ('asc' or 'desc')
   * @returns {Promise<{charts: Array, count: number, ids: Array}>} Chart usage data
   */
  async fetchUsageData(
    page = 1,
    pageSize = 25,
    sortColumn = 'changed_on_delta_humanized',
    sortDirection = 'desc',
  ) {
    const { datasource } = this.state;

    // Abort previous fetchUsageData if still pending
    if (this.abortControllers.fetchUsageData) {
      this.abortControllers.fetchUsageData.abort();
    }

    this.abortControllers.fetchUsageData = new AbortController();
    const { signal } = this.abortControllers.fetchUsageData;

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

      // Map chart IDs to chart objects
      const chartsWithIds = charts.map(
        (chart: Omit<ChartUsageData, 'id'>, index: number) => ({
          ...chart,
          id: ids[index],
        }),
      );

      // Only update state if not aborted and component still mounted
      if (!signal.aborted && this.isComponentMounted) {
        this.setState({
          usageCharts: chartsWithIds,
          usageChartsCount: json?.count || 0,
        });
      }

      return {
        charts: chartsWithIds,
        count: json?.count || 0,
        ids,
      };
    } catch (error) {
      // Rethrow AbortError so callers can handle gracefully
      if (error.name === 'AbortError') throw error;

      const { error: clientError, statusText } =
        await getClientErrorObject(error);

      this.props.addDangerToast(
        clientError ||
          statusText ||
          t('An error occurred while fetching usage data'),
      );
      this.setState({
        usageCharts: [],
        usageChartsCount: 0,
      });

      return {
        charts: [],
        count: 0,
        ids: [],
      };
    } finally {
      this.abortControllers.fetchUsageData = null;
    }
  }

  findDuplicates<T>(arr: T[], accessor: (obj: T) => string): string[] {
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
  }

  validate(callback: () => void) {
    let errors: string[] = [];
    let dups: string[];
    const { datasource } = this.state;

    // Looking for duplicate column_name
    dups = this.findDuplicates(datasource.columns, obj => obj.column_name);
    errors = errors.concat(
      dups.map(name => t('Column name [%s] is duplicated', name)),
    );

    // Looking for duplicate metric_name
    dups = this.findDuplicates(
      datasource.metrics ?? [],
      obj => obj.metric_name,
    );
    errors = errors.concat(
      dups.map(name => t('Metric name [%s] is duplicated', name)),
    );

    // Making sure calculatedColumns have an expression defined
    const noFilterCalcCols = this.state.calculatedColumns.filter(
      col => !col.expression && !col.json,
    );
    errors = errors.concat(
      noFilterCalcCols.map(col =>
        t('Calculated column [%s] requires an expression', col.column_name),
      ),
    );

    // validate currency code (skip 'AUTO' - it's a placeholder for auto-detection)
    try {
      this.state.datasource.metrics?.forEach(
        metric =>
          metric.currency?.symbol &&
          metric.currency.symbol !== 'AUTO' &&
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: metric.currency.symbol,
          }),
      );
    } catch {
      errors = errors.concat([t('Invalid currency code in saved metrics')]);
    }

    // Validate folders
    if (this.state.folders?.length > 0) {
      const folderValidation = validateFolders(this.state.folders);
      errors = errors.concat(folderValidation.errors);
    }

    this.setState({ errors }, callback);
  }

  handleTabSelect(activeTabKey: string) {
    this.setState({ activeTabKey });
  }

  sortMetrics(metrics: Metric[]) {
    return metrics.sort(
      ({ id: a }: { id?: number }, { id: b }: { id?: number }) =>
        (b ?? 0) - (a ?? 0),
    );
  }

  renderDefaultColumnSettings() {
    const { datasource, databaseColumns, calculatedColumns } = this.state;
    const { theme } = this.props;
    const allColumns = [...databaseColumns, ...calculatedColumns];

    // Get datetime-compatible columns for the default datetime dropdown
    const datetimeColumns = allColumns
      .filter(col => col.is_dttm)
      .map(col => ({
        value: col.column_name,
        label: col.verbose_name || col.column_name,
      }));

    // String columns + untyped calculated columns for the currency code dropdown
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
                this.onDatasourceChange({
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
                this.onDatasourceChange({
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
  }

  renderSettingsFieldset() {
    const { datasource } = this.state;
    return (
      <Fieldset
        title={t('Basic')}
        item={datasource}
        onChange={this.onDatasourceChange}
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
        {this.state.isSqla && (
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
        {this.state.isSqla && (
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
            this.onDatasourceChange({ ...datasource, owners: newOwners });
          }}
        />
      </Fieldset>
    );
  }

  renderAdvancedFieldset() {
    const { datasource } = this.state;
    return (
      <Fieldset
        title={t('Advanced')}
        item={datasource}
        onChange={this.onDatasourceChange}
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
        {this.state.isSqla && (
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
    );
  }

  renderSpatialTab() {
    const { datasource } = this.state;
    const { spatials, all_cols: allCols } = datasource;

    return {
      key: TABS_KEYS.SPATIAL,
      label: <CollectionTabTitle collection={spatials} title={t('Spatial')} />,
      children: (
        <CollectionTable
          tableColumns={['name', 'config']}
          sortColumns={['name']}
          onChange={this.onDatasourcePropChange.bind(this, 'spatials')}
          itemGenerator={() => ({
            name: t('<new spatial>'),
            type: t('<no type>'),
            config: null,
          })}
          collection={spatials ?? []}
          allowDeletes
          itemRenderers={{
            name: (d, onChange) => (
              <EditableTitle
                canEdit
                title={d as string}
                onSaveTitle={onChange}
              />
            ),
            config: (v, onChange) => (
              <SpatialControl
                value={
                  v as {
                    type: 'latlong' | 'delimited' | 'geohash';
                  }
                }
                onChange={onChange}
                choices={allCols?.map(col => [col, col] as [string, string])}
              />
            ),
          }}
        />
      ),
    };
  }

  renderSqlEditorOverlay = () => (
    <div
      css={theme => css`
        position: absolute;
        background: ${theme.colorBgLayout};
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
          css={theme => css`
            display: block;
            margin: ${theme.sizeUnit * 4}px auto;
            width: fit-content;
            color: ${theme.colorText};
          `}
        >
          {t('We are working on your query')}
        </span>
      </div>
    </div>
  );

  renderOpenInSqlLabLink(isError = false) {
    return (
      <a
        href={this.getSQLLabUrl()}
        target="_blank"
        rel="noopener noreferrer"
        css={theme => css`
          color: ${isError ? theme.colorErrorText : theme.colorText};
          font-size: ${theme.fontSizeSM}px;
          text-decoration: underline;
        `}
      >
        {t('Open in SQL lab')}
      </a>
    );
  }

  renderSqlErrorMessage = () => (
    <span
      css={theme => css`
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorErrorText};
      `}
    >
      {this.props.database?.error && t('Error executing query. ')}
      {this.renderOpenInSqlLabLink(true)}
      {t(' to check for details.')}
    </span>
  );

  renderSourceFieldset() {
    const { datasource } = this.state;

    return (
      <div>
        <EditLockContainer>
          <span
            css={theme => css`
              color: ${theme.colorTextTertiary};
            `}
            role="button"
            tabIndex={0}
            onClick={this.onChangeEditMode}
          >
            {this.state.isEditMode ? (
              <Icons.UnlockOutlined
                iconSize="xl"
                css={theme => css`
                  margin: auto ${theme.sizeUnit}px auto 0;
                `}
              />
            ) : (
              <Icons.LockOutlined
                iconSize="xl"
                css={theme => ({
                  margin: `auto ${theme.sizeUnit}px auto 0`,
                })}
              />
            )}
          </span>
          {!this.state.isEditMode && (
            <div>{t('Click the lock to make changes.')}</div>
          )}
          {this.state.isEditMode && (
            <div>{t('Click the lock to prevent further changes.')}</div>
          )}
        </EditLockContainer>
        <div
          css={theme => css`
            margin-top: ${theme.sizeUnit * 3}px;
            display: flex;
            gap: ${theme.sizeUnit * 4}px;
          `}
        >
          {DATASOURCE_TYPES_ARR.map(type => (
            <Radio
              key={type.key}
              value={type.key}
              onChange={this.onDatasourceTypeChange.bind(this, type.key)}
              checked={this.state.datasourceType === type.key}
              disabled={!this.state.isEditMode}
            >
              {type.label}
            </Radio>
          ))}
        </div>
        <Divider />
        <Fieldset item={datasource} onChange={this.onDatasourceChange} compact>
          {this.state.datasourceType === DATASOURCE_TYPES.virtual.key && (
            <div>
              {this.state.isSqla && (
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
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('catalog', catalog)
                            }
                            onSchemaChange={schema =>
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('schema', schema)
                            }
                            onDbChange={database =>
                              this.state.isEditMode &&
                              this.onDatasourcePropChange('database', database)
                            }
                            formMode={false}
                            handleError={this.props.addDangerToast}
                            readOnly={!this.state.isEditMode}
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
                              this.onDatasourcePropChange('table_name', table);
                            }}
                            placeholder={t('Dataset name')}
                            disabled={!this.state.isEditMode}
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
                      this.props.database?.isLoading ? (
                        <>
                          {this.renderSqlEditorOverlay()}
                          <TextAreaControl
                            hotkeys={[
                              {
                                name: 'formatQuery',
                                key: 'ctrl+shift+f',
                                descr: t('Format SQL query'),
                                func: () => {
                                  this.onQueryFormat();
                                },
                              },
                            ]}
                            language="sql"
                            offerEditInModal={false}
                            minLines={10}
                            maxLines={Infinity}
                            readOnly={!this.state.isEditMode}
                            resize="both"
                          />
                        </>
                      ) : (
                        <TextAreaControl
                          css={theme => css`
                            margin-top: ${theme.sizeUnit * 3}px;
                          `}
                          hotkeys={[
                            {
                              name: 'formatQuery',
                              key: 'ctrl+shift+f',
                              descr: t('Format SQL query'),
                              func: () => {
                                this.onQueryFormat();
                              },
                            },
                          ]}
                          language="sql"
                          offerEditInModal={false}
                          minLines={10}
                          maxLines={Infinity}
                          readOnly={!this.state.isEditMode}
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
                          disabled={this.props.database?.isLoading}
                          tooltip={t('Open SQL Lab in a new tab')}
                          buttonStyle="secondary"
                          onClick={() => {
                            this.openOnSqlLab();
                          }}
                          icon={<Icons.ExportOutlined iconSize="s" />}
                        />
                        <Button
                          disabled={this.props.database?.isLoading}
                          tooltip={t('Run query')}
                          buttonStyle="primary"
                          onClick={() => {
                            this.onQueryRun();
                          }}
                          icon={<Icons.CaretRightFilled iconSize="s" />}
                        />
                      </div>
                    }
                  />
                  {this.props.database?.queryResult && (
                    <>
                      <div
                        css={theme => css`
                          margin-bottom: ${theme.sizeUnit}px;
                        `}
                      >
                        <span
                          css={theme => css`
                            color: ${theme.colorText};
                            font-size: ${theme.fontSizeSM}px;
                          `}
                        >
                          {t(
                            'In this view you can preview the first 25 rows. ',
                          )}
                        </span>
                        {this.renderOpenInSqlLabLink()}
                        <span
                          css={theme => css`
                            color: ${theme.colorText};
                            font-size: ${theme.fontSizeSM}px;
                          `}
                        >
                          {t(' to see details.')}
                        </span>
                      </div>
                      <ResultTable
                        data={this.props.database?.queryResult?.data ?? []}
                        queryId={
                          this.props.database?.queryResult?.query?.id ?? ''
                        }
                        orderedColumnKeys={
                          this.props.database?.queryResult?.columns?.map(
                            col => col.column_name,
                          ) ?? []
                        }
                        expandedColumns={this.props.database?.queryResult?.expanded_columns?.map(
                          col => col.column_name,
                        )}
                        height={300}
                        allowHTML
                      />
                    </>
                  )}
                  {this.props.database?.error && this.renderSqlErrorMessage()}
                </>
              )}
            </div>
          )}
          {this.state.datasourceType === DATASOURCE_TYPES.physical.key && (
            <Col xs={24} md={12}>
              {this.state.isSqla && (
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
                        handleError={this.props.addDangerToast}
                        catalog={datasource.catalog}
                        schema={datasource.schema}
                        tableValue={datasource.table_name}
                        onCatalogChange={
                          this.state.isEditMode
                            ? catalog =>
                                this.onDatasourcePropChange('catalog', catalog)
                            : undefined
                        }
                        onSchemaChange={
                          this.state.isEditMode
                            ? schema =>
                                this.onDatasourcePropChange('schema', schema)
                            : undefined
                        }
                        onDbChange={
                          this.state.isEditMode
                            ? database =>
                                this.onDatasourcePropChange(
                                  'database',
                                  database,
                                )
                            : undefined
                        }
                        onTableSelectChange={
                          this.state.isEditMode
                            ? table =>
                                this.onDatasourcePropChange('table_name', table)
                            : undefined
                        }
                        readOnly={!this.state.isEditMode}
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
    );
  }

  renderErrors() {
    if (this.state.errors.length > 0) {
      return (
        <Alert
          css={theme => ({ marginBottom: theme.sizeUnit * 4 })}
          type="error"
          message={
            <>
              {this.state.errors.map(err => (
                <div key={err}>{err}</div>
              ))}
            </>
          }
        />
      );
    }
    return null;
  }

  renderMetricCollection() {
    const { datasource } = this.state;
    const { metrics } = datasource;
    const sortedMetrics = metrics?.length ? this.sortMetrics(metrics) : [];
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
        onChange={this.onDatasourcePropChange.bind(this, 'metrics')}
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
          metric_name: (v, onChange, _, record) => (
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
                onSaveTitle={onChange}
                maxWidth={300}
              />
            </FlexRowContainer>
          ),
          verbose_name: (v, onChange) => (
            <TextControl value={v as string} onChange={onChange} />
          ),
          expression: (v, onChange) => (
            <TextAreaControl
              canEdit
              initialValue={v as string}
              onChange={onChange}
              extraClasses={['datasource-sql-expression']}
              language="sql"
              offerEditInModal={false}
              minLines={5}
              textAreaStyles={{ minWidth: '200px', maxWidth: '450px' }}
              resize="both"
            />
          ),
          description: (v, onChange, label) => (
            <StackedField
              label={label}
              formElement={
                <TextControl value={v as string} onChange={onChange} />
              }
            />
          ),
          d3format: (v, onChange, label) => (
            <StackedField
              label={label}
              formElement={
                <TextControl value={v as string} onChange={onChange} />
              }
            />
          ),
        }}
        allowDeletes
        stickyHeader
      />
    );
  }

  render() {
    const { datasource, activeTabKey } = this.state;
    const { metrics } = datasource;
    const sortedMetrics = metrics?.length ? this.sortMetrics(metrics) : [];

    return (
      <DatasourceContainer data-test="datasource-editor">
        {this.renderErrors()}
        <Alert
          css={theme => ({ marginBottom: theme.sizeUnit * 4 })}
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
          onChange={this.handleTabSelect}
          defaultActiveKey={activeTabKey}
          items={[
            {
              key: TABS_KEYS.SOURCE,
              label: t('Source'),
              children: this.renderSourceFieldset(),
            },
            {
              key: TABS_KEYS.METRICS,
              label: (
                <CollectionTabTitle
                  collection={sortedMetrics}
                  title={t('Metrics')}
                />
              ),
              children: this.renderMetricCollection(),
            },
            {
              key: TABS_KEYS.COLUMNS,
              label: (
                <CollectionTabTitle
                  collection={this.state.databaseColumns}
                  title={t('Columns')}
                />
              ),
              children: (
                <StyledTableTabWrapper>
                  {this.renderDefaultColumnSettings()}
                  <DefaultColumnSettingsTitle>
                    {t('Column Settings')}
                  </DefaultColumnSettingsTitle>
                  <ColumnButtonWrapper>
                    <StyledButtonWrapper>
                      <Button
                        buttonSize="small"
                        buttonStyle="tertiary"
                        onClick={this.syncMetadata}
                        className="sync-from-source"
                        disabled={this.state.isEditMode}
                      >
                        <Icons.DatabaseOutlined iconSize="m" />
                        {t('Sync columns from source')}
                      </Button>
                    </StyledButtonWrapper>
                  </ColumnButtonWrapper>
                  <ColumnCollectionTable
                    className="columns-table"
                    columns={this.state.databaseColumns}
                    datasource={datasource}
                    onColumnsChange={databaseColumns =>
                      this.setColumns({ databaseColumns })
                    }
                    onDatasourceChange={this.onDatasourceChange}
                  />
                  {this.state.metadataLoading && <Loading />}
                </StyledTableTabWrapper>
              ),
            },
            {
              key: TABS_KEYS.CALCULATED_COLUMNS,
              label: (
                <CollectionTabTitle
                  collection={this.state.calculatedColumns}
                  title={t('Calculated columns')}
                />
              ),
              children: (
                <StyledTableTabWrapper>
                  {this.renderDefaultColumnSettings()}
                  <DefaultColumnSettingsTitle>
                    {t('Column Settings')}
                  </DefaultColumnSettingsTitle>
                  <ColumnCollectionTable
                    columns={this.state.calculatedColumns}
                    onColumnsChange={calculatedColumns =>
                      this.setColumns({ calculatedColumns })
                    }
                    columnLabelTooltips={{
                      column_name: t(
                        'This field is used as a unique identifier to attach ' +
                          'the calculated dimension to charts. It is also used ' +
                          'as the alias in the SQL query.',
                      ),
                    }}
                    onDatasourceChange={this.onDatasourceChange}
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
                  collection={{ length: this.state.usageChartsCount }}
                  title={t('Usage')}
                />
              ),
              children: (
                <StyledTableTabWrapper>
                  <DatasetUsageTab
                    datasourceId={datasource.id ?? 0}
                    charts={
                      this.state.usageCharts as React.ComponentProps<
                        typeof DatasetUsageTab
                      >['charts']
                    }
                    totalCount={this.state.usageChartsCount}
                    onFetchCharts={this.fetchUsageData}
                    addDangerToast={this.props.addDangerToast}
                  />
                </StyledTableTabWrapper>
              ),
            },
            ...(isFeatureEnabled(FeatureFlag.DatasetFolders)
              ? [
                  {
                    key: TABS_KEYS.FOLDERS,
                    label: (
                      <CollectionTabTitle
                        count={this.state.folderCount}
                        title={t('Folders')}
                      />
                    ),
                    children: (
                      <FoldersEditor
                        folders={this.state.folders}
                        // Type cast needed: local Metric interface differs slightly from chart-controls Metric
                        metrics={
                          sortedMetrics as unknown as import('@superset-ui/chart-controls').Metric[]
                        }
                        columns={this.state.databaseColumns}
                        onChange={this.handleFoldersChange}
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
                    <FormContainer>
                      {this.renderSettingsFieldset()}
                    </FormContainer>
                  </Col>
                  <Col xs={24} md={12}>
                    <FormContainer>
                      {this.renderAdvancedFieldset()}
                    </FormContainer>
                  </Col>
                </Row>
              ),
            },
          ]}
        />
      </DatasourceContainer>
    );
  }

  componentDidUpdate(prevProps: DatasourceEditorProps): void {
    // Preserve calculated columns order when props change to prevent jumping
    if (this.props.datasource !== prevProps.datasource) {
      const newCalculatedColumns = this.props.datasource.columns.filter(
        col => !!col.expression,
      );
      const currentCalculatedColumns = this.state.calculatedColumns;

      if (newCalculatedColumns.length === currentCalculatedColumns.length) {
        // Try to preserve the order by matching with existing calculated columns
        const orderedCalculatedColumns: Column[] = [];
        const usedIds = new Set<string | number>();

        // First, add existing columns in their current order
        currentCalculatedColumns.forEach(currentCol => {
          const id = currentCol.id || currentCol.column_name;
          const updatedCol = newCalculatedColumns.find(
            newCol => (newCol.id || newCol.column_name) === id,
          );
          if (updatedCol) {
            orderedCalculatedColumns.push(updatedCol);
            usedIds.add(id);
          }
        });

        // Then add any new columns that weren't in the current list
        newCalculatedColumns.forEach(newCol => {
          const id = newCol.id || newCol.column_name;
          if (!usedIds.has(id)) {
            orderedCalculatedColumns.push(newCol);
          }
        });

        this.setState({
          calculatedColumns: orderedCalculatedColumns,
          databaseColumns: this.props.datasource.columns.filter(
            col => !col.expression,
          ),
        });
      }
    }
  }

  componentDidMount() {
    this.isComponentMounted = true;
    Mousetrap.bind('ctrl+shift+f', e => {
      e.preventDefault();
      if (this.state.isEditMode) {
        this.onQueryFormat();
      }
      return false;
    });
    this.fetchUsageData().catch(error => {
      if (error?.name !== 'AbortError') throw error;
    });
  }

  componentWillUnmount() {
    this.isComponentMounted = false;

    // Abort all pending requests
    Object.values(this.abortControllers).forEach(controller => {
      if (controller) controller.abort();
    });

    Mousetrap.unbind('ctrl+shift+f');
    this.props.resetQuery();
  }
}

const DataSourceComponent = withTheme(DatasourceEditor);

export default withToasts(connector(DataSourceComponent));
