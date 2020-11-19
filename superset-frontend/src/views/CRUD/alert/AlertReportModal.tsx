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
import React, { FunctionComponent, useState, useEffect } from 'react';
import { styled, t, SupersetClient } from '@superset-ui/core';
import rison from 'rison';
// import { useSingleViewResource } from 'src/views/CRUD/hooks';

import Icon from 'src/components/Icon';
import Modal from 'src/common/components/Modal';
import { Switch } from 'src/common/components/Switch';
import { Select } from 'src/common/components/Select';
import { Radio } from 'src/common/components/Radio';
import { AsyncSelect } from 'src/components/Select';
import withToasts from 'src/messageToasts/enhancers/withToasts';

import { AlertObject } from './types';

interface AlertReportModalProps {
  addDangerToast: (msg: string) => void;
  alert?: AlertObject | null;
  isReport?: boolean;
  onAdd?: (alert?: AlertObject) => void;
  onHide: () => void;
  show: boolean;
}

const CONDITIONS = [
  '< (Smaller than)',
  '> (Larger than)',
  '<= (Smaller or equal)',
  '>= (Larger or equal)',
  '== (Is Equal)',
  '!= (Is Not Equal)',
];

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const StyledSectionContainer = styled.div`
  display: flex;
  flex-direction: column;

  .header-section {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    width: 100%;
    padding: ${({ theme }) => theme.gridUnit * 4}px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }

  .column-section {
    display: flex;
    flex: 1 1 auto;

    .column {
      flex: 1 1 auto;
      min-width: 33.33%;
      padding: ${({ theme }) => theme.gridUnit * 4}px;

      &.condition {
        border-right: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
      }

      &.message {
        border-left: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
      }
    }
  }

  .inline-container {
    display: flex;
    flex-direction: row;
    align-items: center;

    > div {
      flex: 1 1 auto;
    }

    &.format-option {
      margin-bottom: 5px;
    }

    .styled-input {
      margin: 0 0 0 10px;

      input {
        flex: 0 0 auto;
      }
    }
  }
`;

const StyledSectionTitle = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 2}px auto
    ${({ theme }) => theme.gridUnit * 4}px auto;
`;

const StyledSwitchContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 10px;

  .switch-label {
    margin-left: 10px;
  }
`;

const StyledInputContainer = styled.div`
  flex: 1 1 auto;
  margin: ${({ theme }) => theme.gridUnit * 2}px;
  margin-top: 0;

  .required {
    margin-left: ${({ theme }) => theme.gridUnit / 2}px;
    color: ${({ theme }) => theme.colors.error.base};
  }

  .input-container {
    display: flex;
    align-items: center;

    label {
      display: flex;
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    }

    i {
      margin: 0 ${({ theme }) => theme.gridUnit}px;
    }
  }

  input,
  textarea,
  .Select,
  .ant-select {
    flex: 1 1 auto;
  }

  textarea {
    height: 160px;
    resize: none;
  }

  input::placeholder,
  textarea::placeholder,
  .Select__placeholder {
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }

  textarea,
  input[type='text'],
  input[type='number'],
  .Select__control,
  .ant-select-single .ant-select-selector {
    padding: ${({ theme }) => theme.gridUnit * 1.5}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border-style: none;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;

    &[name='description'] {
      flex: 1 1 auto;
    }
  }

  .Select__control {
    padding: 2px 0;
  }

  .input-label {
    margin-left: 10px;
  }
`;

const AlertReportModal: FunctionComponent<AlertReportModalProps> = ({
  addDangerToast,
  onAdd,
  onHide,
  show,
  alert = null,
  isReport = false,
}) => {
  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [currentAlert, setCurrentAlert] = useState<AlertObject | null>();
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const isEditMode = alert !== null;

  // TODO: Alert fetch logic
  /* const {
    state: { loading, resource },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<AlertObject>(
    'alert',
    t('alert'),
    addDangerToast,
  ); */

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onSave = () => {
    if (isEditMode) {
      // Edit
      if (currentAlert && currentAlert.id) {
        /* const update_id = currentAlert.id;
        delete currentAlert.id;
        delete currentAlert.created_by;

        updateResource(update_id, currentAlert).then(() => {
          if (onAdd) {
            onAdd();
          }

          hide();
        }); */
        hide();
      }
    } else if (currentAlert) {
      // Create
      /* createResource(currentAlert).then(response => {
        if (onAdd) {
          onAdd(response);
        }

        hide();
      }); */
      hide();
    }
  };

  // Fetch data to populate form dropdowns
  const loadOwnerOptions = (input = '') => {
    const query = rison.encode({ filter: input });
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard/related/owners?q=${query}`,
    }).then(
      response => {
        return response.json.result.map(item => ({
          value: item.value,
          label: item.text,
        }));
      },
      badResponse => {
        handleErrorResponse(badResponse);
        return [];
      },
    );
  };

  // Updating alert/report state
  const updateAlertState = (name: string, value: any) => {
    const data = {
      ...currentAlert,
      // name: currentAlert ? currentAlert.name : '', // TODO: do we need this?
    };

    data[name] = value;
    setCurrentAlert(data);
  };

  // Handle input/textarea updates
  const onTextChange = (
    event:
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { target } = event;

    updateAlertState(target.name, target.value);
  };

  const onOwnersChange = (value: Array<Owner>) => {
    updateAlertState('owners', value || []);
  };

  const onActiveSwitch = (checked: boolean) => {
    updateAlertState('active', checked);
  };

  const onConditionChange = (condition) => {
    updateAlertState('condition_operator', condition);
  };

  const onScheduleFormatChange = (event: React.ChangeEvent) => {
    const { target } = event;

    updateAlertState('schedule_format', target.value);
  };

  const validate = () => {
    if (
      currentAlert &&
      currentAlert.name.length &&
      currentAlert.owners.length
    ) {
      setDisableSave(false);
    } else {
      setDisableSave(true);
    }
  };

  // Initialize
  if (
    isEditMode &&
    (!currentAlert ||
      !currentAlert.id ||
      (alert && alert.id !== currentAlert.id) ||
      (isHidden && show))
  ) {
    if (alert && alert.id !== null /* && !loading */) {
      /* const id = alert.id || 0;

      fetchResource(id).then(() => {
        setCurrentAlert(resource);
      }); */
    }
  } else if (
    !isEditMode &&
    (!currentAlert || currentAlert.id || (isHidden && show))
  ) {
    // TODO: update to match expected type variables
    setCurrentAlert({
      name: '',
      owners: [],
      active: true,
    });
  }

  // Validation
  useEffect(
    () => {
      validate();
    },
    currentAlert ? [currentAlert.name, currentAlert.owners] : [],
  );

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  // Dropdown options
  const conditionOptions = CONDITIONS.map(condition => {
    return (<Select.Option value={condition}>{condition}</Select.Option>
  });

  return (
    <Modal
      className="no-content-padding"
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      show={show}
      width="100%"
      title={
        <h4 data-test="alert-modal-title">
          {isEditMode ? (
            <StyledIcon name="edit-alt" />
          ) : (
            <StyledIcon name="plus-large" />
          )}
          {isEditMode
            ? t(`Edit ${isReport ? 'Report' : 'Alert'}`)
            : t(`Add ${isReport ? 'Report' : 'Alert'}`)}
        </h4>
      }
    >
      <StyledSectionContainer>
        <div className="header-section">
          <StyledInputContainer>
            <div className="control-label">
              {t('Alert Name')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="name"
                value={currentAlert ? currentAlert.name : ''}
                placeholder={t('Alert Name')}
                onChange={onTextChange}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">
              {t('Owners')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <AsyncSelect
                name="owners"
                isMulti
                value={currentAlert ? currentAlert.owners : []}
                loadOptions={loadOwnerOptions}
                defaultOptions // load options on render
                cacheOptions
                onChange={onOwnersChange}
                // disabled={!isDashboardLoaded}
                filterOption={null} // options are filtered at the api
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">{t('Description')}</div>
            <div className="input-container">
              <input
                type="text"
                name="description"
                value={currentAlert ? currentAlert.description || '' : ''}
                placeholder={t('Description')}
                onChange={onTextChange}
              />
            </div>
          </StyledInputContainer>
          <StyledSwitchContainer>
            <Switch onChange={onActiveSwitch} checked={currentAlert ? currentAlert.active : true}/>
            <div className="switch-label">Active</div>
          </StyledSwitchContainer>
        </div>
        <div className="column-section">
          {!isReport && (
            <div className="column condition">
              <StyledSectionTitle>
                <h4>{t('Alert Condition')}</h4>
              </StyledSectionTitle>
              <StyledInputContainer>
                <div className="control-label">
                  {t('Source')}
                  <span className="required">*</span>
                </div>
                <div className="input-container">
                  <input
                    type="text"
                    name="source"
                    value={currentAlert ? currentAlert.source : ''}
                    placeholder={t('Source')}
                    onChange={onTextChange}
                  />
                </div>
              </StyledInputContainer>
              <StyledInputContainer>
                <div className="control-label">
                  {t('SQL Query')}
                  <span className="required">*</span>
                </div>
                <div className="input-container">
                  <textarea
                    name="query"
                    value={currentAlert ? currentAlert.query : ''}
                    onChange={onTextChange}
                  />
                </div>
              </StyledInputContainer>
              <div className="inline-container">
                <StyledInputContainer>
                  <div className="control-label">
                    {t('Alert If...')}
                    <span className="required">*</span>
                  </div>
                  <div className="input-container">
                    <Select
                      onChange={onConditionChange}
                      placeholder="Condition"
                      defaultValue={currentAlert ? currentAlert.condition_operator || null : null}
                    >
                      {conditionOptions}
                    </Select>
                  </div>
                </StyledInputContainer>
                <StyledInputContainer>
                  <div className="control-label">
                    {t('Value')}
                    <span className="required">*</span>
                  </div>
                  <div className="input-container">
                    <input
                      type="text"
                      name="alert_condition_val"
                      value={
                        currentAlert ? currentAlert.alert_condition_val : ''
                      }
                      placeholder={t('Value')}
                      onChange={onTextChange}
                    />
                  </div>
                </StyledInputContainer>
              </div>
            </div>
          )}
          <div className="column schedule">
            <StyledSectionTitle>
              <h4>{t('Alert Condition Schedule')}</h4>
            </StyledSectionTitle>
            <Radio.Group
              onChange={onScheduleFormatChange}
              value={currentAlert ? currentAlert.schedule_format || 'dropdown-format' : 'dropdown-format'}
            >
              <div className="inline-container format-option">
                <Radio value="dropdown-format"/>
                <span className="input-label">Every x Minutes (should be set of dropdown options)</span>
              </div>
              <div className="inline-container format-option">
                <Radio value="cron-format"/>
                <span className="input-label">CRON Schedule</span>
                <StyledInputContainer className="styled-input">
                  <div className="input-container">
                    <input
                      type="text"
                      name="cron_string"
                      value={currentAlert ? currentAlert.cron_string || '' : ''}
                      placeholder={t('CRON Expression')}
                      onChange={onTextChange}
                    />
                  </div>
                </StyledInputContainer>
              </div>
            </Radio.Group>
            <StyledSectionTitle>
              <h4>{t('Schedule Settings')}</h4>
            </StyledSectionTitle>
            <StyledInputContainer>
              <div className="control-label">
                {t('Log Retention')}
                <span className="required">*</span>
              </div>
              <div className="input-container">
                <input
                  type="text"
                  name="log_retention"
                  value={currentAlert ? currentAlert.log_retention : ''}
                  placeholder={t('Should Be Dropdown')}
                  onChange={onTextChange}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="control-label">{t('Grace Period')}</div>
              <div className="input-container">
                <input
                  type="number"
                  name="grace_period"
                  value={currentAlert ? currentAlert.grace_period : ''}
                  placeholder={t('Time in seconds')}
                  onChange={onTextChange}
                />
                <span className="input-label">seconds</span>
              </div>
            </StyledInputContainer>
          </div>
          <div className="column message">
            <StyledSectionTitle>
              <h4>{t('Message Content')}</h4>
            </StyledSectionTitle>
            <div className="inline-container">
              Dashboard/Chart radio buttons here
            </div>
            <div>Dashboard/Chart dropdown select here</div>
            <StyledSectionTitle>
              <h4>{t('Notification Method')}</h4>
            </StyledSectionTitle>
          </div>
        </div>
      </StyledSectionContainer>
    </Modal>
  );
};

export default withToasts(AlertReportModal);
