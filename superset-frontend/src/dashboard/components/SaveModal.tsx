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
/* eslint-env browser */
import { useRef, useState } from 'react';
import { Radio, RadioChangeEvent } from '@superset-ui/core/components/Radio';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Divider,
  Flex,
} from '@superset-ui/core/components';
import { t, useTheme } from '@superset-ui/core';

import {
  ModalTrigger,
  ModalTriggerRef,
} from '@superset-ui/core/components/ModalTrigger';
import {
  SAVE_TYPE_OVERWRITE,
  SAVE_TYPE_NEWDASHBOARD,
} from 'src/dashboard/util/constants';

type SaveType = typeof SAVE_TYPE_OVERWRITE | typeof SAVE_TYPE_NEWDASHBOARD;

type SaveModalProps = {
  addSuccessToast: (arg: string) => void;
  addDangerToast: (arg: string) => void;
  dashboardId: number;
  dashboardTitle: string;
  dashboardInfo: Record<string, any>;
  expandedSlices: Record<string, any>;
  layout: Record<string, any>;
  saveType: SaveType;
  triggerNode: JSX.Element;
  customCss: string;
  colorNamespace?: string;
  colorScheme?: string;
  onSave: (data: any, id: number | string, saveType: SaveType) => void;
  canOverwrite: boolean;
  shouldPersistRefreshFrequency: boolean;
  refreshFrequency: number;
  lastModifiedTime: number;
};

// Removed SaveModalState - now using useState hooks

function SaveModal({
  saveType: initialSaveType = SAVE_TYPE_OVERWRITE,
  colorNamespace,
  colorScheme,
  shouldPersistRefreshFrequency = false,
  dashboardTitle,
  onSave,
  triggerNode,
  canOverwrite,
  addSuccessToast,
  addDangerToast,
  dashboardId,
  dashboardInfo,
  expandedSlices,
  layout,
  customCss,
  refreshFrequency,
  lastModifiedTime,
}: SaveModalProps) {
  const theme = useTheme();
  const modal = useRef() as ModalTriggerRef;

  const [saveType, setSaveType] = useState<SaveType>(initialSaveType);
  const [newDashName, setNewDashName] = useState(
    `${dashboardTitle} ${t('[copy]')}`,
  );
  const [duplicateSlices, setDuplicateSlices] = useState(false);

  const toggleDuplicateSlices = () => {
    setDuplicateSlices(prev => !prev);
  };

  const handleSaveTypeChange = (event: RadioChangeEvent) => {
    setSaveType((event.target as HTMLInputElement).value as SaveType);
  };

  const handleNameChange = (name: string) => {
    setNewDashName(name);
    setSaveType(SAVE_TYPE_NEWDASHBOARD);
  };

  const saveDashboard = () => {
    // check refresh frequency is for current session or persist
    const refreshFrequencyToUse = shouldPersistRefreshFrequency
      ? refreshFrequency
      : dashboardInfo.metadata?.refresh_frequency; // eslint-disable camelcase

    const data = {
      certified_by: dashboardInfo.certified_by,
      certification_details: dashboardInfo.certification_details,
      css: customCss,
      dashboard_title:
        saveType === SAVE_TYPE_NEWDASHBOARD ? newDashName : dashboardTitle,
      duplicate_slices: duplicateSlices,
      last_modified_time: lastModifiedTime,
      owners: dashboardInfo.owners,
      roles: dashboardInfo.roles,
      metadata: {
        ...dashboardInfo?.metadata,
        positions: layout,
        refresh_frequency: refreshFrequencyToUse,
      },
    };

    if (saveType === SAVE_TYPE_NEWDASHBOARD && !newDashName) {
      addDangerToast(t('You must pick a name for the new dashboard'));
    } else {
      onSave(data, dashboardId, saveType);
      modal?.current?.close?.();
    }
  };

  return (
    <ModalTrigger
      ref={modal}
      triggerNode={triggerNode}
      modalTitle={t('Save dashboard')}
      modalBody={
        <Form layout="vertical">
          <Form.Item>
            <Radio
              value={SAVE_TYPE_OVERWRITE}
              onChange={handleSaveTypeChange}
              checked={saveType === SAVE_TYPE_OVERWRITE}
              disabled={!canOverwrite}
            >
              {t('Overwrite Dashboard [%s]', dashboardTitle)}
            </Radio>
          </Form.Item>

          <Divider />

          <Form.Item style={{ marginBottom: theme.sizeUnit }}>
            <Radio
              value={SAVE_TYPE_NEWDASHBOARD}
              onChange={handleSaveTypeChange}
              checked={saveType === SAVE_TYPE_NEWDASHBOARD}
            >
              {t('Save as:')}
            </Radio>
          </Form.Item>

          <Form.Item style={{ marginBottom: theme.sizeUnit }}>
            <Input
              placeholder={t('[dashboard name]')}
              value={newDashName}
              onFocus={e => handleNameChange(e.target.value)}
              onChange={e => handleNameChange(e.target.value)}
            />
          </Form.Item>

          <Form.Item>
            <Checkbox
              checked={duplicateSlices}
              onChange={() => toggleDuplicateSlices()}
            >
              {t('also copy (duplicate) charts')}
            </Checkbox>
          </Form.Item>
        </Form>
      }
      modalFooter={
        <Flex justify="flex-end" gap={theme.sizeUnit}>
          <Button
            buttonStyle="secondary"
            onClick={() => modal?.current?.close?.()}
          >
            {t('Cancel')}
          </Button>
          <Button
            type="primary"
            data-test="modal-save-dashboard-button"
            onClick={saveDashboard}
          >
            {t('Save')}
          </Button>
        </Flex>
      }
    />
  );
}

export default SaveModal;
