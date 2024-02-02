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
import { styled } from '@superset-ui/core';
import { ValidationObject } from './types';
import { TRANSLATIONS } from './AlertReportModal';

const StyledList = styled.ul`
  margin: 0;
  padding: 0;
  li {
    padding-left: ${({ theme }) => theme.gridUnit * 3}px;
  }
`;

export const buildErrorTooltipMessage = (
  build = true,
  setErrorTooltipMessage: Function,
  validationStatus: ValidationObject,
) => {
  if (build) {
    const sectionErrors: string[] = [];
    Object.values(validationStatus).forEach(validationData => {
      if (!validationData.status) {
        const sectionTitle = `${validationData.name}: `;
        sectionErrors.push(sectionTitle + validationData.errors.join(', '));
      }
    });
    setErrorTooltipMessage(
      <div>
        {TRANSLATIONS.ERROR_TOOLTIP_MESSAGE}
        <StyledList>
          {sectionErrors.map(err => (
            <li key={err}>{err}</li>
          ))}
        </StyledList>
      </div>,
    );
  } else {
    setErrorTooltipMessage('');
  }
};
