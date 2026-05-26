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
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';
import { ListView } from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { ConfirmStatusChange, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  getExtensionSettingsSnapshot,
  setExtensionSettings,
} from 'src/core/extensions';

const PAGE_SIZE = 25;

type Extension = {
  id: string;
  name: string;
  publisher: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeChatbotId, setActiveChatbotId] = useState<string | null>(null);

  const {
    state: { loading, resourceCount, resourceCollection },
    fetchData,
    refreshData,
  } = useListViewResource<Extension>(
    'extensions',
    t('Extensions'),
    addDangerToast,
  );

  // Load current active chatbot from settings on mount
  useEffect(() => {
    SupersetClient.get({ endpoint: '/api/v1/extensions/settings' })
      .then(({ json }) => {
        setActiveChatbotId(json?.result?.active_chatbot_id ?? null);
      })
      .catch(() => {
        // non-fatal: leave activeChatbotId as null
      });
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.supx')) {
      addDangerToast(t('File must have a .supx extension.'));
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('bundle', file);

    setUploading(true);
    SupersetClient.post({
      endpoint: '/api/v1/extensions/',
      body: formData,
      headers: { Accept: 'application/json' },
    })
      .then(() => {
        addSuccessToast(t('Extension installed successfully.'));
        refreshData();
      })
      .catch(
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue installing the extension: %s', errMsg),
          ),
        ),
      )
      .finally(() => {
        setUploading(false);
        e.target.value = '';
      });
  };

  const handleDelete = (extension: Extension) => {
    const { publisher, name } = extension;
    SupersetClient.delete({
      endpoint: `/api/v1/extensions/${publisher}/${name}`,
    }).then(
      () => {
        addSuccessToast(t('Deleted: %s', extension.name));
        refreshData();
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', extension.name, errMsg),
        ),
      ),
    );
  };

  const handleSetDefaultChatbot = useCallback(
    (extension: Extension) => {
      const newId = activeChatbotId === extension.id ? null : extension.id;
      SupersetClient.put({
        endpoint: '/api/v1/extensions/settings',
        jsonPayload: { active_chatbot_id: newId },
      }).then(
        () => {
          setActiveChatbotId(newId);
          // Reflect the change in the shared settings store so the live
          // ChatbotMount re-resolves the active chatbot immediately.
          setExtensionSettings({
            ...getExtensionSettingsSnapshot(),
            active_chatbot_id: newId,
          });
          addSuccessToast(
            newId
              ? t('%s set as default chatbot.', extension.name)
              : t('Default chatbot cleared.'),
          );
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue updating chatbot settings: %s', errMsg),
          ),
        ),
      );
    },
    [activeChatbotId, addDangerToast, addSuccessToast],
  );

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
        Header: t('Publisher'),
        accessor: 'publisher',
        id: 'publisher',
        Cell: ({
          row: {
            original: { publisher },
          },
        }: any) => publisher,
      },
      {
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        Cell: ({ row: { original } }: any) => {
          const isDefault = activeChatbotId === original.id;
          return (
            <>
              <Tooltip
                id="set-chatbot-tooltip"
                title={
                  isDefault
                    ? t('Clear default chatbot')
                    : t('Set as default chatbot')
                }
                placement="bottom"
              >
                <span
                  role="button"
                  tabIndex={0}
                  className="action-button"
                  onClick={() => handleSetDefaultChatbot(original)}
                >
                  {isDefault ? (
                    <Icons.StarFilled iconSize="l" />
                  ) : (
                    <Icons.StarOutlined iconSize="l" />
                  )}
                </span>
              </Tooltip>
              <ConfirmStatusChange
                title={t('Please confirm')}
                description={
                  <>
                    {t('Are you sure you want to delete')}{' '}
                    <b>{original.name}</b>?
                  </>
                }
                onConfirm={() => handleDelete(original)}
              >
                {(confirmDelete: () => void) => (
                  <Tooltip
                    id="delete-extension-tooltip"
                    title={t('Delete')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={confirmDelete}
                    >
                      <Icons.DeleteOutlined iconSize="l" />
                    </span>
                  </Tooltip>
                )}
              </ConfirmStatusChange>
            </>
          );
        },
      },
    ],
    [loading, activeChatbotId, handleSetDefaultChatbot],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Extensions',
    name: t('Extensions'),
    buttons: [
      {
        name: (
          <Tooltip
            id="import-extension-tooltip"
            title={t('Import extension (.supx)')}
            placement="bottomRight"
          >
            <Icons.DownloadOutlined iconSize="l" />
          </Tooltip>
        ),
        buttonStyle: 'link',
        onClick: handleUploadClick,
        loading: uploading,
      },
    ],
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".supx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <SubMenu {...menuData} />
      <ListView<Extension>
        columns={columns}
        count={resourceCount}
        data={resourceCollection}
        initialSort={[{ id: 'name', desc: false }]}
        pageSize={PAGE_SIZE}
        fetchData={fetchData}
        loading={loading}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
        refreshData={refreshData}
      />
    </>
  );
};

export default withToasts(ExtensionsList);
