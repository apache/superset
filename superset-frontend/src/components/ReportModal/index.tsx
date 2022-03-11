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
  useCallback,
  useReducer,
  Reducer,
} from 'react';
import { t, SupersetTheme } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { addReport, editReport } from 'src/reports/actions/reports';
import TimezoneSelector from 'src/components/TimezoneSelector';
import LabeledErrorBoundInput from 'src/components/Form/LabeledErrorBoundInput';
import Icons from 'src/components/Icons';
import withToasts from 'src/components/MessageToasts/withToasts';
import { CronError } from 'src/components/CronPicker';
import { RadioChangeEvent } from 'src/components';
import { ReportObject, NOTIFICATION_FORMATS } from 'src/views/CRUD/alert/types';
import { ChartState } from 'src/explore/types';
import { reportSelector } from 'src/views/CRUD/hooks';
import { ReportType } from 'src/dashboard/util/constants';
import {
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

const errorMapping = {
  'Name must be unique': t(
    'A report with this name exists, please enter a new name.',
  ),
};
interface ReportProps {
  addReport: (report?: ReportObject) => {};
  onHide: () => void;
  onReportAdd: (report?: ReportObject) => {};
  showModal?: boolean;
  userId: number;
  userEmail: string;
  dashboardId?: number;
  chart?: ChartState;
  props?: any;
}

interface ReportPayloadType {
  name: string;
  value: string;
}

enum ActionType {
  inputChange,
  fetched,
  reset,
  error,
}

type ReportActionType =
  | {
      type: ActionType.inputChange;
      payload: ReportPayloadType;
    }
  | {
      type: ActionType.fetched;
      payload: Partial<ReportObject>;
    }
  | {
      type: ActionType.reset;
    }
  | {
      type: ActionType.error;
      payload: {
        name: string[];
      };
    };

const TEXT_BASED_VISUALIZATION_TYPES = [
  'pivot_table',
  'pivot_table_v2',
  'table',
  'paired_ttest',
];

const reportReducer = (
  state: Partial<ReportObject> | null,
  action: ReportActionType,
): Partial<ReportObject> | null => {
  const initialState = {
    name: 'Weekly Report',
  };

  switch (action.type) {
    case ActionType.inputChange:
      return {
        ...initialState,
        ...state,
        [action.payload.name]: action.payload.value,
      };
    case ActionType.fetched:
      return {
        ...initialState,
        ...action.payload,
      };
    case ActionType.reset:
      return { ...initialState };
    case ActionType.error:
      return {
        ...state,
        error: action.payload.name[0],
      };
    default:
      return state;
  }
};

function ReportModal({
  onReportAdd,
  onHide,
  showModal = false,
  dashboardId,
  chart,
  userId,
  userEmail,
}: ReportProps) {
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
  const [cronError, setCronError] = useState<CronError>();
  const dispatch = useDispatch();
  // Report fetch logic
  const report = useSelector<any, ReportObject>(state => {
    const resourceType = dashboardId
      ? ReportType.DASHBOARDS
      : ReportType.CHARTS;
    return reportSelector(state, resourceType, dashboardId || chart?.id);
  });
  const isEditMode = report && Object.keys(report).length;

  useEffect(() => {
    if (isEditMode) {
      setCurrentReport({
        type: ActionType.fetched,
        payload: report,
      });
    } else {
      setCurrentReport({
        type: ActionType.reset,
      });
    }
  }, [report]);

  const onSave = async () => {
    // Create new Report
    const newReportValues: Partial<ReportObject> = {
      crontab: currentReport?.crontab,
      dashboard: dashboardId,
      chart: chart?.id,
      description: currentReport?.description,
      name: currentReport?.name,
      owners: [userId],
      recipients: [
        {
          recipient_config_json: { target: userEmail },
          type: 'Email',
        },
      ],
      type: 'Report',
      creation_method: dashboardId ? 'dashboards' : 'charts',
      active: true,
      report_format: currentReport?.report_format || defaultNotificationFormat,
      timezone: currentReport?.timezone,
      force_screenshot: false,
    };

    if (isEditMode) {
      await dispatch(
        editReport(currentReport?.id, newReportValues as ReportObject),
      );
      onHide();
    } else {
      try {
        await dispatch(addReport(newReportValues as ReportObject));
        onHide();
      } catch (e) {
        const parsedError = await getClientErrorObject(e);
        const errorMessage = parsedError.message;
        onReducerChange(ActionType.error, errorMessage);
      }
    }

    if (onReportAdd) onReportAdd();
  };

  const wrappedTitle = (
    <StyledIconWrapper>
      <Icons.Calendar />
      <span className="text">
        {isEditMode ? t('Edit Email Report') : t('New Email Report')}
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
        disabled={!currentReport?.name}
      >
        {isEditMode ? t('Save') : t('Add')}
      </StyledFooterButton>
    </>
  );

  const renderMessageContentSection = (
    <>
      <StyledMessageContentTitle>
        <h4>{t('Message Content')}</h4>
      </StyledMessageContentTitle>
      <div className="inline-container">
        <StyledRadioGroup
          onChange={(event: RadioChangeEvent) => {
            onReducerChange(ActionType.inputChange, {
              name: 'report_format',
              value: event.target.value,
            });
          }}
          value={currentReport?.report_format || defaultNotificationFormat}
        >
          {vizType && TEXT_BASED_VISUALIZATION_TYPES.includes(vizType) && (
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

  const renderErrorMessage =
    currentReport?.error &&
    (errorMapping[currentReport.error] || currentReport?.error);

  return (
    <StyledModal
      show={showModal}
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
          value={currentReport?.name || ''}
          placeholder={t('Weekly Report')}
          required
          validationMethods={{
            onChange: ({ target }: { target: HTMLInputElement }) =>
              onReducerChange(ActionType.inputChange, {
                name: target.name,
                value: target.value,
              }),
          }}
          errorMessage={renderErrorMessage || ''}
          label="Report Name"
          data-test="report-name-test"
        />

        <LabeledErrorBoundInput
          id="description"
          name="description"
          value={currentReport?.description || ''}
          validationMethods={{
            onChange: ({ target }: { target: HTMLInputElement }) =>
              onReducerChange(ActionType.inputChange, {
                name: target.name,
                value: target.value,
              }),
          }}
          errorMessage=""
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
          <p>{t('Scheduled reports will be sent to your email as a PNG')}</p>
        </StyledScheduleTitle>

        <StyledCronPicker
          clearButton={false}
          value={t(currentReport?.crontab || '0 12 * * 1')}
          setValue={(newValue: string) => {
            onReducerChange(ActionType.inputChange, {
              name: 'crontab',
              value: newValue,
            });
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
          onTimezoneChange={value => {
            setCurrentReport({
              type: ActionType.inputChange,
              payload: { name: 'timezone', value },
            });
          }}
          timezone={currentReport?.timezone}
        />
        {isChart && renderMessageContentSection}
      </StyledBottomSection>
    </StyledModal>
  );
}

export default withToasts(ReportModal);
