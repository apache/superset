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
const findMatches = (
  undefined_parameters: string[],
  template_keys: string[],
) => {
  const matches: { [undefined_parameter: string]: string[] } = {};
  undefined_parameters.forEach(undefined_parameter => {
    template_keys.forEach(template_key => {
      if (
        levenshtein(undefined_parameter, template_key) <=
        maxDistanceForSuggestion
      ) {
        if (!matches[undefined_parameter]) {
          matches[undefined_parameter] = [];
        }
        matches[undefined_parameter].push(`"${template_key}"`);
      }
    });
  });
  return matches;
};

function ParameterErrorMessage({
  error,
  source = 'sqllab',
}: ErrorMessageComponentProps<ParameterErrorExtra>) {
  const { extra, level, message } = error;

  const triggerMessage = tn(
    'This was triggered by:',
    'This may be triggered by:',
    extra.issue_codes.length,
  );

  const matches = findMatches(
    extra.undefined_parameters || [],
    Object.keys(extra.template_parameters || []),
  );

  const body = (
    <>
      <p>
        {matches && (
          <>
            <p>{t('Did you mean:')}</p>
            <ul>
              {Object.entries(matches).map(
                ([undefined_parameter, template_keys]) => (
                  <li>
                    {tn(
                      '%(suggestion)s instead of "%(undefined)s?"',
                      '%(first_suggestions)s or %(last_suggestion)s instead of "%(undefined)s"?',
                      template_keys.length,
                      {
                        suggestion: template_keys.join(', '),
                        first_suggestions: template_keys
                          .slice(0, -1)
                          .join(', '),
                        last_suggestion:
                          template_keys[template_keys.length - 1],
                        undefined: undefined_parameter,
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
