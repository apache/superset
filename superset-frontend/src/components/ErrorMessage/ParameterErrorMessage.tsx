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
import levenshtein from 'js-levenshtein';

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

const maxDistanceForSuggestion = 2;
const findMatches = (undefinedParameters: string[], templateKeys: string[]) => {
  const matches: { [undefinedParameter: string]: string[] } = {};
  undefinedParameters.forEach(undefinedParameter => {
    templateKeys.forEach(templateKey => {
      if (
        levenshtein(undefinedParameter, templateKey) <= maxDistanceForSuggestion
      ) {
        if (!matches[undefinedParameter]) {
          matches[undefinedParameter] = [];
        }
        matches[undefinedParameter].push(`"${templateKey}"`);
      }
    });
  });
  return matches;
};

function ParameterErrorMessage({
  error,
  source = 'sqllab',
  subtitle,
}: ErrorMessageComponentProps<ParameterErrorExtra>) {
  const { extra = { issue_codes: [] }, level, message } = error;

  const triggerMessage = tn(
    'This was triggered by:',
    'This may be triggered by:',
    extra.issue_codes.length,
  );

  const matches = findMatches(
    extra.undefined_parameters || [],
    Object.keys(extra.template_parameters || {}),
  );

  const body = (
    <>
      <p>
        {Object.keys(matches).length > 0 && (
          <>
            <p>{t('Did you mean:')}</p>
            <ul>
              {Object.entries(matches).map(
                ([undefinedParameter, templateKeys]) => (
                  <li>
                    {tn(
                      '%(suggestion)s instead of "%(undefinedParameter)s?"',
                      '%(firstSuggestions)s or %(lastSuggestion)s instead of "%(undefinedParameter)s"?',
                      templateKeys.length,
                      {
                        suggestion: templateKeys.join(', '),
                        firstSuggestions: templateKeys.slice(0, -1).join(', '),
                        lastSuggestion: templateKeys[templateKeys.length - 1],
                        undefinedParameter,
                      },
                    )}
                  </li>
                ),
              )}
            </ul>
            <br />
          </>
        )}
        {triggerMessage}
        <br />
        {extra.issue_codes.length > 0 &&
          extra.issue_codes
            .map<ReactNode>(issueCode => <IssueCode {...issueCode} />)
            .reduce((prev, curr) => [prev, <br />, curr])}
      </p>
    </>
  );

  return (
    <ErrorAlert
      errorType={t('Parameter error')}
      type={level}
      message={message}
      description={subtitle}
      descriptionDetails={body}
    />
  );
}

export default ParameterErrorMessage;
