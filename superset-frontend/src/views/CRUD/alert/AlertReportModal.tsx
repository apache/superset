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

const NOTIFICATION_METHODS = [
  'email',
  'slack',
];

const CONDITIONS = [
  '< (Smaller than)',
  '> (Larger than)',
  '<= (Smaller or equal)',
  '>= (Larger or equal)',
  '== (Is Equal)',
  '!= (Is Not Equal)',
];

const RETENTION_OPTIONS = [
  'None',
  '30 days',
  '60 days',
  '90 days',
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

      .async-select {
        margin: 10px 0 20px;
      }

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

    &.add-margin {
      margin-bottom: 5px;
    }

    .styled-input {
      margin: 0 0 0 10px;

      input {
        flex: 0 0 auto;
      }
    }
  }

  .hide-dropdown {
    display: none;
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

// Notification Method components
const StyledNotificationAddButton = styled.div`
  color: ${({ theme }) => theme.colors.primary.dark1};
  cursor: pointer;

  i {
    margin-right: ${({ theme }) => theme.gridUnit * 2}px
  }

  &.disabled {
    color: ${({ theme }) => theme.colors.grayscale.light1};
    cursor: default;
  }
`;

const StyledNotificationMethod = styled.div`
  margin-bottom: 10px;

  .input-container {
    textarea {
      height: auto;
    }
  }

  .inline-container {
    margin-bottom: 10px;

    .input-container {
      margin-left: 10px;
    }

    > div {
      margin: 0;
    }

    .delete-button {
      margin-left: 10px;
      padding-top: 3px;
    }
  }
`;

type NotificationAddStatus = 'active' | 'disabled' | 'hidden';

interface NotificationMethodAddProps {
  status: NotificationAddStatus;
  onClick: () => void;
}

const NotificationMethodAdd: FunctionComponent<NotificationMethodAddProps> = ({
  status = 'active',
  onClick,
}) => {
  if ( status === 'hidden' ) {
    return null;
  }

  const checkStatus = () => {
    if ( status !== 'disabled' ) {
      onClick();
    }
  };

  return (
    <StyledNotificationAddButton className={status} onClick={checkStatus}>
      <i className="fa fa-plus" /> {status === 'active' ? t('Add notification method') : t('Add delivery method')}
    </StyledNotificationAddButton>
  );
};

type NotificationMethod = 'email' | 'slack' | null;

type NotificationSetting = {
  method: NotificationMethod;
  recipients: string;
  options: NotificationMethod[];
};

interface NotificationMethodProps {
  setting?: NotificationSetting | null;
  index: number;
  onUpdate?: (index: number, method: NotificationMethod, recipients: string) => void;
  onRemove?: (index: number) => void;
}

const NotificationMethod: FunctionComponent<NotificationMethodProps> = ({
  setting = null,
  index,
  onUpdate,
  onRemove,
}) => {
  if (!setting) {
    return null;
  };

  const { method, recipients, options } = setting;
  const [recipientValue, setRecipientValue] = useState<string>(recipients || '');

  const onMethodChange = (method: NotificationMethod) => {
    console.log('method', method);
    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        method,
        recipients: '',
      };

      console.log('updated setting', updatedSetting);
      onUpdate(index, updatedSetting);
    }
  };

  const onRecipientsChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { target } = event;

    setRecipientValue(target.value);
  };

  const methodOptions = options.map((method: NotificationMethod) => {
    return (<Select.Option key={method} value={method}>{method}</Select.Option>
  });

  return (
    <StyledNotificationMethod>
      <div className="inline-container">
        <StyledInputContainer>
          <div className="input-container">
            <Select
              onChange={onMethodChange}
              placeholder="Select Delivery Method"
              defaultValue={method}
            >
              {methodOptions}
            </Select>
          </div>
        </StyledInputContainer>
        {method !== null && !!onRemove ?
          (<span
            role="button"
            tabIndex={0}
            className="delete-button"
            onClick={() => onRemove(index)}
          >
            <Icon name="trash" />
          </span>)
          : null
        }
      </div>
      {method !== null ?
        (<StyledInputContainer>
          <div className="control-label">
            {t(method)}
          </div>
          <div className="input-container">
            <textarea
              name="recipients"
              value={recipientValue}
              onChange={onRecipientsChange}
            />
          </div>
        </StyledInputContainer>)
        : null
      }
    </StyledNotificationMethod>
  );
};

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
  const [contentType, setContentType] = useState<string>(alert ? alert.content_type || 'dashboard' : 'dashboard');
  const isEditMode = alert !== null;

  // TODO: need to set status/settings list based on alert's notification settings
  const [notificationAddState, setNotificationAddState] = useState<NotificationAddStatus>('active');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSetting[]>([]);

  const onNotificationAdd = () => {
    const settings: NotificationSetting[] = notificationSettings.slice();

    settings.push({
      method: null,
      recipients: '',
      options: ['email', 'slack'], // Need better logic for this
    });

    setNotificationSettings(settings);
    setNotificationAddState(settings.length === NOTIFICATION_METHODS.length ? 'hidden' : 'disabled');
  };

  const updateNotificationSetting = (index: number, setting: NotificationSetting) => {
    let settings = notificationSettings.slice();

    settings[index] = setting;
    setNotificationSettings(settings);

    if (setting.method !== null && notificationAddState !== 'hidden') {
      setNotificationAddState('active');
    }
  };

  const removeNotificationSetting = (index: number) => {
    let settings = notificationSettings.slice();

    settings.splice(index, 1);
    setNotificationSettings(settings);
    setNotificationAddState('active');
  };

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

  const loadDashboardOptions = (input = '') => {
    const query = rison.encode({ filter: input });
    return SupersetClient.get({
      endpoint: `/api/v1/dashboard?q=${query}`,
    }).then(
      response => {
        return response.json.result.map(item => ({
          value: item.id,
          label: item.dashboard_title,
        }));
      },
      badResponse => {
        handleErrorResponse(badResponse);
        return [];
      },
    );
  };

  const loadChartOptions = (input = '') => {
    const query = rison.encode({ filter: input });
    return SupersetClient.get({
      endpoint: `/api/v1/chart?q=${query}`,
    }).then(
      response => {
        return response.json.result.map(item => ({
          value: item.id,
          label: item.slice_name,
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

  const onDashboardChange = (value: number) => {
    updateAlertState('dashboard', value || null);
  };

  const onChartChange = (value: number) => {
    updateAlertState('chart', value || null);
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

  const onLogRetentionChange = (retention) => {
    updateAlertState('log_retention', retention);
  };

  const onContentTypeChange = (event: React.ChangeEvent) => {
    const { target } = event;

    updateAlertState('content_type', target.value);
    setContentType(target.value);
  };

  const validate = () => {
    if (
      currentAlert &&
      currentAlert.label.length &&
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
      label: '',
      owners: [],
      active: true,
    });

    setNotificationSettings([]);
    setNotificationAddState('active');
  }

  // Validation
  useEffect(
    () => {
      validate();
    },
    currentAlert ? [currentAlert.label, currentAlert.owners] : [],
  );

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  // Dropdown options
  const conditionOptions = CONDITIONS.map(condition => {
    return (<Select.Option value={condition}>{condition}</Select.Option>
  });

  const retentionOptions = RETENTION_OPTIONS.map(option => {
    return (<Select.Option value={option}>{option}</Select.Option>
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
                name="label"
                value={currentAlert ? currentAlert.label : ''}
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
                      type="number"
                      name="condition_value"
                      value={
                        currentAlert ? currentAlert.condition_value : ''
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
              <div className="inline-container add-margin">
                <Radio value="dropdown-format"/>
                <span className="input-label">Every x Minutes (should be set of dropdown options)</span>
              </div>
              <div className="inline-container add-margin">
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
                <Select
                  onChange={onLogRetentionChange}
                  placeholder
                  defaultValue={currentAlert ? currentAlert.log_retention || '90 days' : '90 days'}
                >
                  {retentionOptions}
                </Select>
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
            <div className="inline-container add-margin">
              <Radio.Group
                onChange={onContentTypeChange}
                value={currentAlert ? currentAlert.content_type || 'dashboard' : 'dashboard'}
              >
                <Radio value="dashboard">Dashboard</Radio>
                <Radio value="chart">Chart</Radio>
              </Radio.Group>
            </div>
            <AsyncSelect
              className={contentType === 'chart' ? 'async-select' : 'hide-dropdown async-select'}
              name="chart"
              value={currentAlert ? currentAlert.chart : null}
              loadOptions={loadChartOptions}
              defaultOptions // load options on render
              cacheOptions
              onChange={onChartChange}
              filterOption={null} // options are filtered at the api
            />
            <AsyncSelect
              className={contentType === 'dashboard' ? 'async-select' : 'hide-dropdown async-select'}
              name="dashboard"
              value={currentAlert ? currentAlert.dashboard : null}
              loadOptions={loadDashboardOptions}
              defaultOptions // load options on render
              cacheOptions
              onChange={onDashboardChange}
              filterOption={null} // options are filtered at the api
            />
            <StyledSectionTitle>
              <h4>{t('Notification Method')}</h4>
            </StyledSectionTitle>
            <NotificationMethod
              setting={notificationSettings[0]}
              index={0}
              onUpdate={updateNotificationSetting}
              onRemove={removeNotificationSetting}
            />
            <NotificationMethod
              setting={notificationSettings[1]}
              index={1}
              onUpdate={updateNotificationSetting}
              onRemove={removeNotificationSetting}
            />
            <NotificationMethodAdd status={notificationAddState} onClick={onNotificationAdd}/>
          </div>
        </div>
      </StyledSectionContainer>
    </Modal>
  );
};

export default withToasts(AlertReportModal);
