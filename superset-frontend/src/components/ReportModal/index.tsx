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
  FunctionComponent,
} from 'react';
import { t } from '@superset-ui/core';
import { useSingleViewResource } from 'src/views/CRUD/hooks';

import { bindActionCreators } from 'redux';
import { connect, useDispatch } from 'react-redux';
import { addReport } from 'src/reports/actions/reportState';

import LabeledErrorBoundInput from 'src/components/Form/LabeledErrorBoundInput';
import Icons from 'src/components/Icons';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { CronPicker, CronError } from 'src/components/CronPicker';
import {
  StyledModal,
  StyledTopSection,
  StyledBottomSection,
  StyledIconWrapper,
  StyledScheduleTitle,
  StyledCronError,
  noBottomMargin,
  StyledFooterButton,
} from './styles';

interface ReportObject {
  active: boolean;
  crontab: string;
  dashboard?: number;
  chart?: number;
  description?: string;
  log_retention: number;
  name: string;
  owners: number[];
  recipients: [{ recipient_config_json: { target: string }; type: string }];
  report_format: string;
  type: string;
  validator_config_json: {} | null;
  validator_type: string;
  working_timeout: number;
  creation_method: string;
}

interface ReportProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  addReport: (report?: ReportObject) => {};
  onHide: () => {};
  onReportAdd: (report?: ReportObject) => {};
  show: boolean;
  userId: number;
  userEmail: string;
  dashboardId?: number;
  chartId?: number;
  creationMethod: string;
  props: any;
}

enum ActionType {
  textChange,
  inputChange,
  fetched,
}

interface ReportPayloadType {
  name: string;
  description: string;
  crontab: string;
  value: string;
}

type ReportActionType =
  | {
      type: ActionType.textChange | ActionType.inputChange;
      payload: ReportPayloadType;
    }
  | {
      type: ActionType.fetched;
      payload: Partial<ReportObject>;
    };

const reportReducer = (
  state: Partial<ReportObject> | null,
  action: ReportActionType,
): Partial<ReportObject> | null => {
  const trimmedState = {
    ...(state || {}),
  };

  switch (action.type) {
    case ActionType.textChange:
      return {
        ...trimmedState,
        [action.payload.name]: action.payload.value,
      };
    default:
      return state;
  }
};

const ReportModal: FunctionComponent<ReportProps> = ({
  addDangerToast,
  onReportAdd,
  onHide,
  show = false,
  ...props
}) => {
  const [currentReport, setCurrentReport] = useReducer<
    Reducer<Partial<ReportObject> | null, ReportActionType>
  >(reportReducer, null);
  const onChange = useCallback((type: any, payload: any) => {
    setCurrentReport({ type, payload } as ReportActionType);
  }, []);
  const [error, setError] = useState<CronError>();
  // ---------- comments on lines 139-159 & 182 are being held for edit functionality
  // const [hasConnectedReport, setHasConnectedReport] = useState<boolean>(false);
  // const [isLoading, setLoading] = useState<boolean>(false);
  const dispatch = useDispatch();

  // Report fetch logic
  // const {
  //   state: { resource },
  // } = useSingleViewResource<ReportObject>(
  //   'report',
  //   t('report'),
  //   addDangerToast,
  // );

  // useEffect(() => {
  //   if (resource?.dashboard) {
  //     setHasConnectedReport(true);
  //   }
  // }, [resource?.dashboard]);

  const onClose = () => {
    // setLoading(false);
    onHide();
  };

  const onSave = async () => {
    // Create new Report
    const newReportValues: Partial<ReportObject> = {
      crontab: currentReport?.crontab,
      dashboard: props.props.dashboardId,
      chart: props.props.chartId,
      description: currentReport?.description,
      name: currentReport?.name || 'Weekly Report',
      owners: [props.props.userId],
      recipients: [
        {
          recipient_config_json: { target: props.props.userEmail },
          type: 'Email',
        },
      ],
      type: 'Report',
      creation_method: props.props.creationMethod,
    };

    // setLoading(true);
    await dispatch(addReport(newReportValues as ReportObject));

    if (onReportAdd) {
      onReportAdd();
    }

    onClose();
  };

  const wrappedTitle = (
    <StyledIconWrapper>
      <Icons.Calendar />
      <span className="text">{t('New Email Report')}</span>
    </StyledIconWrapper>
  );

  const renderModalFooter = (
    <>
      <StyledFooterButton key="back" onClick={onClose}>
        Cancel
      </StyledFooterButton>
      <StyledFooterButton key="submit" buttonStyle="primary" onClick={onSave}>
        Add
      </StyledFooterButton>
    </>
  );

  return (
    <StyledModal
      show={show}
      onHide={onClose}
      title={wrappedTitle}
      footer={renderModalFooter}
      width="432"
      centered
    >
      <StyledTopSection>
        <LabeledErrorBoundInput
          id="name"
          name="name"
          value={currentReport?.name || 'Weekly Report'}
          required
          validationMethods={{
            onChange: ({ target }: { target: HTMLInputElement }) =>
              onChange(ActionType.textChange, {
                name: target.name,
                value: target.value,
              }),
          }}
          errorMessage={
            currentReport?.name === 'error' ? t('REPORT NAME ERROR') : ''
          }
          label="Report Name"
          data-test="report-name-test"
        />

        <LabeledErrorBoundInput
          id="description"
          name="description"
          value={currentReport?.description || ''}
          validationMethods={{
            onChange: ({ target }: { target: HTMLInputElement }) =>
              onChange(ActionType.textChange, {
                name: target.name,
                value: target.value,
              }),
          }}
          errorMessage={
            currentReport?.description === 'error' ? t('DESCRIPTION ERROR') : ''
          }
          label="Description"
          placeholder="Include a description that will be sent with your report"
          css={noBottomMargin}
          data-test="report-description-test"
        />
      </StyledTopSection>

      <StyledBottomSection>
        <StyledScheduleTitle>
          <h2>Schedule</h2>
          <p>Scheduled reports will be sent to your email as a PNG</p>
        </StyledScheduleTitle>

        <CronPicker
          clearButton={false}
          value={currentReport?.crontab || '0 12 * * 1'}
          setValue={(newValue: string) => {
            onChange(ActionType.textChange, {
              name: 'crontab',
              value: newValue,
            });
          }}
          onError={setError}
        />
        <StyledCronError>{error}</StyledCronError>
      </StyledBottomSection>
    </StyledModal>
  );
};

const mapDispatchToProps = (dispatch: any) =>
  bindActionCreators({ addReport }, dispatch);

export default connect(null, mapDispatchToProps)(withToasts(ReportModal));
