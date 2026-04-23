import { useMemo, useState } from 'react';
import { t, SupersetClient } from '@superset-ui/core';

import rison from 'rison';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { DeleteModal, ConfirmStatusChange } from '@superset-ui/core/components';
import {
  ListView,
  ListViewActionsBar,
  ListViewFilterOperator as FilterOperator,
  type ListViewActionProps,
  type ListViewFilters,
} from 'src/components';
import { Icons } from '@superset-ui/core/components/Icons';
import DynamicPluginModal, {
  DynamicPluginObject,
} from 'src/features/dynamicPlugins/DynamicPluginModal';

const PAGE_SIZE = 25;

interface DynamicPluginsListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function DynamicPluginsList({
  addDangerToast,
  addSuccessToast,
}: DynamicPluginsListProps) {
  const {
    state: {
      loading,
      resourceCount: pluginsCount,
      resourceCollection: plugins,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<DynamicPluginObject>(
    'manage/dynamic-plugins',
    t('Dynamic plugins'),
    addDangerToast,
  );

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canRead = hasPerm('can_read');

  const [pluginModalOpen, setPluginModalOpen] = useState<boolean>(false);
  const [currentPlugin, setCurrentPlugin] =
    useState<DynamicPluginObject | null>(null);
  const [pluginCurrentlyDeleting, setPluginCurrentlyDeleting] =
    useState<DynamicPluginObject | null>(null);

  const handlePluginEdit = (plugin: DynamicPluginObject) => {
    setCurrentPlugin(plugin);
    setPluginModalOpen(true);
  };

  const handlePluginDelete = ({ id, name }: DynamicPluginObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/manage/dynamic-plugins/${id}`,
    }).then(
      () => {
        refreshData();
        setPluginCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(t('There was an issue deleting %s: %s', name, errMsg)),
      ),
    );
  };

  const handleBulkPluginDelete = (pluginsToDelete: DynamicPluginObject[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/manage/dynamic-plugins/?q=${rison.encode(
        pluginsToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected plugins: %s', errMsg),
        ),
      ),
    );
  };

  const initialSort = [{ id: 'name', desc: true }];

  const columns = useMemo(
    () => [
      {
        accessor: 'id',
        id: 'id',
        Header: 'Id',
        size: 'xs',
      },
      {
        accessor: 'name',
        id: 'name',
        Header: t('Name'),
      },
      {
        accessor: 'key',
        id: 'key',
        Header: t('Key'),
        Cell: ({ row: { original } }: any) => <span>{original.key_id}</span>,
      },
      {
        accessor: 'bundle_url',
        id: 'bundle_url',
        Header: t('Bundle URL'),
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => handlePluginEdit(original);
          const handleDelete = () => setPluginCurrentlyDeleting(original);

          const actions = [
            canEdit
              ? {
                  label: 'edit-action',
                  tooltip: t('Edit dynamic plugin'),
                  placement: 'bottom',
                  icon: 'EditOutlined',
                  onClick: handleEdit,
                }
              : null,
            canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete dynamic plugin'),
                  placement: 'bottom',
                  icon: 'DeleteOutlined',
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => !!item);

          return (
            <ListViewActionsBar actions={actions as ListViewActionProps[]} />
          );
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        hidden: !canRead && !canEdit && !canDelete,
        size: 'xs',
      },
      {
        accessor: 'created_by',
        id: 'created_by',
        hidden: true,
      },
      {
        accessor: 'changed_by',
        id: 'changed_by',
        hidden: true,
      },
    ],
    [canDelete, canEdit, canRead],
  );

  const menuData: SubMenuProps = {
    name: t('Dynamic plugins'),
  };

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  if (canCreate) {
    subMenuButtons.push({
      name: t('Dynamic plugin'),
      buttonStyle: 'primary',
      icon: <Icons.PlusOutlined iconSize="m" />,
      onClick: () => {
        setCurrentPlugin(null);
        setPluginModalOpen(true);
      },
    });
  }

  menuData.buttons = subMenuButtons;

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'name',
        id: 'name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Key'),
        key: 'key',
        id: 'key',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Bundle URL'),
        key: 'bundle_url',
        id: 'bundle_url',
        input: 'search',
        operator: FilterOperator.Contains,
      },
    ],
    [],
  );

  const emptyState = {
    title: t('No dynamic plugins yet'),
    image: 'filter-results.svg',
  };

  return (
    <>
      <SubMenu {...menuData} />
      <DynamicPluginModal
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        plugin={currentPlugin}
        onPluginAdd={() => refreshData()}
        onHide={() => setPluginModalOpen(false)}
        show={pluginModalOpen}
      />
      {pluginCurrentlyDeleting && (
        <DeleteModal
          description={t('This action will permanently delete the plugin.')}
          onConfirm={() => {
            if (pluginCurrentlyDeleting) {
              handlePluginDelete(pluginCurrentlyDeleting);
            }
          }}
          onHide={() => setPluginCurrentlyDeleting(null)}
          open
          title={t('Delete dynamic plugin?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected plugins?')}
        onConfirm={handleBulkPluginDelete}
      >
        {confirmDelete => (
          <ListView<DynamicPluginObject>
            className="dynamic-plugins-list-view"
            columns={columns}
            count={pluginsCount}
            data={plugins}
            fetchData={fetchData}
            filters={filters}
            initialSort={initialSort}
            loading={loading}
            pageSize={PAGE_SIZE}
            bulkSelectEnabled={bulkSelectEnabled}
            disableBulkSelect={toggleBulkSelect}
            addDangerToast={addDangerToast}
            addSuccessToast={addSuccessToast}
            emptyState={emptyState}
            refreshData={refreshData}
          />
        )}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(DynamicPluginsList);
