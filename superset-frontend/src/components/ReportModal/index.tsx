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
import React, { FunctionComponent } from 'react';
import { styled, t } from '@superset-ui/core';

import LabeledErrorBoundInput from 'src/components/Form/LabeledErrorBoundInput';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import Modal from 'src/components/Modal';

export interface ReportModalProps {
  active: boolean;
  crontab: string;
  dashboard: number;
  description?: string;
  log_retention: number;
  name: string;
  owners: string;
  recipients: [{ recipient_config_json: { target: string }; type: string }];
  report_format: string;
  type: string;
  validator_config_json: {} | null;
  validator_type: string;
  working_timeout: number;
  onHide: () => {};
  show: boolean;
}

/*
Using this on both Charts and Dashboard
dashboard will pass in all the information
OnEdit - fetch on dashboard page
OnSave will be passed in as well
Reducer will live on the dashboard
Go ahead and put in the dashboard, hide button except locally

{
  active: true (always true)
  crontab: "0 * * * *” (set by UI)
  dashboard: 1 (id of dashboard)
  description: "Here's a description” (optional and set by user)
  log_retention: 90 (always 90)
  name: "test api” (required and set by user. Ask Sophie about a default value)
  owners: [1] (array containing the id of the user from redux)
  recipients: [{recipient_config_json: {target: "elizabeth@preset.io"}, type: "Email”}] (take email address from redux and keep this json structure)
  report_format: “PNG” (always send this value)
  type: “Report" (always send this value)
  validator_config_json: {} (we can try deleting or sending null, but this will always be blank or {}
  validator_type: “operator"  (always send this value)
  working_timeout: 3600
}
*/

const StyledIconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => 2 * theme.gridUnit}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
`;

const ReportModal: FunctionComponent<ReportModalProps> = ({
  active,
  crontab,
  dashboard,
  description,
  log_retention,
  name,
  owners,
  recipients,
  report_format,
  type,
  validator_config_json,
  validator_type,
  working_timeout,
  show = false,
  onHide,
}) => {
  const wrappedTitle = (
    <StyledIconWrapper>
      <Icons.EditAlt />
      <span className="text">{t('Edit Email Report')}</span>
    </StyledIconWrapper>
  );

  return (
    <Modal show={show} onHide={onHide} title={wrappedTitle}>
      {/* 🚧 - Unsure of:
        validationMethods,
        errorMessage
       */}
      <LabeledErrorBoundInput
        id="name"
        name="name"
        value={name}
        required
        validationMethods={{ onChange: () => {} }}
        errorMessage={name === 'error' ? t('REPORT NAME ERROR') : ''}
        label="Report Name"
      />
      <LabeledErrorBoundInput
        id="description"
        name="description"
        value={description}
        validationMethods={{ onChange: () => {} }}
        errorMessage={name === 'error' ? t('DESCRIPTION ERROR') : ''}
        label="Description"
        placeholder="Include a description that will be sent with your report"
      />
      <h1>Schedule</h1>
      <p>Scheduled reports will be sent to your email as a PNG</p>
    </Modal>
  );
};

export default ReportModal;
