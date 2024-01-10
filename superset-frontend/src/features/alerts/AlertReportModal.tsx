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

// Style Constants
const MODAL_BODY_HEIGHT = 180.5;

// Apply to collapse panels as 'style' prop value
const panelBorder = {
  borderBottom: 'none',
};

// Apply to final text input components of each collapse panel
const no_margin_bottom = css`
  margin-bottom: 0;
`;

// Styled Components

/*
Height of modal body defined here, total width defined at component invocation as antd prop.

.inline-container applies to Alert Condition panel <div> containing trigger
and value inputs.
 */
const StyledModal = styled(Modal)`
  .ant-modal-body {
    height: ${({ theme }) => theme.gridUnit * MODAL_BODY_HEIGHT}px;
    height: ${({ theme }) => theme.gridUnit * MODAL_BODY_HEIGHT}px;
  }

  .control-label {
    margin-top: ${({ theme }) => theme.gridUnit}px;
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
  flex: 1;
  margin-top: 0px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  margin-top: 0px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;

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

const StyledCheckbox = styled(AntdCheckbox)`
  margin-top: ${({ theme }) => theme.gridUnit * 0}px;
`;

const StyledTooltip = styled(InfoTooltipWithTrigger)`
  margin-left: ${({ theme }) => theme.gridUnit}px;
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

const inputSpacer = (theme: SupersetTheme) => css`
  margin-right: ${theme.gridUnit * 3}px;
`;

type NotificationAddStatus = 'active' | 'disabled' | 'hidden';

interface NotificationMethodAddProps {
  status: NotificationAddStatus;
  onClick: () => void;
}

export const TRANSLATIONS = {
  // Modal header
  EDIT_REPORT_TEXT: t('Edit Report'),
  EDIT_ALERT_TEXT: t('Edit Alert'),
  ADD_REPORT_TEXT: t('Add Report'),
  ADD_ALERT_TEXT: t('Add Alert'),
  // Panel titles
  GENERAL_TITLE: t('General information'),
  ALERT_CONDITION_TITLE: t('Alert condition'),
  ALERT_CONTENTS_TITLE: t('Alert contents'),
  REPORT_CONTENTS_TITLE: t('Report contents'),
  SCHEDULE_TITLE: t('Schedule'),
  NOTIFICATION_TITLE: t('Notification method'),
  // Panel subtitles
  GENERAL_SUBTITLE: t('Set up basic details, such as name and description.'),
  ALERT_CONDITION_SUBTITLE: t(
    'Define the database, SQL query, and triggering conditions for alert.',
  ),
  CONTENTS_SUBTITLE: t('Customize data source, filters, and layout.'),
  SCHEDULE_SUBTITLE: t(
    'Define delivery schedule, timezone, and frequency settings.',
  ),
  NOTIFICATION_SUBTITLE: t('Choose notification method and recipients.'),
  // General info panel inputs
  REPORT_NAME_TEXT: t('Report name'),
  REPORT_NAME_PLACEHOLDER: t('Enter report name'),
  ALERT_NAME_TEXT: t('Alert name'),
  ALERT_NAME_PLACEHOLDER: t('Enter alert name'),
  OWNERS_TEXT: t('Owners'),
  OWNERS_PLACEHOLDER: t('Select owners'),
  DESCRIPTION_TEXT: t('Description'),
  REPORT_DESCRIPTION_PLACEHOLDER: t(
    'Include description to be sent with report',
  ),
  ALERT_DESCRIPTION_PLACEHOLDER: t('Include description to be sent with alert'),
  ACTIVE_REPORT_TEXT: t('Report is active'),
  ACTIVE_ALERT_TEXT: t('Alert is active'),
  // Alert condition panel inputs
  DATABASE_TEXT: t('Database'),
  DATABASE_PLACEHOLDER: t('Select database'),
  SQL_QUERY_TEXT: t('SQL Query'),
  SQL_QUERY_TOOLTIP: t(
    'The result of this query must be a value capable of numeric interpretation i.e. 1, 1.0, or "1" (compatible with Python\'s float() function).',
  ),
  TRIGGER_ALERT_IF_TEXT: t('Trigger Alert If...'),
  CONDITION_TEXT: t('Condition'),
  CONDITION_PLACEHOLDER: t('Condition'),
  VALUE_TEXT: t('Value'),
  // Contents panel inputs
  CONTENT_TYPE_LABEL: t('Content type'),
  CONTENT_TYPE_PLACEHOLDER: t('Select content type'),
  SELECT_DASHBOARD_LABEL: t('Select dashboard'),
  SELECT_DASHBOARD_PLACEHOLDER: t('Select dashboard to use'),
  SELECT_CHART_LABEL: t('Select chart'),
  SELECT_CHART_PLACEHOLDER: t('Select chart to use'),
  DASHBOARD_TEXT: t('Dashboard'),
  CHART_TEXT: t('Chart'),
  FORMAT_TYPE_LABEL: t('Content Format'),
  FORMAT_TYPE_PLACEHOLDER: t('Select format'),
  IGNORE_CACHE_TEXT: t('Ignore cache when generating report'),
  CUSTOM_SCREENSHOT_WIDTH_TEXT: t('Screenshot width'),
  CUSTOM_SCREENSHOT_WIDTH_PLACEHOLDER_TEXT: t('Input custom width in pixels'),
  // Schedule panel inputs
  SCHEDULE_TYPE_TEXT: t('Schedule type'),
  SCHEDULE: t('Schedule'),
  TIMEZONE_TEXT: t('Timezone'),
  LOG_RETENTION_TEXT: t('Log retention'),
  WORKING_TIMEOUT_TEXT: t('Working timeout'),
  TIME_IN_SECONDS_TEXT: t('Time in seconds'),
  SECONDS_TEXT: t('seconds'),
  GRACE_PERIOD_TEXT: t('Grace period'),
  // Notification panel inputs
  ADD_NOTIFICATION_METHOD_TEXT: t('Add another notification method'),
  ADD_DELIVERY_METHOD_TEXT: t('Add delivery method'),
  NOTIFICATION_METHOD_TEXT: t('Notification method'),
  // Button text
  SAVE_TEXT: t('Save'),
  ADD_TEXT: t('Add'),
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
    generalSection: { status: false, name: 'General information', errors: [] },
    contentSection: { status: false, name: 'Report contents', errors: [] },
    alertConditionSection: {
      status: false,
      name: 'Alert condition',
      errors: [],
    },
    scheduleSection: { status: false, name: 'Schedule', errors: [] },
    notificationSection: {
      status: false,
      name: 'Notification methods',
      errors: [],
    },
  });
  const [errorTooltipMessage, setErrorTooltipMessage] = useState<ReactNode>('');

  const updateValidationStatus = (
    section: Sections,
    status: boolean,
    errors?: string[],
  ) => {
    if (status || (section === Sections.ALERT && isReport)) {
      // clear set true and clear errors
      setValidationStatus(currentValidationData => ({
        ...currentValidationData,
        [section]: {
          status: true,
          name: currentValidationData[section].name,
          errors: [],
        },
      }));
    } else {
      // push errors
      setValidationStatus(currentValidationData => ({
        ...currentValidationData,
        [section]: {
          status: false,
          name: currentValidationData[section].name,
          errors,
        },
      }));
    }
  };
  // Chart metadata
  const [chartVizType, setChartVizType] = useState<string>('');

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

  const onContentTypeChange = (value: any) => {
    // When switch content type, reset force_screenshot to false
    setForceScreenshot(false);
    setContentType(value);
  };

  const onFormatChange = (value: any) => {
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
      errors.push('name');
    }
    if (!currentAlert?.owners?.length) {
      errors.push('owners');
    }
    if (errors.length) {
      updateValidationStatus(Sections.GENERAL, false, errors);
    } else {
      updateValidationStatus(Sections.GENERAL, true);
    }
  };
  const validateContentSection = () => {
    const errors = [];
    if (
      !(
        (contentType === 'dashboard' && !!currentAlert?.dashboard) ||
        (contentType === 'chart' && !!currentAlert?.chart)
      )
    ) {
      errors.push('content type');
    }
    if (errors.length) {
      updateValidationStatus(Sections.CONTENT, false, errors);
    } else {
      updateValidationStatus(Sections.CONTENT, true);
    }
  };
  const validateAlertSection = () => {
    const errors = [];
    if (!currentAlert?.database) {
      errors.push('database');
    }
    if (!currentAlert?.sql?.length) {
      errors.push('sql');
    }
    if (
      !(
        (conditionNotNull || !!currentAlert?.validator_config_json?.op) &&
        (conditionNotNull ||
          currentAlert?.validator_config_json?.threshold !== undefined)
      )
    ) {
      errors.push('alert condition');
    }
    if (errors.length) {
      updateValidationStatus(Sections.ALERT, false, errors);
    } else {
      updateValidationStatus(Sections.ALERT, true);
    }
  };
  const validateScheduleSection = () => {
    const errors = [];
    if (!currentAlert?.crontab?.length) {
      errors.push('crontab');
    }
    if (!currentAlert?.working_timeout) {
      errors.push('working timeout');
    }

    if (errors.length) {
      updateValidationStatus(Sections.SCHEDULE, false, errors);
    } else {
      updateValidationStatus(Sections.SCHEDULE, true);
    }
  };
  const validateNotificationSection = () => {
    if (checkNotificationSettings()) {
      updateValidationStatus(Sections.NOTIFICATION, true);
    } else {
      updateValidationStatus(Sections.NOTIFICATION, false, ['recipients']);
    }
  };

  const validateAll = () => {
    validateGeneralSection();
    validateContentSection();
    validateAlertSection();
    validateScheduleSection();
    validateNotificationSection();
  };

  const enforceValidation = () => {
    if (
      validationStatus[Sections.GENERAL].status &&
      validationStatus[Sections.CONTENT].status &&
      (isReport || validationStatus[Sections.ALERT].status) &&
      validationStatus[Sections.SCHEDULE].status &&
      validationStatus[Sections.NOTIFICATION].status
    ) {
      buildErrorTooltipMessage(false, setErrorTooltipMessage, validationStatus);
      setDisableSave(false);
    } else {
      buildErrorTooltipMessage(true, setErrorTooltipMessage, validationStatus);
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

  return (
    <StyledModal
      className="no-content-padding"
      responsive
      disablePrimaryButton={disableSave}
      primaryTooltipMessage={errorTooltipMessage}
      onHandledPrimaryAction={onSave}
      onHide={hide}
      primaryButtonName={
        isEditMode ? TRANSLATIONS.SAVE_TEXT : TRANSLATIONS.ADD_TEXT
      }
      show={show}
      width="500px"
      centered
      title={
        <h4 data-test="alert-report-modal-title">
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
      <Collapse
        expandIconPosition="right"
        defaultActiveKey="1"
        accordion
        style={{ border: 'none' }}
      >
        <StyledPanel
          header={
            <ValidatedPanelHeader
              title={TRANSLATIONS.GENERAL_TITLE}
              subtitle={TRANSLATIONS.GENERAL_SUBTITLE}
              required
              validateCheckStatus={validationStatus[Sections.GENERAL].status}
              testId="general-information-panel"
            />
          }
          key="1"
          style={panelBorder}
        >
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
                      ? TRANSLATIONS.REPORT_NAME_PLACEHOLDER
                      : TRANSLATIONS.ALERT_NAME_PLACEHOLDER
                  }
                  onChange={onInputChange}
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
                  placeholder={TRANSLATIONS.OWNERS_PLACEHOLDER}
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
              <div className="control-label">
                {TRANSLATIONS.DESCRIPTION_TEXT}
              </div>
              <div className="input-container">
                <input
                  type="text"
                  name="description"
                  value={currentAlert ? currentAlert.description || '' : ''}
                  placeholder={
                    isReport
                      ? TRANSLATIONS.REPORT_DESCRIPTION_PLACEHOLDER
                      : TRANSLATIONS.ALERT_DESCRIPTION_PLACEHOLDER
                  }
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
                {isReport
                  ? TRANSLATIONS.ACTIVE_REPORT_TEXT
                  : TRANSLATIONS.ACTIVE_ALERT_TEXT}
              </div>
            </StyledSwitchContainer>
          </div>
        </StyledPanel>
        {!isReport && (
          <StyledPanel
            header={
              <ValidatedPanelHeader
                title={TRANSLATIONS.ALERT_CONDITION_TITLE}
                subtitle={TRANSLATIONS.ALERT_CONDITION_SUBTITLE}
                required={false}
                validateCheckStatus={validationStatus[Sections.ALERT].status}
                testId="alert-condition-panel"
              />
            }
            key="2"
            style={{ borderBottom: 'none' }}
          >
            <StyledInputContainer>
              <div className="control-label">
                {TRANSLATIONS.DATABASE_TEXT}
                <span className="required">*</span>
              </div>
              <div className="input-container">
                <AsyncSelect
                  ariaLabel={TRANSLATIONS.DATABASE_TEXT}
                  name="source"
                  placeholder={TRANSLATIONS.DATABASE_PLACEHOLDER}
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
              <StyledInputContainer css={no_margin_bottom}>
                <div className="control-label" css={inputSpacer}>
                  {TRANSLATIONS.TRIGGER_ALERT_IF_TEXT}
                  <span className="required">*</span>
                </div>
                <div className="input-container">
                  <Select
                    ariaLabel={TRANSLATIONS.CONDITION_TEXT}
                    onChange={onConditionChange}
                    placeholder={TRANSLATIONS.CONDITION_PLACEHOLDER}
                    value={currentAlert?.validator_config_json?.op || undefined}
                    options={CONDITIONS}
                    css={inputSpacer}
                  />
                </div>
              </StyledInputContainer>
              <StyledInputContainer css={no_margin_bottom}>
                <div className="control-label">
                  {TRANSLATIONS.VALUE_TEXT} <span className="required">*</span>
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
              subtitle={TRANSLATIONS.CONTENTS_SUBTITLE}
              required
              validateCheckStatus={validationStatus[Sections.CONTENT].status}
              testId="contents-panel"
            />
          }
          key="3"
          style={{ borderBottom: 'none' }}
        >
          <StyledInputContainer>
            <div className="control-label">
              {TRANSLATIONS.CONTENT_TYPE_LABEL}
              <span className="required">*</span>
            </div>
            <Select
              ariaLabel={TRANSLATIONS.CONTENT_TYPE_PLACEHOLDER}
              onChange={onContentTypeChange}
              value={contentType}
              options={CONTENT_TYPE_OPTIONS}
              placeholder={TRANSLATIONS.CONTENT_TYPE_PLACEHOLDER}
            />
          </StyledInputContainer>
          <StyledInputContainer>
            {contentType === 'chart' ? (
              <>
                <div className="control-label">
                  {TRANSLATIONS.SELECT_CHART_LABEL}
                  <span className="required">*</span>
                </div>
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
                  placeholder={TRANSLATIONS.SELECT_CHART_PLACEHOLDER}
                />
              </>
            ) : (
              <>
                <div className="control-label">
                  {TRANSLATIONS.SELECT_DASHBOARD_LABEL}
                  <span className="required">*</span>
                </div>
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
                  placeholder={TRANSLATIONS.SELECT_DASHBOARD_PLACEHOLDER}
                />
              </>
            )}
          </StyledInputContainer>
          <StyledInputContainer
            css={['TEXT', 'CSV'].includes(reportFormat) && no_margin_bottom}
          >
            {formatOptionEnabled && (
              <>
                <div className="control-label">
                  {TRANSLATIONS.FORMAT_TYPE_LABEL}
                  <span className="required">*</span>
                </div>
                <Select
                  ariaLabel={TRANSLATIONS.FORMAT_TYPE_PLACEHOLDER}
                  onChange={onFormatChange}
                  value={reportFormat}
                  options={
                    /* If chart is of text based viz type: show text
                  format option */
                    TEXT_BASED_VISUALIZATION_TYPES.includes(chartVizType)
                      ? Object.values(FORMAT_OPTIONS)
                      : ['png', 'csv'].map(key => FORMAT_OPTIONS[key])
                  }
                  placeholder={TRANSLATIONS.FORMAT_TYPE_PLACEHOLDER}
                />
              </>
            )}
          </StyledInputContainer>
          {isScreenshot && (
            <StyledInputContainer
              css={!isReport && contentType === 'chart' && no_margin_bottom}
            >
              <div className="control-label">
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
        </StyledPanel>
        <StyledPanel
          header={
            <ValidatedPanelHeader
              title={TRANSLATIONS.SCHEDULE_TITLE}
              subtitle={TRANSLATIONS.SCHEDULE_SUBTITLE}
              required
              validateCheckStatus={validationStatus[Sections.SCHEDULE].status}
              testId="schedule-panel"
            />
          }
          key="4"
          style={{ borderBottom: 'none' }}
        >
          <AlertReportCronScheduler
            value={currentAlert?.crontab || ALERT_REPORTS_DEFAULT_CRON_VALUE}
            onChange={newVal => updateAlertState('crontab', newVal)}
          />
          <StyledInputContainer>
            <div className="control-label">
              {TRANSLATIONS.TIMEZONE_TEXT} <span className="required">*</span>
            </div>
            <TimezoneSelector
              onTimezoneChange={onTimezoneChange}
              timezone={currentAlert?.timezone}
              minWidth="100%"
            />
          </StyledInputContainer>
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
          <StyledInputContainer css={no_margin_bottom}>
            {isReport ? (
              <>
                <div className="control-label">
                  {TRANSLATIONS.WORKING_TIMEOUT_TEXT}
                  <span className="required">*</span>
                </div>
                <div className="input-container">
                  <NumberInput
                    min={1}
                    name="working_timeout"
                    value={currentAlert?.working_timeout || ''}
                    placeholder={TRANSLATIONS.TIME_IN_SECONDS_TEXT}
                    onChange={onTimeoutVerifyChange}
                    timeUnit="seconds"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="control-label">
                  {TRANSLATIONS.GRACE_PERIOD_TEXT}
                </div>
                <div className="input-container">
                  <NumberInput
                    min={1}
                    name="grace_period"
                    value={currentAlert?.grace_period || ''}
                    placeholder={TRANSLATIONS.TIME_IN_SECONDS_TEXT}
                    onChange={onTimeoutVerifyChange}
                    timeUnit="seconds"
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
              subtitle={TRANSLATIONS.NOTIFICATION_SUBTITLE}
              required
              validateCheckStatus={
                validationStatus[Sections.NOTIFICATION].status
              }
              testId="notification-method-panel"
            />
          }
          key="5"
          style={{ borderBottom: 'none' }}
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
            allowedNotificationMethods.length > 1 && (
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
