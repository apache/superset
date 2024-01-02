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
import React, {
  FunctionComponent,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  css,
  isFeatureEnabled,
  FeatureFlag,
  styled,
  SupersetClient,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import rison from 'rison';
import { useSingleViewResource } from 'src/views/CRUD/hooks';

import Icons from 'src/components/Icons';
import { Input } from 'src/components/Input';
import { Switch } from 'src/components/Switch';
import Modal from 'src/components/Modal';
import TimezoneSelector from 'src/components/TimezoneSelector';
import { Radio } from 'src/components/Radio';
import { propertyComparator } from 'src/components/Select/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import Owner from 'src/types/Owner';
import { AntdCheckbox, AsyncSelect, Select } from 'src/components';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import { useCommonConf } from 'src/features/databases/state';
import { CustomWidthHeaderStyle } from 'src/features/reports/ReportModal/styles';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import {
  NotificationMethodOption,
  AlertObject,
  ChartObject,
  DashboardObject,
  DatabaseObject,
  MetaObject,
  Operator,
  Recipient,
  AlertsReportsConfig,
} from 'src/features/alerts/types';
import { useSelector } from 'react-redux';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { AlertReportCronScheduler } from './components/AlertReportCronScheduler';
import { NotificationMethod } from './components/NotificationMethod';

const TIMEOUT_MIN = 1;
const TEXT_BASED_VISUALIZATION_TYPES = [
  'pivot_table_v2',
  'table',
  'paired_ttest',
];

type SelectValue = {
  value: string;
  label: string;
};

interface AlertReportModalProps {
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  alert?: AlertObject | null;
  isReport?: boolean;
  onAdd?: (alert?: AlertObject) => void;
  onHide: () => void;
  show: boolean;
}

const DEFAULT_WORKING_TIMEOUT = 3600;
const DEFAULT_CRON_VALUE = '0 * * * *'; // every hour
const DEFAULT_RETENTION = 90;

const DEFAULT_NOTIFICATION_METHODS: NotificationMethodOption[] = ['Email'];
const DEFAULT_NOTIFICATION_FORMAT = 'PNG';
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
    label: t('== (Is equal)'),
    value: '==',
  },
  {
    label: t('!= (Is not equal)'),
    value: '!=',
  },
  {
    label: t('Not null'),
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

const StyledModal = styled(Modal)`
  max-width: 1200px;
  width: 100%;

  .ant-modal-body {
    overflow: initial;
  }
`;

const StyledTooltip = styled(InfoTooltipWithTrigger)`
  margin-left: ${({ theme }) => theme.gridUnit}px;
`;

const StyledIcon = (theme: SupersetTheme) => css`
  margin: auto ${theme.gridUnit * 2}px auto 0;
  color: ${theme.colors.grayscale.base};
`;

const StyledSectionContainer = styled.div`
  display: flex;
  flex-direction: column;

  .control-label {
    margin-top: ${({ theme }) => theme.gridUnit}px;
  }

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
`;

const StyledSectionTitle = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ theme }) => theme.gridUnit * 2}px auto
    ${({ theme }) => theme.gridUnit * 4}px auto;

  h4 {
    margin: 0;
  }

  .required {
    margin-left: ${({ theme }) => theme.gridUnit}px;
    color: ${({ theme }) => theme.colors.error.base};
  }
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
  flex: 1;
  margin-top: 0;

  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type='number'] {
    -moz-appearance: textfield;
  }

  .helper {
    display: block;
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    padding: ${({ theme }) => theme.gridUnit}px 0;
    text-align: left;
  }

  .required {
    margin-left: ${({ theme }) => theme.gridUnit / 2}px;
    color: ${({ theme }) => theme.colors.error.base};
  }

  .input-container {
    display: flex;
    align-items: center;

    > div {
      width: 100%;
    }

    label {
      display: flex;
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    }

    i {
      margin: 0 ${({ theme }) => theme.gridUnit}px;
    }
  }

  input,
  textarea {
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
  textarea::placeholder {
    color: ${({ theme }) => theme.colors.grayscale.light1};
  }

  textarea,
  input[type='text'],
  input[type='number'] {
    padding: ${({ theme }) => theme.gridUnit}px
      ${({ theme }) => theme.gridUnit * 2}px;
    border-style: none;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.gridUnit}px;

    &[name='description'] {
      flex: 1 1 auto;
    }
  }

  .input-label {
    margin-left: 10px;
  }
`;

const StyledRadio = styled(Radio)`
  display: block;
  line-height: ${({ theme }) => theme.gridUnit * 7}px;
`;

const StyledRadioGroup = styled(Radio.Group)`
  margin-left: ${({ theme }) => theme.gridUnit * 5.5}px;
`;

const StyledCheckbox = styled(AntdCheckbox)`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
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

const StyledNotificationMethodWrapper = styled.div`
  .inline-container .input-container {
    margin-left: 0;
  }
`;

const timezoneHeaderStyle = (theme: SupersetTheme) => css`
  margin: ${theme.gridUnit * 3}px 0;
`;

const inputSpacer = (theme: SupersetTheme) => css`
  margin-right: ${theme.gridUnit * 3}px;
`;

type NotificationAddStatus = 'active' | 'disabled' | 'hidden';

interface NotificationMethodAddProps {
  status: NotificationAddStatus;
  onClick: () => void;
}

export const TRANSLATIONS = {
  ADD_NOTIFICATION_METHOD_TEXT: t('Add notification method'),
  ADD_DELIVERY_METHOD_TEXT: t('Add delivery method'),
  SAVE_TEXT: t('Save'),
  ADD_TEXT: t('Add'),
  EDIT_REPORT_TEXT: t('Edit Report'),
  EDIT_ALERT_TEXT: t('Edit Alert'),
  ADD_REPORT_TEXT: t('Add Report'),
  ADD_ALERT_TEXT: t('Add Alert'),
  REPORT_NAME_TEXT: t('Report name'),
  ALERT_NAME_TEXT: t('Alert name'),
  OWNERS_TEXT: t('Owners'),
  DESCRIPTION_TEXT: t('Description'),
  ACTIVE_TEXT: t('Active'),
  ALERT_CONDITION_TEXT: t('Alert condition'),
  DATABASE_TEXT: t('Database'),
  SQL_QUERY_TEXT: t('SQL Query'),
  SQL_QUERY_TOOLTIP: t(
    'The result of this query should be a numeric-esque value',
  ),
  TRIGGER_ALERT_IF_TEXT: t('Trigger Alert If...'),
  CONDITION_TEXT: t('Condition'),
  VALUE_TEXT: t('Value'),
  REPORT_SCHEDULE_TEXT: t('Report schedule'),
  ALERT_CONDITION_SCHEDULE_TEXT: t('Alert condition schedule'),
  TIMEZONE_TEXT: t('Timezone'),
  SCHEDULE_SETTINGS_TEXT: t('Schedule settings'),
  LOG_RETENTION_TEXT: t('Log retention'),
  WORKING_TIMEOUT_TEXT: t('Working timeout'),
  TIME_IN_SECONDS_TEXT: t('Time in seconds'),
  SECONDS_TEXT: t('seconds'),
  GRACE_PERIOD_TEXT: t('Grace period'),
  MESSAGE_CONTENT_TEXT: t('Message content'),
  DASHBOARD_TEXT: t('Dashboard'),
  CHART_TEXT: t('Chart'),
  SEND_AS_PNG_TEXT: t('Send as PNG'),
  SEND_AS_CSV_TEXT: t('Send as CSV'),
  SEND_AS_TEXT: t('Send as text'),
  IGNORE_CACHE_TEXT: t('Ignore cache when generating report'),
  CUSTOM_SCREENSHOT_WIDTH_TEXT: t('Screenshot width'),
  CUSTOM_SCREENSHOT_WIDTH_PLACEHOLDER_TEXT: t('Input custom width in pixels'),
  NOTIFICATION_METHOD_TEXT: t('Notification method'),
};

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
        ? TRANSLATIONS.ADD_NOTIFICATION_METHOD_TEXT
        : TRANSLATIONS.ADD_DELIVERY_METHOD_TEXT}
    </StyledNotificationAddButton>
  );
};

type NotificationSetting = {
  method?: NotificationMethodOption;
  recipients: string;
  options: NotificationMethodOption[];
};

const AlertReportModal: FunctionComponent<AlertReportModalProps> = ({
  addDangerToast,
  onAdd,
  onHide,
  show,
  alert = null,
  isReport = false,
  addSuccessToast,
}) => {
  const currentUser = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const conf = useCommonConf();
  const allowedNotificationMethods: NotificationMethodOption[] =
    conf?.ALERT_REPORTS_NOTIFICATION_METHODS || DEFAULT_NOTIFICATION_METHODS;

  const [disableSave, setDisableSave] = useState<boolean>(true);
  const [currentAlert, setCurrentAlert] =
    useState<Partial<AlertObject> | null>();
  const [isHidden, setIsHidden] = useState<boolean>(true);
  const [contentType, setContentType] = useState<string>('dashboard');
  const [reportFormat, setReportFormat] = useState<string>(
    DEFAULT_NOTIFICATION_FORMAT,
  );
  const [forceScreenshot, setForceScreenshot] = useState<boolean>(false);

  const [isScreenshot, setIsScreenshot] = useState<boolean>(false);
  useEffect(() => {
    setIsScreenshot(
      contentType === 'dashboard' ||
        (contentType === 'chart' && reportFormat === 'PNG'),
    );
  }, [contentType, reportFormat]);

  // Dropdown options
  const [conditionNotNull, setConditionNotNull] = useState<boolean>(false);
  const [sourceOptions, setSourceOptions] = useState<MetaObject[]>([]);
  const [dashboardOptions, setDashboardOptions] = useState<MetaObject[]>([]);
  const [chartOptions, setChartOptions] = useState<MetaObject[]>([]);

  // Chart metadata
  const [chartVizType, setChartVizType] = useState<string>('');

  const isEditMode = alert !== null;
  const formatOptionEnabled =
    contentType === 'chart' &&
    (isFeatureEnabled(FeatureFlag.ALERTS_ATTACH_REPORTS) || isReport);

  const [notificationAddState, setNotificationAddState] =
    useState<NotificationAddStatus>('active');
  const [notificationSettings, setNotificationSettings] = useState<
    NotificationSetting[]
  >([]);

  const onNotificationAdd = () => {
    const settings: NotificationSetting[] = notificationSettings.slice();

    settings.push({
      recipients: '',
      options: allowedNotificationMethods,
    });

    setNotificationSettings(settings);
    setNotificationAddState(
      settings.length === allowedNotificationMethods.length
        ? 'hidden'
        : 'disabled',
    );
  };

  const {
    ALERT_REPORTS_DEFAULT_WORKING_TIMEOUT,
    ALERT_REPORTS_DEFAULT_CRON_VALUE,
    ALERT_REPORTS_DEFAULT_RETENTION,
  } = useSelector<any, AlertsReportsConfig>(state => {
    const conf = state.common?.conf;
    return {
      ALERT_REPORTS_DEFAULT_WORKING_TIMEOUT:
        conf?.ALERT_REPORTS_DEFAULT_WORKING_TIMEOUT ?? DEFAULT_WORKING_TIMEOUT,
      ALERT_REPORTS_DEFAULT_CRON_VALUE:
        conf?.ALERT_REPORTS_DEFAULT_CRON_VALUE ?? DEFAULT_CRON_VALUE,
      ALERT_REPORTS_DEFAULT_RETENTION:
        conf?.ALERT_REPORTS_DEFAULT_RETENTION ?? DEFAULT_RETENTION,
    };
  });

  const defaultAlert = {
    active: true,
    creation_method: 'alerts_reports',
    crontab: ALERT_REPORTS_DEFAULT_CRON_VALUE,
    log_retention: ALERT_REPORTS_DEFAULT_RETENTION,
    working_timeout: ALERT_REPORTS_DEFAULT_WORKING_TIMEOUT,
    name: '',
    owners: [],
    recipients: [],
    sql: '',
    validator_config_json: {},
    validator_type: '',
    force_screenshot: false,
    grace_period: undefined,
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
    clearError,
  } = useSingleViewResource<AlertObject>('report', t('report'), addDangerToast);

  // Functions
  const hide = () => {
    clearError();
    setIsHidden(true);
    onHide();
    setNotificationSettings([]);
    setCurrentAlert({ ...defaultAlert });
    setNotificationAddState('active');
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

    const shouldEnableForceScreenshot = contentType === 'chart' && !isReport;
    const data: any = {
      ...currentAlert,
      type: isReport ? 'Report' : 'Alert',
      force_screenshot: shouldEnableForceScreenshot || forceScreenshot,
      validator_type: conditionNotNull ? 'not null' : 'operator',
      validator_config_json: conditionNotNull
        ? {}
        : currentAlert?.validator_config_json,
      chart: contentType === 'chart' ? currentAlert?.chart?.value : null,
      dashboard:
        contentType === 'dashboard' ? currentAlert?.dashboard?.value : null,
      database: currentAlert?.database?.value,
      owners: (currentAlert?.owners || []).map(
        owner => (owner as MetaObject).value || owner.id,
      ),
      recipients,
      report_format:
        contentType === 'dashboard'
          ? DEFAULT_NOTIFICATION_FORMAT
          : reportFormat || DEFAULT_NOTIFICATION_FORMAT,
    };

    if (data.recipients && !data.recipients.length) {
      delete data.recipients;
    }

    data.context_markdown = 'string';

    if (isEditMode) {
      // Edit
      if (currentAlert?.id) {
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

          addSuccessToast(t('%s updated', data.type));

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

        addSuccessToast(t('%s updated', data.type));

        if (onAdd) {
          onAdd(response);
        }

        hide();
      });
    }
  };

  // Fetch data to populate form dropdowns
  const loadOwnerOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/report/related/created_by?q=${query}`,
        }).then(response => ({
          data: response.json.result.map(
            (item: { value: number; text: string }) => ({
              value: item.value,
              label: item.text,
            }),
          ),
          totalCount: response.json.count,
        }));
      },
    [],
  );

  const getSourceData = useCallback(
    (db?: MetaObject) => {
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
    },
    [currentAlert?.database, sourceOptions],
  );

  // Updating alert/report state
  const updateAlertState = (name: string, value: any) => {
    setCurrentAlert(currentAlertData => ({
      ...currentAlertData,
      [name]: value,
    }));
  };

  const loadSourceOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/report/related/database?q=${query}`,
        }).then(response => {
          const list = response.json.result.map(
            (item: { value: number; text: string }) => ({
              value: item.value,
              label: item.text,
            }),
          );
          setSourceOptions(list);
          return { data: list, totalCount: response.json.count };
        });
      },
    [],
  );

  const databaseLabel = currentAlert?.database && !currentAlert.database.label;
  useEffect(() => {
    // Find source if current alert has one set
    if (databaseLabel) {
      updateAlertState('database', getSourceData());
    }
  }, [databaseLabel, getSourceData]);

  const loadDashboardOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode_uri({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/report/related/dashboard?q=${query}`,
        }).then(response => {
          const list = response.json.result.map(
            (item: { value: number; text: string }) => ({
              value: item.value,
              label: item.text,
            }),
          );
          setDashboardOptions(list);
          return { data: list, totalCount: response.json.count };
        });
      },
    [],
  );

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

  const getChartData = useCallback(
    (chartData?: MetaObject) => {
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
    },
    [chartOptions, currentAlert?.chart],
  );

  const noChartLabel = currentAlert?.chart && !currentAlert?.chart.label;
  useEffect(() => {
    // Find source if current alert has one set
    if (noChartLabel) {
      updateAlertState('chart', getChartData());
    }
  }, [getChartData, noChartLabel]);

  const loadChartOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode_uri({
          filter: input,
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/report/related/chart?q=${query}`,
        }).then(response => {
          const list = response.json.result.map(
            (item: { value: number; text: string }) => ({
              value: item.value,
              label: item.text,
            }),
          );

          setChartOptions(list);
          return { data: list, totalCount: response.json.count };
        });
      },
    [],
  );

  const getChartVisualizationType = (chart: SelectValue) =>
    SupersetClient.get({
      endpoint: `/api/v1/chart/${chart.value}`,
    }).then(response => setChartVizType(response.json.result.viz_type));

  // Handle input/textarea updates
  const onInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const {
      target: { type, value, name },
    } = event;
    const parsedValue = type === 'number' ? parseInt(value, 10) || null : value;

    updateAlertState(name, parsedValue);
  };

  const onTimeoutVerifyChange = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const { target } = event;
    const value = +target.value;

    // Need to make sure grace period is not lower than TIMEOUT_MIN
    if (value === 0) {
      updateAlertState(target.name, null);
    } else {
      updateAlertState(
        target.name,
        value ? Math.max(value, TIMEOUT_MIN) : value,
      );
    }
  };

  const onSQLChange = (value: string) => {
    updateAlertState('sql', value || '');
  };

  const onOwnersChange = (value: Array<SelectValue>) => {
    updateAlertState('owners', value || []);
  };

  const onSourceChange = (value: Array<SelectValue>) => {
    updateAlertState('database', value || []);
  };

  const onDashboardChange = (dashboard: SelectValue) => {
    updateAlertState('dashboard', dashboard || undefined);
    updateAlertState('chart', null);
  };

  const onChartChange = (chart: SelectValue) => {
    getChartVisualizationType(chart);
    updateAlertState('chart', chart || undefined);
    updateAlertState('dashboard', null);
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

  const onTimezoneChange = (timezone: string) => {
    updateAlertState('timezone', timezone);
  };

  const onContentTypeChange = (event: any) => {
    const { target } = event;
    // When switch content type, reset force_screenshot to false
    setForceScreenshot(false);
    // Gives time to close the select before changing the type
    setTimeout(() => setContentType(target.value), 200);
  };

  const onFormatChange = (event: any) => {
    const { target } = event;

    setReportFormat(target.value);
  };

  const onForceScreenshotChange = (event: any) => {
    setForceScreenshot(event.target.checked);
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
      currentAlert?.name?.length &&
      currentAlert?.owners?.length &&
      currentAlert?.crontab?.length &&
      currentAlert?.working_timeout !== undefined &&
      ((contentType === 'dashboard' && !!currentAlert?.dashboard) ||
        (contentType === 'chart' && !!currentAlert?.chart)) &&
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
  useEffect(() => {
    if (
      isEditMode &&
      (!currentAlert?.id || alert?.id !== currentAlert.id || (isHidden && show))
    ) {
      if (alert?.id !== null && !loading && !fetchError) {
        const id = alert.id || 0;
        fetchResource(id);
      }
    } else if (
      !isEditMode &&
      (!currentAlert || currentAlert.id || (isHidden && show))
    ) {
      setCurrentAlert({
        ...defaultAlert,
        owners: currentUser
          ? [
              {
                value: currentUser.userId,
                label: `${currentUser.firstName} ${currentUser.lastName}`,
              },
            ]
          : [],
      });
      setNotificationSettings([]);
      setNotificationAddState('active');
    }
  }, [alert]);

  useEffect(() => {
    if (resource) {
      // Add notification settings
      const settings = (resource.recipients || []).map(setting => {
        const config =
          typeof setting.recipient_config_json === 'string'
            ? JSON.parse(setting.recipient_config_json)
            : {};
        return {
          method: setting.type,
          // @ts-ignore: Type not assignable
          recipients: config.target || setting.recipient_config_json,
          options: allowedNotificationMethods,
        };
      });

      setNotificationSettings(settings);
      setNotificationAddState(
        settings.length === allowedNotificationMethods.length
          ? 'hidden'
          : 'active',
      );
      setContentType(resource.chart ? 'chart' : 'dashboard');
      setReportFormat(
        resource.chart
          ? resource.report_format || DEFAULT_NOTIFICATION_FORMAT
          : DEFAULT_NOTIFICATION_FORMAT,
      );
      const validatorConfig =
        typeof resource.validator_config_json === 'string'
          ? JSON.parse(resource.validator_config_json)
          : resource.validator_config_json;

      setConditionNotNull(resource.validator_type === 'not null');

      if (resource.chart) {
        setChartVizType((resource.chart as ChartObject).viz_type);
      }
      setForceScreenshot(resource.force_screenshot);

      setCurrentAlert({
        ...resource,
        chart: resource.chart
          ? getChartData(resource.chart) || {
              value: (resource.chart as ChartObject).id,
              label: (resource.chart as ChartObject).slice_name,
            }
          : undefined,
        dashboard: resource.dashboard
          ? getDashboardData(resource.dashboard) || {
              value: (resource.dashboard as DashboardObject).id,
              label: (resource.dashboard as DashboardObject).dashboard_title,
            }
          : undefined,
        database: resource.database
          ? getSourceData(resource.database) || {
              value: (resource.database as DatabaseObject).id,
              label: (resource.database as DatabaseObject).database_name,
            }
          : undefined,
        owners: (alert?.owners || []).map(owner => ({
          value: (owner as MetaObject).value || owner.id,
          label:
            (owner as MetaObject).label ||
            `${(owner as Owner).first_name} ${(owner as Owner).last_name}`,
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
  }, [resource]);

  // Validation
  const currentAlertSafe = currentAlert || {};
  useEffect(() => {
    validate();
  }, [
    currentAlertSafe.name,
    currentAlertSafe.owners,
    currentAlertSafe.database,
    currentAlertSafe.sql,
    currentAlertSafe.validator_config_json,
    currentAlertSafe.crontab,
    currentAlertSafe.working_timeout,
    currentAlertSafe.dashboard,
    currentAlertSafe.chart,
    contentType,
    notificationSettings,
    conditionNotNull,
  ]);

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  return (
    <StyledModal
      className="no-content-padding"
      responsive
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={
        isEditMode ? TRANSLATIONS.SAVE_TEXT : TRANSLATIONS.ADD_TEXT
      }
      show={show}
      width="100%"
      maxWidth="1450px"
      title={
        <h4 data-test="alert-report-modal-title">
          {isEditMode ? (
            <Icons.EditAlt css={StyledIcon} />
          ) : (
            <Icons.PlusLarge css={StyledIcon} />
          )}
          {isEditMode && isReport
            ? TRANSLATIONS.EDIT_REPORT_TEXT
            : isEditMode
            ? TRANSLATIONS.EDIT_ALERT_TEXT
            : isReport
            ? TRANSLATIONS.ADD_REPORT_TEXT
            : TRANSLATIONS.ADD_ALERT_TEXT}
        </h4>
      }
    >
      <StyledSectionContainer>
        <div className="header-section">
          <StyledInputContainer>
            <div className="control-label">
              {isReport
                ? TRANSLATIONS.REPORT_NAME_TEXT
                : TRANSLATIONS.ALERT_NAME_TEXT}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <input
                type="text"
                name="name"
                value={currentAlert ? currentAlert.name : ''}
                placeholder={
                  isReport
                    ? TRANSLATIONS.REPORT_NAME_TEXT
                    : TRANSLATIONS.ALERT_NAME_TEXT
                }
                onChange={onInputChange}
                css={inputSpacer}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">
              {TRANSLATIONS.OWNERS_TEXT}
              <span className="required">*</span>
            </div>
            <div data-test="owners-select" className="input-container">
              <AsyncSelect
                ariaLabel={TRANSLATIONS.OWNERS_TEXT}
                allowClear
                name="owners"
                mode="multiple"
                value={
                  (currentAlert?.owners as {
                    label: string;
                    value: number;
                  }[]) || []
                }
                options={loadOwnerOptions}
                onChange={onOwnersChange}
                css={inputSpacer}
              />
            </div>
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">{TRANSLATIONS.DESCRIPTION_TEXT}</div>
            <div className="input-container">
              <input
                type="text"
                name="description"
                value={currentAlert ? currentAlert.description || '' : ''}
                placeholder={TRANSLATIONS.DESCRIPTION_TEXT}
                onChange={onInputChange}
                css={inputSpacer}
              />
            </div>
          </StyledInputContainer>
          <StyledSwitchContainer>
            <Switch
              onChange={onActiveSwitch}
              checked={currentAlert ? currentAlert.active : true}
            />
            <div className="switch-label">{TRANSLATIONS.ACTIVE_TEXT}</div>
          </StyledSwitchContainer>
        </div>
        <div className="column-section">
          {!isReport && (
            <div className="column condition">
              <StyledSectionTitle>
                <h4>{TRANSLATIONS.ALERT_CONDITION_TEXT}</h4>
              </StyledSectionTitle>
              <StyledInputContainer>
                <div className="control-label">
                  {TRANSLATIONS.DATABASE_TEXT}
                  <span className="required">*</span>
                </div>
                <div className="input-container">
                  <AsyncSelect
                    ariaLabel={TRANSLATIONS.DATABASE_TEXT}
                    name="source"
                    value={
                      currentAlert?.database?.label &&
                      currentAlert?.database?.value
                        ? {
                            value: currentAlert.database.value,
                            label: currentAlert.database.label,
                          }
                        : undefined
                    }
                    options={loadSourceOptions}
                    onChange={onSourceChange}
                  />
                </div>
              </StyledInputContainer>
              <StyledInputContainer>
                <div className="control-label">
                  {TRANSLATIONS.SQL_QUERY_TEXT}
                  <StyledTooltip tooltip={TRANSLATIONS.SQL_QUERY_TOOLTIP} />
                  <span className="required">*</span>
                </div>
                <TextAreaControl
                  name="sql"
                  language="sql"
                  offerEditInModal={false}
                  minLines={15}
                  maxLines={15}
                  onChange={onSQLChange}
                  readOnly={false}
                  initialValue={resource?.sql}
                  key={currentAlert?.id}
                />
              </StyledInputContainer>
              <div className="inline-container wrap">
                <StyledInputContainer>
                  <div className="control-label" css={inputSpacer}>
                    {TRANSLATIONS.TRIGGER_ALERT_IF_TEXT}
                    <span className="required">*</span>
                  </div>
                  <div className="input-container">
                    <Select
                      ariaLabel={TRANSLATIONS.CONDITION_TEXT}
                      onChange={onConditionChange}
                      placeholder="Condition"
                      value={
                        currentAlert?.validator_config_json?.op || undefined
                      }
                      options={CONDITIONS}
                      css={inputSpacer}
                    />
                  </div>
                </StyledInputContainer>
                <StyledInputContainer>
                  <div className="control-label">
                    {TRANSLATIONS.VALUE_TEXT}
                    <span className="required">*</span>
                  </div>
                  <div className="input-container">
                    <input
                      type="number"
                      name="threshold"
                      disabled={conditionNotNull}
                      value={
                        currentAlert?.validator_config_json?.threshold !==
                        undefined
                          ? currentAlert.validator_config_json.threshold
                          : ''
                      }
                      placeholder={TRANSLATIONS.VALUE_TEXT}
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
                  ? TRANSLATIONS.REPORT_SCHEDULE_TEXT
                  : TRANSLATIONS.ALERT_CONDITION_SCHEDULE_TEXT}
              </h4>
              <span className="required">*</span>
            </StyledSectionTitle>
            <AlertReportCronScheduler
              value={currentAlert?.crontab || ALERT_REPORTS_DEFAULT_CRON_VALUE}
              onChange={newVal => updateAlertState('crontab', newVal)}
            />
            <div className="control-label">{TRANSLATIONS.TIMEZONE_TEXT}</div>
            <div
              className="input-container"
              css={(theme: SupersetTheme) => timezoneHeaderStyle(theme)}
            >
              <TimezoneSelector
                onTimezoneChange={onTimezoneChange}
                timezone={currentAlert?.timezone}
                minWidth="100%"
              />
            </div>
            <StyledSectionTitle>
              <h4>{TRANSLATIONS.SCHEDULE_SETTINGS_TEXT}</h4>
            </StyledSectionTitle>
            <StyledInputContainer>
              <div className="control-label">
                {TRANSLATIONS.LOG_RETENTION_TEXT}
                <span className="required">*</span>
              </div>
              <div className="input-container">
                <Select
                  ariaLabel={TRANSLATIONS.LOG_RETENTION_TEXT}
                  placeholder={TRANSLATIONS.LOG_RETENTION_TEXT}
                  onChange={onLogRetentionChange}
                  value={
                    typeof currentAlert?.log_retention === 'number'
                      ? currentAlert?.log_retention
                      : ALERT_REPORTS_DEFAULT_RETENTION
                  }
                  options={RETENTION_OPTIONS}
                  sortComparator={propertyComparator('value')}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="control-label">
                {TRANSLATIONS.WORKING_TIMEOUT_TEXT}
                <span className="required">*</span>
              </div>
              <div className="input-container">
                <input
                  type="number"
                  min="1"
                  name="working_timeout"
                  value={currentAlert?.working_timeout || ''}
                  placeholder={TRANSLATIONS.TIME_IN_SECONDS_TEXT}
                  onChange={onTimeoutVerifyChange}
                />
                <span className="input-label">{TRANSLATIONS.SECONDS_TEXT}</span>
              </div>
            </StyledInputContainer>
            {!isReport && (
              <StyledInputContainer>
                <div className="control-label">
                  {TRANSLATIONS.GRACE_PERIOD_TEXT}
                </div>
                <div className="input-container">
                  <input
                    type="number"
                    min="1"
                    name="grace_period"
                    value={currentAlert?.grace_period || ''}
                    placeholder={TRANSLATIONS.TIME_IN_SECONDS_TEXT}
                    onChange={onTimeoutVerifyChange}
                  />
                  <span className="input-label">
                    {TRANSLATIONS.SECONDS_TEXT}
                  </span>
                </div>
              </StyledInputContainer>
            )}
          </div>
          <div className="column message">
            <StyledSectionTitle>
              <h4>{TRANSLATIONS.MESSAGE_CONTENT_TEXT}</h4>
              <span className="required">*</span>
            </StyledSectionTitle>
            <Radio.Group onChange={onContentTypeChange} value={contentType}>
              <StyledRadio value="dashboard">
                {TRANSLATIONS.DASHBOARD_TEXT}
              </StyledRadio>
              <StyledRadio value="chart">{TRANSLATIONS.CHART_TEXT}</StyledRadio>
            </Radio.Group>
            {contentType === 'chart' ? (
              <AsyncSelect
                ariaLabel={TRANSLATIONS.CHART_TEXT}
                name="chart"
                value={
                  currentAlert?.chart?.label && currentAlert?.chart?.value
                    ? {
                        value: currentAlert.chart.value,
                        label: currentAlert.chart.label,
                      }
                    : undefined
                }
                options={loadChartOptions}
                onChange={onChartChange}
              />
            ) : (
              <AsyncSelect
                ariaLabel={TRANSLATIONS.DASHBOARD_TEXT}
                name="dashboard"
                value={
                  currentAlert?.dashboard?.label &&
                  currentAlert?.dashboard?.value
                    ? {
                        value: currentAlert.dashboard.value,
                        label: currentAlert.dashboard.label,
                      }
                    : undefined
                }
                options={loadDashboardOptions}
                onChange={onDashboardChange}
              />
            )}
            {formatOptionEnabled && (
              <>
                <div className="inline-container">
                  <StyledRadioGroup
                    onChange={onFormatChange}
                    value={reportFormat}
                  >
                    <StyledRadio value="PNG">
                      {TRANSLATIONS.SEND_AS_PNG_TEXT}
                    </StyledRadio>
                    <StyledRadio value="CSV">
                      {TRANSLATIONS.SEND_AS_CSV_TEXT}
                    </StyledRadio>
                    {TEXT_BASED_VISUALIZATION_TYPES.includes(chartVizType) && (
                      <StyledRadio value="TEXT">
                        {TRANSLATIONS.SEND_AS_TEXT}
                      </StyledRadio>
                    )}
                  </StyledRadioGroup>
                </div>
              </>
            )}
            {isScreenshot && (
              <StyledInputContainer>
                <div className="control-label" css={CustomWidthHeaderStyle}>
                  {TRANSLATIONS.CUSTOM_SCREENSHOT_WIDTH_TEXT}
                </div>
                <div className="input-container">
                  <Input
                    type="number"
                    name="custom_width"
                    value={currentAlert?.custom_width || ''}
                    placeholder={
                      TRANSLATIONS.CUSTOM_SCREENSHOT_WIDTH_PLACEHOLDER_TEXT
                    }
                    onChange={onInputChange}
                  />
                </div>
              </StyledInputContainer>
            )}
            {(isReport || contentType === 'dashboard') && (
              <div className="inline-container">
                <StyledCheckbox
                  data-test="bypass-cache"
                  className="checkbox"
                  checked={forceScreenshot}
                  onChange={onForceScreenshotChange}
                >
                  {TRANSLATIONS.IGNORE_CACHE_TEXT}
                </StyledCheckbox>
              </div>
            )}
            <StyledSectionTitle>
              <h4>{TRANSLATIONS.NOTIFICATION_METHOD_TEXT}</h4>
              <span className="required">*</span>
            </StyledSectionTitle>
            {notificationSettings.map((notificationSetting, i) => (
              <StyledNotificationMethodWrapper>
                <NotificationMethod
                  setting={notificationSetting}
                  index={i}
                  key={`NotificationMethod-${i}`}
                  onUpdate={updateNotificationSetting}
                  onRemove={removeNotificationSetting}
                />
              </StyledNotificationMethodWrapper>
            ))}
            <NotificationMethodAdd
              data-test="notification-add"
              status={notificationAddState}
              onClick={onNotificationAdd}
            />
          </div>
        </div>
      </StyledSectionContainer>
    </StyledModal>
  );
};

export default withToasts(AlertReportModal);
