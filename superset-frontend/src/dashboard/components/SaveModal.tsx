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
import { createRef, PureComponent } from 'react';
import { Radio, RadioChangeEvent } from '@superset-ui/core/components/Radio';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Divider,
  Space,
} from '@superset-ui/core/components';
import { t, themeObject, JsonResponse } from '@superset-ui/core';

import {
  ModalTrigger,
  ModalTriggerRef,
} from '@superset-ui/core/components/ModalTrigger';
import {
  SAVE_TYPE_OVERWRITE,
  SAVE_TYPE_NEWDASHBOARD,
} from 'src/dashboard/util/constants';
import { navigateTo } from 'src/utils/navigationUtils';

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

type SaveModalState = {
  saveType: SaveType;
  newDashName: string;
  duplicateSlices: boolean;
};

const defaultProps = {
  saveType: SAVE_TYPE_OVERWRITE,
  colorNamespace: undefined,
  colorScheme: undefined,
  shouldPersistRefreshFrequency: false,
};

class SaveModal extends PureComponent<SaveModalProps, SaveModalState> {
  static defaultProps = defaultProps;

  modal: ModalTriggerRef | null;

  onSave: (
    data: Record<string, any>,
    dashboardId: number | string,
    saveType: SaveType,
  ) => Promise<JsonResponse>;

  constructor(props: SaveModalProps) {
    super(props);
    this.state = {
      saveType: props.saveType,
      newDashName: `${props.dashboardTitle} ${t('[copy]')}`,
      duplicateSlices: false,
    };

    this.handleSaveTypeChange = this.handleSaveTypeChange.bind(this);
    this.handleNameChange = this.handleNameChange.bind(this);
    this.saveDashboard = this.saveDashboard.bind(this);
    this.toggleDuplicateSlices = this.toggleDuplicateSlices.bind(this);
    this.onSave = this.props.onSave.bind(this);
    this.modal = createRef() as ModalTriggerRef;
  }

  toggleDuplicateSlices(): void {
    this.setState(prevState => ({
      duplicateSlices: !prevState.duplicateSlices,
    }));
  }

  handleSaveTypeChange(event: RadioChangeEvent) {
    this.setState({
      saveType: (event.target as HTMLInputElement).value as SaveType,
    });
  }

  handleNameChange(name: string) {
    this.setState({
      newDashName: name,
      saveType: SAVE_TYPE_NEWDASHBOARD,
    });
  }

  saveDashboard() {
    const { saveType, newDashName } = this.state;
    const {
      dashboardTitle,
      dashboardInfo,
      layout: positions,
      customCss,
      dashboardId,
      refreshFrequency: currentRefreshFrequency,
      shouldPersistRefreshFrequency,
      lastModifiedTime,
    } = this.props;

    // check refresh frequency is for current session or persist
    const refreshFrequency = shouldPersistRefreshFrequency
      ? currentRefreshFrequency
      : dashboardInfo.metadata?.refresh_frequency; // eslint-disable camelcase

    const data = {
      certified_by: dashboardInfo.certified_by,
      certification_details: dashboardInfo.certification_details,
      css: customCss,
      dashboard_title:
        saveType === SAVE_TYPE_NEWDASHBOARD ? newDashName : dashboardTitle,
      duplicate_slices: this.state.duplicateSlices,
      last_modified_time: lastModifiedTime,
      owners: dashboardInfo.owners,
      roles: dashboardInfo.roles,
      metadata: {
        ...dashboardInfo?.metadata,
        positions,
        refresh_frequency: refreshFrequency,
      },
    };

    if (saveType === SAVE_TYPE_NEWDASHBOARD && !newDashName) {
      this.props.addDangerToast(
        t('You must pick a name for the new dashboard'),
      );
    } else {
      this.onSave(data, dashboardId, saveType).then((resp: JsonResponse) => {
        if (saveType === SAVE_TYPE_NEWDASHBOARD && resp.json?.result?.id) {
          navigateTo(`/superset/dashboard/${resp.json.result.id}/`);
        }
      });
      this.modal?.current?.close?.();
    }
  }

  render() {
    const { theme } = themeObject;
    return (
      <ModalTrigger
        ref={this.modal}
        triggerNode={this.props.triggerNode}
        modalTitle={t('Save dashboard')}
        modalBody={
          <Form layout="vertical">
            <Form.Item>
              <Radio
                value={SAVE_TYPE_OVERWRITE}
                onChange={this.handleSaveTypeChange}
                checked={this.state.saveType === SAVE_TYPE_OVERWRITE}
                disabled={!this.props.canOverwrite}
              >
                {t('Overwrite Dashboard [%s]', this.props.dashboardTitle)}
              </Radio>
            </Form.Item>

            <Divider />

            <Form.Item style={{ marginBottom: theme.sizeUnit }}>
              <Radio
                value={SAVE_TYPE_NEWDASHBOARD}
                onChange={this.handleSaveTypeChange}
                checked={this.state.saveType === SAVE_TYPE_NEWDASHBOARD}
              >
                {t('Save as:')}
              </Radio>
            </Form.Item>

            <Form.Item style={{ marginBottom: theme.sizeUnit }}>
              <Input
                placeholder={t('[dashboard name]')}
                value={this.state.newDashName}
                onFocus={e => this.handleNameChange(e.target.value)}
                onChange={e => this.handleNameChange(e.target.value)}
              />
            </Form.Item>

            <Form.Item>
              <Checkbox
                checked={this.state.duplicateSlices}
                onChange={() => this.toggleDuplicateSlices()}
              >
                {t('also copy (duplicate) charts')}
              </Checkbox>
            </Form.Item>
          </Form>
        }
        modalFooter={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              data-test="modal-save-dashboard-button"
              onClick={this.saveDashboard}
            >
              {t('Save')}
            </Button>
          </Space>
        }
      />
    );
  }
}

export default SaveModal;
