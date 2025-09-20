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
import { t, SupersetClient, styled } from '@superset-ui/core';
import {
  Tag,
  DeleteModal,
  ConfirmStatusChange,
  Loading,
  Alert,
  Tooltip,
  Space,
  Modal,
} from '@superset-ui/core/components';

import rison from 'rison';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useThemeContext } from 'src/theme/ThemeProvider';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import handleResourceExport from 'src/utils/export';
import getBootstrapData from 'src/utils/getBootstrapData';
import {
  ModifiedInfo,
  ListView,
  ListViewActionsBar,
  ListViewFilterOperator as FilterOperator,
  ImportModal as ImportModelsModal,
  type ListViewProps,
  type ListViewActionProps,
  type ListViewFilters,
} from 'src/components';

import ThemeModal from 'src/features/themes/ThemeModal';
import { ThemeObject } from 'src/features/themes/types';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  setSystemDefaultTheme,
  setSystemDarkTheme,
  unsetSystemDefaultTheme,
  unsetSystemDarkTheme,
} from 'src/features/themes/api';

const PAGE_SIZE = 25;

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit}px;

  .ant-tag {
    margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
  }
`;

const CONFIRM_OVERWRITE_MESSAGE = t(
  'You are importing one or more themes that already exist. ' +
    'Overwriting might cause you to lose some of your work. Are you ' +
    'sure you want to overwrite?',
);

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
  const { setTemporaryTheme, getCurrentCrudThemeId } = useThemeContext();
  const [themeModalOpen, setThemeModalOpen] = useState<boolean>(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeObject | null>(null);
  const [preparingExport, setPreparingExport] = useState<boolean>(false);
  const [importingTheme, showImportModal] = useState<boolean>(false);
  const [appliedThemeId, setAppliedThemeId] = useState<number | null>(null);

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const canImport = hasPerm('can_write');
  const canApply = hasPerm('can_write'); // Only users with write permission can apply themes

  // Get theme settings from bootstrap data
  const bootstrapData = getBootstrapData();
  const themeData = bootstrapData?.common?.theme || {};

  const canSetSystemThemes =
    canEdit && (themeData as any)?.enableUiThemeAdministration;

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
    // Filter out system themes and themes that are set as system themes
    const deletableThemes = themesToDelete.filter(
      theme =>
        !theme.is_system && !theme.is_system_default && !theme.is_system_dark,
    );

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
        setAppliedThemeId(themeObj.id || null);
        addSuccessToast(t('Local theme set to "%s"', themeObj.theme_name));
      } catch (error) {
        addDangerToast(
          t('Failed to set local theme: Invalid JSON configuration'),
        );
      }
    }
  }

  function handleThemeModalApply() {
    // Clear any previously applied theme ID when applying from modal
    // since the modal theme might not have an ID yet (unsaved theme)
    setAppliedThemeId(null);
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

  const openThemeImportModal = () => {
    showImportModal(true);
  };

  const closeThemeImportModal = () => {
    showImportModal(false);
  };

  const handleThemeImport = () => {
    showImportModal(false);
    refreshData();
    addSuccessToast(t('Theme imported'));
  };

  // Generic confirmation modal utility to reduce code duplication
  const showThemeConfirmation = (config: {
    title: string;
    content: string;
    onConfirm: () => Promise<any>;
    successMessage: string;
    errorMessage: string;
  }) => {
    Modal.confirm({
      title: config.title,
      content: config.content,
      onOk: () => {
        config
          .onConfirm()
          .then(() => {
            refreshData();
            addSuccessToast(config.successMessage);
          })
          .catch(err => {
            addDangerToast(t(config.errorMessage, err.message));
          });
      },
    });
  };

  const handleSetSystemDefault = (theme: ThemeObject) => {
    showThemeConfirmation({
      title: t('Set System Default Theme'),
      content: t(
        'Are you sure you want to set "%s" as the system default theme? This will apply to all users who haven\'t set a personal preference.',
        theme.theme_name,
      ),
      onConfirm: () => setSystemDefaultTheme(theme.id!),
      successMessage: t(
        '"%s" is now the system default theme',
        theme.theme_name,
      ),
      errorMessage: 'Failed to set system default theme: %s',
    });
  };

  const handleSetSystemDark = (theme: ThemeObject) => {
    showThemeConfirmation({
      title: t('Set System Dark Theme'),
      content: t(
        'Are you sure you want to set "%s" as the system dark theme? This will apply to all users who haven\'t set a personal preference.',
        theme.theme_name,
      ),
      onConfirm: () => setSystemDarkTheme(theme.id!),
      successMessage: t('"%s" is now the system dark theme', theme.theme_name),
      errorMessage: 'Failed to set system dark theme: %s',
    });
  };

  const handleUnsetSystemDefault = () => {
    showThemeConfirmation({
      title: t('Remove System Default Theme'),
      content: t(
        'Are you sure you want to remove the system default theme? The application will fall back to the configuration file default.',
      ),
      onConfirm: () => unsetSystemDefaultTheme(),
      successMessage: t('System default theme removed'),
      errorMessage: 'Failed to remove system default theme: %s',
    });
  };

  const handleUnsetSystemDark = () => {
    showThemeConfirmation({
      title: t('Remove System Dark Theme'),
      content: t(
        'Are you sure you want to remove the system dark theme? The application will fall back to the configuration file dark theme.',
      ),
      onConfirm: () => unsetSystemDarkTheme(),
      successMessage: t('System dark theme removed'),
      errorMessage: 'Failed to remove system dark theme: %s',
    });
  };

  const initialSort = [{ id: 'theme_name', desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({ row: { original } }: any) => {
          const currentCrudThemeId = getCurrentCrudThemeId();
          const isCurrentTheme =
            (currentCrudThemeId &&
              original.id?.toString() === currentCrudThemeId) ||
            (appliedThemeId && original.id === appliedThemeId);

          return (
            <FlexRowContainer>
              {original.theme_name}
              {isCurrentTheme && (
                <Tooltip
                  title={t('This theme is set locally for your session')}
                >
                  <Tag color="success">{t('Local')}</Tag>
                </Tooltip>
              )}
              {original.is_system && (
                <Tooltip title={t('Defined through system configuration.')}>
                  <Tag color="processing">{t('System')}</Tag>
                </Tooltip>
              )}
              {original.is_system_default && (
                <Tooltip title={t('This is the system default theme')}>
                  <Tag color="warning">
                    <Icons.SunOutlined /> {t('Default')}
                  </Tag>
                </Tooltip>
              )}
              {original.is_system_dark && (
                <Tooltip title={t('This is the system dark theme')}>
                  <Tag color="default">
                    <Icons.MoonOutlined /> {t('Dark')}
                  </Tag>
                </Tooltip>
              )}
            </FlexRowContainer>
          );
        },
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
          const handleDelete = () => {
            if (original.is_system_default || original.is_system_dark) {
              addDangerToast(
                t(
                  'Cannot delete theme that is set as system default or dark theme',
                ),
              );
              return;
            }
            setThemeCurrentlyDeleting(original);
          };
          const handleApply = () => handleThemeApply(original);
          const handleExport = () => handleBulkThemeExport([original]);

          const actions = [
            canApply
              ? {
                  label: 'apply-action',
                  tooltip: t(
                    'Set local theme. Will be applied to your session until unset.',
                  ),
                  placement: 'bottom',
                  icon: 'ThunderboltOutlined',
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
            canSetSystemThemes && !original.is_system_default
              ? {
                  label: 'set-default-action',
                  tooltip: t('Set as system default theme'),
                  placement: 'bottom',
                  icon: 'SunOutlined',
                  onClick: () => handleSetSystemDefault(original),
                }
              : null,
            canSetSystemThemes && original.is_system_default
              ? {
                  label: 'unset-default-action',
                  tooltip: t('Remove as system default theme'),
                  placement: 'bottom',
                  icon: 'StopOutlined',
                  onClick: () => handleUnsetSystemDefault(),
                }
              : null,
            canSetSystemThemes && !original.is_system_dark
              ? {
                  label: 'set-dark-action',
                  tooltip: t('Set as system dark theme'),
                  placement: 'bottom',
                  icon: 'MoonOutlined',
                  onClick: () => handleSetSystemDark(original),
                }
              : null,
            canSetSystemThemes && original.is_system_dark
              ? {
                  label: 'unset-dark-action',
                  tooltip: t('Remove as system dark theme'),
                  placement: 'bottom',
                  icon: 'StopOutlined',
                  onClick: () => handleUnsetSystemDark(),
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
    [
      canDelete,
      canCreate,
      canApply,
      canExport,
      canSetSystemThemes,
      appliedThemeId,
    ],
  );

  const menuData: SubMenuProps = {
    name: t('Themes'),
  };

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canImport) {
    subMenuButtons.push({
      name: (
        <Tooltip
          id="import-tooltip"
          title={t('Import themes')}
          placement="bottomRight"
        >
          <Icons.DownloadOutlined iconSize="l" data-test="import-button" />
        </Tooltip>
      ),
      buttonStyle: 'link',
      onClick: openThemeImportModal,
    });
  }

  if (canDelete || canExport) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

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
        onThemeApply={handleThemeModalApply}
        onHide={() => setThemeModalOpen(false)}
        show={themeModalOpen}
        canDevelop={canEdit}
      />
      <ImportModelsModal
        resourceName="theme"
        resourceLabel={t('theme')}
        passwordsNeededMessage=""
        confirmOverwriteMessage={CONFIRM_OVERWRITE_MESSAGE}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        onModelImport={handleThemeImport}
        show={importingTheme}
        onHide={closeThemeImportModal}
      />
      {themeCurrentlyDeleting && (
        <DeleteModal
          description={
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>{t('This action will permanently delete the theme.')}</div>
              <Alert
                type="warning"
                showIcon
                closable={false}
                message={t(
                  'Any dashboards using this theme will be automatically dissociated from it.',
                )}
              />
            </Space>
          }
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
        description={
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              {t('Are you sure you want to delete the selected themes?')}
            </div>
            <Alert
              type="warning"
              showIcon
              closable={false}
              message={t(
                'Any dashboards using these themes will be automatically dissociated from them.',
              )}
            />
          </Space>
        }
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
