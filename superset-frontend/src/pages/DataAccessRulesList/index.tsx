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
import { t, SupersetClient } from '@superset-ui/core';
import { useMemo, useState } from 'react';
import { ConfirmStatusChange, Tooltip } from '@superset-ui/core/components';
import {
  ModifiedInfo,
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilters,
  type ListViewFetchDataConfig as FetchDataConfig,
} from 'src/components';
import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import rison from 'rison';
import { useListViewResource } from 'src/views/CRUD/hooks';
import DataAccessRuleModal from 'src/features/dataAccessRules/DataAccessRuleModal';
import { DataAccessRuleObject } from 'src/features/dataAccessRules/types';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import { QueryObjectColumns } from 'src/views/CRUD/types';

interface DataAccessRulesListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function DataAccessRulesList(props: DataAccessRulesListProps) {
  const { addDangerToast, addSuccessToast, user } = props;
  const [ruleModalOpen, setRuleModalOpen] = useState<boolean>(false);
  const [currentRule, setCurrentRule] =
    useState<DataAccessRuleObject | null>(null);

  const {
    state: {
      loading,
      resourceCount: rulesCount,
      resourceCollection: rules,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<DataAccessRuleObject>(
    'dar',
    t('Data Access Rule'),
    addDangerToast,
    true,
    undefined,
    undefined,
    true,
  );

  function handleRuleEdit(rule: DataAccessRuleObject | null) {
    setCurrentRule(rule);
    setRuleModalOpen(true);
  }

  function handleRuleDelete(
    { id, role }: DataAccessRuleObject,
    refreshData: (arg0?: FetchDataConfig | null) => void,
    addSuccessToast: (arg0: string) => void,
    addDangerToast: (arg0: string) => void,
  ) {
    const name = role?.name || `Rule ${id}`;
    return SupersetClient.delete({
      endpoint: `/api/v1/dar/${id}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t('Deleted %s', name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', name, errMsg)),
      ),
    );
  }

  function handleBulkRulesDelete(rulesToDelete: DataAccessRuleObject[]) {
    const ids = rulesToDelete.map(({ id }) => id);
    return SupersetClient.delete({
      endpoint: `/api/v1/dar/?q=${rison.encode(ids)}`,
    }).then(
      () => {
        refreshData();
        addSuccessToast(t(`Deleted`));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting rules: %s', errMsg)),
      ),
    );
  }

  function handleRuleModalHide() {
    setCurrentRule(null);
    setRuleModalOpen(false);
    refreshData();
  }

  const canWrite = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canExport = hasPerm('can_export');

  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { role },
          },
        }: {
          row: { original: DataAccessRuleObject };
        }) => role?.name || '-',
        accessor: 'role',
        Header: t('Role'),
        size: 'lg',
        id: 'role',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: { rule },
          },
        }: {
          row: { original: DataAccessRuleObject };
        }) => {
          const displayRule =
            typeof rule === 'string' ? rule : JSON.stringify(rule);
          const truncated =
            displayRule.length > 100
              ? `${displayRule.substring(0, 100)}...`
              : displayRule;
          return (
            <Tooltip id="rule-tooltip" title={displayRule} placement="top">
              <code style={{ fontSize: '11px' }}>{truncated}</code>
            </Tooltip>
          );
        },
        accessor: 'rule',
        Header: t('Rule (JSON)'),
        size: 'xxl',
        id: 'rule',
        disableSortBy: true,
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: {
          row: { original: DataAccessRuleObject };
        }) => <ModifiedInfo date={changedOn} user={changedBy} />,
        Header: t('Last modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
        id: 'changed_on_delta_humanized',
      },
      {
        Cell: ({ row: { original } }: { row: { original: DataAccessRuleObject } }) => {
          const handleDelete = () =>
            handleRuleDelete(
              original,
              refreshData,
              addSuccessToast,
              addDangerToast,
            );
          const handleEdit = () => handleRuleEdit(original);
          return (
            <div className="actions">
              {canWrite && (
                <ConfirmStatusChange
                  title={t('Please confirm')}
                  description={
                    <>
                      {t('Are you sure you want to delete')}{' '}
                      <b>{original.role?.name || `Rule ${original.id}`}</b>
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
                        role="button"
                        tabIndex={0}
                        className="action-button"
                        onClick={confirmDelete}
                      >
                        <Icons.DeleteOutlined
                          data-test="dar-list-trash-icon"
                          iconSize="l"
                        />
                      </span>
                    </Tooltip>
                  )}
                </ConfirmStatusChange>
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
                    onClick={handleEdit}
                  >
                    <Icons.EditOutlined data-test="edit-alt" iconSize="l" />
                  </span>
                </Tooltip>
              )}
            </div>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canWrite && !canExport,
        disableSortBy: true,
        size: 'lg',
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
        id: QueryObjectColumns.ChangedBy,
      },
    ],
    [
      user.userId,
      canEdit,
      canWrite,
      canExport,
      hasPerm,
      refreshData,
      addDangerToast,
      addSuccessToast,
    ],
  );

  const emptyState = {
    title: t('No Data Access Rules yet'),
    image: 'filter-results.svg',
    buttonAction: () => handleRuleEdit(null),
    buttonIcon: canEdit ? (
      <Icons.PlusOutlined iconSize="m" data-test="add-rule-empty" />
    ) : undefined,
    buttonText: canEdit ? t('Rule') : null,
  };

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Role'),
        key: 'role',
        id: 'role',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'dar',
          'role',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching roles: %s', errMsg),
          ),
          user,
        ),
        paginate: true,
      },
      {
        Header: t('Modified by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'dar',
          'changed_by',
          createErrorHandler(errMsg =>
            t('An error occurred while fetching users: %s', errMsg),
          ),
          user,
        ),
        paginate: true,
      },
    ],
    [user],
  );

  const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
  const PAGE_SIZE = 25;

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canWrite) {
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      'data-test': 'bulk-select',
      onClick: toggleBulkSelect,
    });
    subMenuButtons.push({
      name: t('Rule'),
      icon: <Icons.PlusOutlined iconSize="m" data-test="add-rule" />,
      buttonStyle: 'primary',
      onClick: () => handleRuleEdit(null),
    });
  }

  return (
    <>
      <SubMenu name={t('Data Access Rules')} buttons={subMenuButtons} />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected rules?')}
        onConfirm={handleBulkRulesDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canWrite) {
            bulkActions.push({
              key: 'delete',
              name: t('Delete'),
              type: 'danger',
              onSelect: confirmDelete,
            });
          }
          return (
            <>
              <DataAccessRuleModal
                rule={currentRule}
                addDangerToast={addDangerToast}
                onHide={handleRuleModalHide}
                addSuccessToast={addSuccessToast}
                show={ruleModalOpen}
              />
              <ListView<DataAccessRuleObject>
                className="dar-list-view"
                bulkActions={bulkActions}
                bulkSelectEnabled={bulkSelectEnabled}
                disableBulkSelect={toggleBulkSelect}
                columns={columns}
                count={rulesCount}
                data={rules}
                emptyState={emptyState}
                fetchData={fetchData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                addDangerToast={addDangerToast}
                addSuccessToast={addSuccessToast}
                refreshData={() => {}}
                pageSize={PAGE_SIZE}
              />
            </>
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(DataAccessRulesList);
