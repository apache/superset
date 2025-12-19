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

import { useCallback, useEffect } from 'react';
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { Form, Input } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import { WhatIfModification } from './types';
import {
  createSimulation,
  updateSimulation,
  WhatIfSimulation,
} from './whatIfApi';

const ModalContent = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 4}px;

  .ant-form-item {
    margin-bottom: ${({ theme }) => theme.sizeUnit * 6}px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .ant-form-item-label {
    padding-bottom: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const { TextArea } = Input;

interface SaveSimulationModalProps {
  show: boolean;
  onHide: () => void;
  onSaved: (simulation: WhatIfSimulation) => void;
  dashboardId: number;
  modifications: WhatIfModification[];
  cascadingEffectsEnabled: boolean;
  existingSimulation?: WhatIfSimulation | null;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
}

const SaveSimulationModal = ({
  show,
  onHide,
  onSaved,
  dashboardId,
  modifications,
  cascadingEffectsEnabled,
  existingSimulation,
  addSuccessToast,
  addDangerToast,
}: SaveSimulationModalProps) => {
  const [form] = Form.useForm();

  const isUpdate = Boolean(existingSimulation);

  useEffect(() => {
    if (show) {
      form.setFieldsValue({
        name: existingSimulation?.name || '',
        description: existingSimulation?.description || '',
      });
    }
  }, [show, existingSimulation, form]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();

      if (isUpdate && existingSimulation) {
        await updateSimulation(existingSimulation.id, {
          name: values.name,
          description: values.description,
          modifications,
          cascadingEffectsEnabled,
        });
        const updatedSimulation: WhatIfSimulation = {
          ...existingSimulation,
          name: values.name,
          description: values.description,
          modifications,
          cascadingEffectsEnabled,
        };
        onSaved(updatedSimulation);
        addSuccessToast(t('Simulation updated successfully'));
      } else {
        const simulation = await createSimulation({
          name: values.name,
          description: values.description,
          dashboardId,
          modifications,
          cascadingEffectsEnabled,
        });
        onSaved(simulation);
        addSuccessToast(t('Simulation saved successfully'));
      }

      onHide();
    } catch (error) {
      addDangerToast(t('Failed to save simulation'));
    }
  }, [
    form,
    isUpdate,
    existingSimulation,
    modifications,
    cascadingEffectsEnabled,
    dashboardId,
    onSaved,
    onHide,
    addSuccessToast,
    addDangerToast,
  ]);

  const handleCancel = useCallback(() => {
    form.resetFields();
    onHide();
  }, [form, onHide]);

  return (
    <StandardModal
      show={show}
      onHide={handleCancel}
      onSave={handleSave}
      title={isUpdate ? t('Update Simulation') : t('Save Simulation')}
      width={500}
      saveText={isUpdate ? t('Update') : t('Save')}
    >
      <ModalContent>
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('Name')}
            rules={[{ required: true, message: t('Please enter a name') }]}
          >
            <Input placeholder={t('My What-If Scenario')} />
          </Form.Item>
          <Form.Item name="description" label={t('Description')}>
            <TextArea
              placeholder={t('Optional description of this simulation')}
              rows={3}
            />
          </Form.Item>
        </Form>
      </ModalContent>
    </StandardModal>
  );
};

export default SaveSimulationModal;
