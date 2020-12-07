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

import React, { useMemo, useEffect } from 'react';
import { t, styled } from '@superset-ui/core';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import Button from 'src/components/Button';
import Icon, { IconName } from 'src/components/Icon';
import { Tooltip } from 'src/common/components/Tooltip';
import { Switch } from 'src/common/components/Switch';
import FacePile from 'src/components/FacePile';
import ListView, { Filters, FilterOperators } from 'src/components/ListView';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/messageToasts/enhancers/withToasts';

import {
  useListViewResource,
  useSingleViewResource,
} from 'src/views/CRUD/hooks';

import { AlertObject } from './types';

const PAGE_SIZE = 25;

interface AlertListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  isReportEnabled: boolean;
  user: {
    userId: string | number;
  };
}

const StatusIcon = styled(Icon)<{ status: string }>`
  color: ${({ status, theme }) => {
    switch (status) {
      case 'Working':
        return theme.colors.alert.base;
      case 'Error':
        return theme.colors.error.base;
      case 'Success':
        return theme.colors.success.base;
      default:
        return theme.colors.grayscale.base;
    }
  }};
`;

function AlertList({
  addDangerToast,
  isReportEnabled = false,
  user,
}: AlertListProps) {
  const title = isReportEnabled ? t('report') : t('alert');
  const initalFilters = useMemo(
    () => [
      {
        id: 'type',
        operator: FilterOperators.equals,
        value: isReportEnabled ? 'Report' : 'Alert',
      },
    ],
    [isReportEnabled],
  );
  const {
    state: { loading, resourceCount: alertsCount, resourceCollection: alerts },
    hasPerm,
    fetchData,
    refreshData,
  } = useListViewResource<AlertObject>(
    'report',
    t('reports'),
    addDangerToast,
    true,
    undefined,
    initalFilters,
  );
  const pathName = isReportEnabled ? 'Reports' : 'Alerts';
  const { updateResource } = useSingleViewResource<AlertObject>(
    'report',
    t('reports'),
    addDangerToast,
  );

  const canEdit = hasPerm('can_edit');
  const canDelete = hasPerm('can_delete');
  const canCreate = hasPerm('can_add');

  const initialSort = [{ id: 'name', desc: true }];

  const toggleActive = (data: AlertObject, checked: boolean) => {
    if (data && data.id) {
      const update_id = data.id;
      updateResource(update_id, { active: checked }).then(() => {
        refreshData();
      });
    }
  };

  useEffect(() => {
    refreshData();
  }, [isReportEnabled]);

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { last_state: lastState },
          },
        }: any) => {
          const lastStateConfig = {
            name: '',
            label: '',
            status: '',
          };
          switch (lastState) {
            case 'Success':
              lastStateConfig.name = 'check';
              lastStateConfig.label = t('Success');
              lastStateConfig.status = 'Success';
              break;
            case 'Working':
              lastStateConfig.name = 'exclamation';
              lastStateConfig.label = t('Working');
              lastStateConfig.status = 'Working';
              break;
            case 'Error':
              lastStateConfig.name = 'x-small';
              lastStateConfig.label = t('Error');
              lastStateConfig.status = 'Error';
              break;
            default:
              lastStateConfig.name = 'exclamation';
              lastStateConfig.label = t('Working');
              lastStateConfig.status = 'Working';
          }
          return (
            <Tooltip title={lastStateConfig.label} placement="bottom">
              <StatusIcon
                name={lastStateConfig.name as IconName}
                status={lastStateConfig.status}
              />
            </Tooltip>
          );
        },
        accessor: 'last_state',
        size: 'xs',
        disableSortBy: true,
      },
      {
        accessor: 'name',
        Header: t('Name'),
      },
      {
        Cell: ({
          row: {
            original: { recipients },
          },
        }: any) =>
          recipients.map((r: any) => (
            <Icon key={r.id} name={r.type as IconName} />
          )),
        accessor: 'recipients',
        Header: t('Notification Method'),
        disableSortBy: true,
      },
      {
        Header: t('Schedule'),
        accessor: 'crontab',
      },
      {
        accessor: 'created_by',
        disableSortBy: true,
        hidden: true,
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
        size: 'lg',
      },
      {
        Cell: ({ row: { original } }: any) => (
          <Switch
            data-test="toggle-active"
            checked={original.active}
            onClick={(checked: boolean) => toggleActive(original, checked)}
            size="small"
          />
        ),
        Header: t('Active'),
        accessor: 'active',
        id: 'active',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => {}; // handleAnnotationEdit(original);
          const handleDelete = () => {}; // setAlertCurrentlyDeleting(original);
          const actions = [
            canEdit
              ? {
                  label: 'preview-action',
                  tooltip: t('Execution Log'),
                  placement: 'bottom',
                  icon: 'note' as IconName,
                  onClick: handleEdit,
                }
              : null,
            canEdit
              ? {
                  label: 'edit-action',
                  tooltip: t('Edit Alert'),
                  placement: 'bottom',
                  icon: 'edit' as IconName,
                  onClick: handleEdit,
                }
              : null,
            canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete Alert'),
                  placement: 'bottom',
                  icon: 'trash' as IconName,
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canDelete,
        disableSortBy: true,
        size: 'xl',
      },
    ],
    [canDelete, canEdit],
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
      onClick: () => {},
    });
  }

  const EmptyStateButton = (
    <Button buttonStyle="primary" onClick={() => {}}>
      <i className="fa fa-plus" /> {title}
    </Button>
  );

  const emptyState = {
    message: t('No %s yet', title),
    slot: canCreate ? EmptyStateButton : null,
  };

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Created By'),
        id: 'created_by',
        input: 'select',
        operator: FilterOperators.relationOneMany,
        unfilteredLabel: 'All',
        fetchSelects: createFetchRelated(
          'report',
          'created_by',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching created by values: %s', errMsg),
          ),
          user.userId,
        ),
        paginate: true,
      },
      {
        Header: t('Status'),
        id: 'last_state',
        input: 'select',
        operator: FilterOperators.equals,
        unfilteredLabel: 'Any',
        selects: [
          { label: t('Success'), value: 'Success' },
          { label: t('Working'), value: 'Working' },
          { label: t('Error'), value: 'Error' },
        ],
      },
      {
        Header: t('Search'),
        id: 'name',
        input: 'search',
        operator: FilterOperators.contains,
      },
    ],
    [],
  );

  return (
    <>
      <SubMenu
        activeChild={pathName}
        name={t('Alerts & Reports')}
        tabs={[
          {
            name: 'Alerts',
            label: t('Alerts'),
            url: '/alert/list/',
            usesRouter: true,
          },
          {
            name: 'Reports',
            label: t('Reports'),
            url: '/report/list/',
            usesRouter: true,
          },
        ]}
        buttons={subMenuButtons}
      />
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
        pageSize={PAGE_SIZE}
      />
    </>
  );
}

export default withToasts(AlertList);
