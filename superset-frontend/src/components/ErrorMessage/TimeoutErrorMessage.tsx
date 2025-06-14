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
import { ReactNode } from 'react';
import { t, tn } from '@superset-ui/core';

import { ErrorMessageComponentProps } from './types';
import IssueCode from './IssueCode';
import ErrorAlert from './ErrorAlert';

interface TimeoutErrorExtra {
  issue_codes: {
    code: number;
    message: string;
  }[];
  owners?: string[];
  timeout: number;
}

function TimeoutErrorMessage({
  error,
  source,
}: ErrorMessageComponentProps<TimeoutErrorExtra>) {
  const { extra, level } = error;

  const isVisualization = (
    ['dashboard', 'explore'] as (string | undefined)[]
  ).includes(source);

  const subtitle = isVisualization
    ? tn(
        'We’re having trouble loading this visualization. Queries are set to timeout after %s second.',
        'We’re having trouble loading this visualization. Queries are set to timeout after %s seconds.',
        extra.timeout,
        extra.timeout,
      )
    : tn(
        'We’re having trouble loading these results. Queries are set to timeout after %s second.',
        'We’re having trouble loading these results. Queries are set to timeout after %s seconds.',
        extra.timeout,
        extra.timeout,
      );

  const body = (
    <>
      <p>
        {t('This may be triggered by:')}
        <br />
        {extra.issue_codes
          .map<ReactNode>(issueCode => <IssueCode {...issueCode} />)
          .reduce((prev, curr) => [prev, <br />, curr])}
      </p>
      {isVisualization && extra.owners && (
        <>
          <br />
          <p>
            {tn(
              'Please reach out to the Chart Owner for assistance.',
              'Please reach out to the Chart Owners for assistance.',
              extra.owners.length,
            )}
          </p>
          <p>
            {tn(
              'Chart Owner: %s',
              'Chart Owners: %s',
              extra.owners.length,
              extra.owners.join(', '),
            )}
          </p>
        </>
      )}
    </>
  );

  return (
    <ErrorAlert
      errorType={t('Timeout error')}
      message={subtitle}
      type={level}
      descriptionDetails={body}
    />
  );
}

export default TimeoutErrorMessage;
