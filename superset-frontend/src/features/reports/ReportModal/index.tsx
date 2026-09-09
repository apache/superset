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
import {
  useState,
  useEffect,
  useReducer,
  useCallback,
  useMemo,
  ChangeEvent,
} from 'react';

import { t } from '@apache-superset/core/translation';
import {
  getClientErrorObject,
  isFeatureEnabled,
  FeatureFlag,
  VizType,
} from '@superset-ui/core';
import { Alert } from '@apache-superset/core/components';
import { SupersetTheme } from '@apache-superset/core/theme';
import { useDispatch, useSelector } from 'react-redux';
import {
  editReport,
  subscribeReport,
} from 'src/features/reports/ReportModal/actions';
import {
  Checkbox,
  Input,
  LabeledErrorBoundInput,
  type CheckboxChangeEvent,
  type CronError,
} from '@superset-ui/core/components';
import { InputNumber } from '@superset-ui/core/components/Input';
import TimezoneSelector from '@superset-ui/core/components/TimezoneSelector';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';
import { Radio, RadioChangeEvent } from '@superset-ui/core/components/Radio';
import withToasts from 'src/components/MessageToasts/withToasts';
import { ChartState } from 'src/explore/types';
import {
  ReportCreationMethod,
  ReportObject,
  NotificationFormats,
} from 'src/features/reports/types';
import { reportSelector } from 'src/views/CRUD/hooks';
import getBootstrapData from 'src/utils/getBootstrapData';
import { StyledInputContainer } from 'src/features/alerts/AlertReportModal';
import { CreationMethod } from './HeaderReportDropdown';
import {
  antDErrorAlertStyles,
  CustomWidthHeaderStyle,
  StyledErrorHandlingSection,
  StyledModal,
  StyledRetryFieldGroup,
  StyledTopSection,
  StyledBottomSection,
  StyledIconWrapper,
  StyledScheduleTitle,
  StyledCronPicker,
  StyledCronError,
  noBottomMargin,
  StyledFooterButton,
  TimezoneHeaderStyle,
  SectionHeaderStyle,
  StyledMessageContentTitle,
} from './styles';

interface ReportProps {
  onHide: () => {};
  addDangerToast: (msg: string) => void;
  show: boolean;
  userEmail: string;
  ccEmail: string;
  bccEmail: string;
  chart?: ChartState;
  chartName?: string;
  dashboardId?: number;
  dashboardName?: string;
  creationMethod: ReportCreationMethod;
  props: any;
}

const TEXT_BASED_VISUALIZATION_TYPES = [
  VizType.PivotTable,
  'table',
  VizType.PairedTTest,
];

const INITIAL_STATE = {
  crontab: '0 12 * * 1',
};

type ReportObjectState = Partial<ReportObject> & {
  error?: string;
  /**
   * Is submitting changes to the backend.
   */
  isSubmitting?: boolean;
};

// Same instance to be used in useEffects
const EMPTY_OBJECT = {};

function ReportModal({
  onHide,
  show = false,
  dashboardId,
  chart,
  userEmail,
  ccEmail,
  bccEmail,
  creationMethod,
  dashboardName,
  chartName,
}: ReportProps) {
  const vizType = chart?.sliceFormData?.viz_type;
  const isChart = !!chart;
  const isTextBasedChart =
    isChart && vizType && TEXT_BASED_VISUALIZATION_TYPES.includes(vizType);
  const defaultNotificationFormat = isTextBasedChart
    ? NotificationFormats.Text
    : NotificationFormats.PNG;
  const currentUserSubjectId = getBootstrapData()?.common?.user_subject_id;
  const entityName = dashboardName || chartName;
  const initialState: ReportObjectState = useMemo(
    () => ({
      ...INITIAL_STATE,
      name: entityName
        ? t('Weekly Report for %s', entityName)
        : t('Weekly Report'),
    }),
    [entityName],
  );

  const reportReducer = useCallback(
    (state: ReportObjectState | null, action: 'reset' | ReportObjectState) => {
      if (action === 'reset') {
        return initialState;
      }
      return {
        ...state,
        ...action,
      };
    },
    [initialState],
  );

  const [currentReport, setCurrentReport] = useReducer(
    reportReducer,
    initialState,
  );
  const [cronError, setCronError] = useState<CronError>();

  const dispatch = useDispatch();
  // Report fetch logic
  const report = useSelector<any, ReportObject>(state => {
    const isChartReport = creationMethod === CreationMethod.Charts;
    return (
      reportSelector(
        state,
        isChartReport ? CreationMethod.Charts : CreationMethod.Dashboards,
        isChartReport ? chart?.id : dashboardId,
      ) || EMPTY_OBJECT
    );
  });
  const isEditMode = report && Object.keys(report).length;

  useEffect(() => {
    if (isEditMode) {
      setCurrentReport(report);
    } else {
      setCurrentReport('reset');
    }
  }, [isEditMode, report]);

  const onSave = async () => {
    const commonFields: Partial<ReportObject> = {
      type: 'Report',
      active: true,
      force_screenshot: false,
      custom_width: currentReport.custom_width,
      ...(creationMethod === CreationMethod.Charts
        ? { chart: chart?.id }
        : { dashboard: dashboardId }),
      name: currentReport.name,
      description: currentReport.description,
      crontab: currentReport.crontab,
      report_format: currentReport.report_format || defaultNotificationFormat,
      timezone: currentReport.timezone,
      ...(isFeatureEnabled(FeatureFlag.AlertReportsRetry) && {
        retry_on_failure: currentReport.retry_on_failure ?? false,
        retry_max_attempts: currentReport.retry_max_attempts ?? 3,
        send_failed_reports: currentReport.send_failed_reports ?? false,
        retry_notify_owners: currentReport.retry_notify_owners ?? true,
        retry_notify_recipients: currentReport.retry_notify_recipients ?? false,
      }),
    };

    setCurrentReport({ isSubmitting: true, error: undefined });
    try {
      if (isEditMode && currentReport.id) {
        // Edit path: include all fields, PUT endpoint accepts recipients/editors directly
        await dispatch(
          editReport(currentReport.id, {
            ...commonFields,
            creation_method: creationMethod,
            ...(currentUserSubjectId === undefined
              ? {}
              : { editors: [currentUserSubjectId] }),
            recipients: [
              {
                recipient_config_json: {
                  target: userEmail,
                  ccTarget: ccEmail,
                  bccTarget: bccEmail,
                },
                type: 'Email',
              },
            ],
          } as ReportObject),
        );
      } else {
        // Subscribe path: creation_method, editors, and recipients are set server-side.
        await dispatch(subscribeReport(commonFields as ReportObject));
      }
      onHide();
    } catch (e) {
      const { error } = await getClientErrorObject(e);
      setCurrentReport({ error });
    }
    setCurrentReport({ isSubmitting: false });
  };

  const wrappedTitle = (
    <StyledIconWrapper>
      <Icons.CalendarOutlined />
      <span className="text">
        {isEditMode ? t('Edit email report') : t('Schedule a new email report')}
      </span>
    </StyledIconWrapper>
  );

  const renderModalFooter = (
    <>
      <StyledFooterButton key="back" onClick={onHide}>
        {t('Cancel')}
      </StyledFooterButton>
      <StyledFooterButton
        key="submit"
        buttonStyle="primary"
        onClick={onSave}
        disabled={!currentReport.name}
        loading={currentReport.isSubmitting}
      >
        {isEditMode ? t('Save') : t('Add')}
      </StyledFooterButton>
    </>
  );

  const renderMessageContentSection = (
    <>
      <StyledMessageContentTitle>
        <Typography.Title level={4}>{t('Message content')}</Typography.Title>
      </StyledMessageContentTitle>
      <div className="inline-container">
        <Radio.GroupWrapper
          spaceConfig={{
            direction: 'vertical',
            size: 'middle',
            align: 'start',
            wrap: false,
          }}
          onChange={(event: RadioChangeEvent) => {
            setCurrentReport({ report_format: event.target.value });
          }}
          value={currentReport.report_format || defaultNotificationFormat}
          options={[
            {
              label: t('Text embedded in email'),
              value: NotificationFormats.Text,
            },
            {
              label: t('Image (PNG) embedded in email'),
              value: NotificationFormats.PNG,
            },
            {
              label: t('Formatted CSV attached in email'),
              value: NotificationFormats.CSV,
            },
            {
              label: t('Formatted Excel attached in email'),
              value: NotificationFormats.XLSX,
            },
          ]}
        />
      </div>
    </>
  );
  const renderCustomWidthSection = (
    <StyledInputContainer>
      <div className="control-label" css={CustomWidthHeaderStyle}>
        {t('Screenshot width')}
      </div>
      <div className="input-container">
        <Input
          type="number"
          name="custom_width"
          value={currentReport?.custom_width ?? ''}
          placeholder={t('Input custom width in pixels')}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const parsedWidth = parseInt(event.target.value, 10);
            setCurrentReport({
              custom_width: Number.isNaN(parsedWidth) ? null : parsedWidth,
            });
          }}
        />
      </div>
    </StyledInputContainer>
  );

  const retryEnabled = !!currentReport.retry_on_failure;

  const renderErrorHandlingSection = (
    <StyledErrorHandlingSection>
      <Typography.Title
        level={4}
        css={(theme: SupersetTheme) => SectionHeaderStyle(theme)}
      >
        {t('Error Handling')}
      </Typography.Title>
      <Checkbox
        checked={retryEnabled}
        onChange={(e: CheckboxChangeEvent) => {
          const { checked } = e.target;
          setCurrentReport({
            retry_on_failure: checked,
            ...(!checked && {
              send_failed_reports: false,
              retry_notify_owners: true,
              retry_notify_recipients: false,
              retry_max_attempts: 3,
            }),
          });
        }}
      >
        {t('Enable Retries')}
      </Checkbox>
      {retryEnabled && (
        <StyledRetryFieldGroup>
          <div>
            <div className="control-label">{t('Maximum Retry Attempts')}</div>
            <InputNumber
              min={1}
              max={10}
              value={currentReport.retry_max_attempts ?? 3}
              onChange={(value: number | null) =>
                setCurrentReport({ retry_max_attempts: value ?? 3 })
              }
            />
          </div>
          <Checkbox
            checked={!!currentReport.send_failed_reports}
            onChange={(e: CheckboxChangeEvent) =>
              setCurrentReport({ send_failed_reports: e.target.checked })
            }
          >
            {t('Send Failed Reports')}
          </Checkbox>
          <div>
            <div className="control-label">{t('Failure Notifications')}</div>
            <div>
              <Checkbox
                checked={currentReport.retry_notify_owners ?? true}
                onChange={(e: CheckboxChangeEvent) =>
                  setCurrentReport({ retry_notify_owners: e.target.checked })
                }
              >
                {t('Owners')}
              </Checkbox>
            </div>
            <div>
              <Checkbox
                checked={!!currentReport.retry_notify_recipients}
                onChange={(e: CheckboxChangeEvent) =>
                  setCurrentReport({
                    retry_notify_recipients: e.target.checked,
                  })
                }
              >
                {t('Report Recipients')}
              </Checkbox>
            </div>
          </div>
        </StyledRetryFieldGroup>
      )}
    </StyledErrorHandlingSection>
  );

  return (
    <StyledModal
      show={show}
      onHide={onHide}
      title={wrappedTitle}
      footer={renderModalFooter}
      width="432"
      centered
    >
      <StyledTopSection>
        <LabeledErrorBoundInput
          id="name"
          name="name"
          value={currentReport.name || ''}
          placeholder={initialState.name}
          required
          validationMethods={{
            onChange: ({ target }: { target: HTMLInputElement }) =>
              setCurrentReport({ name: target.value }),
          }}
          label={t('Report Name')}
          data-test="report-name-test"
        />
        <LabeledErrorBoundInput
          id="description"
          name="description"
          value={currentReport?.description || ''}
          validationMethods={{
            onChange: ({ target }: { target: HTMLInputElement }) => {
              setCurrentReport({ description: target.value });
            },
          }}
          label={t('Description')}
          placeholder={t(
            'Include a description that will be sent with your report',
          )}
          css={noBottomMargin}
          data-test="report-description-test"
        />
      </StyledTopSection>

      <StyledBottomSection>
        <StyledScheduleTitle>
          <Typography.Title
            level={5}
            css={(theme: SupersetTheme) => SectionHeaderStyle(theme)}
          >
            {t('Schedule')}
          </Typography.Title>
          <p>{t('The report will be sent to your email at')}</p>
        </StyledScheduleTitle>

        <StyledCronPicker
          clearButton={false}
          value={currentReport.crontab || '0 12 * * 1'}
          setValue={(newValue: string) => {
            setCurrentReport({ crontab: newValue });
          }}
          onError={setCronError}
        />
        <StyledCronError>{cronError?.description}</StyledCronError>
        <div
          className="control-label"
          css={(theme: SupersetTheme) => TimezoneHeaderStyle(theme)}
        >
          {t('Timezone')}
        </div>
        <TimezoneSelector
          timezone={currentReport.timezone}
          onTimezoneChange={value => {
            setCurrentReport({ timezone: value });
          }}
        />
        {isChart && renderMessageContentSection}
        {(!isChart || !isTextBasedChart) && renderCustomWidthSection}
        {isFeatureEnabled(FeatureFlag.AlertReportsRetry) &&
          renderErrorHandlingSection}
      </StyledBottomSection>
      {currentReport.error && (
        <Alert
          type="error"
          css={(theme: SupersetTheme) => antDErrorAlertStyles(theme)}
          message={
            isEditMode
              ? t('Failed to update report')
              : t('Failed to create report')
          }
          description={currentReport.error}
        />
      )}
    </StyledModal>
  );
}

export default withToasts(ReportModal);
