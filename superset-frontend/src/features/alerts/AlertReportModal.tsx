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
  ReactNode,
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

import { Input } from 'src/components/Input';
import { Switch } from 'src/components/Switch';
import Modal from 'src/components/Modal';
import Collapse from 'src/components/Collapse';
import TimezoneSelector from 'src/components/TimezoneSelector';
import { propertyComparator } from 'src/components/Select/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import Owner from 'src/types/Owner';
import { AntdCheckbox, AsyncSelect, Select } from 'src/components';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import { useCommonConf } from 'src/features/databases/state';
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
  ValidationObject,
  Sections,
} from 'src/features/alerts/types';
import { useSelector } from 'react-redux';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import NumberInput from './components/NumberInput';
import { AlertReportCronScheduler } from './components/AlertReportCronScheduler';
import { NotificationMethod } from './components/NotificationMethod';
import ValidatedPanelHeader from './components/ValidatedPanelHeader';
import StyledPanel from './components/StyledPanel';
import { buildErrorTooltipMessage } from './buildErrorTooltipMessage';

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

export interface AlertReportModalProps {
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  alert?: AlertObject | null;
  isReport?: boolean;
  onAdd?: (alert?: AlertObject) => void;
  onHide: () => void;
  show: boolean;
}

const DEFAULT_WORKING_TIMEOUT = 3600;
const DEFAULT_CRON_VALUE = '0 0 * * *'; // every day
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

const CONTENT_TYPE_OPTIONS = [
  {
    label: t('Dashboard'),
    value: 'dashboard',
  },
  {
    label: t('Chart'),
    value: 'chart',
  },
];
const FORMAT_OPTIONS = {
  png: {
    label: t('Send as PNG'),
    value: 'PNG',
  },
  csv: {
    label: t('Send as CSV'),
    value: 'CSV',
  },
  txt: {
    label: t('Send as text'),
    value: 'TEXT',
  },
};

// Apply to final text input components of each collapse panel
const noMarginBottom = css`
  margin-bottom: 0;
`;

/*
Height of modal body defined here, total width defined at component invocation as antd prop.
 */
const StyledModal = styled(Modal)`
  .ant-modal-body {
    height: 720px;
  }

  .control-label {
    margin-top: ${({ theme }) => theme.gridUnit}px;
  }

  .ant-collapse > .ant-collapse-item {
    border-bottom: none;
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
  ${({ theme }) => css`
    flex: 1;
    margin-top: 0px;
    margin-bottom: ${theme.gridUnit * 4}px;

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
      color: ${theme.colors.grayscale.base};
      font-size: ${theme.typography.sizes.s}px;
      padding: ${theme.gridUnit}px 0;
      text-align: left;
    }

    .required {
      margin-left: ${theme.gridUnit / 2}px;
      color: ${theme.colors.error.base};
    }

    .input-container {
      display: flex;
      align-items: center;

      > div {
        width: 100%;
      }

      label {
        display: flex;
        margin-right: ${theme.gridUnit * 2}px;
      }

      i {
        margin: 0 ${theme.gridUnit}px;
      }
    }

    input,
    textarea {
      flex: 1 1 auto;
    }

    input[disabled] {
      color: ${theme.colors.grayscale.base};
    }

    textarea {
      height: 300px;
      resize: none;
    }

    input::placeholder,
    textarea::placeholder {
      color: ${theme.colors.grayscale.light1};
    }

    textarea,
    input[type='text'],
    input[type='number'] {
      padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
      border-style: none;
      border: 1px solid ${theme.colors.grayscale.light2};
      border-radius: ${theme.gridUnit}px;

      &[name='description'] {
        flex: 1 1 auto;
      }
    }

    .input-label {
      margin-left: 10px;
    }
  `}
`;

const StyledCheckbox = styled(AntdCheckbox)`
  margin-top: ${({ theme }) => theme.gridUnit * 0}px;
`;

const StyledTooltip = styled(InfoTooltipWithTrigger)`
  margin-left: ${({ theme }) => theme.gridUnit}px;
`;

// Notification Method components
const StyledNotificationAddButton = styled.div`
  ${({ theme }) => css`
    color: ${theme.colors.primary.dark1};
    cursor: pointer;

    i {
      margin-right: ${theme.gridUnit * 2}px;
    }

    &.disabled {
      color: ${theme.colors.grayscale.light1};
      cursor: default;
    }
  `}
`;

const StyledNotificationMethodWrapper = styled.div`
  .inline-container .input-container {
    margin-left: 0;
  }
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
  // Panel titles
  GENERAL_TITLE: t('General information'),
  ALERT_CONDITION_TITLE: t('Alert condition'),
  ALERT_CONTENTS_TITLE: t('Alert contents'),
  REPORT_CONTENTS_TITLE: t('Report contents'),
  SCHEDULE_TITLE: t('Schedule'),
  NOTIFICATION_TITLE: t('Notification method'),
  // Error text
  NAME_ERROR_TEXT: t('name'),
  OWNERS_ERROR_TEXT: t('owners'),
  CONTENT_ERROR_TEXT: t('content type'),
  DATABASE_ERROR_TEXT: t('database'),
  SQL_ERROR_TEXT: t('sql'),
  ALERT_CONDITION_ERROR_TEXT: t('alert condition'),
  CRONTAB_ERROR_TEXT: t('crontab'),
  WORKING_TIMEOUT_ERROR_TEXT: t('working timeout'),
  RECIPIENTS_ERROR_TEXT: t('recipients'),
  ERROR_TOOLTIP_MESSAGE: t(
    'Not all required fields are complete. Please provide the following:',
  ),
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
        ? t('Add another notification method')
        : t('Add delivery method')}
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
  // Check config for alternate notification methods setting
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
  // Validation
  const [validationStatus, setValidationStatus] = useState<ValidationObject>({
    [Sections.General]: {
      hasErrors: false,
      name: TRANSLATIONS.GENERAL_TITLE,
      errors: [],
    },
    [Sections.Content]: {
      hasErrors: false,
      name: isReport
        ? TRANSLATIONS.REPORT_CONTENTS_TITLE
        : TRANSLATIONS.ALERT_CONTENTS_TITLE,
      errors: [],
    },
    [Sections.Alert]: {
      hasErrors: false,
      name: TRANSLATIONS.ALERT_CONDITION_TITLE,
      errors: [],
    },
    [Sections.Schedule]: {
      hasErrors: false,
      name: TRANSLATIONS.SCHEDULE_TITLE,
      errors: [],
    },
    [Sections.Notification]: {
      hasErrors: false,
      name: TRANSLATIONS.NOTIFICATION_TITLE,
      errors: [],
    },
  });
  const [errorTooltipMessage, setErrorTooltipMessage] = useState<ReactNode>('');

  const updateValidationStatus = (section: Sections, errors: string[]) => {
    setValidationStatus(currentValidationData => ({
      ...currentValidationData,
      [section]: {
        hasErrors: errors.length > 0,
        name: currentValidationData[section].name,
        errors,
      },
    }));
  };

  // Chart metadata
  const [chartVizType, setChartVizType] = useState<string>('');

  const reportOrAlert = isReport ? 'report' : 'alert';
  const isEditMode = alert !== null;
  const formatOptionEnabled =
    contentType === 'chart' &&
    (isFeatureEnabled(FeatureFlag.AlertsAttachReports) || isReport);

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

  const onContentTypeChange = (value: string) => {
    // When switch content type, reset force_screenshot to false
    setForceScreenshot(false);
    setContentType(value);
  };

  const onFormatChange = (value: string) => {
    setReportFormat(value);
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

  const validateGeneralSection = () => {
    const errors = [];
    if (!currentAlert?.name?.length) {
      errors.push(TRANSLATIONS.NAME_ERROR_TEXT);
    }
    if (!currentAlert?.owners?.length) {
      errors.push(TRANSLATIONS.OWNERS_ERROR_TEXT);
    }
    updateValidationStatus(Sections.General, errors);
  };
  const validateContentSection = () => {
    const errors = [];
    if (
      !(
        (contentType === 'dashboard' && !!currentAlert?.dashboard) ||
        (contentType === 'chart' && !!currentAlert?.chart)
      )
    ) {
      errors.push(TRANSLATIONS.CONTENT_ERROR_TEXT);
    }
    updateValidationStatus(Sections.Content, errors);
  };
  const validateAlertSection = () => {
    const errors = [];
    if (!currentAlert?.database) {
      errors.push(TRANSLATIONS.DATABASE_ERROR_TEXT);
    }
    if (!currentAlert?.sql?.length) {
      errors.push(TRANSLATIONS.SQL_ERROR_TEXT);
    }
    if (
      !(
        (conditionNotNull || !!currentAlert?.validator_config_json?.op) &&
        (conditionNotNull ||
          currentAlert?.validator_config_json?.threshold !== undefined)
      )
    ) {
      errors.push(TRANSLATIONS.ALERT_CONDITION_ERROR_TEXT);
    }
    updateValidationStatus(Sections.Alert, errors);
  };

  const validateScheduleSection = () => {
    const errors = [];
    if (!currentAlert?.crontab?.length) {
      errors.push(TRANSLATIONS.CRONTAB_ERROR_TEXT);
    }
    if (!currentAlert?.working_timeout) {
      errors.push(TRANSLATIONS.WORKING_TIMEOUT_ERROR_TEXT);
    }

    updateValidationStatus(Sections.Schedule, errors);
  };

  const validateNotificationSection = () => {
    const hasErrors = !checkNotificationSettings();
    const errors = hasErrors ? [TRANSLATIONS.RECIPIENTS_ERROR_TEXT] : [];
    updateValidationStatus(Sections.Notification, errors);
  };

  const validateAll = () => {
    validateGeneralSection();
    validateContentSection();
    if (!isReport) validateAlertSection();
    validateScheduleSection();
    validateNotificationSection();
  };

  const enforceValidation = () => {
    const sections = [
      Sections.General,
      Sections.Content,
      isReport ? undefined : Sections.Alert,
      Sections.Schedule,
      Sections.Notification,
    ];

    const hasErrors = sections.some(
      section => section && validationStatus[section].hasErrors,
    );
    const tooltip = hasErrors ? buildErrorTooltipMessage(validationStatus) : '';
    setErrorTooltipMessage(tooltip);
    setDisableSave(hasErrors);
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
      setNotificationSettings([
        {
          recipients: '',
          options: allowedNotificationMethods,
          method: 'Email',
        },
      ]);
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
    validateAll();
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
  useEffect(() => {
    enforceValidation();
  }, [validationStatus]);

  // Show/hide
  if (isHidden && show) {
    setIsHidden(false);
  }

  const getTitleText = () => {
    let titleText;

    switch (true) {
      case isEditMode && isReport:
        titleText = t('Edit Report');
        break;
      case isEditMode:
        titleText = t('Edit Alert');
        break;
      case isReport:
        titleText = t('Add Report');
        break;
      default:
        titleText = t('Add Alert');
        break;
    }

    return titleText;
  };

  return (
    <StyledModal
      className="no-content-padding"
      responsive
      disablePrimaryButton={disableSave}
      primaryTooltipMessage={errorTooltipMessage}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={isEditMode ? t('Save') : t('Add')}
      show={show}
      width="500px"
      centered
      title={<h4 data-test="alert-report-modal-title">{getTitleText()}</h4>}
    >
      <Collapse
        expandIconPosition="right"
        defaultActiveKey="general"
        accordion
        css={css`
          border: 'none';
        `}
      >
        <StyledPanel
          header={
            <ValidatedPanelHeader
              title={TRANSLATIONS.GENERAL_TITLE}
              subtitle={t(
                'Set up basic details, such as name and description.',
              )}
              validateCheckStatus={
                !validationStatus[Sections.General].hasErrors
              }
              testId="general-information-panel"
            />
          }
          key="general"
        >
          <div className="header-section">
            <StyledInputContainer>
              <div className="control-label">
                {isReport ? t('Report name') : t('Alert name')}
                <span className="required">*</span>
              </div>
              <div className="input-container">
                <input
                  type="text"
                  name="name"
                  value={currentAlert ? currentAlert.name : ''}
                  placeholder={
                    isReport ? t('Enter report name') : t('Enter alert name')
                  }
                  onChange={onInputChange}
                />
              </div>
            </StyledInputContainer>
            <StyledInputContainer>
              <div className="control-label">
                {t('Owners')}
                <span className="required">*</span>
              </div>
              <div data-test="owners-select" className="input-container">
                <AsyncSelect
                  ariaLabel={t('Owners')}
                  allowClear
                  name="owners"
                  mode="multiple"
                  placeholder={t('Select owners')}
                  value={
                    (currentAlert?.owners as {
                      label: string;
                      value: number;
                    }[]) || []
                  }
                  options={loadOwnerOptions}
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
                  placeholder={t(
                    'Include description to be sent with %s',
                    reportOrAlert,
                  )}
                  onChange={onInputChange}
                />
              </div>
            </StyledInputContainer>
            <StyledSwitchContainer>
              <Switch
                checked={currentAlert ? currentAlert.active : false}
                defaultChecked
                onChange={onActiveSwitch}
              />
              <div className="switch-label">
                {isReport ? t('Report is active') : t('Alert is active')}
              </div>
            </StyledSwitchContainer>
          </div>
        </StyledPanel>
        {!isReport && (
          <StyledPanel
            header={
              <ValidatedPanelHeader
                title={TRANSLATIONS.ALERT_CONDITION_TITLE}
                subtitle={t(
                  'Define the database, SQL query, and triggering conditions for alert.',
                )}
                validateCheckStatus={
                  !validationStatus[Sections.Alert].hasErrors
                }
                testId="alert-condition-panel"
              />
            }
            key="condition"
          >
            <StyledInputContainer>
              <div className="control-label">
                {t('Database')}
                <span className="required">*</span>
              </div>
              <div className="input-container">
                <AsyncSelect
                  ariaLabel={t('Database')}
                  name="source"
                  placeholder={t('Select database')}
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
                {t('SQL Query')}
                <StyledTooltip
                  tooltip={t(
                    'The result of this query must be a value capable of numeric interpretation e.g. 1, 1.0, or "1" (compatible with Python\'s float() function).',
                  )}
                />
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
              <StyledInputContainer css={noMarginBottom}>
                <div className="control-label" css={inputSpacer}>
                  {t('Trigger Alert If...')}
                  <span className="required">*</span>
                </div>
                <div className="input-container">
                  <Select
                    ariaLabel={t('Condition')}
                    onChange={onConditionChange}
                    placeholder={t('Condition')}
                    value={currentAlert?.validator_config_json?.op || undefined}
                    options={CONDITIONS}
                    css={inputSpacer}
                  />
                </div>
              </StyledInputContainer>
              <StyledInputContainer css={noMarginBottom}>
                <div className="control-label">
                  {t('Value')} <span className="required">*</span>
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
                    placeholder={t('Value')}
                    onChange={onThresholdChange}
                  />
                </div>
              </StyledInputContainer>
            </div>
          </StyledPanel>
        )}
        <StyledPanel
          header={
            <ValidatedPanelHeader
              title={
                isReport
                  ? TRANSLATIONS.REPORT_CONTENTS_TITLE
                  : TRANSLATIONS.ALERT_CONTENTS_TITLE
              }
              subtitle={t('Customize data source, filters, and layout.')}
              validateCheckStatus={
                !validationStatus[Sections.Content].hasErrors
              }
              testId="contents-panel"
            />
          }
          key="contents"
        >
          <StyledInputContainer>
            <div className="control-label">
              {t('Content type')}
              <span className="required">*</span>
            </div>
            <Select
              ariaLabel={t('Select content type')}
              onChange={onContentTypeChange}
              value={contentType}
              options={CONTENT_TYPE_OPTIONS}
              placeholder={t('Select content type')}
            />
          </StyledInputContainer>
          <StyledInputContainer>
            {contentType === 'chart' ? (
              <>
                <div className="control-label">
                  {t('Select chart')}
                  <span className="required">*</span>
                </div>
                <AsyncSelect
                  ariaLabel={t('Chart')}
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
                  placeholder={t('Select chart to use')}
                />
              </>
            ) : (
              <>
                <div className="control-label">
                  {t('Select dashboard')}
                  <span className="required">*</span>
                </div>
                <AsyncSelect
                  ariaLabel={t('Dashboard')}
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
                  placeholder={t('Select dashboard to use')}
                />
              </>
            )}
          </StyledInputContainer>
          <StyledInputContainer
            css={['TEXT', 'CSV'].includes(reportFormat) && noMarginBottom}
          >
            {formatOptionEnabled && (
              <>
                <div className="control-label">
                  {t('Content format')}
                  <span className="required">*</span>
                </div>
                <Select
                  ariaLabel={t('Select format')}
                  onChange={onFormatChange}
                  value={reportFormat}
                  options={
                    /* If chart is of text based viz type: show text
                  format option */
                    TEXT_BASED_VISUALIZATION_TYPES.includes(chartVizType)
                      ? Object.values(FORMAT_OPTIONS)
                      : ['png', 'csv'].map(key => FORMAT_OPTIONS[key])
                  }
                  placeholder={t('Select format')}
                />
              </>
            )}
          </StyledInputContainer>
          {isScreenshot && (
            <StyledInputContainer
              css={!isReport && contentType === 'chart' && noMarginBottom}
            >
              <div className="control-label">{t('Screenshot width')}</div>
              <div className="input-container">
                <Input
                  type="number"
                  name="custom_width"
                  value={currentAlert?.custom_width || ''}
                  placeholder={t('Input custom width in pixels')}
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
                {t('Ignore cache when generating report')}
              </StyledCheckbox>
            </div>
          )}
        </StyledPanel>
        <StyledPanel
          header={
            <ValidatedPanelHeader
              title={TRANSLATIONS.SCHEDULE_TITLE}
              subtitle={t(
                'Define delivery schedule, timezone, and frequency settings.',
              )}
              validateCheckStatus={
                !validationStatus[Sections.Schedule].hasErrors
              }
              testId="schedule-panel"
            />
          }
          key="schedule"
        >
          <AlertReportCronScheduler
            value={currentAlert?.crontab || ALERT_REPORTS_DEFAULT_CRON_VALUE}
            onChange={newVal => updateAlertState('crontab', newVal)}
          />
          <StyledInputContainer>
            <div className="control-label">
              {t('Timezone')} <span className="required">*</span>
            </div>
            <TimezoneSelector
              onTimezoneChange={onTimezoneChange}
              timezone={currentAlert?.timezone}
              minWidth="100%"
            />
          </StyledInputContainer>
          <StyledInputContainer>
            <div className="control-label">
              {t('Log retention')}
              <span className="required">*</span>
            </div>
            <div className="input-container">
              <Select
                ariaLabel={t('Log retention')}
                placeholder={t('Log retention')}
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
          <StyledInputContainer css={noMarginBottom}>
            {isReport ? (
              <>
                <div className="control-label">
                  {t('Working timeout')}
                  <span className="required">*</span>
                </div>
                <div className="input-container">
                  <NumberInput
                    min={1}
                    name="working_timeout"
                    value={currentAlert?.working_timeout || ''}
                    placeholder={t('Time in seconds')}
                    onChange={onTimeoutVerifyChange}
                    timeUnit={t('seconds')}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="control-label">{t('Grace period')}</div>
                <div className="input-container">
                  <NumberInput
                    min={1}
                    name="grace_period"
                    value={currentAlert?.grace_period || ''}
                    placeholder={t('Time in seconds')}
                    onChange={onTimeoutVerifyChange}
                    timeUnit={t('seconds')}
                  />
                </div>
              </>
            )}
          </StyledInputContainer>
        </StyledPanel>
        <StyledPanel
          header={
            <ValidatedPanelHeader
              title={TRANSLATIONS.NOTIFICATION_TITLE}
              subtitle={t('Choose notification method and recipients.')}
              validateCheckStatus={
                !validationStatus[Sections.Notification].hasErrors
              }
              testId="notification-method-panel"
            />
          }
          key="notification"
        >
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
          {
            // Prohibit 'add notification method' button if only one present
            allowedNotificationMethods.length > notificationSettings.length && (
              <NotificationMethodAdd
                data-test="notification-add"
                status={notificationAddState}
                onClick={onNotificationAdd}
              />
            )
          }
        </StyledPanel>
      </Collapse>
    </StyledModal>
  );
};

export default withToasts(AlertReportModal);
