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

import { useMemo, useState } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import {
  Tag,
  DeleteModal,
  ConfirmStatusChange,
  Loading,
} from '@superset-ui/core/components';

import rison from 'rison';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useThemeContext } from 'src/theme/ThemeProvider';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import handleResourceExport from 'src/utils/export';
import {
  ModifiedInfo,
  ListView,
  ListViewActionsBar,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewActionProps,
  type ListViewFilters,
} from 'src/components';

import ThemeModal from 'src/features/themes/ThemeModal';
import { ThemeObject } from 'src/features/themes/types';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import { Icons } from '@superset-ui/core/components/Icons';

const PAGE_SIZE = 25;

interface ThemesListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function ThemesList({
  addDangerToast,
  addSuccessToast,
  user,
}: ThemesListProps) {
  const {
    state: {
      loading,
      resourceCount: themesCount,
      resourceCollection: themes,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<ThemeObject>('theme', t('Themes'), addDangerToast);
  const { setTemporaryTheme } = useThemeContext();
  const [themeModalOpen, setThemeModalOpen] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeObject | null>(null);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const canApply = hasPerm('can_write'); // Only users with write permission can apply themes

  const [themeCurrentlyDeleting, setThemeCurrentlyDeleting] =
    useState<ThemeObject | null>(null);

  const handleThemeDelete = ({ id, theme_name }: ThemeObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/theme/${id}`,
    }).then(
      () => {
        refreshData();
        setThemeCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', theme_name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', theme_name, errMsg),
        ),
      ),
    );
  };

  const handleBulkThemeDelete = (themesToDelete: ThemeObject[]) => {
    // Filter out system themes from deletion
    const deletableThemes = themesToDelete.filter(theme => !theme.is_system);

    if (deletableThemes.length === 0) {
      addDangerToast(t('Cannot delete system themes'));
      return;
    }

    if (deletableThemes.length !== themesToDelete.length) {
      addDangerToast(
        t(
          'Skipped %d system themes that cannot be deleted',
          themesToDelete.length - deletableThemes.length,
        ),
      );
    }

    SupersetClient.delete({
      endpoint: `/api/v1/theme/?q=${rison.encode(
        deletableThemes.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected themes: %s', errMsg),
        ),
      ),
    );
  };

  function handleThemeEdit(themeObj: ThemeObject) {
    setCurrentTheme(themeObj);
    setThemeModalOpen(true);
  }

  function handleThemeApply(themeObj: ThemeObject) {
    if (themeObj.json_data) {
      try {
        const themeConfig = JSON.parse(themeObj.json_data);
        setTemporaryTheme(themeConfig);
        addSuccessToast(
          t('Theme "%s" applied temporarily', themeObj.theme_name),
        );
      } catch (error) {
        addDangerToast(t('Failed to apply theme: Invalid JSON configuration'));
      }
    }
  }

  const handleBulkThemeExport = (themesToExport: ThemeObject[]) => {
    const ids = themesToExport
      .map(({ id }) => id)
      .filter((id): id is number => id !== undefined);
    handleResourceExport('theme', ids, () => {
      setPreparingExport(false);
    });
    setPreparingExport(true);
  };

  const initialSort = [{ id: 'theme_name', desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({ row: { original } }: any) => (
          <>
            {original.theme_name}
            {original.is_system && (
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {t('System')}
              </Tag>
            )}
          </>
        ),
        Header: t('Name'),
        accessor: 'theme_name',
        id: 'theme_name',
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
        disableSortBy: true,
        id: 'changed_on_delta_humanized',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => handleThemeEdit(original);
          const handleDelete = () => setThemeCurrentlyDeleting(original);
          const handleApply = () => handleThemeApply(original);
          const handleExport = () => handleBulkThemeExport([original]);

          const actions = [
            canApply
              ? {
                  label: 'apply-action',
                  tooltip: t('Apply theme'),
                  placement: 'bottom',
                  icon: 'FormatPainterOutlined',
                  onClick: handleApply,
                }
              : null,
            canEdit
              ? {
                  label: 'edit-action',
                  tooltip: original.is_system
                    ? t('View theme')
                    : t('Edit theme'),
                  placement: 'bottom',
                  icon: original.is_system ? 'EyeOutlined' : 'EditOutlined',
                  onClick: handleEdit,
                }
              : null,
            canExport
              ? {
                  label: 'export-action',
                  tooltip: t('Export theme'),
                  placement: 'bottom',
                  icon: 'UploadOutlined',
                  onClick: handleExport,
                }
              : null,
            canDelete && !original.is_system
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete theme'),
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
        hidden: !canEdit && !canDelete && !canApply && !canExport,
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
        id: QueryObjectColumns.ChangedBy,
      },
    ],
    [canDelete, canCreate, canApply, canExport],
  );

  const menuData: SubMenuProps = {
    name: t('Themes'),
  };

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCreate) {
    subMenuButtons.push({
      name: <>{t('Theme')}</>,
      buttonStyle: 'primary',
      icon: <Icons.PlusOutlined iconSize="m" />,
      onClick: () => {
        setCurrentTheme(null);
        setThemeModalOpen(true);
      },
    });
  }

  if (canDelete || canExport) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  menuData.buttons = subMenuButtons;

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'theme_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Modified by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'theme',
          'changed_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching theme datasource values: %s',
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

  return (
    <>
      <SubMenu {...menuData} />
      <ThemeModal
        addDangerToast={addDangerToast}
        theme={currentTheme}
        onThemeAdd={() => refreshData()}
        onHide={() => setThemeModalOpen(false)}
        show={themeModalOpen}
        canDevelop={canEdit}
      />
      {themeCurrentlyDeleting && (
        <DeleteModal
          description={t('This action will permanently delete the theme.')}
          onConfirm={() => {
            if (themeCurrentlyDeleting) {
              handleThemeDelete(themeCurrentlyDeleting);
            }
          }}
          onHide={() => setThemeCurrentlyDeleting(null)}
          open
          title={t('Delete Theme?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t('Are you sure you want to delete the selected themes?')}
        onConfirm={handleBulkThemeDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = [];
          if (canDelete) {
            bulkActions.push({
              key: 'delete',
              name: t('Delete'),
              onSelect: confirmDelete,
              type: 'danger',
            });
          }
          if (canExport) {
            bulkActions.push({
              key: 'export',
              name: t('Export'),
              type: 'primary',
              onSelect: handleBulkThemeExport,
            });
          }

          return (
            <ListView<ThemeObject>
              className="themes-list-view"
              columns={columns}
              count={themesCount}
              data={themes}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>
      {preparingExport && <Loading />}
    </>
  );
}

export default withToasts(ThemesList);
