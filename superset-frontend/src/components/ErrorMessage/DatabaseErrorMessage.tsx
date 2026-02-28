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
import { t } from '@apache-superset/core';
import { tn } from '@apache-superset/core';

import type { ErrorMessageComponentProps } from './types';
import { IssueCode } from './IssueCode';
import { ErrorAlert } from './ErrorAlert';
import { CustomDocLink, CustomDocLinkProps } from './CustomDocLink';

interface DatabaseErrorExtra {
  owners?: string[];
  issue_codes: {
    code: number;
    message: string;
  }[];
  engine_name: string | null;
  custom_doc_links?: CustomDocLinkProps[];
  show_issue_info?: boolean;
}

export function DatabaseErrorMessage({
  error,
  source,
  closable,
}: ErrorMessageComponentProps<DatabaseErrorExtra | null>) {
  const { extra, level, message } = error;

  const isVisualization = ['dashboard', 'explore'].includes(source || '');
  const [firstLine, ...remainingLines] = message.split('\n');
  const alertDescription =
    remainingLines.length > 0 ? remainingLines.join('\n') : null;
  let alertMessage: ReactNode = firstLine;

  if (Array.isArray(extra?.custom_doc_links)) {
    alertMessage = (
      <>
        {firstLine}
        {extra.custom_doc_links.map(link => (
          <div key={link.url}>
            <CustomDocLink {...link} />
          </div>
        ))}
      </>
    );
  }

  const body = extra && extra.show_issue_info !== false && (
    <>
      <p>
        {t('This may be triggered by:')}
        <br />
        {extra.issue_codes?.flatMap((issueCode, idx, arr) => [
          <IssueCode {...issueCode} key={issueCode.code} />,
          idx < arr.length - 1 ? <br key={`br-${issueCode.code}`} /> : null,
        ])}
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
      closable={closable}
    />
  );
}
