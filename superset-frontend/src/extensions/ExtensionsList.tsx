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
import { styled, useTheme, css, t } from '@superset-ui/core';
import { FunctionComponent, useMemo } from 'react';
import { useListViewResource } from 'src/views/CRUD/hooks';
import {
  ConfirmStatusChange,
  Tooltip,
  Icons,
} from '@superset-ui/core/components';
import {
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilters,
} from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { JsonModal } from 'src/components/JsonModal';
import { Popconfirm } from 'antd';
import { safeJsonObjectParse } from 'src/components/JsonModal/utils';
import ExtensionsManager from './ExtensionsManager';

const PAGE_SIZE = 25;

const Actions = styled.div`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.base};

    .disabled {
      svg,
      i {
        &:hover {
          path {
            fill: ${theme.colors.grayscale.light1};
          }
        }
      }
      color: ${theme.colors.grayscale.light1};
      .antd5-menu-item:hover {
        cursor: default;
      }
      &::after {
        color: ${theme.colors.grayscale.light1};
      }
    }
  `}
`;

type Extension = {
  id: number;
  name: string;
  enabled: boolean;
};

interface ExtensionsListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const ExtensionsList: FunctionComponent<ExtensionsListProps> = ({
  addDangerToast,
  addSuccessToast,
}) => {
  const theme = useTheme();
  const {
    state: { loading, resourceCount, resourceCollection, bulkSelectEnabled },
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<Extension>(
    'extensions',
    t('extensions'),
    addDangerToast,
    false,
  );

  const newExtension = () => {
    console.log('New extension');
  };

  const deleteExtensions = (extensions: Extension[]) => {
    console.log('Deleting extensions:', extensions);
  };

  const enableExtensions = (extensions: Extension[]) => {
    extensions.forEach(extension =>
      ExtensionsManager.getInstance().enableExtensionByName(extension.name),
    );
  };

  const disableExtensions = (extensions: Extension[]) => {
    extensions.forEach(extension =>
      ExtensionsManager.getInstance().disableExtensionByName(extension.name),
    );
  };

  const confirmationAction = (
    actionName: string,
    actionFn: (extensions: Extension[]) => void,
    extension: Extension,
    icon: React.ReactNode,
  ) => {
    const { name } = extension;
    const title = t(actionName);
    const description = (
      <>
        {t('Are you sure you want to %s', actionName.toLowerCase())}{' '}
        <b>{name}</b>?
      </>
    );
    return (
      <Popconfirm
        title={title}
        description={description}
        onConfirm={() => actionFn([extension])}
        okText={t('Yes')}
        cancelText={t('No')}
      >
        <Tooltip title={title} placement="bottom">
          <span role="button" tabIndex={0} className="action-button">
            {icon}
          </span>
        </Tooltip>
      </Popconfirm>
    );
  };

  const columns = useMemo(
    () => [
      {
        Header: t('Name'),
        accessor: 'name',
        size: 'lg',
        id: 'name',
        Cell: ({
          row: {
            original: { name },
          },
        }: any) => name,
      },
      {
        Header: t('Contributions'),
        accessor: 'contributions',
        size: 'lg',
        id: 'contributions',
        Cell: ({
          row: {
            original: { contributions },
          },
        }: any) => (
          <div
            css={css`
              color: ${theme.colors.primary.dark1};
              text-decoration: underline;
            `}
          >
            <JsonModal
              modalTitle={t('Contributions')}
              jsonObject={safeJsonObjectParse(contributions)!}
              jsonValue={t('View')}
            />
          </div>
        ),
      },
      {
        Header: t('Enabled'),
        accessor: 'enabled',
        id: 'enabled',
        size: 'lg',
        Cell: ({
          row: {
            original: { enabled },
          },
        }: any) => enabled.toString(),
      },
      {
        Cell: ({ row: { original } }: any) => (
          <Actions className="actions">
            {confirmationAction(
              t('Delete'),
              deleteExtensions,
              original,
              <Icons.DeleteOutlined iconSize="l" />,
            )}
            {confirmationAction(
              original.enabled ? t('Disable') : t('Enable'),
              original.enabled ? disableExtensions : enableExtensions,
              original,
              original.enabled ? (
                <Icons.StopOutlined iconSize="l" />
              ) : (
                <Icons.CheckCircleOutlined iconSize="l" />
              ),
            )}
          </Actions>
        ),
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [],
  );

  const filterTypes: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Enabled'),
        key: 'enabled',
        id: 'enabled',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      },
    ],
    [],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Extensions',
    name: t('Extensions'),
    buttons: [
      {
        name: t('Bulk select'),
        onClick: toggleBulkSelect,
        buttonStyle: 'secondary',
      },
      {
        name: (
          <>
            <Icons.PlusOutlined
              iconColor={theme.colors.primary.light5}
              iconSize="m"
              css={css`
                vertical-align: text-top;
              `}
            />
            {t('Extension')}
          </>
        ),
        onClick: newExtension,
        buttonStyle: 'primary',
      },
    ],
  };

  return (
    <>
      <SubMenu {...menuData} />
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected extensions?',
        )}
        onConfirm={deleteExtensions}
      >
        {deleteExtensions => {
          const bulkActions: ListViewProps['bulkActions'] = [
            {
              key: 'delete',
              name: t('Delete'),
              onSelect: deleteExtensions,
              type: 'danger',
            },
            {
              key: 'enable',
              name: t('Enable'),
              onSelect: enableExtensions,
              type: 'primary',
            },
            {
              key: 'disable',
              name: t('Disable'),
              onSelect: disableExtensions,
              type: 'primary',
            },
          ];
          return (
            <ListView<Extension>
              columns={columns}
              data={resourceCollection}
              count={resourceCount}
              initialSort={[{ id: 'name', desc: false }]}
              pageSize={PAGE_SIZE}
              fetchData={fetchData}
              filters={filterTypes}
              loading={loading}
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
    </>
  );
};

export default withToasts(ExtensionsList);
