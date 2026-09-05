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
import { t, tn } from '@apache-superset/core/translation';
import { isDefined } from '@superset-ui/core';
import { Typography } from '@superset-ui/core/components';

import type { ErrorMessageComponentProps } from './types';
import { IssueCode } from './IssueCode';
import { ErrorAlert } from './ErrorAlert';

interface DatasourceSecurityAccessExtra {
  owners?: string[];
  link?: string;
  datasource?: number | string;
  is_access_denial?: boolean;
  tables?: string[];
  issue_codes?: {
    code: number;
    message: string;
  }[];
}

/**
 * Shown when a viewer opens a chart but lacks permission to its underlying data
 * (DATASOURCE_SECURITY_ACCESS_ERROR / TABLE_SECURITY_ACCESS_ERROR). Surfaces a
 * plain-language explanation, who to contact, and a "Request access" link when
 * the deployment configures PERMISSION_INSTRUCTIONS_LINK.
 */
export function DatasourceSecurityAccessErrorMessage({
  error,
  source,
  closable,
  compact,
}: ErrorMessageComponentProps<DatasourceSecurityAccessExtra | null>) {
  const { extra, level, message } = error;
  const isVisualization = ['dashboard', 'explore'].includes(source || '');

  // DATASOURCE_SECURITY_ACCESS_ERROR is also raised for non-access failures
  // (e.g. virtual-dataset SQL validation: "Only SELECT statements are
  // allowed"). Those errors carry no access payload — render them plainly
  // rather than misleading the user with request-access guidance.
  //
  // `datasource` is the pre-`is_access_denial` shape of the payload; accepting
  // it keeps this guidance working while a rolling deploy still has older API
  // pods answering. It never appears on the non-access failures above.
  const isAccessDenial =
    !!extra?.tables?.length ||
    !!extra?.is_access_denial ||
    isDefined(extra?.datasource);
  if (!isAccessDenial) {
    return (
      <ErrorAlert
        errorType={t('Unexpected error')}
        message={message}
        type={level}
        closable={closable}
        compact={compact}
      />
    );
  }

  let explanation: string;
  if (extra?.tables?.length) {
    explanation = isVisualization
      ? t(
          'You do not have access to the data behind this chart ' +
            '(tables: %s).',
          extra.tables.join(', '),
        )
      : t(
          'You do not have access to the following tables: %s.', // sqllab
          extra.tables.join(', '),
        );
  } else {
    // Access denial without identifying the dataset to the unauthorized user.
    explanation = isVisualization
      ? t('You do not have permission to view this chart\u2019s data.')
      : t('You do not have permission to view this data.');
  }

  const owners = extra?.owners;
  const ownerLine =
    isVisualization && owners && owners.length > 0
      ? tn(
          'To request access, reach out to the chart owner: %s.',
          'To request access, reach out to the chart owners: %s.',
          owners.length,
          owners.join(', '),
        )
      : t('To request access, contact your Superset administrator.');

  // Actionable guidance stays visible (not collapsed): who to contact + link.
  const description: ReactNode = (
    <>
      <div>{ownerLine}</div>
      {extra?.link && (
        <Typography.Link
          href={extra.link}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('Request access')}
        </Typography.Link>
      )}
    </>
  );

  // Technical detail is collapsible: issue codes and the raw backend message.
  const hasIssueCodes = !!extra?.issue_codes && extra.issue_codes.length > 0;
  const descriptionDetails: ReactNode =
    hasIssueCodes || message ? (
      <>
        {hasIssueCodes && (
          <p>
            {t('This may be triggered by:')}
            <br />
            {extra?.issue_codes?.flatMap((issueCode, idx, arr) => [
              <IssueCode {...issueCode} key={issueCode.code} />,
              idx < arr.length - 1 ? <br key={`br-${issueCode.code}`} /> : null,
            ])}
          </p>
        )}
        {message && <pre>{message}</pre>}
      </>
    ) : undefined;

  return (
    <ErrorAlert
      errorType={
        isVisualization
          ? t("You don't have access to this chart's data")
          : t("You don't have access to this data")
      }
      message={explanation}
      description={description}
      descriptionDetails={descriptionDetails}
      descriptionPre={false}
      type={level}
      closable={closable}
      compact={compact}
    />
  );
}
