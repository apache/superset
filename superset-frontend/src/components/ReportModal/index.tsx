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
  useState,
  useEffect,
  useReducer,
  useCallback,
  useMemo,
} from 'react';
import { t, SupersetTheme } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { addReport, editReport } from 'src/reports/actions/reports';
import Alert from 'src/components/Alert';
import TimezoneSelector from 'src/components/TimezoneSelector';
import LabeledErrorBoundInput from 'src/components/Form/LabeledErrorBoundInput';
import Icons from 'src/components/Icons';
import { CronError } from 'src/components/CronPicker';
import { RadioChangeEvent } from 'src/components';
import withToasts from 'src/components/MessageToasts/withToasts';
import { ChartState } from 'src/explore/types';
import {
  ReportCreationMethod,
  ReportObject,
  NOTIFICATION_FORMATS,
} from 'src/reports/types';
import { reportSelector } from 'src/views/CRUD/hooks';
import { DashboardLayout, DashboardState } from 'src/dashboard/types';
import { CreationMethod } from './HeaderReportDropdown';
import {
  antDErrorAlertStyles,
  StyledModal,
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
  StyledRadio,
  StyledRadioGroup,
} from './styles';

interface ReportProps {
  onHide: () => {};
  addDangerToast: (msg: string) => void;
  show: boolean;
  userId: number;
  userEmail: string;
  chart?: ChartState;
  chartName?: string;
  dashboardId?: number;
  dashboardName?: string;
  creationMethod: ReportCreationMethod;
}

const TEXT_BASED_VISUALIZATION_TYPES = [
  'pivot_table',
  'pivot_table_v2',
  'table',
  'paired_ttest',
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

export type SourceDashboardState = 'active' | 'default';

function ReportModal({
  onHide,
  show = false,
  dashboardId,
  chart,
  userId,
  userEmail,
  creationMethod,
  dashboardName,
  chartName,
}: ReportProps) {
  const vizType = chart?.sliceFormData?.viz_type;
  const isChart = !!chart;
  const isTextBasedChart =
    isChart && vizType && TEXT_BASED_VISUALIZATION_TYPES.includes(vizType);
  const defaultNotificationFormat = isTextBasedChart
    ? NOTIFICATION_FORMATS.TEXT
    : NOTIFICATION_FORMATS.PNG;
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
  const [sourceDashboardState, setSourceDashboardState] =
    useState<SourceDashboardState>('active');

  const dispatch = useDispatch();
  // Report fetch logic
  const { report, dashboardLayout, dashboardActiveTabs } = useSelector(
    (state: any) => ({
      report: reportSelector(
        state,
        dashboardId ? CreationMethod.DASHBOARDS : CreationMethod.CHARTS,
        dashboardId ?? chart?.id,
      ) as ReportObject,
      dashboardLayout: state.dashboardLayout?.present as DashboardLayout,
      dashboardActiveTabs: state.dashboardState
        ?.activeTabs as DashboardState['activeTabs'],
    }),
  );

  const isEditMode = report && Object.keys(report).length;

  useEffect(() => {
    if (isEditMode) {
      setCurrentReport(report);
    } else {
      setCurrentReport('reset');
    }
  }, [isEditMode, report]);

  const onSave = async () => {
    const dashboardExtra =
      dashboardId && dashboardActiveTabs?.length > 0
        ? {
            dashboard: {
              active_tabs: dashboardActiveTabs,
            },
          }
        : {};
    // Create new Report
    const newReportValues: Partial<ReportObject> = {
      type: 'Report',
      active: true,
      force_screenshot: false,
      creation_method: creationMethod,
      dashboard: dashboardId,
      chart: chart?.id,
      owners: [userId],
      recipients: [
        {
          recipient_config_json: { target: userEmail },
          type: 'Email',
        },
      ],
      name: currentReport.name,
      description: currentReport.description,
      crontab: currentReport.crontab,
      report_format: currentReport.report_format || defaultNotificationFormat,
      timezone: currentReport.timezone,
      extra: {
        ...currentReport.extra,
        ...dashboardExtra,
      },
    };

    setCurrentReport({ isSubmitting: true, error: undefined });
    try {
      if (isEditMode) {
        await dispatch(
          editReport(currentReport.id, newReportValues as ReportObject),
        );
      } else {
        await dispatch(addReport(newReportValues as ReportObject));
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
      <Icons.Calendar />
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
        <h4>{t('Message content')}</h4>
      </StyledMessageContentTitle>
      <div className="inline-container">
        <StyledRadioGroup
          onChange={(event: RadioChangeEvent) => {
            setCurrentReport({ report_format: event.target.value });
          }}
          value={currentReport.report_format || defaultNotificationFormat}
        >
          {isTextBasedChart && (
            <StyledRadio value={NOTIFICATION_FORMATS.TEXT}>
              {t('Text embedded in email')}
            </StyledRadio>
          )}
          <StyledRadio value={NOTIFICATION_FORMATS.PNG}>
            {t('Image (PNG) embedded in email')}
          </StyledRadio>
          <StyledRadio value={NOTIFICATION_FORMATS.CSV}>
            {t('Formatted CSV attached in email')}
          </StyledRadio>
        </StyledRadioGroup>
      </div>
    </>
  );

  const renderDashboardTabSection = () => {
    // only show this section if dashboard report and dashboard has tab(s)
    if (!dashboardLayout || !dashboardActiveTabs) {
      return null;
    }
    return (
      <>
        <StyledMessageContentTitle>
          <h4>{t('Dashboard tabs')}</h4>
        </StyledMessageContentTitle>
        <p>{t('Capture screenshots for the scheduled report from')}</p>
        <div className="inline-container">
          <StyledRadioGroup
            name="source_dashbaord_sate"
            onChange={(event: RadioChangeEvent) => {
              setSourceDashboardState(event.target.value);
            }}
            value={sourceDashboardState}
          >
            <StyledRadio value="active">
              {t('Current selected tabs')}
            </StyledRadio>
            <StyledRadio value="default">
              {t('Default dashboard view')}
            </StyledRadio>
          </StyledRadioGroup>
        </div>
      </>
    );
  };

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
          label="Report Name"
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
          <h4 css={(theme: SupersetTheme) => SectionHeaderStyle(theme)}>
            {t('Schedule')}
          </h4>
          <p>{t('A screenshot of the dashboard will be sent to your email')}</p>
        </StyledScheduleTitle>

        <StyledCronPicker
          clearButton={false}
          value={currentReport.crontab || '0 12 * * 1'}
          setValue={(newValue: string) => {
            setCurrentReport({ crontab: newValue });
          }}
          onError={setCronError}
        />
        <StyledCronError>{cronError}</StyledCronError>
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
        {dashboardLayout && dashboardActiveTabs && renderDashboardTabSection()}
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
