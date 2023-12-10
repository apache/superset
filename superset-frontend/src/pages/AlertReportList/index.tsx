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

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import {
  t,
  SupersetClient,
  makeApi,
  styled,
  getExtensionsRegistry,
} from '@superset-ui/core';
import moment from 'moment';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import FacePile from 'src/components/FacePile';
import { Tooltip } from 'src/components/Tooltip';
import ListView, {
  FilterOperator,
  Filters,
  ListViewProps,
} from 'src/components/ListView';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { Switch } from 'src/components/Switch';
import { DATETIME_WITH_TIME_ZONE } from 'src/constants';
import withToasts from 'src/components/MessageToasts/withToasts';
import AlertStatusIcon from 'src/features/alerts/components/AlertStatusIcon';
import RecipientIcon from 'src/features/alerts/components/RecipientIcon';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DeleteModal from 'src/components/DeleteModal';
import LastUpdated from 'src/components/LastUpdated';
import {
  useListViewResource,
  useSingleViewResource,
} from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import Owner from 'src/types/Owner';
import AlertReportModal from 'src/features/alerts/AlertReportModal';
import { AlertObject, AlertState } from 'src/features/alerts/types';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';

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
  width: 100%;
  padding: 0 ${({ theme }) => theme.gridUnit * 4}px
    ${({ theme }) => theme.gridUnit * 3}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;

const StyledHeaderWithIcon = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  > *:first-child {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const HeaderExtension = extensionsRegistry.get('alertsreports.header.icon');

function AlertList({
  addDangerToast,
  isReportEnabled = false,
  user,
  addSuccessToast,
}: AlertListProps) {
  const title = isReportEnabled ? t('report') : t('alert');
  const titlePlural = isReportEnabled ? t('reports') : t('alerts');
  const pathName = isReportEnabled ? 'Reports' : 'Alerts';
  const initialFilters = useMemo(
    () => [
      {
        id: 'type',
        operator: FilterOperator.equals,
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
    t('reports'),
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
      },
      {
        Cell: ({
          row: {
            original: { last_eval_dttm: lastEvalDttm },
          },
        }: any) =>
          lastEvalDttm
            ? moment.utc(lastEvalDttm).local().format(DATETIME_WITH_TIME_ZONE)
            : '',
        accessor: 'last_eval_dttm',
        Header: t('Last run'),
        size: 'lg',
      },
      {
        accessor: 'name',
        Header: t('Name'),
        size: 'xl',
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
        size: 'xl',
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
        size: 'xl',
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
                  icon: 'Note',
                  onClick: handleGotoExecutionLog,
                }
              : null,
            canEdit
              ? {
                  label: allowEdit ? 'edit-action' : 'preview-action',
                  tooltip: allowEdit ? t('Edit') : t('View'),
                  placement: 'bottom',
                  icon: allowEdit ? 'Edit' : 'Binoculars',
                  onClick: handleEdit,
                }
              : null,
            allowEdit && canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete'),
                  placement: 'bottom',
                  icon: 'Trash',
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => item !== null);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canDelete,
        disableSortBy: true,
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.changed_by,
        hidden: true,
      },
    ],
    [canDelete, canEdit, isReportEnabled, toggleActive],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCreate) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {title}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        handleAlertEdit(null);
      },
    });
  }
  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
      'data-test': 'bulk-select-toggle',
    });
  }

  const emptyState = {
    title: t('No %s yet', titlePlural),
    image: 'filter-results.svg',
    buttonAction: () => handleAlertEdit(null),
    buttonText: canCreate ? (
      <>
        <i className="fa fa-plus" /> {title}{' '}
      </>
    ) : null,
  };

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'name',
        input: 'search',
        operator: FilterOperator.contains,
      },
      {
        Header: t('Owner'),
        key: 'owner',
        id: 'owners',
        input: 'select',
        operator: FilterOperator.relationManyMany,
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
      },
      {
        Header: t('Status'),
        key: 'status',
        id: 'last_state',
        input: 'select',
        operator: FilterOperator.equals,
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
        operator: FilterOperator.relationOneMany,
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
          },
          {
            name: 'Reports',
            label: t('Reports'),
            url: '/report/list/',
            usesRouter: true,
            'data-test': 'report-list',
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
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AlertList);
