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
import { t } from '@apache-superset/core/translation';
import {
  getExtensionsRegistry,
  SupersetClient,
  isFeatureEnabled,
  FeatureFlag,
} from '@superset-ui/core';
import { styled, useTheme, css } from '@apache-superset/core/theme';
import { FunctionComponent, useState, useMemo, useCallback, Key } from 'react';
import type { CellProps } from 'react-table';
import { Link, useHistory } from 'react-router-dom';
import rison from 'rison';
import {
  createFetchRelated,
  createFetchDistinct,
  createFetchOwners,
  createErrorHandler,
} from 'src/views/CRUD/utils';
import { OWNER_OPTION_FILTER_PROPS } from 'src/features/owners/OwnerSelectLabel';
import { ColumnObject } from 'src/features/datasets/types';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  Button,
  ConfirmStatusChange,
  CertifiedBadge,
  DeleteModal,
  Dropdown,
  Tooltip,
  InfoTooltip,
  DatasetTypeLabel,
  Loading,
  List,
} from '@superset-ui/core/components';
import {
  DatasourceModal,
  GenericLink,
  FacePile,
  ImportModal as ImportModelsModal,
  ModifiedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilters,
  type ListViewFetchDataConfig,
} from 'src/components';
import { Typography } from '@superset-ui/core/components/Typography';
import handleResourceExport from 'src/utils/export';
import SubMenu, { SubMenuProps, ButtonProps } from 'src/features/home/SubMenu';
import Owner from 'src/types/Owner';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Icons } from '@superset-ui/core/components/Icons';
import WarningIconWithTooltip from '@superset-ui/core/components/WarningIconWithTooltip';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';

import {
  PAGE_SIZE,
  SORT_BY,
  PASSWORDS_NEEDED_MESSAGE,
  CONFIRM_OVERWRITE_MESSAGE,
} from 'src/features/datasets/constants';
import DuplicateDatasetModal from 'src/features/datasets/DuplicateDatasetModal';
import type DatasetType from 'src/types/Dataset';
import SemanticViewEditModal from 'src/features/semanticViews/SemanticViewEditModal';
import AddSemanticViewModal from 'src/features/semanticViews/AddSemanticViewModal';
import {
  datasetLabel,
  datasetLabelLower,
  datasetsLabel,
  datasetsLabelLower,
  databaseLabel,
} from 'src/utils/semanticLayerLabels';
import { useSelector } from 'react-redux';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import { WIDER_DROPDOWN_WIDTH } from 'src/components/ListView/utils';
import type { BootstrapData } from 'src/types/bootstrapTypes';

const extensionsRegistry = getExtensionsRegistry();
const DatasetDeleteRelatedExtension = extensionsRegistry.get(
  'dataset.delete.related',
);

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit}px;

  svg {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const Actions = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorIcon};

    .disabled {
      svg,
      i {
        &:hover {
          path {
            fill: ${theme.colorText};
          }
        }
      }
      color: ${theme.colorTextDisabled};
      &:hover {
        cursor: not-allowed;
      }
      .ant-menu-item:hover {
        cursor: default;
      }
      &::after {
        color: ${theme.colorTextDisabled};
      }
    }
  `}
`;

type Dataset = {
  changed_by_name: string;
  changed_by: Owner;
  changed_on_delta_humanized: string;
  database: {
    id: string;
    database_name: string;
  } | null;
  kind: 'physical' | 'virtual' | 'semantic_view';
  source_type?: 'database' | 'semantic_layer';
  explore_url: string;
  id: number;
  owners: Array<Owner>;
  schema: string | null;
  table_name: string;
  description?: string | null;
  cache_timeout?: number | null;
  extra?: string | Record<string, any> | null;
  sql?: string | null;
};

interface VirtualDataset extends Dataset {
  kind: 'virtual';
  extra: string | Record<string, any>;
  sql: string;
}

interface DatasetListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

const DatasetList: FunctionComponent<DatasetListProps> = ({
  addDangerToast,
  addSuccessToast,
  user,
}) => {
  const history = useHistory();
  const theme = useTheme();
  const {
    state: { bulkSelectEnabled },
    hasPerm,
    toggleBulkSelect,
  } = useListViewResource<Dataset>(
    'dataset',
    datasetLabelLower(),
    addDangerToast,
  );

  // Combined endpoint state
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetCount, setDatasetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastFetchConfig, setLastFetchConfig] =
    useState<ListViewFetchDataConfig | null>(null);

  /**
   * Fetches "Data connection" filter options — a combined list of databases
   * and semantic layers.
   *
   * Semantic layer values are prefixed with "sl:" so that fetchData can tell
   * them apart from integer database IDs and route to the correct API filter.
   */
  const fetchConnectionOptions = useCallback(
    async (filterValue = '', page: number, pageSize: number) => {
      const showDatabases = currentSourceFilter !== 'semantic_layer';
      const showSemanticLayers =
        isFeatureEnabled(FeatureFlag.SemanticLayers) &&
        currentSourceFilter !== 'database';

      const [dbResult, slResult] = await Promise.all([
        showDatabases
          ? createFetchRelated(
              'dataset',
              'database',
              createErrorHandler(errMsg =>
                t(
                  'An error occurred while fetching %s: %s',
                  datasetsLabelLower(),
                  errMsg,
                ),
              ),
            )(filterValue, page, pageSize)
          : Promise.resolve({ data: [], totalCount: 0 }),
        showSemanticLayers
          ? SupersetClient.get({
              endpoint: `/api/v1/semantic_layer/?q=${rison.encode_uri({
                ...(filterValue
                  ? { filters: [{ col: 'name', opr: 'ct', value: filterValue }] }
                  : {}),
                page: 0,
                page_size: 100,
              })}`,
            })
              .then(({ json = {} }) => ({
                data: (json?.result ?? []).map(
                  (layer: { uuid: string; name: string }) => ({
                    label: layer.name,
                    // "sl:" prefix distinguishes semantic layers from DB integer IDs
                    value: `sl:${layer.uuid}`,
                  }),
                ),
                totalCount: json?.count ?? 0,
              }))
              .catch(() => ({ data: [], totalCount: 0 }))
          : Promise.resolve({ data: [], totalCount: 0 }),
      ]);

      return {
        // Semantic layers first, then databases
        data: [...slResult.data, ...dbResult.data],
        totalCount: slResult.totalCount + dbResult.totalCount,
      };
    },
    [currentSourceFilter],
  );

  const fetchData = useCallback((config: ListViewFetchDataConfig) => {
    setLastFetchConfig(config);
    setLoading(true);
    const { pageIndex, pageSize, sortBy, filters: filterValues } = config;

    // Separate source_type and database/connection filters for special handling
    const sourceTypeFilter = filterValues.find(f => f.id === 'source_type');
    const databaseFilter = filterValues.find(f => f.id === 'database');

    // Track source filter for conditional Type filter visibility
    const sourceVal =
      sourceTypeFilter?.value && typeof sourceTypeFilter.value === 'object'
        ? (sourceTypeFilter.value as { value: string }).value
        : ((sourceTypeFilter?.value as string) ?? '');
    setCurrentSourceFilter(sourceVal);

    const otherFilters = filterValues
      .filter(f => f.id !== 'source_type' && f.id !== 'database')
      .filter(
        ({ value }) => value !== '' && value !== null && value !== undefined,
      )
      .map(({ id, operator: opr, value }) => ({
        col: id,
        opr,
        value:
          value && typeof value === 'object' && 'value' in value
            ? value.value
            : value,
      }));

      // Add source_type filter for the combined endpoint
      const sourceTypeValue =
        sourceTypeFilter?.value && typeof sourceTypeFilter.value === 'object'
          ? (sourceTypeFilter.value as { value: string }).value
          : (sourceTypeFilter?.value as string | undefined);
      if (sourceTypeValue) {
        otherFilters.push({
          col: 'source_type',
          opr: 'eq',
          value: sourceTypeValue,
        });
      }

      const queryParams = rison.encode_uri({
        order_column: sortBy[0].id,
        order_direction: sortBy[0].desc ? 'desc' : 'asc',
        page: pageIndex,
        page_size: pageSize,
        ...(otherFilters.length ? { filters: otherFilters } : {}),
      });

    // Translate the "Data connection" filter: values prefixed with "sl:" are
    // semantic layer UUIDs; plain values are database IDs.
    if (databaseFilter?.value !== undefined && databaseFilter.value !== '') {
      const raw =
        databaseFilter.value &&
        typeof databaseFilter.value === 'object' &&
        'value' in databaseFilter.value
          ? (databaseFilter.value as { value: unknown }).value
          : databaseFilter.value;
      if (typeof raw === 'string' && raw.startsWith('sl:')) {
        otherFilters.push({
          col: 'semantic_layer_uuid',
          opr: 'eq',
          value: raw.slice(3),
        });
      } else if (raw !== null && raw !== undefined && raw !== '') {
        otherFilters.push({
          col: 'database',
          opr: databaseFilter.operator,
          value: raw,
        });
      }
    }

    return SupersetClient.get({
      endpoint: `/api/v1/datasource/?q=${queryParams}`,
    })
      .then(({ json = {} }) => {
        setDatasets(json.result);
        setDatasetCount(json.count);
      })
      .catch(() => {
        addDangerToast(
          t('An error occurred while fetching %s', datasetsLabelLower()),
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [addDangerToast]);

  const refreshData = useCallback(() => {
    if (lastFetchConfig) {
      return fetchData(lastFetchConfig);
    }
    return undefined;
  }, [lastFetchConfig, fetchData]);

  const [datasetCurrentlyDeleting, setDatasetCurrentlyDeleting] = useState<
    | (Dataset & {
        charts: any;
        dashboards: any;
      })
    | null
  >(null);

  const [datasetCurrentlyEditing, setDatasetCurrentlyEditing] =
    useState<Dataset | null>(null);

  const [datasetCurrentlyDuplicating, setDatasetCurrentlyDuplicating] =
    useState<VirtualDataset | null>(null);

  const [svCurrentlyEditing, setSvCurrentlyEditing] = useState<Dataset | null>(
    null,
  );

  const [svCurrentlyDeleting, setSvCurrentlyDeleting] =
    useState<Dataset | null>(null);

  const [showAddSemanticViewModal, setShowAddSemanticViewModal] =
    useState(false);
  const [importingDataset, showImportModal] = useState<boolean>(false);
  const [passwordFields, setPasswordFields] = useState<string[]>([]);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [sshTunnelPasswordFields, setSSHTunnelPasswordFields] = useState<
    string[]
  >([]);
  const [sshTunnelPrivateKeyFields, setSSHTunnelPrivateKeyFields] = useState<
    string[]
  >([]);
  const [
    sshTunnelPrivateKeyPasswordFields,
    setSSHTunnelPrivateKeyPasswordFields,
  ] = useState<string[]>([]);

  const PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET = useSelector<
    BootstrapData,
    boolean
  >(
    state =>
      state.common?.conf?.PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET || false,
  );

  const currentSourceFilter = useMemo(() => {
    const sourceTypeFilter = lastFetchConfig?.filters.find(
      filter => filter.id === 'source_type',
    );
    if (
      sourceTypeFilter?.value &&
      typeof sourceTypeFilter.value === 'object' &&
      'value' in sourceTypeFilter.value
    ) {
      return sourceTypeFilter.value.value as string;
    }
    return (sourceTypeFilter?.value as string | undefined) ?? '';
  }, [lastFetchConfig]);

  const openDatasetImportModal = () => {
    showImportModal(true);
  };

  const closeDatasetImportModal = () => {
    showImportModal(false);
  };

  const handleDatasetImport = () => {
    showImportModal(false);
    refreshData();
    addSuccessToast(t('%s imported', datasetLabel()));
  };

  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canCreate = hasPerm('can_write');
  const canDuplicate = hasPerm('can_duplicate');
  const canExport = hasPerm('can_export');

  const initialSort = SORT_BY;

  const openDatasetEditModal = useCallback(
    ({ id }: Dataset) => {
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${id}`,
      })
        .then(({ json = {} }) => {
          const addCertificationFields = json.result.columns.map(
            (column: ColumnObject) => {
              const {
                certification: {
                  details = '',
                  certified_by: certifiedBy = '',
                } = {},
              } = JSON.parse(column.extra || '{}') || {};
              return {
                ...column,
                certification_details: details || '',
                certified_by: certifiedBy || '',
                is_certified: details || certifiedBy,
              };
            },
          );
          json.result.columns = [...addCertificationFields];
          setDatasetCurrentlyEditing(json.result);
        })
        .catch(() => {
          addDangerToast(
            t(
              'An error occurred while fetching %s related data',
              datasetLabelLower(),
            ),
          );
        });
    },
    [addDangerToast],
  );

  const openDatasetDeleteModal = useCallback(
    (dataset: Dataset) =>
      SupersetClient.get({
        endpoint: `/api/v1/dataset/${dataset.id}/related_objects`,
      })
        .then(({ json = {} }) => {
          setDatasetCurrentlyDeleting({
            ...dataset,
            charts: json.charts,
            dashboards: json.dashboards,
          });
        })
        .catch(
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset related data: %s',
              errMsg,
            ),
          ),
        ),
    [],
  );

  const openDatasetDuplicateModal = useCallback((dataset: VirtualDataset) => {
    setDatasetCurrentlyDuplicating(dataset);
  }, []);

  const handleBulkDatasetExport = useCallback(
    async (datasetsToExport: Dataset[]) => {
      const ids = datasetsToExport.map(({ id }) => id);
      setPreparingExport(true);
      try {
        await handleResourceExport('dataset', ids, () => {
          setPreparingExport(false);
        });
      } catch {
        setPreparingExport(false);
        addDangerToast(
          t(
            'There was an issue exporting the selected %s',
            datasetsLabelLower(),
          ),
        );
      }
    },
    [addDangerToast, setPreparingExport],
  );

  const handleSemanticViewDelete = (sv: Dataset) => {
    setSvCurrentlyDeleting(sv);
  };

  const handleSemanticViewDeleteConfirm = () => {
    if (!svCurrentlyDeleting) return;
    const { id, table_name: tableName } = svCurrentlyDeleting;
    SupersetClient.delete({
      endpoint: `/api/v1/semantic_view/${id}`,
    }).then(
      () => {
        setSvCurrentlyDeleting(null);
        refreshData();
        addSuccessToast(t('Deleted: %s', tableName));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', tableName, errMsg),
        ),
      ),
    );
  };

  const columns = useMemo(
    () => [
      {
        Cell: () => null,
        accessor: 'kind_icon',
        disableSortBy: true,
        size: 'xs',
        id: 'id',
      },
      {
        Cell: ({
          row: {
            original: {
              extra,
              table_name: datasetTitle,
              description,
              explore_url: exploreURL,
            },
          },
        }: CellProps<Dataset>) => {
          let titleLink: JSX.Element;
          if (PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET) {
            titleLink = (
              <Link data-test="internal-link" to={exploreURL}>
                {datasetTitle}
              </Link>
            );
          } else {
            titleLink = (
              // exploreUrl can be a link to Explore or an external link
              // in the first case use SPA routing, else use HTML anchor
              <GenericLink to={exploreURL}>{datasetTitle}</GenericLink>
            );
          }
          try {
            const parsedExtra =
              typeof extra === 'string'
                ? JSON.parse(extra)
                : (extra as Record<string, any> | null);
            return (
              <FlexRowContainer>
                {parsedExtra?.certification && (
                  <CertifiedBadge
                    certifiedBy={parsedExtra.certification.certified_by}
                    details={parsedExtra.certification.details}
                    size="l"
                  />
                )}
                {parsedExtra?.warning_markdown && (
                  <WarningIconWithTooltip
                    warningMarkdown={parsedExtra.warning_markdown}
                    size="l"
                  />
                )}
                {titleLink}
                {description && <InfoTooltip tooltip={description} />}
              </FlexRowContainer>
            );
          } catch {
            return titleLink;
          }
        },
        Header: t('Name'),
        accessor: 'table_name',
        id: 'table_name',
      },
      {
        Cell: ({
          row: {
            original: { kind },
          },
        }: CellProps<Dataset>) => <DatasetTypeLabel datasetType={kind} />,
        Header: t('Type'),
        accessor: 'kind',
        disableSortBy: true,
        size: 'sm',
        id: 'kind',
      },
      {
        Cell: ({
          row: {
            original: { database },
          },
        }: CellProps<Dataset>) => database?.database_name || '-',
        Header: databaseLabel(),
        accessor: 'database.database_name',
        size: 'xl',
        id: 'database.database_name',
      },
      {
        Cell: ({
          row: {
            original: { schema },
          },
        }: CellProps<Dataset>) => schema || '-',
        Header: t('Schema'),
        accessor: 'schema',
        size: 'lg',
        id: 'schema',
      },
      {
        accessor: 'database',
        disableSortBy: true,
        hidden: true,
        id: 'database',
      },
      {
        Cell: ({
          row: {
            original: { owners = [] },
          },
        }: CellProps<Dataset>) => <FacePile users={owners} />,
        Header: t('Owners'),
        id: 'owners',
        disableSortBy: true,
        size: 'lg',
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: CellProps<Dataset>) => (
          <ModifiedInfo date={changedOn} user={changedBy} />
        ),
        Header: t('Last modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
        id: 'changed_on_delta_humanized',
      },
      {
        accessor: 'sql',
        hidden: true,
        disableSortBy: true,
        id: 'sql',
      },
      {
        accessor: 'source_type',
        hidden: true,
        disableSortBy: true,
        id: 'source_type',
      },
      {
        Cell: ({ row: { original } }: CellProps<Dataset>) => {
          const isSemanticView = original.kind === 'semantic_view';

          // Semantic view: show edit and delete buttons
          if (isSemanticView) {
            if (!canEdit && !canDelete) return null;
            return (
              <Actions className="actions">
                {canDelete && (
                  <Tooltip
                    id="delete-action-tooltip"
                    title={t('Delete')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={() => handleSemanticViewDelete(original)}
                    >
                      <Icons.DeleteOutlined iconSize="l" />
                    </span>
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip
                    id="edit-action-tooltip"
                    title={t('Edit')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={() => setSvCurrentlyEditing(original)}
                    >
                      <Icons.EditOutlined iconSize="l" />
                    </span>
                  </Tooltip>
                )}
              </Actions>
            );
          }

          // Dataset: full set of actions
          const allowEdit =
            original.owners
              .map((o: Owner) => o.id)
              .includes(Number(user.userId)) || isUserAdmin(user);

          const handleEdit = () => openDatasetEditModal(original);
          const handleDelete = () => openDatasetDeleteModal(original);
          const handleExport = () => handleBulkDatasetExport([original]);
          const handleDuplicate = () => {
            if (original.kind === 'virtual' && original.sql) {
              openDatasetDuplicateModal(original as VirtualDataset);
            }
          };
          if (!canEdit && !canDelete && !canExport && !canDuplicate) {
            return null;
          }
          return (
            <Actions className="actions">
              {canEdit && (
                <Tooltip
                  id="edit-action-tooltip"
                  title={
                    allowEdit
                      ? t('Edit')
                      : t(
                          'You must be a dataset owner in order to edit. Please reach out to a dataset owner to request modifications or edit access.',
                        )
                  }
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className={`action-button ${allowEdit ? '' : 'disabled'}`}
                    onClick={allowEdit ? handleEdit : undefined}
                  >
                    <Icons.EditOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
              {canExport && (
                <Tooltip
                  id="export-action-tooltip"
                  title={t('Export')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleExport}
                  >
                    <Icons.UploadOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
              {canDuplicate && original.kind === 'virtual' && (
                <Tooltip
                  id="duplicate-action-tooltip"
                  title={t('Duplicate')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleDuplicate}
                  >
                    <Icons.CopyOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
              {canDelete && (
                <Tooltip
                  id="delete-action-tooltip"
                  title={t('Delete')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleDelete}
                  >
                    <Icons.DeleteOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
            </Actions>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canDelete && !canDuplicate,
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
        id: QueryObjectColumns.ChangedBy,
      },
    ],
    [
      canEdit,
      canDelete,
      canExport,
      canDuplicate,
      openDatasetEditModal,
      openDatasetDeleteModal,
      openDatasetDuplicateModal,
      handleBulkDatasetExport,
      PREVENT_UNSAFE_DEFAULT_URLS_ON_DATASET,
      user,
    ],
  );

  const filterTypes: ListViewFilters = useMemo(
    () => [
      ...(isFeatureEnabled(FeatureFlag.SemanticLayers)
        ? [
            {
              Header: t('Source'),
              key: 'source_type',
              id: 'source_type',
              input: 'select' as const,
              operator: FilterOperator.Equals,
              unfilteredLabel: t('All'),
              selects: [
                { label: t('Database'), value: 'database' },
                { label: t('Semantic Layer'), value: 'semantic_layer' },
              ],
            },
          ]
        : []),
      {
        Header: t('Name'),
        key: 'search',
        id: 'table_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      ...(isFeatureEnabled(FeatureFlag.SemanticLayers)
        ? [
            {
              Header: t('Type'),
              key: 'sql',
              id: 'sql',
              input: 'select' as const,
              operator: FilterOperator.DatasetIsNullOrEmpty,
              unfilteredLabel: 'All',
              selects: [
                ...(currentSourceFilter !== 'semantic_layer'
                  ? [
                      { label: t('Physical'), value: true },
                      { label: t('Virtual'), value: false },
                    ]
                  : []),
                ...(currentSourceFilter !== 'database'
                  ? [{ label: t('Semantic View'), value: 'semantic_view' }]
                  : []),
              ],
            },
          ]
        : [
            {
              Header: t('Type'),
              key: 'sql',
              id: 'sql',
              input: 'select' as const,
              operator: FilterOperator.DatasetIsNullOrEmpty,
              unfilteredLabel: 'All',
              selects: [
                { label: t('Physical'), value: true },
                { label: t('Virtual'), value: false },
              ],
            },
          ]),
      {
        Header: databaseLabel(),
        key: 'database',
        id: 'database',
        input: 'select' as const,
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: 'All',
        fetchSelects: fetchConnectionOptions,
        paginate: true,
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      {
        Header: t('Schema'),
        key: 'schema',
        id: 'schema',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: 'All',
        fetchSelects: createFetchDistinct(
          'dataset',
          'schema',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching schema values: %s', errMsg),
          ),
        ),
        paginate: true,
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      {
        Header: t('Owner'),
        key: 'owner',
        id: 'owners',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        unfilteredLabel: 'All',
        fetchSelects: createFetchOwners(
          'dataset',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching %s owner values: %s',
              datasetLabelLower(),
              errMsg,
            ),
          ),
          user,
        ),
        optionFilterProps: OWNER_OPTION_FILTER_PROPS,
        paginate: true,
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      {
        Header: t('Certified'),
        key: 'certified',
        id: 'id',
        urlDisplay: 'certified',
        input: 'select',
        operator: FilterOperator.DatasetIsCertified,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      },
      {
        Header: t('Modified by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'dataset',
          'changed_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching %s values: %s',
              datasetLabelLower(),
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
    ],
    [user, currentSourceFilter],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Datasets',
    name: datasetsLabel(),
  };

  const buttonArr: Array<ButtonProps> = [];

  if (canCreate) {
    buttonArr.push({
      name: (
        <Tooltip
          id="import-tooltip"
          title={t('Import %s', datasetsLabelLower())}
          placement="bottomRight"
        >
          <Icons.DownloadOutlined
            iconColor={theme.colorPrimary}
            data-test="import-button"
            iconSize="l"
          />
        </Tooltip>
      ),
      buttonStyle: 'link',
      onClick: openDatasetImportModal,
    });
  }

  if (canDelete || canExport) {
    buttonArr.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  if (canCreate) {
    if (isFeatureEnabled(FeatureFlag.SemanticLayers)) {
      buttonArr.push({
        name: t('New'),
        buttonStyle: 'primary',
        component: (
          <Dropdown
            css={css`
              margin-left: ${theme.sizeUnit * 2}px;
            `}
            menu={{
              items: [
                {
                  key: 'dataset',
                  label: datasetLabel(),
                  onClick: () => history.push('/dataset/add/'),
                },
                {
                  key: 'semantic-view',
                  label: t('Semantic View'),
                  onClick: () => setShowAddSemanticViewModal(true),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button
              data-test="btn-create-new"
              buttonStyle="primary"
              icon={<Icons.PlusOutlined iconSize="m" />}
            >
              {t('New')}
              <Icons.DownOutlined
                iconSize="s"
                css={css`
                  margin-left: ${theme.sizeUnit * 1.5}px;
                  margin-right: -${theme.sizeUnit * 2}px;
                `}
              />
            </Button>
          </Dropdown>
        ),
      });
    } else {
      buttonArr.push({
        icon: <Icons.PlusOutlined iconSize="m" />,
        name: datasetLabel(),
        onClick: () => {
          history.push('/dataset/add/');
        },
        buttonStyle: 'primary',
      });
    }
  }

  menuData.buttons = buttonArr;

  const closeDatasetDeleteModal = () => {
    setDatasetCurrentlyDeleting(null);
  };

  const closeDatasetEditModal = () => {
    setDatasetCurrentlyEditing(null);
  };

  const closeDatasetDuplicateModal = () => {
    setDatasetCurrentlyDuplicating(null);
  };

  const handleDatasetDelete = ({ id, table_name: tableName }: Dataset) => {
    SupersetClient.delete({
      endpoint: `/api/v1/dataset/${id}`,
    }).then(
      () => {
        refreshData();
        setDatasetCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', tableName));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', tableName, errMsg),
        ),
      ),
    );
  };

  const handleBulkDatasetDelete = (datasetsToDelete: Dataset[]) => {
    const datasets = datasetsToDelete.filter(
      d => d.source_type !== 'semantic_layer',
    );
    const semanticViews = datasetsToDelete.filter(
      d => d.source_type === 'semantic_layer',
    );

    const promises: Promise<unknown>[] = [];

    if (datasets.length) {
      promises.push(
        SupersetClient.delete({
          endpoint: `/api/v1/dataset/?q=${rison.encode(
            datasets.map(({ id }) => id),
          )}`,
        }),
      );
    }

    if (semanticViews.length) {
      promises.push(
        SupersetClient.delete({
          endpoint: `/api/v1/semantic_view/?q=${rison.encode(
            semanticViews.map(({ id }) => id),
          )}`,
        }),
      );
    }

    Promise.allSettled(promises).then(results => {
      const failures = results.filter(r => r.status === 'rejected');
      // Always refresh so the list reflects whatever actually got deleted.
      refreshData();
      if (failures.length === 0) {
        addSuccessToast(t('Deleted %s item(s)', datasetsToDelete.length));
      } else {
        addDangerToast(
          t('There was an issue deleting the selected %s', datasetsLabelLower()),
        );
      }
    });
  };

  const handleDatasetDuplicate = (newDatasetName: string) => {
    if (datasetCurrentlyDuplicating === null) {
      addDangerToast(
        t('There was an issue duplicating the %s.', datasetLabelLower()),
      );
    }

    SupersetClient.post({
      endpoint: `/api/v1/dataset/duplicate`,
      jsonPayload: {
        base_model_id: datasetCurrentlyDuplicating?.id,
        table_name: newDatasetName,
      },
    }).then(
      () => {
        setDatasetCurrentlyDuplicating(null);
        refreshData();
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t(
            'There was an issue duplicating the selected %s: %s',
            datasetsLabelLower(),
            errMsg,
          ),
        ),
      ),
    );
  };

  return (
    <>
      <SubMenu {...menuData} />
      {datasetCurrentlyDeleting && (
        <DeleteModal
          description={
            <>
              <p>
                {t('The %s', datasetLabelLower())}
                <b> {datasetCurrentlyDeleting.table_name} </b>
                {t(
                  'is linked to %s charts that appear on %s dashboards. Are you sure you want to continue? Deleting the dataset will break those objects.',
                  datasetCurrentlyDeleting.charts.count,
                  datasetCurrentlyDeleting.dashboards.count,
                )}
              </p>
              {datasetCurrentlyDeleting.dashboards.count >= 1 && (
                <>
                  <h4>{t('Affected Dashboards')}</h4>
                  <List
                    split={false}
                    size="small"
                    dataSource={datasetCurrentlyDeleting.dashboards.result.slice(
                      0,
                      10,
                    )}
                    renderItem={(result: {
                      id: Key | null | undefined;
                      title: string;
                    }) => (
                      <List.Item key={result.id} compact>
                        <List.Item.Meta
                          avatar={<span>•</span>}
                          title={
                            <Typography.Link
                              href={`/superset/dashboard/${result.id}`}
                              target="_atRiskItem"
                            >
                              {result.title}
                            </Typography.Link>
                          }
                        />
                      </List.Item>
                    )}
                    footer={
                      datasetCurrentlyDeleting.dashboards.result.length >
                        10 && (
                        <div>
                          {t(
                            '... and %s others',
                            datasetCurrentlyDeleting.dashboards.result.length -
                              10,
                          )}
                        </div>
                      )
                    }
                  />
                </>
              )}
              {datasetCurrentlyDeleting.charts.count >= 1 && (
                <>
                  <h4>{t('Affected Charts')}</h4>
                  <List
                    split={false}
                    size="small"
                    dataSource={datasetCurrentlyDeleting.charts.result.slice(
                      0,
                      10,
                    )}
                    renderItem={(result: {
                      id: Key | null | undefined;
                      slice_name: string;
                    }) => (
                      <List.Item key={result.id} compact>
                        <List.Item.Meta
                          avatar={<span>•</span>}
                          title={
                            <Typography.Link
                              href={`/explore/?slice_id=${result.id}`}
                              target="_atRiskItem"
                            >
                              {result.slice_name}
                            </Typography.Link>
                          }
                        />
                      </List.Item>
                    )}
                    footer={
                      datasetCurrentlyDeleting.charts.result.length > 10 && (
                        <div>
                          {t(
                            '... and %s others',
                            datasetCurrentlyDeleting.charts.result.length - 10,
                          )}
                        </div>
                      )
                    }
                  />
                </>
              )}
              {DatasetDeleteRelatedExtension && (
                <DatasetDeleteRelatedExtension
                  dataset={datasetCurrentlyDeleting}
                />
              )}
            </>
          }
          onConfirm={() => {
            if (datasetCurrentlyDeleting) {
              handleDatasetDelete(datasetCurrentlyDeleting);
            }
          }}
          onHide={closeDatasetDeleteModal}
          open
          title={t('Delete %s?', datasetLabel())}
        />
      )}
      {svCurrentlyDeleting && (
        <DeleteModal
          description={t(
            'Are you sure you want to delete %s?',
            svCurrentlyDeleting.table_name,
          )}
          onConfirm={handleSemanticViewDeleteConfirm}
          onHide={() => setSvCurrentlyDeleting(null)}
          open
          title={t('Delete Semantic View?')}
        />
      )}
      {datasetCurrentlyEditing && (
        <DatasourceModal
          datasource={datasetCurrentlyEditing}
          onDatasourceSave={refreshData}
          onHide={closeDatasetEditModal}
          show
        />
      )}
      <DuplicateDatasetModal
        dataset={datasetCurrentlyDuplicating as DatasetType | null}
        onHide={closeDatasetDuplicateModal}
        onDuplicate={handleDatasetDuplicate}
      />
      <SemanticViewEditModal
        show={!!svCurrentlyEditing}
        onHide={() => setSvCurrentlyEditing(null)}
        onSave={refreshData}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        semanticView={svCurrentlyEditing}
      />
      <AddSemanticViewModal
        show={showAddSemanticViewModal}
        onHide={() => setShowAddSemanticViewModal(false)}
        onSuccess={refreshData}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected %s?',
          datasetsLabelLower(),
        )}
        onConfirm={handleBulkDatasetDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canDelete) {
            bulkActions.push({
              key: 'delete',
              name: t('Delete'),
              onSelect: confirmDelete,
              type: 'danger',
            });
          }
          if (canExport) {
            bulkActions.push({
              key: 'export',
              name: t('Export'),
              type: 'primary',
              onSelect: handleBulkDatasetExport,
            });
          }
          return (
            <ListView<Dataset>
              className="dataset-list-view"
              columns={columns}
              data={datasets}
              count={datasetCount}
              pageSize={PAGE_SIZE}
              fetchData={fetchData}
              filters={filterTypes}
              loading={loading}
              initialSort={initialSort}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              refreshData={refreshData}
              renderBulkSelectCopy={selected => {
                const { virtualCount, physicalCount } = selected.reduce(
                  (acc, e) => {
                    if (e.original.kind === 'physical') acc.physicalCount += 1;
                    else if (e.original.kind === 'virtual') {
                      acc.virtualCount += 1;
                    }
                    return acc;
                  },
                  { virtualCount: 0, physicalCount: 0 },
                );

                if (!selected.length) {
                  return t('0 Selected');
                }
                if (virtualCount && !physicalCount) {
                  return t(
                    '%s Selected (Virtual)',
                    selected.length,
                    virtualCount,
                  );
                }
                if (physicalCount && !virtualCount) {
                  return t(
                    '%s Selected (Physical)',
                    selected.length,
                    physicalCount,
                  );
                }

                return t(
                  '%s Selected (%s Physical, %s Virtual)',
                  selected.length,
                  physicalCount,
                  virtualCount,
                );
              }}
            />
          );
        }}
      </ConfirmStatusChange>

      <ImportModelsModal
        resourceName="dataset"
        resourceLabel={datasetLabelLower()}
        passwordsNeededMessage={PASSWORDS_NEEDED_MESSAGE}
        confirmOverwriteMessage={CONFIRM_OVERWRITE_MESSAGE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onModelImport={handleDatasetImport}
        show={importingDataset}
        onHide={closeDatasetImportModal}
        passwordFields={passwordFields}
        setPasswordFields={setPasswordFields}
        sshTunnelPasswordFields={sshTunnelPasswordFields}
        setSSHTunnelPasswordFields={setSSHTunnelPasswordFields}
        sshTunnelPrivateKeyFields={sshTunnelPrivateKeyFields}
        setSSHTunnelPrivateKeyFields={setSSHTunnelPrivateKeyFields}
        sshTunnelPrivateKeyPasswordFields={sshTunnelPrivateKeyPasswordFields}
        setSSHTunnelPrivateKeyPasswordFields={
          setSSHTunnelPrivateKeyPasswordFields
        }
      />
      {preparingExport && <Loading />}
    </>
  );
};

export default withToasts(DatasetList);
