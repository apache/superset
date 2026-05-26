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
import { css } from '@apache-superset/core/theme';
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
import { Switch } from '@superset-ui/core/components/Switch';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { ListView } from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import { CHATBOT_LOCATION } from 'src/views/contributions';
import { getRegisteredViewIds, subscribeToLocation } from 'src/core/views';

const PAGE_SIZE = 25;

type Extension = {
  id: string;
  name: string;
  enabled: boolean;
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
          addSuccessToast(t('Settings saved.'));
        })
        .catch(() => addDangerToast(t('Failed to save extension settings.')));
    },
    [settings, addDangerToast, addSuccessToast],
  );

  const toggleEnabled = useCallback(
    (extensionId: string, enabled: boolean) => {
      saveSettings({ enabled: { ...settings.enabled, [extensionId]: enabled } });
    },
    [settings, saveSettings],
  );

  const chatbotExtensions = useMemo(() => {
    const chatbotIds = new Set(getRegisteredViewIds(CHATBOT_LOCATION));
    return resourceCollection.filter(ext => chatbotIds.has(ext.id));
  }, [resourceCollection, chatbotRegistryVersion]);

  const columns = useMemo(
    () => [
      {
        Header: t('Name'),
        accessor: 'name',
        size: 'lg',
        id: 'name',
        Cell: ({
          row: { original: { name } },
        }: any) => name,
      },
      {
        Header: t('Enabled'),
        accessor: 'enabled',
        size: 'sm',
        id: 'enabled',
        Cell: ({
          row: { original: { id } },
        }: any) => (
          <Switch
            data-test="toggle-enabled"
            checked={settings.enabled[id] ?? true}
            onClick={(checked: boolean) => toggleEnabled(id, checked)}
            size="small"
          />
        ),
      },
    ],
    [loading, settings, toggleEnabled],
  );

  const chatbotOptions = chatbotExtensions.map(ext => ({
    label: ext.name,
    value: ext.id,
  }));

  const menuData: SubMenuProps = {
    activeChild: 'Extensions',
    name: t('Extensions'),
    buttons: [],
  };

  return (
    <>
      <SubMenu {...menuData} />
      {chatbotOptions.length > 1 && (
        <div style={{ padding: '16px 24px' }}>
          <label htmlFor="chatbot-select" style={{ marginRight: 8 }}>
            {t('Default chatbot')}
          </label>
          <Select
            allowClear
            options={chatbotOptions}
            value={settings.active_chatbot_id ?? undefined}
            onChange={value =>
              saveSettings({ active_chatbot_id: (value as string) ?? null })
            }
            placeholder={t('First registered (automatic)')}
            css={css`width: 280px;`}
          />
        </div>
      )}
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
