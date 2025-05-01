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

interface DatabaseErrorExtra {
  owners?: string[];
  issue_codes: {
    code: number;
    message: string;
  }[];
  engine_name: string | null;
}

function DatabaseErrorMessage({
  error,
  source,
  subtitle,
}: ErrorMessageComponentProps<DatabaseErrorExtra | null>) {
  const { extra, level, message } = error;

  const isVisualization = ['dashboard', 'explore'].includes(source || '');
  const [firstLine, ...remainingLines] = message.split('\n');
  const alertMessage = firstLine;
  const alertDescription =
    remainingLines.length > 0 ? remainingLines.join('\n') : null;

  const body = extra && (
    <>
      <p>
        {t('This may be triggered by:')}
        <br />
        {extra.issue_codes
          ?.map<ReactNode>(issueCode => (
            <IssueCode {...issueCode} key={issueCode.code} />
          ))
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
      errorType={t('%s Error', extra?.engine_name || t('DB engine'))}
      message={alertMessage}
      description={alertDescription}
      type={level}
      descriptionDetails={body}
    />
  );
}

export default DatabaseErrorMessage;
