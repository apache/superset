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
  useCallback,
  useReducer,
  Reducer,
  FunctionComponent,
} from 'react';
import { styled, css, t } from '@superset-ui/core';

import LabeledErrorBoundInput from 'src/components/Form/LabeledErrorBoundInput';
import Icons from 'src/components/Icons';
import Modal from 'src/components/Modal';
import { CronPicker, CronError } from 'src/components/CronPicker';

interface ReportProps {
  onHide: () => {};
  show: boolean;
  props: any;
}

interface ReportObject {
  active: boolean;
  crontab: string;
  dashboard: number;
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

const StyledModal = styled(Modal)`
  .ant-modal-body {
    padding: 0;
  }
`;

const StyledTopSection = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const StyledBottomSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const StyledIconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
`;

const StyledScheduleTitle = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 7}px;
`;

const noBottomMargin = css`
  margin-bottom: 0;
`;

const ReportModal: FunctionComponent<ReportProps> = ({
  show = false,
  onHide,
  props,
}) => {
  const [currentReport, setCurrentReport] = useReducer<
    Reducer<Partial<ReportObject> | null, ReportActionType>
  >(reportReducer, null);
  const onChange = useCallback((type: any, payload: any) => {
    setCurrentReport({ type, payload } as ReportActionType);
  }, []);
  const [error, setError] = useState<CronError>();

  const wrappedTitle = (
    <StyledIconWrapper>
      <Icons.Calendar />
      <span className="text">{t('New Email Report')}</span>
    </StyledIconWrapper>
  );

  return (
    <StyledModal show={show} onHide={onHide} title={wrappedTitle}>
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
        />
      </StyledTopSection>

      <StyledBottomSection>
        <StyledScheduleTitle>
          <h1>Schedule</h1>
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
        <p>{error}</p>
      </StyledBottomSection>
    </StyledModal>
  );
};

export default ReportModal;
