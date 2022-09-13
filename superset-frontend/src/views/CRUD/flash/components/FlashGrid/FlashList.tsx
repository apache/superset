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

import { SupersetClient, t } from '@superset-ui/core';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useFlashListViewResource } from 'src/views/CRUD/hooks';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import SubMenu, {
  SubMenuProps,
  ButtonProps,
} from 'src/views/components/SubMenu';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import DeleteModal from 'src/components/DeleteModal';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import { SavedQueryObject } from 'src/views/CRUD/types';
import { FLASH_STATUS, FLASH_TYPES, SCHEDULE_TYPE } from '../../constants';
import { FlashServiceObject } from '../../types';
import FlashOwnership from '../FlashOwnership/FlashOwnership';
import FlashExtendTTL from '../FlashExtendTTl/FlashExtendTTl';
import FlashSchedule from '../FlashSchedule/FlashSchedule';
import { fetchDatabases, removeFlash } from '../../services/flash.service';
import FlashQuery from '../FlashQuery/FlashQuery';
import { TooltipPlacement } from 'antd/lib/tooltip';

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
    state: {
      loading,
      resourceCount: flashCount,
      resourceCollection: flashes,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useFlashListViewResource<FlashServiceObject>(
    'flashes',
    t('Flashes'),
    addDangerToast,
  );

  const [currentFlash, setCurrentFlash] = useState<FlashServiceObject | {}>({});
  const [databaseDropdown, setDatabaseDropdown] = useState<Array<any>>([]);

  const [deleteFlash, setDeleteFlash] = useState<FlashServiceObject | null>(
    null,
  );
  const [showFlashOwnership, setShowFlashOwnership] = useState<boolean>(false);
  const [showFlashTtl, setShowFlashTtl] = useState<boolean>(false);
  const [showFlashSchedule, setShowFlashSchedule] = useState<boolean>(false);
  const [showFlashQuery, setShowFlashQuery] = useState<boolean>(false);
  const [savedQueryCurrentlyPreviewing, setSavedQueryCurrentlyPreviewing] =
    useState<SavedQueryObject | null>(null);

  useEffect(() => {
    fetchDatabaseDropdown();
  }, []);

  const menuData: SubMenuProps = {
    name: t('Flash'),
  };

  const subMenuButtons: Array<ButtonProps> = [];
  menuData.buttons = subMenuButtons;

  const fetchDatabaseDropdown = (): Promise<any> => {
    return fetchDatabases().then(
      ({ data }) => {
        let dropdown = data.map((item: any) => {
          return {
            label: item.datastore_name,
            value: item.id,
          };
        });
        setDatabaseDropdown(dropdown);
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue getting Databases %s', errMsg)),
      ),
    );
  };

  const changeOwnership = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashOwnership(true);
  };

  const changeTtl = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashTtl(true);
  };

  const changeSchedule = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashSchedule(true);
  };

  const changeSqlQuery = (flash: FlashServiceObject) => {
    setCurrentFlash(flash);
    setShowFlashQuery(true);
  };

  const handleDeleteFlash = (flash: FlashServiceObject) => {
    flashDeleteService(flash);
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
            return databaseDropdown.find(item => item.value == id).label;
          } else {
            return id;
          }
        },
        Header: t('Database Name'),
        accessor: 'datastoreId',
        size: 'l',
      },
      {
        accessor: 'tableName',
        Header: t('Flash Name'),
        size: 'l',
      },
      {
        Cell: ({
          row: {
            original: { flashType: flash_Type },
          },
        }: any) => {
          return flash_Type.replace(/([A-Z])/g, ' $1').trim();
        },
        Header: t('Flash Type'),
        accessor: 'flashType',
        size: 'l',
      },
      {
        accessor: 'ttl',
        Header: t('TTL'),
        disableSortBy: true,
      },
      {
        accessor: 'scheduleType',
        Header: t('Schedule Type'),
        size: 'l',
      },
      {
        Header: t('Slack Channel'),
        accessor: 'teamSlackChannel',
        size: 'xl',
      },
      {
        Header: t('Slack Handle'),
        accessor: 'teamSlackHandle',
        size: 'xl',
      },
      {
        Header: t('Owner'),
        accessor: 'owner',
        size: 'l',
      },
      {
        Header: t('Status'),
        accessor: 'status',
        size: 'l',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleSqlQuery = () => {
            changeSqlQuery(original);
          };
          const handleChangeSchedule = () => changeSchedule(original);
          const handleChangeOwnership = () => changeOwnership(original);
          const handleChangeCost = () => console.log('costing==', original);
          const handleChangeTtl = () => changeTtl(original);
          const handleDelete = () => setDeleteFlash(original);

          let actions: ActionProps[] | [] = [];

          if (original?.owner === user?.email || user?.roles?.Admin) {
            actions = [
              {
                label: 'export-action',
                tooltip: t('Extend TTL'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Share',
                onClick: handleChangeTtl,
              },
              {
                label: 'ownership-action',
                tooltip: t('Change Ownership'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'SwitchUser',
                onClick: handleChangeOwnership,
              },

              {
                label: 'copy-action',
                tooltip: t('Change Schedule'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Calendar',
                onClick: handleChangeSchedule,
              },
              {
                label: 'copy-action',
                tooltip: t('Update Sql Query'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Sql',
                onClick: handleSqlQuery,
              },
              {
                label: 'copy-action',
                tooltip: t('Change Costing Attributes'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Edit',
                onClick: handleChangeCost,
              },
              {
                label: 'delete-action',
                tooltip: t('Delete Flash'),
                placement: 'bottom' as TooltipPlacement,
                icon: 'Trash',
                onClick: handleDelete,
              },
            ].filter(item => !!item);
          } else {
            actions = [];
          }

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
        operator: FilterOperator.relationOneMany,
        unfilteredLabel: 'All',
        selects: FLASH_STATUS,
      },
    ],
    [databaseDropdown, addDangerToast],
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

      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected flash?')}
        onConfirm={() => console.log('query deleted')}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          bulkActions.push({
            key: 'delete',
            name: t('Delete'),
            onSelect: confirmDelete,
            type: 'danger',
          });
          return (
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
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              highlightRowId={savedQueryCurrentlyPreviewing?.id}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(FlashList);
