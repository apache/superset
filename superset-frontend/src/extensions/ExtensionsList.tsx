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
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SupersetClient } from '@superset-ui/core';
import { ConfirmStatusChange, Tooltip } from '@superset-ui/core/components';
import { Switch } from '@superset-ui/core/components/Switch';
import { Icons } from '@superset-ui/core/components/Icons';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler } from 'src/views/CRUD/utils';
import { ListView } from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { CHATBOT_LOCATION } from 'src/views/contributions';
import { getRegisteredViewIds, subscribeToLocation } from 'src/core/views';
import { notifyExtensionSettingsChanged } from 'src/core/extensions';

const PAGE_SIZE = 25;

type Extension = {
  id: string;
  name: string;
  publisher: string;
  enabled: boolean;
  deletable: boolean;
};

type ExtensionSettings = {
  active_chatbot_id: string | null;
  enabled: Record<string, boolean>;
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

  const {
    state: { loading, resourceCount, resourceCollection },
    fetchData,
    refreshData,
  } = useListViewResource<Extension>(
    'extensions',
    t('Extensions'),
    addDangerToast,
  );

  const [settings, setSettings] = useState<ExtensionSettings>({
    active_chatbot_id: null,
    enabled: {},
  });

  const [chatbotRegistryVersion, setChatbotRegistryVersion] = useState(0);
  useEffect(
    () =>
      subscribeToLocation(CHATBOT_LOCATION, () =>
        setChatbotRegistryVersion(v => v + 1),
      ),
    [],
  );

  useEffect(() => {
    SupersetClient.get({ endpoint: '/api/v1/extensions/settings' })
      .then(({ json }) => setSettings(json.result))
      .catch(() => addDangerToast(t('Failed to load extension settings.')));
  }, [addDangerToast]);

  const saveSettings = useCallback(
    (patch: Partial<ExtensionSettings>) => {
      const next = { ...settings, ...patch };
      SupersetClient.put({
        endpoint: '/api/v1/extensions/settings',
        jsonPayload: next,
      })
        .then(({ json }) => {
          setSettings(json.result);
          notifyExtensionSettingsChanged();
          addSuccessToast(t('Settings saved.'));
        })
        .catch(() => addDangerToast(t('Failed to save extension settings.')));
    },
    [settings, addDangerToast, addSuccessToast],
  );

  const toggleEnabled = useCallback(
    (extensionId: string, enabled: boolean) => {
      saveSettings({
        enabled: { ...settings.enabled, [extensionId]: enabled },
      });
    },
    [settings, saveSettings],
  );

  const setDefaultChatbot = useCallback(
    (extensionId: string) => {
      const next =
        settings.active_chatbot_id === extensionId ? null : extensionId;
      saveSettings({ active_chatbot_id: next });
    },
    [settings, saveSettings],
  );

  const chatbotIds = useMemo(
    () => new Set(getRegisteredViewIds(CHATBOT_LOCATION)),
    // chatbotRegistryVersion is intentionally in deps to re-evaluate when views register
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatbotRegistryVersion],
  );

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

  const columns = useMemo(
    () => [
      {
        Header: t('Name'),
        accessor: 'name',
        id: 'name',
        Cell: ({
          row: {
            original: { name },
          },
        }: any) => name,
      },
      {
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        Cell: ({ row: { original } }: any) => {
          const { id, deletable } = original;
          const isChatbot = chatbotIds.has(id);
          const isDefault = settings.active_chatbot_id === id;
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tooltip
                id="toggle-enabled-tooltip"
                title={t('Enable / Disable')}
                placement="bottom"
              >
                <Switch
                  data-test="toggle-enabled"
                  checked={settings.enabled[id] ?? true}
                  onClick={(checked: boolean) => toggleEnabled(id, checked)}
                  size="small"
                />
              </Tooltip>
              {isChatbot && (
                <Tooltip
                  id="set-default-chatbot-tooltip"
                  title={
                    isDefault
                      ? t('Remove default')
                      : t('Set as default chatbot')
                  }
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={() => setDefaultChatbot(id)}
                  >
                    {isDefault ? (
                      <Icons.StarFilled iconSize="l" />
                    ) : (
                      <Icons.StarOutlined iconSize="l" />
                    )}
                  </span>
                </Tooltip>
              )}
              {deletable && (
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
              )}
            </span>
          );
        },
      },
    ],
    [
      loading,
      settings,
      chatbotIds,
      toggleEnabled,
      setDefaultChatbot,
      handleDelete,
    ],
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
