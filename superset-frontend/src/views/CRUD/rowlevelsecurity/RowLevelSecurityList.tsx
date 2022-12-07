import { t, styled } from '@superset-ui/core';
import React, { useMemo, useState } from 'react';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import Icons from 'src/components/Icons';
import ListView from 'src/components/ListView';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Tooltip } from 'src/components/Tooltip';
import SubMenu, { SubMenuProps } from 'src/views/components/SubMenu';
import { useListViewResource, useSingleViewResource } from '../hooks';
import RowLevelSecurityModal from './RowLevelSecurityModal';
import { RLSObject } from './types';

const Actions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

interface RLSProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId?: string | number;
    firstName: string;
    lastName: string;
  };
}

// TODO: get addSuccessToast and addDangerToast function here
function RowLevelSecurityList(props: RLSProps) {
  console.log('rosl props ', props);
  const {
    addDangerToast,
    addSuccessToast,
    user: { userId },
  } = props;
  const [ruleModalOpen, setRuleModalOpen] = useState<boolean>(false);
  const [currentRule, setCurrentRule] = useState(null);

  const {
    state: {
      loading,
      resourceCount: rulesCount,
      resourceCollection: rules,
      bulkSelectEnabled,
      lastFetched,
    },
    hasPerm,
    fetchData,
    setResourceCollection,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<RLSObject>(
    'rowlevelsecurity',
    t('Row Level Security'),
    addDangerToast,
    true,
    undefined,
    undefined,
    true,
  );
  // fetchData({ pageIndex: 0, pageSize: 10, sortBy: [{ id: 'modified', desc: true }], filters: [] }).then(results => console.log("rls list ", results));
  const { updateResource } = useSingleViewResource<Partial<RLSObject>>(
    'rowlevelsecurity',
    t('rowlevelsecurity'),
    addDangerToast,
  );

  function handleRuleEdit(rule: null) {
    setCurrentRule(rule);
    setRuleModalOpen(true);
  }
  function handleRuleModalHide() {
    setCurrentRule(null);
    setRuleModalOpen(false);
    refreshData();
  }

  const canWrite = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canExport = hasPerm('can_export');

  const generateKey = () => `${new Date().getTime()}`;

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        size: 'xl',
      },
      {
        accessor: 'filter_type',
        Header: t('Filter Type'),
        size: 'xl',
      },
      {
        accessor: 'group_key',
        Header: t('Group Key'),
        size: 'xl',
      },
      {
        accessor: 'clause',
        Header: t('Clause'),
        size: 'xl',
      },
      {
        Cell: ({
          row: {
            original: { changed_on_delta_humanized: changedOn },
          },
        }: any) => <span className="no-wrap">{changedOn}</span>,
        Header: t('Modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () =>
            handleRuleDelete(
              original,
              refreshData,
              addSuccessToast,
              addDangerToast,
            );
          const handleEdit = () => handleRuleEdit(original);
          const handleExport = () => handleBulkRuleExport([original]);
          return (
            <Actions className="actions">
              {canWrite && (
                <ConfirmStatusChange
                  title={t('Please confirm')}
                  description={
                    <>
                      {t('Are you sure you want to delete')}{' '}
                      <b>{original.name}</b>?
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
                        <Icons.Trash data-test="rls-list-trash-icon" />
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
                    onClick={handleEdit}
                  >
                    <Icons.EditAlt data-test="edit-alt" />
                  </span>
                </Tooltip>
              )}
            </Actions>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        hidden: !canEdit && !canWrite && !canExport,
        disableSortBy: true,
      },
    ],
    [
      userId,
      canEdit,
      canWrite,
      canExport,
      hasPerm,
      refreshData,
      addDangerToast,
      addSuccessToast,
    ],
  );

  const emptyState = {};

  const filters = [];

  const initialSort = [{ id: 'modified', desc: true }];
  const PAGE_SIZE = 25;

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canWrite) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Rule')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => handleRuleEdit(null),
    });
  }

  if (canWrite || canExport) {
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      'data-test': 'bulk-select',
      onClick: toggleBulkSelect,
    });
  }

  return (
    <>
      <SubMenu name={t('Row Level Security')} buttons={subMenuButtons} />
      <RowLevelSecurityModal
        rule={currentRule}
        addDangerToast={addDangerToast}
        onHide={handleRuleModalHide}
        addSuccessToast={addSuccessToast}
        show={ruleModalOpen}
      />
      <ListView<RLSObject>
        className="rls-list-view"
        columns={columns}
        count={rulesCount}
        data={rules}
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

export default withToasts(RowLevelSecurityList);
