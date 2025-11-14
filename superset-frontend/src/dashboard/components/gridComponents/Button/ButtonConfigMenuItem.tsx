/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to You under the Apache License, Version 2.0 (the
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import { Button as SupersetButton } from '@superset-ui/core/components/Button';
import { Form } from '@superset-ui/core/components/Form';
import { Input, Select, Tooltip } from '@superset-ui/core/components';
import { Switch } from '@superset-ui/core/components/Switch';
import { Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type {
  ButtonSize,
  ButtonStyle,
} from '@superset-ui/core/components/Button/types';
import type { DashboardButtonMeta } from './types';

const MenuTrigger = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: ${theme.colorTextDescription};

    &:hover {
      color: ${theme.colorPrimary};
    }
  `}
`;

const ConfigFormWrapper = styled.div`
  ${({ theme }) => css`
    width: 320px;

    .ant-form-item {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }

    .config-form-footer {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      justify-content: flex-end;
      margin-top: ${theme.sizeUnit * 3}px;
    }
  `}
`;

const TextArea = styled(Input.TextArea)`
  ${({ theme }) => css`
    resize: vertical;
    min-height: ${theme.sizeUnit * 10}px;
  `}
`;

const BUTTON_STYLE_OPTIONS: ButtonStyle[] = [
  'primary',
  'secondary',
  'tertiary',
  'danger',
  'link',
  'dashed',
];

const BUTTON_SIZE_OPTIONS: ButtonSize[] = ['default', 'small', 'xsmall'];

export type ButtonConfig = Pick<
  DashboardButtonMeta,
  | 'buttonStyle'
  | 'buttonSize'
  | 'disabled'
  | 'tooltip'
  | 'actionType'
  | 'url'
  | 'target'
  | 'apiEndpoint'
  | 'apiMethod'
  | 'apiHeaders'
  | 'apiPayload'
  | 'successMessage'
  | 'errorMessage'
  | 'confirmBeforeExecute'
  | 'confirmMessage'
>;

type FormValues = ButtonConfig;

interface ButtonConfigMenuItemProps {
  meta: DashboardButtonMeta;
  onSave: (updates: ButtonConfig) => void;
  onVisibilityChange?: (open: boolean) => void;
}

const normalizeButtonSize = (size?: string | null): ButtonSize =>
  size === 'middle' || !size ? 'default' : (size as ButtonSize);

const normalizeButtonStyle = (style?: string | null): ButtonStyle =>
  (style as ButtonStyle) || 'primary';

const normalizeActionType = (
  actionType?: string | null,
): ButtonConfig['actionType'] =>
  actionType === 'api' ? 'api' : 'link';

function getInitialValues(meta: DashboardButtonMeta) {
  return {
    buttonStyle: normalizeButtonStyle(meta.buttonStyle),
    buttonSize: normalizeButtonSize(meta.buttonSize),
    disabled: meta.disabled ?? false,
    tooltip: meta.tooltip ?? '',
    actionType: normalizeActionType(meta.actionType),
    url: meta.url ?? '',
    target: meta.target ?? '_self',
    apiEndpoint: meta.apiEndpoint ?? '',
    apiMethod: (meta.apiMethod ?? 'POST').toUpperCase(),
    apiHeaders: meta.apiHeaders ?? '',
    apiPayload: meta.apiPayload ?? '',
    successMessage:
      meta.successMessage ?? t('Action executed successfully.'),
    errorMessage:
      meta.errorMessage ?? t('Unable to execute action.'),
    confirmBeforeExecute: meta.confirmBeforeExecute ?? false,
    confirmMessage:
      meta.confirmMessage ?? t('Are you sure you want to run this action?'),
  } satisfies FormValues;
}

const ButtonConfigMenuItem = ({
  meta,
  onSave,
  onVisibilityChange,
}: ButtonConfigMenuItemProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const initialValues = useMemo(() => getInitialValues(meta), [meta]);
  const actionOptions = useMemo(
    () => [
      { value: 'link', label: t('Open link') },
      { value: 'api', label: t('Call API') },
    ],
    [],
  );
  const buttonStyleOptions = useMemo(
    () => [
      { value: 'primary', label: t('Primary') },
      { value: 'secondary', label: t('Secondary') },
      { value: 'tertiary', label: t('Tertiary') },
      { value: 'danger', label: t('Danger') },
      { value: 'link', label: t('Link') },
      { value: 'dashed', label: t('Dashed') },
    ],
    [],
  );
  const buttonSizeOptions = useMemo(
    () => [
      { value: 'default', label: t('Default') },
      { value: 'small', label: t('Small') },
      { value: 'xsmall', label: t('Extra small') },
    ],
    [],
  );

  const [actionType, setActionType] = useState(initialValues.actionType);

  useEffect(() => {
    if (modalVisible) {
      form.setFieldsValue(initialValues);
      setActionType(initialValues.actionType);
    }
  }, [form, initialValues, modalVisible]);

  const closeModal = useCallback(
    (shouldReset = false) => {
      setModalVisible(false);
      onVisibilityChange?.(false);
      if (shouldReset) {
        form.resetFields();
        setActionType(initialValues.actionType);
      }
    },
    [form, initialValues.actionType, onVisibilityChange],
  );

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      onSave({
        ...values,
        apiMethod: values.apiMethod?.toUpperCase(),
        url: values.url?.trim() ?? '',
        apiEndpoint: values.apiEndpoint?.trim() ?? '',
        apiHeaders: values.apiHeaders?.trim() ?? '',
        apiPayload: values.apiPayload?.trim() ?? '',
        tooltip: values.tooltip?.trim() ?? '',
        successMessage: values.successMessage?.trim() ?? '',
        errorMessage: values.errorMessage?.trim() ?? '',
        confirmMessage: values.confirmMessage?.trim() ?? '',
      });
      closeModal(false);
    },
    [closeModal, onSave],
  );

  const handleCancel = useCallback(() => {
    closeModal(true);
  }, [closeModal]);

  const handleOpenModal = useCallback(() => {
    setModalVisible(true);
    onVisibilityChange?.(true);
  }, [onVisibilityChange]);

  return (
    <>
      <Tooltip title={t('Configure button')}>
        <MenuTrigger
          onClick={event => {
            event.stopPropagation();
            handleOpenModal();
          }}
        >
          <Icons.SettingOutlined iconSize="m" />
        </MenuTrigger>
      </Tooltip>
      <Modal
        title={t('Button configuration')}
        show={modalVisible}
        onHide={handleCancel}
        destroyOnClose
        footer={
          <div className="config-form-footer">
            <SupersetButton
              buttonStyle="tertiary"
              buttonSize="small"
              onClick={handleCancel}
            >
              {t('Cancel')}
            </SupersetButton>
            <SupersetButton
              buttonStyle="primary"
              buttonSize="small"
              onClick={() => form.submit()}
            >
              {t('Save')}
            </SupersetButton>
          </div>
        }
      >
        <ConfigFormWrapper data-test="dashboard-button-config">
          <Form
            layout="vertical"
            form={form}
            initialValues={initialValues}
            onFinish={handleSubmit}
            onValuesChange={(changedValues, values) => {
              if (
                Object.prototype.hasOwnProperty.call(
                  changedValues,
                  'actionType',
                )
              ) {
                setActionType(
                  (values.actionType as ButtonConfig['actionType']) ?? 'link',
                );
              }
            }}
          >
            <Form.Item<FormValues>
              name="buttonStyle"
              label={t('Button style')}
            >
              <Select
                options={buttonStyleOptions}
              />
            </Form.Item>
            <Form.Item<FormValues> name="buttonSize" label={t('Button size')}>
              <Select
                options={buttonSizeOptions}
              />
            </Form.Item>
            <Form.Item<FormValues>
              name="tooltip"
              label={t('Tooltip')}
              extra={t('Optional helper text displayed on hover')}
            >
              <Input />
            </Form.Item>
            <Form.Item<FormValues>
              name="disabled"
              label={t('Disable button')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item<FormValues>
              name="actionType"
              label={t('Action type')}
            >
              <Select options={actionOptions} />
            </Form.Item>
            {actionType === 'link' && (
              <>
                <Form.Item<FormValues>
                  name="url"
                  label={t('Destination URL')}
                  requiredMark="optional"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (!value || value.trim().length === 0) {
                          return Promise.resolve();
                        }
                        const trimmedValue = value.trim();
                        const trimmedLower = trimmedValue.toLowerCase();
                        // Block dangerous protocols
                        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
                        if (dangerousProtocols.some(protocol => trimmedLower.startsWith(protocol))) {
                          return Promise.reject(
                            new Error(
                              t('URLs with javascript:, data:, vbscript:, or file: protocols are not allowed for security reasons.'),
                            ),
                          );
                        }
                        // Validate URL format for absolute URLs
                        if (trimmedLower.startsWith('http://') || trimmedLower.startsWith('https://')) {
                          try {
                            new URL(trimmedValue);
                            return Promise.resolve();
                          } catch {
                            return Promise.reject(
                              new Error(
                                t('Please enter a valid URL (e.g., https://example.com/path)'),
                              ),
                            );
                          }
                        }
                        // Allow relative URLs, mailto, tel, and hash links
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input placeholder="https://example.com/path" />
                </Form.Item>
                <Form.Item<FormValues>
                  name="target"
                  label={t('Open link in')}
                >
                  <Select
                    options={[
                      { value: '_self', label: t('Same tab (default)') },
                      { value: '_blank', label: t('New tab') },
                      { value: '_parent', label: t('Parent frame') },
                      { value: '_top', label: t('Top frame') },
                    ]}
                  />
                </Form.Item>
              </>
            )}
            {actionType === 'api' && (
              <>
                <Form.Item<FormValues>
                  name="apiEndpoint"
                  label={t('API endpoint')}
                  requiredMark="optional"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (!value || value.trim().length === 0) {
                          return Promise.resolve();
                        }
                        const trimmedValue = value.trim();
                        const trimmedLower = trimmedValue.toLowerCase();
                        // Block dangerous protocols
                        const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
                        if (dangerousProtocols.some(protocol => trimmedLower.startsWith(protocol))) {
                          return Promise.reject(
                            new Error(
                              t('Endpoints with javascript:, data:, vbscript:, or file: protocols are not allowed for security reasons.'),
                            ),
                          );
                        }
                        // Validate URL format for absolute URLs
                        if (trimmedLower.startsWith('http://') || trimmedLower.startsWith('https://')) {
                          try {
                            new URL(trimmedValue);
                            return Promise.resolve();
                          } catch {
                            return Promise.reject(
                              new Error(
                                t('Please enter a valid endpoint URL (e.g., https://api.example.com/endpoint) or a relative path (e.g., /api/v1/resource/)'),
                              ),
                            );
                          }
                        }
                        // Allow relative paths (must start with /)
                        if (trimmedValue.startsWith('/')) {
                          return Promise.resolve();
                        }
                        // Warn about relative paths without leading slash (but allow them)
                        return Promise.resolve();
                      },
                    },
                  ]}
                  extra={t(
                    'Relative paths (starting with /) call Superset APIs. Absolute URLs (http:// or https://) are also supported.',
                  )}
                >
                  <Input placeholder="/api/v1/resource/" />
                </Form.Item>
                <Form.Item<FormValues>
                  name="apiMethod"
                  label={t('HTTP method')}
                >
                  <Select
                    options={[
                      { value: 'GET', label: 'GET' },
                      { value: 'POST', label: 'POST' },
                      { value: 'PUT', label: 'PUT' },
                      { value: 'PATCH', label: 'PATCH' },
                      { value: 'DELETE', label: 'DELETE' },
                    ]}
                  />
                </Form.Item>
                <Form.Item<FormValues>
                  name="apiHeaders"
                  label={t('Request headers')}
                  extra={t(
                    'Provide a JSON object with header names and values.',
                  )}
                >
                  <TextArea
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    placeholder='{"Content-Type": "application/json"}'
                  />
                </Form.Item>
                <Form.Item<FormValues>
                  name="apiPayload"
                  label={t('Request body')}
                  extra={t(
                    'JSON payload sent with POST, PUT, or PATCH requests.',
                  )}
                >
                  <TextArea
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder='{"payload": "value"}'
                  />
                </Form.Item>
                <Form.Item<FormValues>
                  name="confirmBeforeExecute"
                  label={t('Ask for confirmation')}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item<FormValues>
                  name="confirmMessage"
                  label={t('Confirmation message')}
                  extra={t(
                    'Optional custom message shown in the confirmation dialog.',
                  )}
                >
                  <Input placeholder={t('Are you sure?')} />
                </Form.Item>
                <Form.Item<FormValues>
                  name="successMessage"
                  label={t('Success toast message')}
                >
                  <Input />
                </Form.Item>
                <Form.Item<FormValues>
                  name="errorMessage"
                  label={t('Error toast message')}
                >
                  <Input />
                </Form.Item>
              </>
            )}
          </Form>
        </ConfigFormWrapper>
      </Modal>
    </>
  );
};

export default ButtonConfigMenuItem;

