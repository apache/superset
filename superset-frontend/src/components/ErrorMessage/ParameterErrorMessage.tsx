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
import React from 'react';
import { t } from '@superset-ui/core';

import { ErrorMessageComponentProps } from './types';
import IssueCode from './IssueCode';
import ErrorAlert from './ErrorAlert';

interface ParameterErrorExtra {
  undefined_parameters?: string[];
  template_parameters?: object;
  issue_codes: {
    code: number;
    message: string;
  }[];
}

const triggerMessage = t('This may be triggered by:');

function ParameterErrorMessage({
  error,
  source = 'sqllab',
}: ErrorMessageComponentProps<ParameterErrorExtra>) {
  const { extra, level, message } = error;

  const body = (
    <>
      <p>
        {triggerMessage}
        <br />
        {extra.issue_codes
          .map<React.ReactNode>(issueCode => <IssueCode {...issueCode} />)
          .reduce((prev, curr) => [prev, <br />, curr])}
      </p>
    </>
  );

  const copyText = `${message}
${triggerMessage}
${extra.issue_codes.map(issueCode => issueCode.message).join('\n')}`;

  return (
    <ErrorAlert
      title={t('Parameter Error')}
      subtitle={message}
      level={level}
      source={source}
      copyText={copyText}
      body={body}
    />
  );
}

export default ParameterErrorMessage;
