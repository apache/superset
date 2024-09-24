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
import { createRef, PureComponent } from 'react';
import Select from 'src/components/Select/Select';
import { t, styled } from '@superset-ui/core';
import Alert from 'src/components/Alert';
import Button from 'src/components/Button';
import { Input } from 'src/components/Input';

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

const StyledDiv = styled.div`
  display: flex;
  margin-top: ${({ theme }) => theme.gridUnit * 3}px;
`;

const InnerStyledDiv = styled.div`
  width: 30%;
  margin: auto;
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
  custom_hour: number;
  custom_min: number;
  custom_sec: number;
  custom_block: boolean;
};

class RefreshIntervalModal extends PureComponent<
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
    this.modalRef = createRef() as ModalTriggerRef;
    this.state = {
      refreshFrequency: props.refreshFrequency,
      custom_hour: 0,
      custom_min: 0,
      custom_sec: 0,
      custom_block: false,
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

    this.setState({
      custom_block: value === -1,
    });

    if (value === -1) {
      this.setState({
        custom_hour: 0,
        custom_min: 0,
        custom_sec: 0,
      });
    }
  }

  onSaveValue(value: number) {
    this.props.onChange(value, this.props.editMode);
    this.modalRef?.current?.close();
    this.props.addSuccessToast(t('Refresh interval saved'));
  }

  createIntervalOptions(refreshIntervalOptions: [number, string][]) {
    const refresh_options = [];

    refresh_options.push({ value: -1, label: t('Custom interval') });
    refresh_options.push(
      ...refreshIntervalOptions.map(option => ({
        value: option[0],
        label: t(option[1]),
      })),
    );

    return refresh_options;
  }

  min_sec_options(min_or_sec: string) {
    return Array.from({ length: 60 }, (_, i) => ({
      value: i,
      label: `${i} ${min_or_sec}`,
    }));
  }

  refresh_custom_val(
    custom_block: boolean,
    custom_hour: number,
    custom_min: number,
    custom_sec: number,
  ) {
    if (custom_block === true) {
      // Get hour value
      const hour_value = custom_hour;

      // Get minutes value
      const minute_value = custom_min;

      // Get seconds value
      const second_value = custom_sec;

      if (
        hour_value < 0 ||
        minute_value < 0 ||
        second_value < 0 ||
        minute_value >= 60 ||
        second_value >= 60
      ) {
        this.props.addSuccessToast(
          t(
            'Put positive values and valid minute and second value less than 60',
          ),
        );
      }
      // Convert given input to seconds
      const value = hour_value * 60 * 60 + minute_value * 60 + second_value;
      if (value === 0) {
        this.props.addSuccessToast(t('Put some positive value greater than 0'));
        return;
      }
      this.handleFrequencyChange(value);
      this.onSaveValue(value);
    } else this.onSave();
  }

  render() {
    const {
      refreshLimit = 0,
      refreshWarning,
      editMode,
      refreshIntervalOptions,
    } = this.props;
    const {
      refreshFrequency = 0,
      custom_hour = 0,
      custom_min = 0,
      custom_sec = 0,
      custom_block = false,
    } = this.state;
    const showRefreshWarning =
      !!refreshFrequency && !!refreshWarning && refreshFrequency < refreshLimit;

    return (
      <StyledModalTrigger
        ref={this.modalRef}
        triggerNode={this.props.triggerNode}
        modalTitle={t('Refresh interval')}
        modalBody={
          <div>
            <div id="refresh_from_dropdown">
              <FormLabel>
                <b>{t('Refresh frequency')}</b>
              </FormLabel>
              <Select
                ariaLabel={t('Refresh interval')}
                options={this.createIntervalOptions(refreshIntervalOptions)}
                value={refreshFrequency}
                onChange={this.handleFrequencyChange}
                sortComparator={propertyComparator('value')}
              />
            </div>
            {custom_block && (
              <StyledDiv>
                <InnerStyledDiv>
                  <FormLabel>
                    <b>{t('HOUR')}</b>
                  </FormLabel>{' '}
                  <br />
                  <Input
                    type="number"
                    min="0"
                    className="form-control input-sm"
                    placeholder={t('Type a number')}
                    onChange={event => {
                      this.setState({
                        custom_hour: Number(event.target.value),
                      });
                    }}
                    value={custom_hour}
                  />
                </InnerStyledDiv>
                <InnerStyledDiv>
                  <FormLabel>
                    <b>{t('MINUTE')}</b>
                  </FormLabel>{' '}
                  <br />
                  <Select
                    ariaLabel={t('Minutes value')}
                    options={this.min_sec_options('minutes')}
                    value={custom_min}
                    onChange={(value: number) => {
                      this.setState({
                        custom_min: value,
                      });
                    }}
                    sortComparator={propertyComparator('value')}
                  />
                </InnerStyledDiv>
                <InnerStyledDiv>
                  <FormLabel>
                    <b>{t('SECOND')}</b>
                  </FormLabel>{' '}
                  <br />
                  <Select
                    ariaLabel={t('Seconds value')}
                    options={this.min_sec_options('seconds')}
                    value={custom_sec}
                    onChange={(value: number) => {
                      this.setState({
                        custom_sec: value,
                      });
                    }}
                    sortComparator={propertyComparator('value')}
                  />
                </InnerStyledDiv>
              </StyledDiv>
            )}
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
            <Button onClick={this.onCancel} buttonSize="small">
              {t('Cancel')}
            </Button>
            <Button
              buttonStyle="primary"
              buttonSize="small"
              onClick={() =>
                this.refresh_custom_val(
                  custom_block,
                  custom_hour,
                  custom_min,
                  custom_sec,
                )
              }
            >
              {editMode ? t('Save') : t('Save for this session')}
            </Button>
          </>
        }
      />
    );
  }
}

export default RefreshIntervalModal;
