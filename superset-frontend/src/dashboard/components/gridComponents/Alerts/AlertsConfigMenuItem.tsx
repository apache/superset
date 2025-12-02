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
import { useCallback, useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import { Button as SupersetButton } from '@superset-ui/core/components/Button';
import { Form } from '@superset-ui/core/components/Form';
import { Input, Select, Tooltip } from '@superset-ui/core/components';
import { Switch } from '@superset-ui/core/components/Switch';
import { Modal } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import type { DashboardAlertsMeta } from './types';

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
    .ant-form-item {
      margin-bottom: ${theme.sizeUnit * 3}px;
    }

    .config-form-footer {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      justify-content: flex-end;
      margin-top: ${theme.sizeUnit * 4}px;
      padding-top: ${theme.sizeUnit * 3}px;
      border-top: 1px solid ${theme.colorBorder};
    }

    .form-section-title {
      font-weight: ${theme.fontWeightBold};
      margin-bottom: ${theme.sizeUnit * 2}px;
      color: ${theme.colorText};
    }

    .form-help-text {
      font-size: ${theme.fontSizeSm}px;
      color: ${theme.colorTextDescription};
      margin-top: ${theme.sizeUnit}px;
    }
  `}
`;

export type AlertsConfig = Pick<
  DashboardAlertsMeta,
  | 'mqttTopic'
  | 'includeGlobalTopic'
  | 'eventFilter'
  | 'severityFilter'
  | 'showVisualIndicator'
  | 'indicatorColor'
>;

type FormValues = AlertsConfig;

interface AlertsConfigMenuItemProps {
  meta: DashboardAlertsMeta;
  onSave: (updates: AlertsConfig) => void;
  onVisibilityChange?: (open: boolean) => void;
}

function getInitialValues(meta: DashboardAlertsMeta): FormValues {
  return {
    mqttTopic: meta.mqttTopic ?? '',
    includeGlobalTopic: meta.includeGlobalTopic ?? true,
    eventFilter: meta.eventFilter ?? '',
    severityFilter: meta.severityFilter ?? [],
    showVisualIndicator: meta.showVisualIndicator ?? true,
    indicatorColor: meta.indicatorColor ?? '#1890ff',
  };
}

const AlertsConfigMenuItem = ({
  meta,
  onSave,
  onVisibilityChange,
}: AlertsConfigMenuItemProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const initialValues = useMemo(() => getInitialValues(meta), [meta]);

  const severityOptions = useMemo(
    () => [
      { value: 'info', label: t('Info') },
      { value: 'success', label: t('Success') },
      { value: 'warning', label: t('Warning') },
      { value: 'error', label: t('Error') },
    ],
    [],
  );

  const handleOpenModal = useCallback(() => {
    form.setFieldsValue(initialValues);
    setModalVisible(true);
    onVisibilityChange?.(true);
  }, [form, initialValues, onVisibilityChange]);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    onVisibilityChange?.(false);
  }, [onVisibilityChange]);

  const handleSubmit = useCallback(() => {
    form
      .validateFields()
      .then(values => {
        const updates: AlertsConfig = {
          mqttTopic: values.mqttTopic?.trim() || '',
          includeGlobalTopic: values.includeGlobalTopic ?? true,
          eventFilter: values.eventFilter?.trim() || '',
          severityFilter: values.severityFilter || [],
          showVisualIndicator: values.showVisualIndicator ?? true,
          indicatorColor: values.indicatorColor || '#1890ff',
        };
        onSave(updates);
        handleCloseModal();
      })
      .catch(error => {
        console.error('Form validation failed:', error);
      });
  }, [form, onSave, handleCloseModal]);

  return (
    <>
      <Tooltip title={t('Configure alerts')} placement="top">
        <MenuTrigger onClick={handleOpenModal}>
          <Icons.SettingOutlined />
        </MenuTrigger>
      </Tooltip>

      <Modal
        title={t('Configure Alert Listener')}
        visible={modalVisible}
        onCancel={handleCloseModal}
        width={600}
        footer={null}
        destroyOnClose
      >
        <ConfigFormWrapper>
          <Form
            form={form}
            layout="vertical"
            initialValues={initialValues}
            preserve={false}
          >
            {/* MQTT Topic Configuration */}
            <div className="form-section-title">{t('MQTT Topic')}</div>
            
            <Form.Item
              name="mqttTopic"
              label={t('Custom Topic')}
              extra={t('Enter the MQTT topic to subscribe to (e.g., "temperature/alerts", "dashboard/123/events")')}
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || value.trim().length === 0) {
                      return Promise.reject(
                        new Error(t('Please enter an MQTT topic')),
                      );
                    }
                    // Basic topic validation
                    if (value.includes('#') && !value.endsWith('#')) {
                      return Promise.reject(
                        new Error(t('Wildcard # must be at the end of topic')),
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input
                placeholder={t('e.g., sensors/temperature or devices/+/events')}
                allowClear
              />
            </Form.Item>

            <Form.Item
              name="includeGlobalTopic"
              label={t('Include Global Topic')}
              valuePropName="checked"
              extra={t('Also subscribe to the global "smartLight/events" topic')}
            >
              <Switch />
            </Form.Item>

            {/* Filtering Options */}
            <div className="form-section-title" style={{ marginTop: 24 }}>
              {t('Filters')}
            </div>

            <Form.Item
              name="eventFilter"
              label={t('Event Type Filter')}
              extra={t('Only show events matching this text (case-insensitive)')}
            >
              <Input
                placeholder={t('e.g., Critical, Warning, Alert')}
                allowClear
              />
            </Form.Item>

            <Form.Item
              name="severityFilter"
              label={t('Severity Filter')}
              extra={t('Only show events with these severity levels')}
            >
              <Select
                mode="multiple"
                options={severityOptions}
                placeholder={t('Select severity levels')}
                allowClear
              />
            </Form.Item>

            {/* Visual Options */}
            <div className="form-section-title" style={{ marginTop: 24 }}>
              {t('Display Options')}
            </div>

            <Form.Item
              name="showVisualIndicator"
              label={t('Show Visual Indicator')}
              valuePropName="checked"
              extra={t('Display a visual indicator when this alert listener is active')}
            >
              <Switch />
            </Form.Item>

            <Form.Item
              name="indicatorColor"
              label={t('Indicator Color')}
              extra={t('Color of the visual indicator')}
            >
              <Input type="color" style={{ width: 100 }} />
            </Form.Item>

            <div className="config-form-footer">
              <SupersetButton onClick={handleCloseModal}>
                {t('Cancel')}
              </SupersetButton>
              <SupersetButton
                buttonStyle="primary"
                onClick={handleSubmit}
              >
                {t('Save')}
              </SupersetButton>
            </div>
          </Form>
        </ConfigFormWrapper>
      </Modal>
    </>
  );
};

export default AlertsConfigMenuItem;
