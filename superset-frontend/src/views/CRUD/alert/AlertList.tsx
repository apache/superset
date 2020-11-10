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

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { t, styled, SupersetClient } from '@superset-ui/core';
import moment from 'moment';
import rison from 'rison';

import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import Button from 'src/components/Button';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DeleteModal from 'src/components/DeleteModal';
import ListView, { ListViewProps } from 'src/components/ListView';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import getClientErrorObject from 'src/utils/getClientErrorObject';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { IconName } from 'src/components/Icon';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';

import { AlertObject } from './types';

const PAGE_SIZE = 25;

interface AlertListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function AlertList({ addDangerToast, addSuccessToast }: AlertListProps) {
  const {
    state: { loading, resourceCount: alertsCount, resourceCollection: alerts },
    fetchData,
  } = useListViewResource<AlertObject>(
    'alert',
    t('alerts'),
    addDangerToast,
    false,
  );

  const initialSort = [{ id: 'short_descr', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'short_descr',
        Header: t('Label'),
      },
      {
        accessor: 'long_descr',
        Header: t('Description'),
      },
      {
        Cell: ({
          row: {
            original: { start_dttm: startDttm },
          },
        }: any) => moment(new Date(startDttm)).format('ll'),
        Header: t('Start'),
        accessor: 'start_dttm',
      },
      {
        Cell: ({
          row: {
            original: { end_dttm: endDttm },
          },
        }: any) => moment(new Date(endDttm)).format('ll'),
        Header: t('End'),
        accessor: 'end_dttm',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => {}; // handleAnnotationEdit(original);
          const handleDelete = () => {}; // setAlertCurrentlyDeleting(original);
          const actions = [
            {
              label: 'edit-action',
              tooltip: t('Edit Alert'),
              placement: 'bottom',
              icon: 'edit' as IconName,
              onClick: handleEdit,
            },
            {
              label: 'delete-action',
              tooltip: t('Delete Alert'),
              placement: 'bottom',
              icon: 'trash' as IconName,
              onClick: handleDelete,
            },
          ];
          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [true, true],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  subMenuButtons.push({
    name: (
      <>
        <i className="fa fa-plus" /> {t('Alert')}
      </>
    ),
    buttonStyle: 'primary',
    onClick: () => {},
  });

  const EmptyStateButton = (
    <Button buttonStyle="primary" onClick={() => {}}>
      <>
        <i className="fa fa-plus" /> {t('Alert')}
      </>
    </Button>
  );

  const emptyState = {
    message: t('No alert yet'),
    slot: EmptyStateButton,
  };

  return (
    <>
      <SubMenu
        activeChild="Alerts"
        name={t('Alerts & Reports')}
        tabs={[
          {
            name: 'Alerts',
            label: t('Alerts'),
            url: '/alters/list/',
            usesRouter: true,
          },
          {
            name: 'Reports',
            label: t('Reports'),
            url: '/reports/list/',
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
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}

export default withToasts(AlertList);
