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

import { t, css } from '@superset-ui/core';
import React, { useState, useMemo, useEffect } from 'react';
import { createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useHistory } from 'react-router-dom';
import { useFlashListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, {
  SubMenuProps,
  ButtonProps,
} from 'src/views/components/SubMenu';
import ListView, { Filters, FilterOperator } from 'src/components/ListView';
import DeleteModal from 'src/components/DeleteModal';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import { TooltipPlacement } from 'antd/lib/tooltip';
import ConfirmationModal from 'src/components/ConfirmationModal';
import InitialsPile from 'src/components/Initials';
import { Tooltip } from 'src/components/Tooltip';
import { Space } from 'antd';
import { Theme } from '@emotion/react';
import { convertTolllDate, convertTolllDatetime } from 'src/utils/commonHelper';
import { Row, Col } from 'src/components';
import { FLASH_STATUS, FLASH_TYPES, SCHEDULE_TYPE } from '../../constants';
import { FlashServiceObject } from '../../types';
import FlashOwnership from '../FlashOwnership/FlashOwnership';
import FlashExtendTTL from '../FlashExtendTTl/FlashExtendTTl';
import FlashSchedule from '../FlashSchedule/FlashSchedule';
import {
  fetchDatabases,
  fetchStatuses,
  recoverFlashObject,
  removeFlash,
} from '../../services/flash.service';
import FlashQuery from '../FlashQuery/FlashQuery';
import { FlashTypes, FlashTypesEnum } from '../../enums';
import FlashView from '../FlashView/FlashView';
import FlashType from '../FlashType/FlashType';

const PAGE_SIZE = 25;

const appContainer = document.getElementById('app');
const { user } = JSON.parse(
  appContainer?.getAttribute('data-bootstrap') || '{}',
);

interface FlashListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function FlashList({ addDangerToast, addSuccessToast }: FlashListProps) {
  const {
    state: { loading, resourceCount: flashCount, resourceCollection: flashes },

    fetchData,
    refreshData,
  } = useFlashListViewResource<FlashServiceObject>(
    'flashes',
    t('Flashes'),
    addDangerToast,
  );

  const [currentFlash, setCurrentFlash] = useState<FlashServiceObject | {}>({});
  const [databaseDropdown, setDatabaseDropdown] = useState<Array<any>>([]);
  const [statusesDropdown, setStatusesDropdown] = useState<Array<any>>([]);

  const [deleteFlash, setDeleteFlash] = useState<FlashServiceObject | null>(
    null,
  );
  const [showFlashOwnership, setShowFlashOwnership] = useState<boolean>(false);
  const [showFlashTtl, setShowFlashTtl] = useState<boolean>(false);
  const [showFlashType, setShowFlashType] = useState<boolean>(false);
  const [showFlashSchedule, setShowFlashSchedule] = useState<boolean>(false);
  const [showFlashQuery, setShowFlashQuery] = useState<boolean>(false);
  const [showFlashView, setShowFlashView] = useState<boolean>(false);
  const [recoverFlash, setRecoverFlash] = useState<FlashServiceObject | null>(
    null,
  );

  useEffect(() => {
    fetchDatabaseDropdown();
    fetchStatusDropdown();
  }, []);

  const menuData: SubMenuProps = {
    name: t('Flash'),
  };

  const subMenuButtons: Array<ButtonProps> = [];
  menuData.buttons = subMenuButtons;

  const fetchDatabaseDropdown = (): Promise<any> =>
    fetchDatabases().then(
      ({ data }) => {
        const dropdown = data.map((item: any) => ({
          label: item.datastore_name,
          value: item.id,
        }));
        setDatabaseDropdown(dropdown);
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue getting Databases: %s', errMsg)),
      ),
    );

  const fetchStatusDropdown = (): Promise<any> =>
    fetchStatuses().then(
      ({ data }) => {
        const dropdown = data.map((item: any) => ({
          label: item.name,
          value: item.id,
        }));
        setStatusesDropdown(dropdown);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue getting Flash Statuses: %s', errMsg),
        ),
      ),
    );

  const changeOwnership = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashOwnership(true);
  };

  const changeTtl = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashTtl(true);
  };

  const changeType = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashType(true);
  };

  const changeSchedule = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashSchedule(true);
  };

  const changeSqlQuery = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashQuery(true);
  };

  const changeViewFlash = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashView(true);
  };

  const handleDeleteFlash = (flash: FlashServiceObject) => {
    flashDeleteService(flash);
  };

  const handleRecoverFlash = (flash: FlashServiceObject) => {
    flashRecoverService(flash);
  };

  const flashDeleteService = (flash: FlashServiceObject) => {
    if (flash && flash?.id) {
      removeFlash(flash?.id).then(
        () => {
          setDeleteFlash(null);
          addSuccessToast(t('Deleted: %s', flash?.tableName));
          refreshData();
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue deleting %s: %s', flash?.tableName, errMsg),
          ),
        ),
      );
    } else {
      addDangerToast('There is an issue deleting the flash');
    }
  };

  const flashRecoverService = (flash: FlashServiceObject) => {
    let currentTtl = '';
    const maxDate = new Date();

    const flashType = flash.flashType.replace(/([A-Z])/g, ' $1').trim();
    if (
      flashType === FlashTypes.SHORT_TERM ||
      flashType === FlashTypes.ONE_TIME
    ) {
      maxDate.setDate(maxDate.getDate() + 7);
      currentTtl = new Date(maxDate).toISOString().split('T')[0];
    } else if (flashType === FlashTypes.LONG_TERM) {
      maxDate.setDate(maxDate.getDate() + 90);
      currentTtl = new Date(maxDate).toISOString().split('T')[0];
    } else {
      addDangerToast(
        'There is an issue recovering the selected flash: FLASH TYPE is missing',
      );
      return;
    }
    const payload = {
      ttl: currentTtl,
      owner: user?.email,
    };
    if (flash && flash?.id) {
      recoverFlashObject(flash?.id, payload).then(
        () => {
          setRecoverFlash(null);
          addSuccessToast(t('Recovered: %s', flash?.tableName));
          refreshData();
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue recovering %s: %s', flash?.tableName, errMsg),
          ),
        ),
      );
    } else {
      addDangerToast(
        'There is an issue recovering the selected flash: FLASH ID is missing',
      );
    }
  };

  const isDeletedFlash = (flashStatus: string) => flashStatus === 'Deleted';

  const getColor = (type: string, theme: Theme) => {
    if (type === FlashTypes.ONE_TIME) {
      return theme.colors.error.light1;
    }
    if (type === FlashTypes.SHORT_TERM) {
      return theme.colors.warning.light1;
    }
    if (type === FlashTypes.LONG_TERM) {
      return theme.colors.success.light1;
    }
    return theme.colors.grayscale.light1;
  };

  const initialSort = [{ id: 'status', desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { datastoreId: id },
          },
        }: any) => {
          if (databaseDropdown && databaseDropdown.length > 0) {
            return databaseDropdown.find(item => item.value === id).label;
          }
          return id;
        },
        Header: t('Database Name'),
        accessor: 'datastoreId',
      },
      {
        Header: t('Flash Type: Flash Name (Schedule Frequency)'),
        Cell: ({
          row: {
            original: { flashType = '', tableName = '', scheduleType = '' },
          },
        }: any) => {
          const flash_type = flashType?.replace(/([A-Z])/g, ' $1').trim();
          const flashContent = flash_type ? flash_type.split(' ')[0][0] : '';
          const tooltipTitle = `${flash_type}: ${tableName}${
            scheduleType ? ` (${scheduleType})` : ''
          }`;
          return (
            tableName && (
              <Space>
                <Tooltip title={`${flash_type}`} placement="top">
                  <span
                    css={(theme: Theme) => css`
                    color: ${theme.colors.grayscale.light5};
                      padding: 5px 8px 5px 8px;

                      font-weight: 800;
                      font-size: 10px
                      border: block;
                      background: ${getColor(flash_type, theme)};
                    `}
                  >{`${flashContent}`}</span>
                </Tooltip>
                <Tooltip title={tooltipTitle} placement="top">
                  {`${tableName}`}{' '}
                  {scheduleType ? <strong>{`(${scheduleType})`}</strong> : null}
                </Tooltip>
              </Space>
            )
          );
        },
      },

      {
        accessor: 'tableName',
        Header: t('Flash Name'),
        size: 'xs',
        hidden: true,
      },
      {
        Header: t('Flash Type'),
        accessor: 'flashType',
        size: 'xs',
        hidden: true,
      },
      {
        accessor: 'scheduleType',
        Header: t('Schedule Frequency'),
        size: 'xs',
        hidden: true,
      },
      {
        Cell: ({
          row: {
            original: { ttl },
          },
        }: any) => convertTolllDate(ttl),
        Header: t('Expiry'),
        accessor: 'ttl',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { lastRefreshTime = '', nextRefreshTime = '' },
          },
        }: any) => (
          <Row>
            <Col sm={6} md={24} lg={11}>
              ({lastRefreshTime ? convertTolllDatetime(lastRefreshTime) : 'N/A'}
              )
            </Col>
            <Col sm={2} md={2} lg={2}>
              {' '}
              -{' '}
            </Col>
            <Col sm={6} md={24} lg={11}>
              {' '}
              ({nextRefreshTime ? convertTolllDatetime(nextRefreshTime) : 'N/A'}
              )
            </Col>
          </Row>
        ),
        Header: t('(Last Refresh - Next Refresh) Time'),
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { owner },
          },
        }: any) => <InitialsPile email={owner} />,
        Header: t('Owner'),
        id: 'owner',
        disableSortBy: true,
      },
      {
        Header: t('Status'),
        accessor: 'status',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const history = useHistory();
          const handleSqlQuery = () => {
            changeSqlQuery(original);
          };
          const handleRecover = () => setRecoverFlash(original);
          const handleChangeSchedule = () => changeSchedule(original);
          const handleChangeOwnership = () => changeOwnership(original);
          const handleChangeTtl = () => changeTtl(original);
          const handleChangeType = () => changeType(original);
          const handleDelete = () => setDeleteFlash(original);
          const handleView = () => changeViewFlash(original);
          const handleGotoAuditLog = () =>
            history.push(`/flash/auditlogs/${original.id}`);

          const actions: ActionProps[] | [] = [
            isDeletedFlash(original?.status) && {
              label: 'recover-action',
              tooltip: t('Recover Flash'),
              placement: 'bottom' as TooltipPlacement,
              icon: 'Undo',
              onClick: handleRecover,
            },
            !isDeletedFlash(original?.status) &&
              original?.flashType !== FlashTypesEnum.ONE_TIME &&
              (original?.owner === user?.email || user?.roles?.Admin) && {
                label: 'export-action',
                tooltip: t('Extend TTL'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Share',
                onClick: handleChangeTtl,
              },
            !isDeletedFlash(original?.status) &&
              (original?.owner === user?.email || user?.roles?.Admin) && {
                label: 'export-action',
                tooltip: t('Change Flash Type'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Edit',
                onClick: handleChangeType,
              },
            !isDeletedFlash(original?.status) && {
              label: 'ownership-action',
              tooltip: t('Change Ownership'),
              placement: 'bottom' as TooltipPlacement,
              icon: 'SwitchUser',
              onClick: handleChangeOwnership,
            },
            !isDeletedFlash(original?.status) &&
              original?.flashType !== FlashTypesEnum.ONE_TIME &&
              (original?.owner === user?.email || user?.roles?.Admin) && {
                label: 'copy-action',
                tooltip: t('Change Schedule'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Calendar',
                onClick: handleChangeSchedule,
              },
            !isDeletedFlash(original?.status) &&
              (original?.owner === user?.email || user?.roles?.Admin) && {
                label: 'copy-action',
                tooltip: t('Update Sql Query'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Sql',
                onClick: handleSqlQuery,
              },
            !isDeletedFlash(original?.status) &&
              original?.owner === user?.email && {
                label: 'delete-action',
                tooltip: t('Delete Flash'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Trash',
                onClick: handleDelete,
              },
            {
              label: 'view-action',
              tooltip: t('View Flash Information'),
              placement: 'bottom' as TooltipPlacement,
              icon: 'Eye',
              onClick: handleView,
            },
            {
              label: 'execution-log-action',
              tooltip: t('Audit logs'),
              placement: 'bottom',
              icon: 'Note',
              onClick: handleGotoAuditLog,
            },
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [databaseDropdown],
  );

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Database Name'),
        id: 'datastoreId',
        input: 'select',
        operator: FilterOperator.equals,
        unfilteredLabel: 'All',
        selects: databaseDropdown,
      },
      {
        Header: t('Flash Name'),
        id: 'tableName',
        input: 'search',
        operator: FilterOperator.contains,
      },

      {
        Header: t('Flash Type'),
        id: 'flashType',
        input: 'select',
        operator: FilterOperator.equals,
        unfilteredLabel: 'All',
        selects: FLASH_TYPES,
      },
      {
        Header: t('TTL'),
        id: 'ttl',
        input: 'date',
      },
      {
        Header: t('Schedule Type'),
        id: 'scheduleType',
        input: 'select',
        operator: FilterOperator.equals,
        unfilteredLabel: 'All',
        selects: SCHEDULE_TYPE,
      },
      {
        Header: t('Owner Name'),
        id: 'owner',
        input: 'search',
        operator: FilterOperator.contains,
      },
      {
        Header: t('Status'),
        id: 'status',
        input: 'select',
        operator: FilterOperator.equals,
        unfilteredLabel: 'All',
        selects: statusesDropdown.length > 0 ? statusesDropdown : FLASH_STATUS,
      },
    ],
    [statusesDropdown, databaseDropdown, addDangerToast],
  );

  return (
    <>
      <SubMenu {...menuData} />

      {showFlashOwnership && (
        <FlashOwnership
          flash={currentFlash as FlashServiceObject}
          show={showFlashOwnership}
          onHide={() => setShowFlashOwnership(false)}
          refreshData={refreshData}
        />
      )}

      {showFlashTtl && (
        <FlashExtendTTL
          flash={currentFlash as FlashServiceObject}
          show={showFlashTtl}
          onHide={() => setShowFlashTtl(false)}
          refreshData={refreshData}
        />
      )}

      {showFlashType && (
        <FlashType
          flash={currentFlash as FlashServiceObject}
          show={showFlashType}
          onHide={() => setShowFlashType(false)}
          refreshData={refreshData}
        />
      )}

      {showFlashSchedule && (
        <FlashSchedule
          flash={currentFlash as FlashServiceObject}
          show={showFlashSchedule}
          onHide={() => setShowFlashSchedule(false)}
          refreshData={refreshData}
        />
      )}

      {showFlashQuery && (
        <FlashQuery
          flash={currentFlash as FlashServiceObject}
          show={showFlashQuery}
          onHide={() => setShowFlashQuery(false)}
          refreshData={refreshData}
        />
      )}

      {showFlashView && (
        <FlashView
          flash={currentFlash as FlashServiceObject}
          show={showFlashView}
          onHide={() => setShowFlashView(false)}
          databaseDropdown={databaseDropdown}
        />
      )}

      {deleteFlash && (
        <DeleteModal
          description={t(
            'This action will permanently delete the selected flash object.',
          )}
          onConfirm={() => {
            if (deleteFlash) {
              handleDeleteFlash(deleteFlash);
            }
          }}
          onHide={() => setDeleteFlash(null)}
          open
          title={t('Delete Flash Object?')}
        />
      )}

      {recoverFlash && (
        <ConfirmationModal
          description={t(
            'This action will recover the selected flash object and the ownership will be transferred to you',
          )}
          onConfirm={() => {
            if (recoverFlash) {
              handleRecoverFlash(recoverFlash);
            }
          }}
          onHide={() => setRecoverFlash(null)}
          open
          title={t('Recover Flash Object?')}
          primaryButtonName={t('recover')}
          confirmationType={t('recover')}
        />
      )}

      <ListView<FlashServiceObject>
        className="flash-list-view"
        columns={columns}
        count={flashCount}
        data={flashes}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}

export default withToasts(FlashList);
