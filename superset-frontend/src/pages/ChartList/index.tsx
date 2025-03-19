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
import {
  isFeatureEnabled,
  FeatureFlag,
  getChartMetadataRegistry,
  JsonResponse,
  styled,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { useState, useMemo, useCallback } from 'react';
import rison from 'rison';
import { uniqBy } from 'lodash';
import { useSelector } from 'react-redux';
import {
  createErrorHandler,
  createFetchRelated,
  handleChartDelete,
} from 'src/views/CRUD/utils';
import {
  useChartEditModal,
  useFavoriteStatus,
  useListViewResource,
} from 'src/views/CRUD/hooks';
import handleResourceExport from 'src/utils/export';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import { TagsList } from 'src/components/Tags';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import FaveStar from 'src/components/FaveStar';
import { Link, useHistory } from 'react-router-dom';
import ListView, {
  Filter,
  FilterOperator,
  Filters,
  ListViewProps,
  SelectOption,
} from 'src/components/ListView';
import Loading from 'src/components/Loading';
import { dangerouslyGetItemDoNotUse } from 'src/utils/localStorageHelpers';
import withToasts from 'src/components/MessageToasts/withToasts';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import ImportModelsModal from 'src/components/ImportModal/index';
import Chart from 'src/types/Chart';
import Tag from 'src/types/TagType';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import InfoTooltip from 'src/components/InfoTooltip';
import CertifiedBadge from 'src/components/CertifiedBadge';
import { GenericLink } from 'src/components/GenericLink/GenericLink';
import { loadTags } from 'src/components/Tags/utils';
import FacePile from 'src/components/FacePile';
import ChartCard from 'src/features/charts/ChartCard';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { findPermission } from 'src/utils/findPermission';
import { DashboardCrossLinks } from 'src/components/ListView/DashboardCrossLinks';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
  }

  svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const PAGE_SIZE = 25;
const PASSWORDS_NEEDED_MESSAGE = t(
  'The passwords for the databases below are needed in order to ' +
    'import them together with the charts. Please note that the ' +
    '"Secure Extra" and "Certificate" sections of ' +
    'the database configuration are not present in export files, and ' +
    'should be added manually after the import if they are needed.',
);
const CONFIRM_OVERWRITE_MESSAGE = t(
  'You are importing one or more charts that already exist. ' +
    'Overwriting might cause you to lose some of your work. Are you ' +
    'sure you want to overwrite?',
);

const registry = getChartMetadataRegistry();

const createFetchDatasets = async (
  filterValue = '',
  page: number,
  pageSize: number,
) => {
  // add filters if filterValue
  const filters = filterValue
    ? { filters: [{ col: 'table_name', opr: 'sw', value: filterValue }] }
    : {};
  const queryParams = rison.encode({
    columns: ['datasource_name', 'datasource_id'],
    keys: ['none'],
    order_column: 'table_name',
    order_direction: 'asc',
    page,
    page_size: pageSize,
    ...filters,
  });

  const { json = {} } = await SupersetClient.get({
    endpoint: `/api/v1/dataset/?q=${queryParams}`,
  });

  const datasets = json?.result?.map(
    ({ table_name: tableName, id }: { table_name: string; id: number }) => ({
      label: tableName,
      value: id,
    }),
  );

  return {
    data: uniqBy<SelectOption>(datasets, 'value'),
    totalCount: json?.count,
  };
};

interface ChartListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

const StyledActions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

function ChartList(props: ChartListProps) {
  const {
    addDangerToast,
    addSuccessToast,
    user: { userId },
  } = props;

  const history = useHistory();

  const {
    state: {
      loading,
      resourceCount: chartCount,
      resourceCollection: charts,
      bulkSelectEnabled,
    },
    setResourceCollection: setCharts,
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<Chart>('chart', t('chart'), addDangerToast);

  const chartIds = useMemo(() => charts.map(c => c.id), [charts]);
  const { roles } = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const canReadTag = findPermission('can_read', 'Tag', roles);

  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'chart',
    chartIds,
    addDangerToast,
  );
  const {
    sliceCurrentlyEditing,
    handleChartUpdated,
    openChartEditModal,
    closeChartEditModal,
  } = useChartEditModal(setCharts, charts);

  const [importingChart, showImportModal] = useState<boolean>(false);
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

  // TODO: Fix usage of localStorage keying on the user id
  const userSettings = dangerouslyGetItemDoNotUse(userId?.toString(), null) as {
    thumbnails: boolean;
  };

  const openChartImportModal = () => {
    showImportModal(true);
  };

  const closeChartImportModal = () => {
    showImportModal(false);
  };

  const handleChartImport = () => {
    showImportModal(false);
    refreshData();
    addSuccessToast(t('Chart imported'));
  };

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
  const handleBulkChartExport = (chartsToExport: Chart[]) => {
    const ids = chartsToExport.map(({ id }) => id);
    handleResourceExport('chart', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  function handleBulkChartDelete(chartsToDelete: Chart[]) {
    SupersetClient.delete({
      endpoint: `/api/v1/chart/?q=${rison.encode(
        chartsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected charts: %s', errMsg),
        ),
      ),
    );
  }
  const fetchDashboards = async (
    filterValue = '',
    page: number,
    pageSize: number,
  ) => {
    // add filters if filterValue
    const filters = filterValue
      ? {
          filters: [
            {
              col: 'dashboard_title',
              opr: FilterOperator.StartsWith,
              value: filterValue,
            },
          ],
        }
      : {};
    const queryParams = rison.encode({
      columns: ['dashboard_title', 'id'],
      keys: ['none'],
      order_column: 'dashboard_title',
      order_direction: 'asc',
      page,
      page_size: pageSize,
      ...filters,
    });
    const response: void | JsonResponse = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${queryParams}`,
    }).catch(() =>
      addDangerToast(t('An error occurred while fetching dashboards')),
    );
    const dashboards = response?.json?.result?.map(
      ({
        dashboard_title: dashboardTitle,
        id,
      }: {
        dashboard_title: string;
        id: number;
      }) => ({
        label: dashboardTitle,
        value: id,
      }),
    );
    return {
      data: uniqBy<SelectOption>(dashboards, 'value'),
      totalCount: response?.json?.count,
    };
  };

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { id },
          },
        }: any) =>
          userId && (
            <FaveStar
              itemId={id}
              saveFaveStar={saveFavoriteStatus}
              isStarred={favoriteStatus[id]}
            />
          ),
        Header: '',
        id: 'id',
        disableSortBy: true,
        size: 'xs',
        hidden: !userId,
      },
      {
        Cell: ({
          row: {
            original: {
              url,
              slice_name: sliceName,
              certified_by: certifiedBy,
              certification_details: certificationDetails,
              description,
            },
          },
        }: any) => (
          <FlexRowContainer>
            <Link to={url} data-test={`${sliceName}-list-chart-title`}>
              {certifiedBy && (
                <>
                  <CertifiedBadge
                    certifiedBy={certifiedBy}
                    details={certificationDetails}
                  />{' '}
                </>
              )}
              {sliceName}
            </Link>
            {description && <InfoTooltip tooltip={description} />}
          </FlexRowContainer>
        ),
        Header: t('Name'),
        accessor: 'slice_name',
      },
      {
        Cell: ({
          row: {
            original: { viz_type: vizType },
          },
        }: any) => registry.get(vizType)?.name || vizType,
        Header: t('Type'),
        accessor: 'viz_type',
        size: 'xxl',
      },
      {
        Cell: ({
          row: {
            original: {
              datasource_name_text: dsNameTxt,
              datasource_url: dsUrl,
            },
          },
        }: any) => <GenericLink to={dsUrl}>{dsNameTxt}</GenericLink>,
        Header: t('Dataset'),
        accessor: 'datasource_id',
        disableSortBy: true,
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { dashboards },
          },
        }: any) => <DashboardCrossLinks dashboards={dashboards} />,
        Header: t('On dashboards'),
        accessor: 'dashboards',
        disableSortBy: true,
        size: 'xxl',
      },
      {
        Cell: ({
          row: {
            original: { tags = [] },
          },
        }: any) => (
          // Only show custom type tags
          <TagsList
            tags={tags.filter((tag: Tag) =>
              tag.type
                ? tag.type === 1 || tag.type === 'TagTypes.custom'
                : true,
            )}
            maxTags={3}
          />
        ),
        Header: t('Tags'),
        accessor: 'tags',
        disableSortBy: true,
        hidden: !isFeatureEnabled(FeatureFlag.TaggingSystem),
      },
      {
        Cell: ({
          row: {
            original: { owners = [] },
          },
        }: any) => <FacePile users={owners} />,
        Header: t('Owners'),
        accessor: 'owners',
        disableSortBy: true,
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: any) => <ModifiedInfo date={changedOn} user={changedBy} />,
        Header: t('Last modified'),
        accessor: 'last_saved_at',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () =>
            handleChartDelete(
              original,
              addSuccessToast,
              addDangerToast,
              refreshData,
            );
          const openEditModal = () => openChartEditModal(original);
          const handleExport = () => handleBulkChartExport([original]);
          if (!canEdit && !canDelete && !canExport) {
            return null;
          }

          return (
            <StyledActions className="actions">
              {canDelete && (
                <ConfirmStatusChange
                  title={t('Please confirm')}
                  description={
                    <>
                      {t('Are you sure you want to delete')}{' '}
                      <b>{original.slice_name}</b>?
                    </>
                  }
                  onConfirm={handleDelete}
                >
                  {confirmDelete => (
                    <Tooltip
                      id="delete-action-tooltip"
                      title={t('Delete')}
                      placement="bottom"
                    >
                      <span
                        data-test="trash"
                        role="button"
                        tabIndex={0}
                        className="action-button"
                        onClick={confirmDelete}
                      >
                        <Icons.Trash />
                      </span>
                    </Tooltip>
                  )}
                </ConfirmStatusChange>
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
                    <Icons.Share />
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
                    onClick={openEditModal}
                  >
                    <Icons.EditAlt data-test="edit-alt" />
                  </span>
                </Tooltip>
              )}
            </StyledActions>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        hidden: !canEdit && !canDelete,
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
      },
    ],
    [
      userId,
      canEdit,
      canDelete,
      canExport,
      saveFavoriteStatus,
      favoriteStatus,
      refreshData,
      addSuccessToast,
      addDangerToast,
    ],
  );

  const favoritesFilter: Filter = useMemo(
    () => ({
      Header: t('Favorite'),
      key: 'favorite',
      id: 'id',
      urlDisplay: 'favorite',
      input: 'select',
      operator: FilterOperator.ChartIsFav,
      unfilteredLabel: t('Any'),
      selects: [
        { label: t('Yes'), value: true },
        { label: t('No'), value: false },
      ],
    }),
    [],
  );

  const filters: Filters = useMemo(() => {
    const filters_list = [
      {
        Header: t('Name'),
        key: 'search',
        id: 'slice_name',
        input: 'search',
        operator: FilterOperator.ChartAllText,
      },
      {
        Header: t('Type'),
        key: 'viz_type',
        id: 'viz_type',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        selects: registry
          .keys()
          .filter(k => nativeFilterGate(registry.get(k)?.behaviors || []))
          .map(k => ({ label: registry.get(k)?.name || k, value: k }))
          .sort((a, b) => {
            if (!a.label || !b.label) {
              return 0;
            }

            if (a.label > b.label) {
              return 1;
            }
            if (a.label < b.label) {
              return -1;
            }

            return 0;
          }),
      },
      {
        Header: t('Dataset'),
        key: 'dataset',
        id: 'datasource_id',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchDatasets,
        paginate: true,
      },
      ...(isFeatureEnabled(FeatureFlag.TaggingSystem) && canReadTag
        ? [
            {
              Header: t('Tag'),
              key: 'tags',
              id: 'tags',
              input: 'select',
              operator: FilterOperator.ChartTagById,
              unfilteredLabel: t('All'),
              fetchSelects: loadTags,
            },
          ]
        : []),
      {
        Header: t('Owner'),
        key: 'owner',
        id: 'owners',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'chart',
          'owners',
          createErrorHandler(errMsg =>
            addDangerToast(
              t(
                'An error occurred while fetching chart owners values: %s',
                errMsg,
              ),
            ),
          ),
          props.user,
        ),
        paginate: true,
      },
      {
        Header: t('Dashboard'),
        key: 'dashboards',
        id: 'dashboards',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        fetchSelects: fetchDashboards,
        paginate: true,
      },
      ...(userId ? [favoritesFilter] : []),
      {
        Header: t('Certified'),
        key: 'certified',
        id: 'id',
        urlDisplay: 'certified',
        input: 'select',
        operator: FilterOperator.ChartIsCertified,
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
          'chart',
          'changed_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset datasource values: %s',
              errMsg,
            ),
          ),
          props.user,
        ),
        paginate: true,
      },
    ] as Filters;
    return filters_list;
  }, [addDangerToast, favoritesFilter, props.user]);

  const sortTypes = [
    {
      desc: false,
      id: 'slice_name',
      label: t('Alphabetical'),
      value: 'alphabetical',
    },
    {
      desc: true,
      id: 'changed_on_delta_humanized',
      label: t('Recently modified'),
      value: 'recently_modified',
    },
    {
      desc: false,
      id: 'changed_on_delta_humanized',
      label: t('Least recently modified'),
      value: 'least_recently_modified',
    },
  ];

  const renderCard = useCallback(
    (chart: Chart) => (
      <ChartCard
        chart={chart}
        showThumbnails={
          userSettings
            ? userSettings.thumbnails
            : isFeatureEnabled(FeatureFlag.Thumbnails)
        }
        hasPerm={hasPerm}
        openChartEditModal={openChartEditModal}
        bulkSelectEnabled={bulkSelectEnabled}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        refreshData={refreshData}
        userId={userId}
        loading={loading}
        favoriteStatus={favoriteStatus[chart.id]}
        saveFavoriteStatus={saveFavoriteStatus}
        handleBulkChartExport={handleBulkChartExport}
      />
    ),
    [
      addDangerToast,
      addSuccessToast,
      bulkSelectEnabled,
      favoriteStatus,
      hasPerm,
      loading,
    ],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];
  if (canDelete || canExport) {
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      'data-test': 'bulk-select',
      onClick: toggleBulkSelect,
    });
  }
  if (canCreate) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Chart')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        history.push('/chart/add');
      },
    });

    subMenuButtons.push({
      name: (
        <Tooltip
          id="import-tooltip"
          title={t('Import charts')}
          placement="bottomRight"
        >
          <Icons.Import data-test="import-button" />
        </Tooltip>
      ),
      buttonStyle: 'link',
      onClick: openChartImportModal,
    });
  }

  return (
    <>
      <SubMenu name={t('Charts')} buttons={subMenuButtons} />
      {sliceCurrentlyEditing && (
        <PropertiesModal
          onHide={closeChartEditModal}
          onSave={handleChartUpdated}
          show
          slice={sliceCurrentlyEditing}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected charts?')}
        onConfirm={handleBulkChartDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canDelete) {
            bulkActions.push({
              key: 'delete',
              name: t('Delete'),
              type: 'danger',
              onSelect: confirmDelete,
            });
          }
          if (canExport) {
            bulkActions.push({
              key: 'export',
              name: t('Export'),
              type: 'primary',
              onSelect: handleBulkChartExport,
            });
          }
          return (
            <ListView<Chart>
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              cardSortSelectOptions={sortTypes}
              className="chart-list-view"
              columns={columns}
              count={chartCount}
              data={charts}
              disableBulkSelect={toggleBulkSelect}
              refreshData={refreshData}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              renderCard={renderCard}
              enableBulkTag
              bulkTagResourceName="chart"
              addSuccessToast={addSuccessToast}
              addDangerToast={addDangerToast}
              showThumbnails={
                userSettings
                  ? userSettings.thumbnails
                  : isFeatureEnabled(FeatureFlag.Thumbnails)
              }
              defaultViewMode={
                isFeatureEnabled(FeatureFlag.ListviewsDefaultCardView)
                  ? 'card'
                  : 'table'
              }
            />
          );
        }}
      </ConfirmStatusChange>

      <ImportModelsModal
        resourceName="chart"
        resourceLabel={t('chart')}
        passwordsNeededMessage={PASSWORDS_NEEDED_MESSAGE}
        confirmOverwriteMessage={CONFIRM_OVERWRITE_MESSAGE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onModelImport={handleChartImport}
        show={importingChart}
        onHide={closeChartImportModal}
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
}

export default withToasts(ChartList);
