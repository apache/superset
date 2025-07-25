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
import { JSONTree } from 'react-json-tree';
import { t } from '@superset-ui/core';
import { useJsonTreeTheme } from 'src/hooks/useJsonTreeTheme';
import { Collapse, List, Typography } from '@superset-ui/core/components';
import type { ErrorMessageComponentProps } from './types';

interface MarshmallowErrorExtra {
  messages: object;
  payload: object;
  issue_codes: {
    code: number;
    message: string;
  }[];
}

const extractInvalidValues = (messages: object, payload: object): string[] => {
  const invalidValues: string[] = [];

  const recursiveExtract = (
    messages: Record<string, any>,
    payload: Record<string, any>,
  ) => {
    Object.keys(messages).forEach(key => {
      const value = payload[key];
      const message = messages[key];

      if (Array.isArray(message)) {
        message.forEach(errorMessage => {
          invalidValues.push(`${errorMessage}: ${value}`);
        });
      } else {
        recursiveExtract(message, value);
      }
    });
  };
  recursiveExtract(
    messages as Record<string, any>,
    payload as Record<string, any>,
  );
  return invalidValues;
};

export function MarshmallowErrorMessage({
  error,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  source = 'crud',
  subtitle,
}: ErrorMessageComponentProps<MarshmallowErrorExtra>) {
  const jsonTreeTheme = useJsonTreeTheme();
  const { extra, message } = error;

  return (
    <div>
      {subtitle && <h4>{subtitle}</h4>}

      {message}

      <List
        size="small"
        dataSource={extractInvalidValues(extra.messages, extra.payload)}
        renderItem={(value, index) => (
          <List.Item key={index}>
            <Typography.Text>{value}</Typography.Text>
          </List.Item>
        )}
      />

      <Collapse
        ghost
        items={[
          {
            label: t('Details'),
            key: 'details',
            children: (
              <JSONTree
                data={extra.messages}
                shouldExpandNodeInitially={() => true}
                hideRoot
                theme={jsonTreeTheme}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
