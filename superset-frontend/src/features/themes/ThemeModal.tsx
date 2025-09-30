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
import SupersetText from 'src/utils/textUtils';

import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  Input,
  Modal,
  JsonEditor,
  Button,
  Form,
  Tooltip,
  Alert,
} from '@superset-ui/core/components';
import { useJsonValidation } from '@superset-ui/core/components/AsyncAceEditor';
import { Typography } from '@superset-ui/core/components/Typography';
import {
  useThemeValidation,
  useIsEnhancedValidationEnabled,
} from 'src/theme/hooks/useThemeValidation';

import { OnlyKeyWithType } from 'src/utils/types';
import { ThemeObject } from './types';

interface ThemeModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast?: (msg: string) => void;
  theme?: ThemeObject | null;
  onThemeAdd?: (theme?: ThemeObject) => void;
  onThemeApply?: () => void;
  onHide: () => void;
  show: boolean;
  canDevelop?: boolean;
}

type ThemeStringKeys = keyof Pick<
  ThemeObject,
  OnlyKeyWithType<ThemeObject, String>
>;

const StyledJsonEditor = styled.div`
  ${({ theme }) => css`
    .ace_editor {
      border-radius: ${theme.borderRadius}px;
    }
  `}
`;

const StyledFormWrapper = styled.div`
  ${({ theme }) => css`
    --ant-form-item-margin-bottom: ${theme.sizeUnit * 6}px;

    .system-theme-notice {
      font-size: ${theme.fontSizeSM}px;
      font-style: italic;
      margin-bottom: ${theme.sizeUnit * 4}px;
      display: block;
    }

    .alert-info {
      margin-bottom: ${theme.sizeUnit * 4}px;
    }

    .apply-button-container {
      margin-top: ${theme.sizeUnit * 2}px;
      text-align: right;
    }
  `}
`;

const ThemeModal: FunctionComponent<ThemeModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onThemeAdd,
  onThemeApply,
  onHide,
  show,
  theme = null,
  canDevelop = false,
}) => {
  const supersetTheme = useTheme();
  const { setTemporaryTheme } = useThemeContext();
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [currentTheme, setCurrentTheme] = useState<ThemeObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const isEditMode = theme !== null;
  const isSystemTheme = currentTheme?.is_system === true;
  const isReadOnly = isSystemTheme;

  const canDevelopThemes = canDevelop;
  const isEnhancedValidationEnabled = useIsEnhancedValidationEnabled();

  // SupersetText URL configurations
  const themeEditorUrl =
    SupersetText?.THEME_MODAL?.THEME_EDITOR_URL ||
    'https://ant.design/theme-editor';
  const documentationUrl =
    SupersetText?.THEME_MODAL?.DOCUMENTATION_URL ||
    'https://superset.apache.org/docs/configuration/theming/';

  // Enhanced theme validation with feature flag support
  const themeValidation = useThemeValidation(currentTheme?.json_data || '', {
    enabled: !isReadOnly && Boolean(currentTheme?.json_data),
    themeName: currentTheme?.theme_name || 'Unknown Theme',
  });

  // Backward compatibility: use basic JSON validation if enhanced validation is disabled
  const jsonAnnotations = useJsonValidation(currentTheme?.json_data, {
    enabled: !isReadOnly && !isEnhancedValidationEnabled,
    errorPrefix: 'Invalid JSON syntax',
  });

  // Use enhanced annotations if available, otherwise fall back to basic JSON validation
  const editorAnnotations = isEnhancedValidationEnabled
    ? themeValidation.annotations
    : jsonAnnotations;

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
        if (onThemeApply) {
          onThemeApply();
        }
        if (addSuccessToast) {
          addSuccessToast(t('Local theme set for preview'));
        }
      } catch (error) {
        addDangerToast(t('Failed to apply theme: Invalid JSON'));
      }
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

  const isEmptyTheme = (jsonData?: string) => {
    if (!jsonData?.trim()) return true;
    try {
      const parsed = JSON.parse(jsonData);
      // Check if it's an empty object or array
      return Object.keys(parsed).length === 0;
    } catch (e) {
      return false; // If it's not valid JSON, let other validation handle it
    }
  };

  const validate = () => {
    if (isReadOnly || !currentTheme) {
      setDisableSave(true);
      return;
    }

    const hasValidName = Boolean(currentTheme?.theme_name?.length);
    const hasValidJsonData = Boolean(currentTheme?.json_data?.length);
    const isValidJsonSyntax = isValidJson(currentTheme?.json_data);
    const isNotEmpty = !isEmptyTheme(currentTheme?.json_data);

    // Basic validation requirements
    const basicValidation =
      hasValidName && hasValidJsonData && isValidJsonSyntax && isNotEmpty;

    if (isEnhancedValidationEnabled && currentTheme) {
      // Enhanced validation: allow saving even with token warnings, but block on JSON syntax errors
      const enhancedValidation = basicValidation && !themeValidation.hasErrors;
      setDisableSave(!enhancedValidation);
    } else {
      // Original validation logic
      setDisableSave(!basicValidation);
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
    isEnhancedValidationEnabled,
    themeValidation.hasErrors,
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
      <StyledFormWrapper>
        <Form layout="vertical">
          {isSystemTheme && (
            <Typography.Text type="secondary" className="system-theme-notice">
              {t('System Theme - Read Only')}
            </Typography.Text>
          )}

          <Form.Item label={t('Name')} required={!isReadOnly}>
            <Input
              name="theme_name"
              onChange={onThemeNameChange}
              value={currentTheme?.theme_name}
              readOnly={isReadOnly}
              placeholder={t('Enter theme name')}
            />
          </Form.Item>

          <Form.Item label={t('JSON Configuration')} required={!isReadOnly}>
            <Alert
              type="info"
              showIcon
              closable={false}
              className="alert-info"
              message={
                <span>
                  {t('Design with')}{' '}
                  <a
                    href={themeEditorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('Ant Design Theme Editor')}
                  </a>
                  {t(', then paste the JSON below. See our')}{' '}
                  <a
                    href={documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('documentation')}
                  </a>
                  {t(' for details.')}
                  {isEnhancedValidationEnabled && (
                    <>
                      {' '}
                      <Typography.Text type="secondary">
                        {t(
                          'Enhanced validation is enabled - invalid tokens will be highlighted and ignored when applied.',
                        )}
                      </Typography.Text>
                    </>
                  )}
                </span>
              }
            />
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
                showGutter
                showPrintMargin={false}
                annotations={editorAnnotations}
              />
            </StyledJsonEditor>

            {canDevelopThemes && (
              <div className="apply-button-container">
                <Tooltip
                  title={t('Set local theme for testing (preview only)')}
                  placement="top"
                >
                  <Button
                    icon={<Icons.ThunderboltOutlined />}
                    onClick={onApply}
                    disabled={
                      !currentTheme?.json_data ||
                      !isValidJson(currentTheme.json_data) ||
                      (isEnhancedValidationEnabled && themeValidation.hasErrors)
                    }
                    buttonStyle="secondary"
                  >
                    {t('Apply')}
                  </Button>
                </Tooltip>
              </div>
            )}
          </Form.Item>
        </Form>
      </StyledFormWrapper>
    </Modal>
  );
};

export default withToasts(ThemeModal);
