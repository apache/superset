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
import { JSONTree } from 'react-json-tree';
import { css, styled, SupersetTheme, t } from '@superset-ui/core';

import { useJsonTreeTheme } from 'src/hooks/useJsonTreeTheme';
import Collapse from 'src/components/Collapse';
import { ErrorMessageComponentProps } from './types';

interface MarshmallowErrorExtra {
  messages: object;
  payload: object;
  issue_codes: {
    code: number;
    message: string;
  }[];
}

const StyledUl = styled.ul`
  padding-left: ${({ theme }) => theme.gridUnit * 5}px;
  padding-top: ${({ theme }) => theme.gridUnit * 4}px;
`;

const collapseStyle = (theme: SupersetTheme) => css`
  .ant-collapse-arrow {
    left: 0px !important;
  }
  .ant-collapse-header {
    padding-left: ${theme.gridUnit * 4}px !important;
  }
  .ant-collapse-content-box {
    padding: 0px !important;
  }
`;

const extractInvalidValues = (messages: object, payload: object): string[] => {
  const invalidValues: string[] = [];

  const recursiveExtract = (messages: object, payload: object) => {
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
  recursiveExtract(messages, payload);
  return invalidValues;
};

export default function MarshmallowErrorMessage({
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

      <StyledUl>
        {extractInvalidValues(extra.messages, extra.payload).map(
          (value, index) => (
            <li key={index}>{value}</li>
          ),
        )}
      </StyledUl>

      <Collapse ghost css={collapseStyle}>
        <Collapse.Panel header={t('Details')} key="details" css={collapseStyle}>
          <JSONTree
            data={extra.messages}
            shouldExpandNode={() => true}
            hideRoot
            theme={jsonTreeTheme}
          />
        </Collapse.Panel>
      </Collapse>
    </div>
  );
}
