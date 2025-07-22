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

import { css, styled, t, useTheme } from '@superset-ui/core';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { useThemeContext } from 'src/theme/ThemeProvider';
import { isUserAdmin } from 'src/dashboard/util/permissionUtils';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import getBootstrapData from 'src/utils/getBootstrapData';

import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Input, Modal, JsonEditor, Button } from '@superset-ui/core/components';
import { Typography } from '@superset-ui/core/components/Typography';

import { OnlyKeyWithType } from 'src/utils/types';
import { ThemeObject } from './types';

interface ThemeModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast?: (msg: string) => void;
  theme?: ThemeObject | null;
  onThemeAdd?: (theme?: ThemeObject) => void;
  onHide: () => void;
  show: boolean;
}

type ThemeStringKeys = keyof Pick<
  ThemeObject,
  OnlyKeyWithType<ThemeObject, String>
>;

const StyledThemeTitle = styled.div(
  ({ theme }) => css`
    margin: ${theme.sizeUnit * 2}px auto ${theme.sizeUnit * 4}px auto;
  `,
);

const StyledJsonEditor = styled.div`
  ${({ theme }) => css`
    border-radius: ${theme.borderRadius}px;
    border: 1px solid ${theme.colorBorder};

    .ace_editor {
      border-radius: ${theme.borderRadius}px;
    }
  `}
`;

const ThemeContainer = styled.div(
  ({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 10}px;

    .control-label {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    .required {
      margin-left: ${theme.sizeUnit / 2}px;
      color: ${theme.colorErrorText};
    }

    input[type='text'] {
      padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 2}px;
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      width: 50%;
    }
  `,
);

const ThemeModal: FunctionComponent<ThemeModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onThemeAdd,
  onHide,
  show,
  theme = null,
}) => {
  const supersetTheme = useTheme();
  const { setTemporaryTheme, clearLocalOverrides, hasDevOverride } =
    useThemeContext();
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [currentTheme, setCurrentTheme] = useState<ThemeObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const isEditMode = theme !== null;
  const isSystemTheme = currentTheme?.is_system === true;
  const isReadOnly = isSystemTheme;
  const user = getBootstrapData()?.user;
  const canDevelopThemes = user
    ? isUserAdmin(user as UserWithPermissionsAndRoles)
    : false;

  // theme fetch logic
  const {
    state: { loading, resource },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<ThemeObject>('theme', t('theme'), addDangerToast);

  // Functions
  const hide = () => {
    onHide();
    setCurrentTheme(null);
  };

  const onSave = () => {
    if (isEditMode) {
      // Edit
      if (currentTheme?.id) {
        const update_id = currentTheme.id;
        delete currentTheme.id;
        delete currentTheme.created_by;
        delete currentTheme.changed_by;
        delete currentTheme.changed_on_delta_humanized;

        updateResource(update_id, currentTheme).then(response => {
          if (!response) {
            return;
          }

          if (onThemeAdd) {
            onThemeAdd();
          }

          hide();
        });
      }
    } else if (currentTheme) {
      // Create
      createResource(currentTheme).then(response => {
        if (!response) {
          return;
        }

        if (onThemeAdd) {
          onThemeAdd();
        }

        hide();
      });
    }
  };

  const onApply = () => {
    if (currentTheme?.json_data && isValidJson(currentTheme.json_data)) {
      try {
        const themeConfig = JSON.parse(currentTheme.json_data);
        setTemporaryTheme(themeConfig);
        if (addSuccessToast) {
          addSuccessToast(t('Theme applied temporarily for preview'));
        }
      } catch (error) {
        addDangerToast(t('Failed to apply theme: Invalid JSON'));
      }
    }
  };

  const onClearLocalSettings = () => {
    clearLocalOverrides();
    if (addSuccessToast) {
      addSuccessToast(t('Local theme settings cleared'));
    }
  };

  const onThemeNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { target } = event;

    const data = {
      ...currentTheme,
      theme_name: currentTheme ? currentTheme.theme_name : '',
      json_data: currentTheme ? currentTheme.json_data : '',
    };

    data[target.name as ThemeStringKeys] = target.value;
    setCurrentTheme(data);
  };

  const onJsonDataChange = (jsonData: string) => {
    const data = {
      ...currentTheme,
      theme_name: currentTheme ? currentTheme.theme_name : '',
      json_data: jsonData,
    };
    setCurrentTheme(data);
  };

  const isValidJson = (str?: string) => {
    if (!str) return false;
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  const validate = () => {
    if (isReadOnly) {
      setDisableSave(true);
      return;
    }

    if (
      currentTheme?.theme_name.length &&
      currentTheme?.json_data?.length &&
      isValidJson(currentTheme.json_data)
    ) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  // Initialize
  useEffect(() => {
    if (
      isEditMode &&
      (!currentTheme?.id ||
        (theme && theme?.id !== currentTheme.id) ||
        (isHidden && show))
    ) {
      if (theme?.id && !loading) {
        fetchResource(theme.id);
      }
    } else if (
      !isEditMode &&
      (!currentTheme || currentTheme.id || (isHidden && show))
    ) {
      setCurrentTheme({
        theme_name: '',
        json_data: JSON.stringify({}, null, 2),
      });
    }
  }, [theme, show]);

  useEffect(() => {
    if (resource) {
      setCurrentTheme(resource);
    }
  }, [resource]);

  // Validation
  useEffect(() => {
    validate();
  }, [
    currentTheme ? currentTheme.theme_name : '',
    currentTheme ? currentTheme.json_data : '',
    isReadOnly,
  ]);

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  return (
    <Modal
      disablePrimaryButton={isReadOnly || disableSave}
      onHandledPrimaryAction={isReadOnly ? undefined : onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      show={show}
      width="55%"
      footer={[
        <Button key="cancel" onClick={hide} buttonStyle="secondary">
          {isReadOnly ? t('Close') : t('Cancel')}
        </Button>,
        ...(canDevelopThemes
          ? [
              <Button
                key="clear-local"
                onClick={onClearLocalSettings}
                disabled={!hasDevOverride()}
                buttonStyle="secondary"
              >
                {t('Clear Local Settings')}
              </Button>,
              <Button
                key="apply"
                onClick={onApply}
                disabled={
                  !currentTheme?.json_data ||
                  !isValidJson(currentTheme.json_data)
                }
                buttonStyle="primary"
              >
                {t('Apply')}
              </Button>,
            ]
          : []),
        ...(!isReadOnly
          ? [
              <Button
                key="save"
                onClick={onSave}
                disabled={disableSave}
                buttonStyle="primary"
              >
                {isEditMode ? t('Save') : t('Add')}
              </Button>,
            ]
          : []),
      ]}
      title={
        <Typography.Title level={4} data-test="theme-modal-title">
          {isEditMode ? (
            <Icons.EditOutlined
              iconSize="l"
              css={css`
                margin: auto ${supersetTheme.sizeUnit * 2}px auto 0;
              `}
            />
          ) : (
            <Icons.PlusOutlined
              iconSize="l"
              css={css`
                margin: auto ${supersetTheme.sizeUnit * 2}px auto 0;
              `}
            />
          )}
          {isEditMode
            ? isReadOnly
              ? t('View theme properties')
              : t('Edit theme properties')
            : t('Add theme')}
        </Typography.Title>
      }
    >
      {isSystemTheme && (
        <StyledThemeTitle>
          <Typography.Text
            type="secondary"
            style={{ fontSize: '14px', fontStyle: 'italic' }}
          >
            {t('System Theme - Read Only')}
          </Typography.Text>
        </StyledThemeTitle>
      )}
      <ThemeContainer>
        <div className="control-label">
          {t('Name')}
          {!isReadOnly && <span className="required">*</span>}
        </div>
        <Input
          name="theme_name"
          onChange={onThemeNameChange}
          type="text"
          value={currentTheme?.theme_name}
          readOnly={isReadOnly}
        />
      </ThemeContainer>
      {isEditMode && currentTheme?.uuid && (
        <ThemeContainer>
          <div className="control-label">
            {t('Theme UUID')}
            <Typography.Text type="secondary" style={{ marginLeft: '8px' }}>
              {t('Copy this to reference in configuration')}
            </Typography.Text>
          </div>
          <Typography.Text
            code
            copyable
            style={{
              display: 'block',
              padding: '8px 12px',
              backgroundColor: supersetTheme.colorBgElevated,
              border: `1px solid ${supersetTheme.colorBorder}`,
              borderRadius: supersetTheme.borderRadius,
              fontFamily: 'monospace',
              fontSize: '13px',
              wordBreak: 'break-all',
            }}
            data-test="theme-uuid-field"
          >
            {currentTheme.uuid}
          </Typography.Text>
        </ThemeContainer>
      )}
      <ThemeContainer>
        <div className="control-label">
          {t('JSON Configuration')}
          {!isReadOnly && <span className="required">*</span>}
        </div>
        <StyledJsonEditor>
          <JsonEditor
            showLoadingForImport
            name="json_data"
            value={currentTheme?.json_data || ''}
            onChange={onJsonDataChange}
            tabSize={2}
            width="100%"
            height="300px"
            wrapEnabled
            readOnly={isReadOnly}
          />
        </StyledJsonEditor>
      </ThemeContainer>
    </Modal>
  );
};

export default withToasts(ThemeModal);
