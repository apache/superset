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
import { FunctionComponent, useState, useEffect, ChangeEvent } from 'react';

import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { ModalTitleWithIcon } from 'src/components/ModalTitleWithIcon';
import { Input, Modal } from '@superset-ui/core/components';
import withToasts from 'src/components/MessageToasts/withToasts';

export type DynamicPluginObject = {
  id?: number;
  name: string;
  key?: string;
  key_id?: string;
  bundle_url: string;
  changed_on_delta_humanized?: string;
  changed_by?: { first_name: string; last_name: string };
  created_by?: { first_name: string; last_name: string };
  created_on?: string;
  changed_on?: string;
};

interface DynamicPluginModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  plugin?: DynamicPluginObject | null;
  onPluginAdd: () => void;
  onHide: () => void;
  show: boolean;
}

const FieldContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;

  .control-label {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  }

  .required {
    margin-left: ${({ theme }) => theme.sizeUnit / 2}px;
    color: ${({ theme }) => theme.colorError};
  }

  .description {
    color: ${({ theme }) => theme.colorTextSecondary};
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }

  input[type='text'] {
    width: 100%;
    margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  }
`;

const DynamicPluginModal: FunctionComponent<DynamicPluginModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onPluginAdd,
  onHide,
  show,
  plugin = null,
}) => {
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [currentPlugin, setCurrentPlugin] =
    useState<DynamicPluginObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const isEditMode = plugin !== null;

  const {
    state: { loading, resource },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<DynamicPluginObject>(
    'manage/dynamic-plugins',
    t('dynamic-plugins'),
    addDangerToast,
  );

  const resetPlugin = () => {
    setCurrentPlugin({ name: '', key_id: '', bundle_url: '' });
  };

  const hide = () => {
    setIsHidden(true);
    resetPlugin();
    onHide();
  };

  const onSave = () => {
    if (!currentPlugin) return;

    const {
      id,
      created_by,
      changed_by,
      changed_on,
      created_on,
      changed_on_delta_humanized,
      key_id,
      ...rest
    } = currentPlugin;

    if (isEditMode && id) {
      updateResource(id, { ...rest, key: key_id }).then(response => {
        if (!response) return;
        addSuccessToast(t('Dynamic plugin updated'));
        onPluginAdd();
        hide();
      });
    } else {
      createResource({ ...rest, key: key_id }).then(response => {
        if (!response) return;
        addSuccessToast(t('Dynamic plugin created'));
        onPluginAdd();
        hide();
      });
    }
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCurrentPlugin(prev => ({
      name: '',
      key_id: '',
      bundle_url: '',
      ...prev,
      [name]: value,
    }));
  };

  const validate = () => {
    setDisableSave(
      !currentPlugin?.name?.length ||
        !currentPlugin?.key_id?.length ||
        !currentPlugin?.bundle_url?.length,
    );
  };

  useEffect(() => {
    if (
      isEditMode &&
      (!currentPlugin?.id ||
        (plugin && plugin.id !== currentPlugin.id) ||
        (isHidden && show))
    ) {
      if (show && plugin && plugin.id !== null && !loading) {
        fetchResource(plugin.id ?? 0);
      }
    } else if (
      !isEditMode &&
      (!currentPlugin || currentPlugin.id || (isHidden && show))
    ) {
      resetPlugin();
    }
  }, [plugin, show]);

  useEffect(() => {
    if (resource) {
      setCurrentPlugin(resource);
    }
  }, [resource]);

  useEffect(() => {
    validate();
  }, [currentPlugin?.name, currentPlugin?.key_id, currentPlugin?.bundle_url]);

  if (isHidden && show) {
    setIsHidden(false);
  }

  return (
    <Modal
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      show={show}
      width="55%"
      name={isEditMode ? t('Edit dynamic plugin') : t('Add dynamic plugin')}
      title={
        <ModalTitleWithIcon
          isEditMode={isEditMode}
          title={
            isEditMode ? t('Edit dynamic plugin') : t('Add dynamic plugin')
          }
          data-test="dynamic-plugin-modal-title"
        />
      }
    >
      <FieldContainer>
        <div className="control-label">
          {t('Name')}
          <span className="required">*</span>
        </div>
        <Input
          name="name"
          onChange={onInputChange}
          type="text"
          value={currentPlugin?.name}
          placeholder={t('Name')}
        />
        <span className="description">{t('A human-friendly name')}</span>
      </FieldContainer>
      <FieldContainer>
        <div className="control-label">
          {t('Key')}
          <span className="required">*</span>
        </div>
        <Input
          name="key_id"
          onChange={onInputChange}
          type="text"
          value={currentPlugin?.key_id}
          placeholder={t('Key')}
        />
        <span className="description">
          {t(
            'Used internally to identify the plugin. Should be set to the package name from the pluginʼs package.json',
          )}
        </span>
      </FieldContainer>
      <FieldContainer>
        <div className="control-label">
          {t('Bundle URL')}
          <span className="required">*</span>
        </div>
        <Input
          name="bundle_url"
          onChange={onInputChange}
          type="text"
          value={currentPlugin?.bundle_url}
          placeholder={t('Bundle URL')}
        />
        <span className="description">
          {t(
            'A full URL pointing to the location of the built plugin (could be hosted on a CDN for example)',
          )}
        </span>
      </FieldContainer>
    </Modal>
  );
};

export default withToasts(DynamicPluginModal);
