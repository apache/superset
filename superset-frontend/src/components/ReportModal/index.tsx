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
  FunctionComponent,
  useCallback,
  useMemo,
} from 'react';
import { t, SupersetTheme } from '@superset-ui/core';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { useDispatch, useSelector } from 'react-redux';
import { addReport, editReport } from 'src/reports/actions/reports';

import Alert from 'src/components/Alert';
import TimezoneSelector from 'src/components/TimezoneSelector';
import LabeledErrorBoundInput from 'src/components/Form/LabeledErrorBoundInput';
import Icons from 'src/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import { CronError } from 'src/components/CronPicker';
import { RadioChangeEvent } from 'src/components';
import { ChartState } from 'src/explore/types';
<<<<<<< HEAD
import {
  ReportCreationMethod,
  ReportRecipientType,
  ReportScheduleType,
} from 'src/reports/types';
=======
>>>>>>> code dry (#16358)
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

export interface ReportObject {
  id?: number;
  active: boolean;
  crontab: string;
  dashboard?: number;
  chart?: number;
  description?: string;
  log_retention: number;
  name: string;
  owners: number[];
  recipients: [
    { recipient_config_json: { target: string }; type: ReportRecipientType },
  ];
  report_format: string;
  timezone: string;
  type: ReportScheduleType;
  validator_config_json: {} | null;
  validator_type: string;
  working_timeout: number;
  creation_method: string;
  force_screenshot: boolean;
}

interface ReportProps {
  onHide: () => {};
  onReportAdd: (report?: ReportObject) => {};
  addDangerToast: (msg: string) => void;
  show: boolean;
  userId: number;
  userEmail: string;
  chart?: ChartState;
  chartName?: string;
  dashboardId?: number;
  dashboardName?: string;
  creationMethod: ReportCreationMethod;
  props: any;
}

const TEXT_BASED_VISUALIZATION_TYPES = [
  'pivot_table',
  'pivot_table_v2',
  'table',
  'paired_ttest',
];

const NOTIFICATION_FORMATS = {
  TEXT: 'TEXT',
  PNG: 'PNG',
  CSV: 'CSV',
};

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

const ReportModal: FunctionComponent<ReportProps> = ({
  onReportAdd,
  onHide,
  show = false,
  dashboardId,
  chart,
  userId,
  userEmail,
<<<<<<< HEAD
  creationMethod,
  ...props
}) => {
  const vizType = chart?.sliceFormData?.viz_type;
  const isChart = !!chart;
  const isTextBasedChart =
    isChart && vizType && TEXT_BASED_VISUALIZATION_TYPES.includes(vizType);
  const defaultNotificationFormat = isTextBasedChart
    ? NOTIFICATION_FORMATS.TEXT
    : NOTIFICATION_FORMATS.PNG;
  const entityName = props.dashboardName || props.chartName;
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
=======
  props,
}) => {
  const vizType = chart?.sliceFormData?.viz_type;
  const isChart = !!chart;
  const defaultNotificationFormat =
    vizType && TEXT_BASED_VISUALIZATION_TYPES.includes(vizType)
      ? NOTIFICATION_FORMATS.TEXT
      : NOTIFICATION_FORMATS.PNG;
  const [currentReport, setCurrentReport] = useReducer<
    Reducer<Partial<ReportObject> | null, ReportActionType>
  >(reportReducer, null);
  const onReducerChange = useCallback((type: any, payload: any) => {
    setCurrentReport({ type, payload });
  }, []);
>>>>>>> code dry (#16358)
  const [cronError, setCronError] = useState<CronError>();

  const dispatch = useDispatch();
  const reports = useSelector<any, ReportObject>(state => state.reports);
  const isEditMode = reports && Object.keys(reports).length;

  useEffect(() => {
    if (isEditMode) {
      const reportsIds = Object.keys(reports);
      const report = reports[reportsIds[0]];
      setCurrentReport(report);
    } else {
      setCurrentReport('reset');
    }
  }, [isEditMode, reports]);

  const onSave = async () => {
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

    if (onReportAdd) onReportAdd();
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
<<<<<<< HEAD
          {isTextBasedChart && (
=======
          {vizType && TEXT_BASED_VISUALIZATION_TYPES.includes(vizType) && (
>>>>>>> code dry (#16358)
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
          <p>
            {t('A screenshot of the dashboard will be sent to your email at')}
          </p>
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
};

export default withToasts(ReportModal);
