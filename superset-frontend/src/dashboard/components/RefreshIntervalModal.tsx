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
import React from 'react';
import Select from 'src/components/Select/Select';
import { t, styled } from '@superset-ui/core';
import Alert from 'src/components/Alert';
import Button from 'src/components/Button';

import ModalTrigger, { ModalTriggerRef } from 'src/components/ModalTrigger';
import { FormLabel } from 'src/components/Form';
import { propertyComparator } from 'src/components/Select/utils';

const StyledModalTrigger = styled(ModalTrigger)`
  .ant-modal-body {
    overflow: visible;
  }
`;

const RefreshWarningContainer = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 6}px;
`;

type RefreshIntervalModalProps = {
  addSuccessToast: (msg: string) => void;
  triggerNode: JSX.Element;
  refreshFrequency: number;
  onChange: (refreshLimit: number, editMode: boolean) => void;
  editMode: boolean;
  refreshLimit?: number;
  refreshWarning: string | null;
  refreshIntervalOptions: [number, string][];
};

type RefreshIntervalModalState = {
  refreshFrequency: number;
};

class RefreshIntervalModal extends React.PureComponent<
  RefreshIntervalModalProps,
  RefreshIntervalModalState
> {
  static defaultProps = {
    refreshLimit: 0,
    refreshWarning: null,
  };

  modalRef: ModalTriggerRef | null;

  constructor(props: RefreshIntervalModalProps) {
    super(props);
    this.modalRef = React.createRef() as ModalTriggerRef;
    this.state = {
      refreshFrequency: props.refreshFrequency,
    };
    this.handleFrequencyChange = this.handleFrequencyChange.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onCancel = this.onCancel.bind(this);
  }

  onSave() {
    this.props.onChange(this.state.refreshFrequency, this.props.editMode);
    this.modalRef?.current?.close();
    this.props.addSuccessToast(t('Refresh interval saved'));
  }

  onCancel() {
    this.setState({
      refreshFrequency: this.props.refreshFrequency,
    });
    this.modalRef?.current?.close();
  }

  handleFrequencyChange(value: number) {
    const { refreshIntervalOptions } = this.props;
    this.setState({
      refreshFrequency: value || refreshIntervalOptions[0][0],
    });
  }

  render() {
    const {
      refreshLimit = 0,
      refreshWarning,
      editMode,
      refreshIntervalOptions,
    } = this.props;
    const { refreshFrequency = 0 } = this.state;
    const showRefreshWarning =
      !!refreshFrequency && !!refreshWarning && refreshFrequency < refreshLimit;

    return (
      <StyledModalTrigger
        ref={this.modalRef}
        triggerNode={this.props.triggerNode}
        modalTitle={t('Refresh interval')}
        modalBody={
          <div>
            <FormLabel>{t('Refresh frequency')}</FormLabel>
            <Select
              ariaLabel={t('Refresh interval')}
              options={refreshIntervalOptions.map(option => ({
                value: option[0],
                label: t(option[1]),
              }))}
              value={refreshFrequency}
              onChange={this.handleFrequencyChange}
              sortComparator={propertyComparator('value')}
            />
            <br />
            <FormLabel>{t('CUSTOM')}</FormLabel> <br />
            <FormLabel>{t('HOUR')}</FormLabel> <br />
            <input
              type="number"
              min="0"
              style={{
                width: '50%',
                border: '1px solid lightgrey',
                borderRadius: '3px',
                paddingLeft: '10px',
              }}
              id="custom_refresh_frequency_hour"
            />
            <br />
            <FormLabel>{t('MINUTE')}</FormLabel> <br />
            <input
              type="number"
              min="0"
              style={{
                width: '50%',
                border: '1px solid lightgrey',
                borderRadius: '3px',
                paddingLeft: '10px',
              }}
              id="custom_refresh_frequency_minute"
            />
            <br />
            <FormLabel>{t('SECOND')}</FormLabel> <br />
            <input
              type="number"
              min="0"
              style={{
                width: '50%',
                border: '1px solid lightgrey',
                borderRadius: '3px',
                paddingLeft: '10px',
              }}
              id="custom_refresh_frequency_second"
            />
            <br />
            <Button
              buttonStyle="primary"
              buttonSize="small"
              style={{ marginTop: '4px' }}
              onClick={() => {
                // Get hour value
                const hour = document.getElementById(
                  'custom_refresh_frequency_hour',
                );
                const hour_value = Number(
                  (hour as HTMLInputElement).value || 0,
                );

                // Get minutes value
                const minute = document.getElementById(
                  'custom_refresh_frequency_minute',
                );
                const minute_value = Number(
                  (minute as HTMLInputElement).value || 0,
                );

                // Get seconds value
                const second = document.getElementById(
                  'custom_refresh_frequency_second',
                );
                const second_value = Number(
                  (second as HTMLInputElement).value || 0,
                );

                if (hour_value < 0 || minute_value < 0 || second_value < 0) {
                  if (hour) {
                    (hour as HTMLInputElement).value = '';
                  }
                  if (minute) {
                    (minute as HTMLInputElement).value = '';
                  }
                  if (second) {
                    (second as HTMLInputElement).value = '';
                  }
                  return;
                }
                // Convert given input to seconds
                const value =
                  hour_value * 60 * 60 + minute_value * 60 + second_value;
                this.handleFrequencyChange(value);
              }}
            >
              USE CUSTOM REFRESH INTERVAL
            </Button>
            {showRefreshWarning && (
              <RefreshWarningContainer>
                <Alert
                  type="warning"
                  message={
                    <>
                      <div>{refreshWarning}</div>
                      <br />
                      <strong>{t('Are you sure you want to proceed?')}</strong>
                    </>
                  }
                />
              </RefreshWarningContainer>
            )}
          </div>
        }
        modalFooter={
          <>
            <Button
              buttonStyle="primary"
              buttonSize="small"
              onClick={this.onSave}
            >
              {editMode ? t('Save') : t('Save for this session')}
            </Button>
            <Button onClick={this.onCancel} buttonSize="small">
              {t('Cancel')}
            </Button>
          </>
        }
      />
    );
  }
}

export default RefreshIntervalModal;
