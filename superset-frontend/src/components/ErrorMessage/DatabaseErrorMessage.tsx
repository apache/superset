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
  source = 'dashboard',
  subtitle,
}: ErrorMessageComponentProps<DatabaseErrorExtra | null>) {
  const { extra, level, message } = error;

  const isVisualization = ['dashboard', 'explore'].includes(source);

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

  const copyText = extra?.issue_codes
    ? t('%(message)s\nThis may be triggered by: \n%(issues)s', {
        message,
        issues: extra.issue_codes
          .map(issueCode => issueCode.message)
          .join('\n'),
      })
    : message;

  return (
    <ErrorAlert
      title={t('%s Error', extra?.engine_name || t('DB engine'))}
      subtitle={subtitle}
      level={level}
      source={source}
      copyText={copyText}
      body={body}
    />
  );
}

export default DatabaseErrorMessage;
