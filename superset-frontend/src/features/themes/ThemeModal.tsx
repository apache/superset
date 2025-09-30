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
import {
  FunctionComponent,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ChangeEvent,
} from 'react';
import { omit } from 'lodash';

import { t } from '@apache-superset/core';
import { css, styled, useTheme, Alert } from '@apache-superset/core/ui';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { useThemeContext } from 'src/theme/ThemeProvider';
import { useBeforeUnload } from 'src/hooks/useBeforeUnload';
import SupersetText from 'src/utils/textUtils';

import { Icons } from '@superset-ui/core/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  Button,
  Form,
  Input,
  Modal,
  Space,
  Tooltip,
} from '@superset-ui/core/components';
import { useJsonValidation } from '@superset-ui/core/components/AsyncAceEditor';
import type { editors } from '@apache-superset/core';
import { EditorHost } from 'src/core/editors';
import { Typography } from '@superset-ui/core/components/Typography';
import {
  useThemeValidation,
  useIsEnhancedValidationEnabled,
} from 'src/theme/hooks/useThemeValidation';
import { OnlyKeyWithType } from 'src/utils/types';
import { ThemeObject } from './types';

type EditorAnnotation = editors.EditorAnnotation;

/**
 * Convert Ace annotation format to EditorAnnotation format.
 */
const toEditorAnnotations = (
  aceAnnotations: Array<{
    type: string;
    row: number;
    column: number;
    text: string;
  }>,
): EditorAnnotation[] =>
  aceAnnotations.map(ann => ({
    severity: ann.type as EditorAnnotation['severity'],
    line: ann.row,
    column: ann.column,
    message: ann.text,
  }));

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
  OnlyKeyWithType<ThemeObject, string>
>;

const StyledEditorWrapper = styled.div`
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
  const [initialTheme, setInitialTheme] = useState<ThemeObject | null>(null);
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const [showConfirmAlert, setShowConfirmAlert] = useState<boolean>(false);
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
  const hasUnsavedChanges = useCallback(() => {
    if (!currentTheme || !initialTheme || isReadOnly) return false;
    return (
      currentTheme.theme_name !== initialTheme.theme_name ||
      currentTheme.json_data !== initialTheme.json_data
    );
  }, [currentTheme, initialTheme, isReadOnly]);

  const hide = useCallback(() => {
    onHide();
    setCurrentTheme(null);
    setInitialTheme(null);
    setShowConfirmAlert(false);
  }, [onHide]);

  const onSave = useCallback(() => {
    if (isEditMode) {
      // Edit
      if (currentTheme?.id) {
        const themeData = omit(currentTheme, [
          'id',
          'created_by',
          'changed_by',
          'changed_on_delta_humanized',
        ]);

        updateResource(currentTheme.id, themeData).then(response => {
          if (!response) return;
          if (onThemeAdd) onThemeAdd();

          hide();
        });
      }
    } else if (currentTheme) {
      // Create
      createResource(currentTheme).then(response => {
        if (!response) return;
        if (onThemeAdd) onThemeAdd();

        hide();
      });
    }
  }, [
    currentTheme,
    isEditMode,
    updateResource,
    createResource,
    onThemeAdd,
    hide,
  ]);

  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowConfirmAlert(true);
    } else {
      hide();
    }
  }, [hasUnsavedChanges, hide]);

  const handleConfirmCancel = useCallback(() => {
    hide();
  }, [hide]);

  const isValidJson = useCallback((str?: string) => {
    if (!str) return false;
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }, []);

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

  const onApply = useCallback(() => {
    if (currentTheme?.json_data && isValidJson(currentTheme.json_data)) {
      try {
        const themeConfig = JSON.parse(currentTheme.json_data);

        setTemporaryTheme(themeConfig);

        if (onThemeApply) onThemeApply();
        if (addSuccessToast) addSuccessToast(t('Local theme set for preview'));
      } catch (error) {
        addDangerToast(t('Failed to apply theme: Invalid JSON'));
      }
    }
  }, [
    currentTheme?.json_data,
    isValidJson,
    setTemporaryTheme,
    onThemeApply,
    addSuccessToast,
    addDangerToast,
  ]);

  const modalTitle = useMemo(() => {
    if (isEditMode) {
      return isReadOnly
        ? t('View theme properties')
        : t('Edit theme properties');
    }
    return t('Add theme');
  }, [isEditMode, isReadOnly]);

  const modalIcon = useMemo(() => {
    const Icon = isEditMode ? Icons.EditOutlined : Icons.PlusOutlined;
    return (
      <Icon
        iconSize="l"
        css={css`
          margin: auto ${supersetTheme.sizeUnit * 2}px auto 0;
        `}
      />
    );
  }, [isEditMode, supersetTheme.sizeUnit]);

  const onThemeNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { target } = event;

      const data = {
        ...currentTheme,
        theme_name: currentTheme?.theme_name || '',
        json_data: currentTheme?.json_data || '',
      };

      data[target.name as ThemeStringKeys] = target.value;
      setCurrentTheme(data);
    },
    [currentTheme],
  );

  const onJsonDataChange = useCallback(
    (jsonData: string) => {
      const data = {
        ...currentTheme,
        theme_name: currentTheme?.theme_name || '',
        json_data: jsonData,
      };
      setCurrentTheme(data);
    },
    [currentTheme],
  );

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
      if (theme?.id && !loading) fetchResource(theme.id);
    } else if (
      !isEditMode &&
      (!currentTheme || currentTheme.id || (isHidden && show))
    ) {
      const newTheme = {
        theme_name: '',
        json_data: JSON.stringify({}, null, 2),
      };
      setCurrentTheme(newTheme);
      setInitialTheme(newTheme);
    }
  }, [theme, show, isEditMode, currentTheme, isHidden, loading, fetchResource]);

  useEffect(() => {
    if (resource) {
      setCurrentTheme(resource);
      setInitialTheme(resource);
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
  useEffect(() => {
    if (isHidden && show) setIsHidden(false);
  }, [isHidden, show]);

  // Handle browser navigation/reload with unsaved changes
  useBeforeUnload(show && hasUnsavedChanges());

  return (
    <Modal
      disablePrimaryButton={isReadOnly || disableSave}
      onHandledPrimaryAction={isReadOnly ? undefined : onSave}
      onHide={handleCancel}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      show={show}
      width="55%"
      centered
      footer={
        showConfirmAlert ? (
          <Alert
            closable={false}
            type="warning"
            message={t('You have unsaved changes')}
            description={t(
              'Your changes will be lost if you leave without saving.',
            )}
            css={{
              textAlign: 'left',
            }}
            action={
              <Space>
                <Button
                  key="keep-editing"
                  buttonStyle="tertiary"
                  onClick={() => setShowConfirmAlert(false)}
                >
                  {t('Keep editing')}
                </Button>
                <Button
                  key="discard"
                  buttonStyle="secondary"
                  onClick={handleConfirmCancel}
                >
                  {t('Discard')}
                </Button>
                <Button
                  key="save"
                  buttonStyle="primary"
                  onClick={() => {
                    setShowConfirmAlert(false);
                    onSave();
                  }}
                  disabled={disableSave}
                >
                  {t('Save')}
                </Button>
              </Space>
            }
          />
        ) : (
          [
            <Button key="cancel" onClick={handleCancel} buttonStyle="secondary">
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
          ]
        )
      }
      title={
        <Typography.Title level={4} data-test="theme-modal-title">
          {modalIcon}
          {modalTitle}
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
            <StyledEditorWrapper>
              <EditorHost
                id="theme-json-editor"
                value={currentTheme?.json_data || ''}
                onChange={onJsonDataChange}
                language="json"
                tabSize={2}
                readOnly={isReadOnly}
                wordWrap
                lineNumbers
                width="100%"
                height="250px"
                annotations={toEditorAnnotations(editorAnnotations)}
              />
            </StyledEditorWrapper>
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
