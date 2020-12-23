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
import { useSingleViewResource } from 'src/views/CRUD/hooks';

import Icon from 'src/components/Icon';
import Modal from 'src/common/components/Modal';
import { Switch } from 'src/common/components/Switch';
import { GraySelect as Select } from 'src/common/components/Select';
import { Radio } from 'src/common/components/Radio';
import { AsyncSelect } from 'src/components/Select';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import Owner from 'src/types/Owner';

import { AlertReportCronScheduler } from './components/AlertReportCronScheduler';
import { AlertObject, Operator, Recipient, MetaObject } from './types';

const SELECT_PAGE_SIZE = 2000; // temporary fix for paginated query

type SelectValue = {
  value: string;
  label: string;
};

interface AlertReportModalProps {
  addDangerToast: (msg: string) => void;
  alert?: AlertObject | null;
  isReport?: boolean;
  onAdd?: (alert?: AlertObject) => void;
  onHide: () => void;
  show: boolean;
}

const NOTIFICATION_METHODS: NotificationMethod[] = ['Email', 'Slack'];

const CONDITIONS = [
  {
    label: t('< (Smaller than)'),
    value: '<',
  },
  {
    label: t('> (Larger than)'),
    value: '>',
  },
  {
    label: t('<= (Smaller or equal)'),
    value: '<=',
  },
  {
    label: t('>= (Larger or equal)'),
    value: '>=',
  },
  {
    label: t('== (Is Equal)'),
    value: '==',
  },
  {
    label: t('!= (Is Not Equal)'),
    value: '!=',
  },
  {
    label: t('Not Null'),
    value: 'not null',
  },
];

const RETENTION_OPTIONS = [
  {
    label: t('None'),
    value: 0,
  },
  {
    label: t('30 days'),
    value: 30,
  },
  {
    label: t('60 days'),
    value: 60,
  },
  {
    label: t('90 days'),
    value: 90,
  },
];

const DEFAULT_RETENTION = 90;
const DEFAULT_WORKING_TIMEOUT = 3600;
const DEFAULT_CRON_VALUE = '* * * * *'; // every minute

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const StyledSectionContainer = styled.div`
  display: flex;
  min-width: 1000px;
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
      min-width: calc(33.33% - ${({ theme }) => theme.gridUnit * 8}px);
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
    &.wrap {
      flex-wrap: wrap;
    }

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

export const StyledInputContainer = styled.div`
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

  input[disabled] {
    color: ${({ theme }) => theme.colors.grayscale.base};
  }

  textarea {
    height: 300px;
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

    .ant-select-selection-placeholder,
    .ant-select-selection-item {
      line-height: 24px;
    }

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
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
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
  if (status === 'hidden') {
    return null;
  }

  const checkStatus = () => {
    if (status !== 'disabled') {
      onClick();
    }
  };

  return (
    <StyledNotificationAddButton className={status} onClick={checkStatus}>
      <i className="fa fa-plus" />{' '}
      {status === 'active'
        ? t('Add notification method')
        : t('Add delivery method')}
    </StyledNotificationAddButton>
  );
};

type NotificationMethod = 'Email' | 'Slack';

type NotificationSetting = {
  method?: NotificationMethod;
  recipients: string;
  options: NotificationMethod[];
};

interface NotificationMethodProps {
  setting?: NotificationSetting | null;
  index: number;
  onUpdate?: (index: number, updatedSetting: NotificationSetting) => void;
  onRemove?: (index: number) => void;
}

const NotificationMethod: FunctionComponent<NotificationMethodProps> = ({
  setting = null,
  index,
  onUpdate,
  onRemove,
}) => {
  const { method, recipients, options } = setting || {};
  const [recipientValue, setRecipientValue] = useState<string>(
    recipients || '',
  );

  if (!setting) {
    return null;
  }

  const onMethodChange = (method: NotificationMethod) => {
    // Since we're swapping the method, reset the recipients
    setRecipientValue('');

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        method,
        recipients: '',
      };

      onUpdate(index, updatedSetting);
    }
  };

  const onRecipientsChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const { target } = event;

    setRecipientValue(target.value);

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        recipients: target.value,
      };

      onUpdate(index, updatedSetting);
    }
  };

  // Set recipients
  if (!!recipients && recipientValue !== recipients) {
    setRecipientValue(recipients);
  }

  const methodOptions = (options || []).map((method: NotificationMethod) => {
    return (
      <Select.Option key={method} value={method}>
        {t(method)}
      </Select.Option>
    );
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
              value={method}
            >
              {methodOptions}
            </Select>
          </div>
        </StyledInputContainer>
        {method !== undefined && !!onRemove ? (
          <span
            role="button"
            tabIndex={0}
            className="delete-button"
            onClick={() => onRemove(index)}
          >
            <Icon name="trash" />
          </span>
        ) : null}
      </div>
      {method !== undefined ? (
        <StyledInputContainer>
          <div className="control-label">{t(method)}</div>
          <div className="input-container">
            <textarea
              name="recipients"
              value={recipientValue}
              onChange={onRecipientsChange}
            />
          </div>
        </StyledInputContainer>
      ) : null}
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
  const [currentAlert, setCurrentAlert] = useState<Partial<
    AlertObject
  > | null>();
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const [contentType, setContentType] = useState<string>('dashboard');

  // Dropdown options
  const [conditionNotNull, setConditionNotNull] = useState<boolean>(false);
  const [sourceOptions, setSourceOptions] = useState<MetaObject[]>([]);
  const [dashboardOptions, setDashboardOptions] = useState<MetaObject[]>([]);
  const [chartOptions, setChartOptions] = useState<MetaObject[]>([]);

  const isEditMode = alert !== null;

  const [notificationAddState, setNotificationAddState] = useState<
    NotificationAddStatus
  >('active');
  const [notificationSettings, setNotificationSettings] = useState<
    NotificationSetting[]
  >([]);

  const onNotificationAdd = () => {
    const settings: NotificationSetting[] = notificationSettings.slice();

    settings.push({
      recipients: '',
      options: NOTIFICATION_METHODS, // TODO: Need better logic for this
    });

    setNotificationSettings(settings);
    setNotificationAddState(
      settings.length === NOTIFICATION_METHODS.length ? 'hidden' : 'disabled',
    );
  };

  const updateNotificationSetting = (
    index: number,
    setting: NotificationSetting,
  ) => {
    const settings = notificationSettings.slice();

    settings[index] = setting;
    setNotificationSettings(settings);

    if (setting.method !== undefined && notificationAddState !== 'hidden') {
      setNotificationAddState('active');
    }
  };

  const removeNotificationSetting = (index: number) => {
    const settings = notificationSettings.slice();

    settings.splice(index, 1);
    setNotificationSettings(settings);
    setNotificationAddState('active');
  };

  // Alert fetch logic
  const {
    state: { loading, resource, error: fetchError },
    fetchResource,
    createResource,
    updateResource,
  } = useSingleViewResource<AlertObject>('report', t('report'), addDangerToast);

  // Functions
  const hide = () => {
    setIsHidden(true);
    onHide();
  };

  const onSave = () => {
    // Notification Settings
    const recipients: Recipient[] = [];

    notificationSettings.forEach(setting => {
      if (setting.method && setting.recipients.length) {
        recipients.push({
          recipient_config_json: {
            target: setting.recipients,
          },
          type: setting.method,
        });
      }
    });

    const data: any = {
      ...currentAlert,
      type: isReport ? 'Report' : 'Alert',
      validator_type: conditionNotNull ? 'not null' : 'operator',
      validator_config_json: conditionNotNull
        ? {}
        : currentAlert?.validator_config_json,
      chart: contentType === 'chart' ? currentAlert?.chart?.value : undefined,
      dashboard:
        contentType === 'dashboard'
          ? currentAlert?.dashboard?.value
          : undefined,
      database: currentAlert?.database?.value,
      owners: (currentAlert?.owners || []).map(
        owner => (owner as MetaObject).value,
      ),
      recipients,
    };

    if (data.recipients && !data.recipients.length) {
      delete data.recipients;
    }

    data.context_markdown = 'string';

    if (isEditMode) {
      // Edit
      if (currentAlert && currentAlert.id) {
        const update_id = currentAlert.id;

        delete data.id;
        delete data.created_by;
        delete data.last_eval_dttm;
        delete data.last_state;
        delete data.last_value;
        delete data.last_value_row_json;

        updateResource(update_id, data).then(response => {
          if (!response) {
            return;
          }

          if (onAdd) {
            onAdd();
          }

          hide();
        });
      }
    } else if (currentAlert) {
      // Create
      createResource(data).then(response => {
        if (!response) {
          return;
        }

        if (onAdd) {
          onAdd(response);
        }

        hide();
      });
    }
  };

  // Fetch data to populate form dropdowns
  const loadOwnerOptions = (input = '') => {
    const query = rison.encode({ filter: input, page_size: SELECT_PAGE_SIZE });
    return SupersetClient.get({
      endpoint: `/api/v1/report/related/owners?q=${query}`,
    }).then(
      response => {
        return response.json.result.map((item: any) => ({
          value: item.value,
          label: item.text,
        }));
      },
      badResponse => {
        return [];
      },
    );
  };

  const loadSourceOptions = (input = '') => {
    const query = rison.encode({ filter: input, page_size: SELECT_PAGE_SIZE });
    return SupersetClient.get({
      endpoint: `/api/v1/report/related/database?q=${query}`,
    }).then(
      response => {
        const list = response.json.result.map((item: any) => ({
          value: item.value,
          label: item.text,
        }));

        setSourceOptions(list);

        // Find source if current alert has one set
        if (
          currentAlert &&
          currentAlert.database &&
          !currentAlert.database.label
        ) {
          updateAlertState('database', getSourceData());
        }

        return list;
      },
      badResponse => {
        return [];
      },
    );
  };

  const getSourceData = (db?: MetaObject) => {
    const database = db || currentAlert?.database;

    if (!database || database.label) {
      return null;
    }

    let result;

    // Cycle through source options to find the selected option
    sourceOptions.forEach(source => {
      if (source.value === database.value || source.value === database.id) {
        result = source;
      }
    });

    return result;
  };

  const loadDashboardOptions = (input = '') => {
    const query = rison.encode({ filter: input, page_size: SELECT_PAGE_SIZE });
    return SupersetClient.get({
      endpoint: `/api/v1/report/related/dashboard?q=${query}`,
    }).then(
      response => {
        const list = response.json.result.map((item: any) => ({
          value: item.value,
          label: item.text,
        }));

        setDashboardOptions(list);

        // Find source if current alert has one set
        if (
          currentAlert &&
          currentAlert.dashboard &&
          !currentAlert.dashboard.label
        ) {
          updateAlertState('dashboard', getDashboardData());
        }

        return list;
      },
      badResponse => {
        return [];
      },
    );
  };

  const getDashboardData = (db?: MetaObject) => {
    const dashboard = db || currentAlert?.dashboard;

    if (!dashboard || dashboard.label) {
      return null;
    }

    let result;

    // Cycle through dashboard options to find the selected option
    dashboardOptions.forEach(dash => {
      if (dash.value === dashboard.value || dash.value === dashboard.id) {
        result = dash;
      }
    });

    return result;
  };

  const loadChartOptions = (input = '') => {
    const query = rison.encode({ filter: input, page_size: SELECT_PAGE_SIZE });
    return SupersetClient.get({
      endpoint: `/api/v1/report/related/chart?q=${query}`,
    }).then(
      response => {
        const list = response.json.result.map((item: any) => ({
          value: item.value,
          label: item.text,
        }));

        setChartOptions(list);

        // Find source if current alert has one set
        if (currentAlert && currentAlert.chart && !currentAlert.chart.label) {
          updateAlertState('chart', getChartData());
        }

        return list;
      },
      badResponse => {
        return [];
      },
    );
  };

  const getChartData = (chartData?: MetaObject) => {
    const chart = chartData || currentAlert?.chart;

    if (!chart || chart.label) {
      return null;
    }

    let result;

    // Cycle through chart options to find the selected option
    chartOptions.forEach(slice => {
      if (slice.value === chart.value || slice.value === chart.id) {
        result = slice;
      }
    });

    return result;
  };

  // Updating alert/report state
  const updateAlertState = (name: string, value: any) => {
    setCurrentAlert(currentAlertData => ({
      ...currentAlertData,
      [name]: value,
    }));
  };

  // Handle input/textarea updates
  const onTextChange = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const { target } = event;

    updateAlertState(target.name, target.value);
  };

  const onOwnersChange = (value: Array<Owner>) => {
    updateAlertState('owners', value || []);
  };

  const onSourceChange = (value: Array<Owner>) => {
    updateAlertState('database', value || []);
  };

  const onDashboardChange = (dashboard: SelectValue) => {
    updateAlertState('dashboard', dashboard || undefined);
  };

  const onChartChange = (chart: SelectValue) => {
    updateAlertState('chart', chart || undefined);
  };

  const onActiveSwitch = (checked: boolean) => {
    updateAlertState('active', checked);
  };

  const onConditionChange = (op: Operator) => {
    setConditionNotNull(op === 'not null');

    const config = {
      op,
      threshold: currentAlert
        ? currentAlert.validator_config_json?.threshold
        : undefined,
    };

    updateAlertState('validator_config_json', config);
  };

  const onThresholdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { target } = event;

    const config = {
      op: currentAlert ? currentAlert.validator_config_json?.op : undefined,
      threshold: target.value,
    };

    updateAlertState('validator_config_json', config);
  };

  const onLogRetentionChange = (retention: number) => {
    updateAlertState('log_retention', retention);
  };

  const onContentTypeChange = (event: any) => {
    const { target } = event;

    setContentType(target.value);
  };

  // Make sure notification settings has the required info
  const checkNotificationSettings = () => {
    if (!notificationSettings.length) {
      return false;
    }

    let hasInfo = false;

    notificationSettings.forEach(setting => {
      if (!!setting.method && setting.recipients?.length) {
        hasInfo = true;
      }
    });

    return hasInfo;
  };

  const validate = () => {
    if (
      currentAlert &&
      currentAlert.name?.length &&
      currentAlert.owners?.length &&
      currentAlert.crontab?.length &&
      currentAlert.working_timeout !== undefined &&
      ((contentType === 'dashboard' && !!currentAlert.dashboard) ||
        (contentType === 'chart' && !!currentAlert.chart)) &&
      checkNotificationSettings()
    ) {
      if (isReport) {
        setDisableSave(false);
      } else if (
        !!currentAlert.database &&
        currentAlert.sql?.length &&
        (conditionNotNull || !!currentAlert.validator_config_json?.op) &&
        (conditionNotNull ||
          currentAlert.validator_config_json?.threshold !== undefined)
      ) {
        setDisableSave(false);
      } else {
        setDisableSave(true);
      }
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
    if (alert && alert.id !== null && !loading && !fetchError) {
      const id = alert.id || 0;

      fetchResource(id).then(() => {
        if (resource) {
          // Add notification settings
          const settings = (resource.recipients || []).map(setting => ({
            method: setting.type as NotificationMethod,
            // @ts-ignore: Type not assignable
            recipients:
              typeof setting.recipient_config_json === 'string'
                ? (JSON.parse(setting.recipient_config_json) || {}).target
                : setting.recipient_config_json,
            options: NOTIFICATION_METHODS as NotificationMethod[], // Need better logic for this
          }));

          setNotificationSettings(settings);
          setContentType(resource.chart ? 'chart' : 'dashboard');

          const validatorConfig =
            typeof resource.validator_config_json === 'string'
              ? JSON.parse(resource.validator_config_json)
              : resource.validator_config_json;

          setConditionNotNull(resource.validator_type === 'not null');

          setCurrentAlert({
            ...resource,
            chart: resource.chart
              ? getChartData(resource.chart) || { value: resource.chart.id }
              : undefined,
            dashboard: resource.dashboard
              ? getDashboardData(resource.dashboard) || {
                  value: resource.dashboard.id,
                }
              : undefined,
            database: resource.database
              ? getSourceData(resource.database) || {
                  value: resource.database.id,
                }
              : undefined,
            owners: (resource.owners || []).map(owner => ({
              value: owner.id,
              label: `${(owner as Owner).first_name} ${
                (owner as Owner).last_name
              }`,
            })),
            // @ts-ignore: Type not assignable
            validator_config_json:
              resource.validator_type === 'not null'
                ? {
                    op: 'not null',
                  }
                : validatorConfig,
          });
        }
      });
    }
  } else if (
    !isEditMode &&
    (!currentAlert || currentAlert.id || (isHidden && show))
  ) {
    setCurrentAlert({
      active: true,
      crontab: DEFAULT_CRON_VALUE,
      log_retention: DEFAULT_RETENTION,
      working_timeout: DEFAULT_WORKING_TIMEOUT,
      name: '',
      owners: [],
      recipients: [],
      sql: '',
      validator_config_json: {},
      validator_type: '',
    });

    setNotificationSettings([]);
    setNotificationAddState('active');
  }

  // Validation
  useEffect(
    () => {
      validate();
    },
    currentAlert
      ? [
          currentAlert.name,
          currentAlert.owners,
          currentAlert.database,
          currentAlert.sql,
          currentAlert.validator_config_json,
          currentAlert.crontab,
          currentAlert.working_timeout,
          currentAlert.dashboard,
          currentAlert.chart,
          contentType,
          notificationSettings,
          conditionNotNull,
        ]
      : [],
  );

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  // Dropdown options
  const conditionOptions = CONDITIONS.map(condition => {
    return (
      <Select.Option key={condition.value} value={condition.value}>
        {condition.label}
      </Select.Option>
    );
  });

  const retentionOptions = RETENTION_OPTIONS.map(option => {
    return (
      <Select.Option key={option.value} value={option.value}>
        {option.label}
      </Select.Option>
    );
  });

  return (
    <Modal
      className="no-content-padding"
      responsive
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      show={show}
      width="100%"
      maxWidth="1450px"
      title={
        <h4 data-test="alert-report-modal-title">
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
              {isReport ? t('Report Name') : t('Alert Name')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="name"
                value={currentAlert ? currentAlert.name : ''}
                placeholder={isReport ? t('Report Name') : t('Alert Name')}
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
            <Switch
              onChange={onActiveSwitch}
              checked={currentAlert ? currentAlert.active : true}
            />
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
                  <AsyncSelect
                    name="source"
                    value={
                      currentAlert && currentAlert.database
                        ? {
                            value: currentAlert.database.value,
                            label: currentAlert.database.label,
                          }
                        : undefined
                    }
                    loadOptions={loadSourceOptions}
                    defaultOptions // load options on render
                    cacheOptions
                    onChange={onSourceChange}
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
                    name="sql"
                    value={currentAlert ? currentAlert.sql || '' : ''}
                    onChange={onTextChange}
                  />
                </div>
              </StyledInputContainer>
              <div className="inline-container wrap">
                <StyledInputContainer>
                  <div className="control-label">
                    {t('Trigger Alert If...')}
                    <span className="required">*</span>
                  </div>
                  <div className="input-container">
                    <Select
                      onChange={onConditionChange}
                      placeholder="Condition"
                      defaultValue={
                        currentAlert
                          ? currentAlert.validator_config_json?.op || undefined
                          : undefined
                      }
                      value={
                        currentAlert
                          ? currentAlert.validator_config_json?.op || undefined
                          : undefined
                      }
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
                      name="threshold"
                      disabled={conditionNotNull}
                      value={
                        currentAlert && currentAlert.validator_config_json
                          ? currentAlert.validator_config_json.threshold || ''
                          : ''
                      }
                      placeholder={t('Value')}
                      onChange={onThresholdChange}
                    />
                  </div>
                </StyledInputContainer>
              </div>
            </div>
          )}
          <div className="column schedule">
            <StyledSectionTitle>
              <h4>
                {isReport
                  ? t('Report Schedule')
                  : t('Alert Condition Schedule')}
              </h4>
            </StyledSectionTitle>
            <AlertReportCronScheduler
              value={
                (currentAlert && currentAlert.crontab) || DEFAULT_CRON_VALUE
              }
              onChange={newVal => updateAlertState('crontab', newVal)}
            />
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
                  defaultValue={
                    currentAlert
                      ? currentAlert.log_retention || DEFAULT_RETENTION
                      : DEFAULT_RETENTION
                  }
                  value={
                    currentAlert
                      ? currentAlert.log_retention || DEFAULT_RETENTION
                      : DEFAULT_RETENTION
                  }
                >
                  {retentionOptions}
                </Select>
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="control-label">
                {t('Working Timeout')}
                <span className="required">*</span>
              </div>
              <div className="input-container">
                <input
                  type="number"
                  name="working_timeout"
                  value={currentAlert ? currentAlert.working_timeout : ''}
                  placeholder={t('Time in seconds')}
                  onChange={onTextChange}
                />
                <span className="input-label">seconds</span>
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
              <Radio.Group onChange={onContentTypeChange} value={contentType}>
                <Radio value="dashboard">Dashboard</Radio>
                <Radio value="chart">Chart</Radio>
              </Radio.Group>
            </div>
            <AsyncSelect
              className={
                contentType === 'chart'
                  ? 'async-select'
                  : 'hide-dropdown async-select'
              }
              name="chart"
              value={
                currentAlert && currentAlert.chart
                  ? {
                      value: currentAlert.chart.value,
                      label: currentAlert.chart.label,
                    }
                  : undefined
              }
              loadOptions={loadChartOptions}
              defaultOptions // load options on render
              cacheOptions
              onChange={onChartChange}
            />
            <AsyncSelect
              className={
                contentType === 'dashboard'
                  ? 'async-select'
                  : 'hide-dropdown async-select'
              }
              name="dashboard"
              value={
                currentAlert && currentAlert.dashboard
                  ? {
                      value: currentAlert.dashboard.value,
                      label: currentAlert.dashboard.label,
                    }
                  : undefined
              }
              loadOptions={loadDashboardOptions}
              defaultOptions // load options on render
              cacheOptions
              onChange={onDashboardChange}
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
            <NotificationMethodAdd
              status={notificationAddState}
              onClick={onNotificationAdd}
            />
          </div>
        </div>
      </StyledSectionContainer>
    </Modal>
  );
};

export default withToasts(AlertReportModal);
