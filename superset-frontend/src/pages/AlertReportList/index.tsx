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

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
  t,
  css,
  SupersetClient,
  makeApi,
  styled,
  getExtensionsRegistry,
} from '@superset-ui/core';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import {
  Tooltip,
  ConfirmStatusChange,
  DeleteModal,
  LastUpdated,
} from '@superset-ui/core/components';
import {
  FacePile,
  ModifiedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  ListViewActionsBar,
  type ListViewActionProps,
  type ListViewProps,
  type ListViewFilters,
} from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { Switch } from '@superset-ui/core/components/Switch';
import { DATETIME_WITH_TIME_ZONE } from 'src/constants';
import withToasts from 'src/components/MessageToasts/withToasts';
import AlertStatusIcon from 'src/features/alerts/components/AlertStatusIcon';
import RecipientIcon from 'src/features/alerts/components/RecipientIcon';
import {
  useListViewResource,
  useSingleViewResource,
} from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import Owner from 'src/types/Owner';
import AlertReportModal from 'src/features/alerts/AlertReportModal';
import { AlertObject, AlertState } from 'src/features/alerts/types';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import { Icons } from '@superset-ui/core/components/Icons';
import { WIDER_DROPDOWN_WIDTH } from 'src/components/ListView/utils';

const extensionsRegistry = getExtensionsRegistry();

const PAGE_SIZE = 25;

const AlertStateLabel: Record<AlertState, string> = {
  [AlertState.Success]: t('Success'),
  [AlertState.Working]: t('Working'),
  [AlertState.Error]: t('Error'),
  [AlertState.Noop]: t('Not triggered'),
  [AlertState.Grace]: t('On Grace'),
};

interface AlertListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  isReportEnabled: boolean;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}
const deleteAlerts = makeApi<number[], { message: string }>({
  requestType: 'rison',
  method: 'DELETE',
  endpoint: '/api/v1/report/',
});

const RefreshContainer = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit}px;
    width: 100%;
    padding: ${theme.sizeUnit * 2}px 0px ${theme.sizeUnit * 3}px;
  `}
`;
const StyledHeaderWithIcon = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  > *:first-child {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const HeaderExtension = extensionsRegistry.get('alertsreports.header.icon');

function AlertList({
  addDangerToast,
  isReportEnabled = false,
  user,
  addSuccessToast,
}: AlertListProps) {
  const title = isReportEnabled ? t('Report') : t('Alert');
  const titlePlural = isReportEnabled ? t('reports') : t('alerts');
  const pathName = isReportEnabled ? 'Reports' : 'Alerts';
  const initialFilters = useMemo(
    () => [
      {
        id: 'type',
        operator: FilterOperator.Equals,
        value: isReportEnabled ? 'Report' : 'Alert',
      },
    ],
    [isReportEnabled],
  );
  const {
    state: {
      loading,
      resourceCount: alertsCount,
      resourceCollection: alerts,
      bulkSelectEnabled,
      lastFetched,
    },
    hasPerm,
    fetchData,
    setResourceCollection,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<AlertObject>(
    'report',
    t('report'),
    addDangerToast,
    true,
    undefined,
    initialFilters,
  );

  const { updateResource } = useSingleViewResource<Partial<AlertObject>>(
    'report',
    t('reports'),
    addDangerToast,
  );

  const [alertModalOpen, setAlertModalOpen] = useState<boolean>(false);
  const [currentAlert, setCurrentAlert] = useState<Partial<AlertObject> | null>(
    null,
  );
  const [currentAlertDeleting, setCurrentAlertDeleting] =
    useState<AlertObject | null>(null);

  // Actions
  function handleAlertEdit(alert: AlertObject | null) {
    setCurrentAlert(alert);
    setAlertModalOpen(true);
  }

  const generateKey = () => `${new Date().getTime()}`;

  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canCreate = hasPerm('can_write');

  useEffect(() => {
    if (bulkSelectEnabled && canDelete) {
      toggleBulkSelect();
    }
  }, [isReportEnabled]);

  const handleAlertDelete = ({ id, name }: AlertObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/report/${id}`,
    }).then(
      () => {
        refreshData();
        setCurrentAlertDeleting(null);
        addSuccessToast(t('Deleted: %s', name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', name, errMsg)),
      ),
    );
  };

  const handleBulkAlertDelete = async (alertsToDelete: AlertObject[]) => {
    try {
      const { message } = await deleteAlerts(
        alertsToDelete.map(({ id }) => id),
      );
      refreshData();
      addSuccessToast(message);
    } catch (e) {
      createErrorHandler(errMsg =>
        addDangerToast(
          t(
            'There was an issue deleting the selected %s: %s',
            titlePlural,
            errMsg,
          ),
        ),
      )(e);
    }
  };

  const initialSort = [{ id: 'name', desc: true }];

  const toggleActive = useCallback(
    (data: AlertObject, checked: boolean) => {
      if (data?.id) {
        const update_id = data.id;
        const original = [...alerts];

        setResourceCollection(
          original.map(alert => {
            if (alert?.id === data.id) {
              return {
                ...alert,
                active: checked,
              };
            }

            return alert;
          }),
        );

        updateResource(update_id, { active: checked }, false, false)
          .then()
          .catch(() => setResourceCollection(original));
      }
    },
    [alerts, setResourceCollection, updateResource],
  );

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { last_state: lastState },
          },
        }: any) => (
          <AlertStatusIcon
            state={lastState}
            isReportEnabled={isReportEnabled}
          />
        ),
        accessor: 'last_state',
        size: 'xs',
        disableSortBy: true,
        id: 'last_state',
      },
      {
        Cell: ({
          row: {
            original: { last_eval_dttm: lastEvalDttm },
          },
        }: any) =>
          lastEvalDttm
            ? extendedDayjs
                .utc(lastEvalDttm)
                .local()
                .format(DATETIME_WITH_TIME_ZONE)
            : '',
        accessor: 'last_eval_dttm',
        Header: t('Last run'),
        size: 'lg',
        id: 'last_eval_dttm',
      },
      {
        accessor: 'name',
        Header: t('Name'),
        size: 'xxl',
        id: 'name',
      },
      {
        Header: t('Schedule'),
        accessor: 'crontab_humanized',
        size: 'xl',
        Cell: ({
          row: {
            original: { crontab_humanized = '', timezone },
          },
        }: any) => (
          <Tooltip
            title={`${crontab_humanized} (${timezone})`}
            placement="topLeft"
          >
            <span>{`${crontab_humanized} (${timezone})`}</span>
          </Tooltip>
        ),
        id: 'crontab_humanized',
      },
      {
        Cell: ({
          row: {
            original: { recipients },
          },
        }: any) =>
          recipients.map((r: any) => (
            <RecipientIcon key={r.id} type={r.type} />
          )),
        accessor: 'recipients',
        Header: t('Notification method'),
        disableSortBy: true,
        size: 'lg',
        id: 'recipients',
      },
      {
        Cell: ({
          row: {
            original: { owners = [] },
          },
        }: any) => <FacePile users={owners} />,
        Header: t('Owners'),
        id: 'owners',
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
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
        id: 'changed_on_delta_humanized',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const allowEdit =
            original.owners.map((o: Owner) => o.id).includes(user.userId) ||
            isUserAdmin(user);

          return (
            <Switch
              disabled={!allowEdit}
              data-test="toggle-active"
              checked={original.active}
              onClick={(checked: boolean) => toggleActive(original, checked)}
              size="small"
            />
          );
        },
        Header: t('Active'),
        accessor: 'active',
        id: 'active',
        size: 'sm',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const history = useHistory();
          const handleEdit = () => handleAlertEdit(original);
          const handleDelete = () => setCurrentAlertDeleting(original);
          const handleGotoExecutionLog = () =>
            history.push(`/${original.type.toLowerCase()}/${original.id}/log`);

          const allowEdit =
            original.owners.map((o: Owner) => o.id).includes(user.userId) ||
            isUserAdmin(user);

          const actions = [
            canEdit
              ? {
                  label: 'execution-log-action',
                  tooltip: t('Execution log'),
                  placement: 'bottom',
                  icon: 'FileTextOutlined',
                  onClick: handleGotoExecutionLog,
                }
              : null,
            canEdit
              ? {
                  label: allowEdit ? 'edit-action' : 'preview-action',
                  tooltip: allowEdit ? t('Edit') : t('View'),
                  placement: 'bottom',
                  icon: allowEdit ? 'EditOutlined' : 'Binoculars',
                  onClick: handleEdit,
                }
              : null,
            allowEdit && canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete'),
                  placement: 'bottom',
                  icon: 'DeleteOutlined',
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => item !== null);

          return (
            <ListViewActionsBar actions={actions as ListViewActionProps[]} />
          );
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canDelete,
        disableSortBy: true,
        size: 'lg',
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
        id: QueryObjectColumns.ChangedBy,
      },
    ],
    [canDelete, canEdit, isReportEnabled, toggleActive],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
      'data-test': 'bulk-select-toggle',
    });
  }

  if (canCreate) {
    subMenuButtons.push({
      icon: <Icons.PlusOutlined iconSize="m" />,
      name: t(title),
      buttonStyle: 'primary',
      onClick: () => {
        handleAlertEdit(null);
      },
    });
  }

  const emptyState = {
    title: t('No %s yet', titlePlural),
    image: 'filter-results.svg',
    buttonAction: () => handleAlertEdit(null),
    buttonText: canCreate ? (
      <>
        <Icons.PlusOutlined
          iconSize="m"
          data-test="add-annotation-layer-button"
        />
        {title}{' '}
      </>
    ) : null,
  };

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Owner'),
        key: 'owner',
        id: 'owners',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'report',
          'owners',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching owners values: %s', errMsg),
          ),
          user,
        ),
        paginate: true,
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
      {
        Header: t('Status'),
        key: 'status',
        id: 'last_state',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: 'Any',
        selects: [
          {
            label: AlertStateLabel[AlertState.Success],
            value: AlertState.Success,
          },
          {
            label: AlertStateLabel[AlertState.Working],
            value: AlertState.Working,
          },
          { label: AlertStateLabel[AlertState.Error], value: AlertState.Error },
          { label: AlertStateLabel[AlertState.Noop], value: AlertState.Noop },
          { label: AlertStateLabel[AlertState.Grace], value: AlertState.Grace },
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
          'report',
          'changed_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset datasource values: %s',
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
        dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
      },
    ],
    [],
  );

  const header = HeaderExtension ? (
    <StyledHeaderWithIcon>
      <div>{t('Alerts & reports')}</div>
      <HeaderExtension />
    </StyledHeaderWithIcon>
  ) : (
    t('Alerts & reports')
  );

  return (
    <>
      <SubMenu
        activeChild={pathName}
        name={header}
        tabs={[
          {
            name: 'Alerts',
            label: t('Alerts'),
            url: '/alert/list/',
            usesRouter: true,
            'data-test': 'alert-list',
            id: 'alert-tab',
            'aria-controls': 'alert-list',
          },
          {
            name: 'Reports',
            label: t('Reports'),
            url: '/report/list/',
            usesRouter: true,
            'data-test': 'report-list',
            id: 'report-tab',
            'aria-controls': 'report-list',
          },
        ]}
        buttons={subMenuButtons}
      >
        <RefreshContainer>
          <LastUpdated updatedAt={lastFetched} update={() => refreshData()} />
        </RefreshContainer>
      </SubMenu>
      <AlertReportModal
        alert={currentAlert}
        addDangerToast={addDangerToast}
        layer={currentAlert}
        onHide={() => {
          setAlertModalOpen(false);
          setCurrentAlert(null);
          refreshData();
        }}
        show={alertModalOpen}
        isReport={isReportEnabled}
        key={currentAlert?.id || generateKey()}
      />
      {currentAlertDeleting && (
        <DeleteModal
          description={t(
            'This action will permanently delete %s.',
            currentAlertDeleting.name,
          )}
          onConfirm={() => {
            if (currentAlertDeleting) {
              handleAlertDelete(currentAlertDeleting);
            }
          }}
          onHide={() => setCurrentAlertDeleting(null)}
          open
          title={t('Delete %s?', title)}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected %s?',
          titlePlural,
        )}
        onConfirm={handleBulkAlertDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = canDelete
            ? [
                {
                  key: 'delete',
                  name: t('Delete'),
                  onSelect: confirmDelete,
                  type: 'danger',
                },
              ]
            : [];
          return (
            <div
              id={isReportEnabled ? 'report-list' : 'alert-list'}
              role="tabpanel"
              aria-labelledby={isReportEnabled ? 'report-tab' : 'alert-tab'}
            >
              <ListView<AlertObject>
                className="alerts-list-view"
                columns={columns}
                count={alertsCount}
                data={alerts}
                emptyState={emptyState}
                fetchData={fetchData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                bulkActions={bulkActions}
                bulkSelectEnabled={bulkSelectEnabled}
                disableBulkSelect={toggleBulkSelect}
                refreshData={refreshData}
                addDangerToast={addDangerToast}
                addSuccessToast={addSuccessToast}
                pageSize={PAGE_SIZE}
              />
            </div>
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AlertList);
