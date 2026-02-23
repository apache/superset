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

import { MouseEvent } from 'react';
import { Button } from '@superset-ui/core/components';
import { ErrorAlert } from 'src/components';
import { styled } from '@apache-superset/core/ui';

interface ControlPanelAlertProps {
  title: string;
  bodyText: React.ReactNode;
  primaryButtonAction?: (e: MouseEvent) => void;
  secondaryButtonAction?: (e: MouseEvent) => void;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  type: 'info' | 'warning' | 'error';
  className?: string;
}

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: ${({ theme }) => theme.sizeUnit * 4}px;
`;

export function ExploreAlert({
  title,
  bodyText,
  primaryButtonAction,
  secondaryButtonAction,
  primaryButtonText,
  secondaryButtonText,
  type = 'info',
  className = '',
}: ControlPanelAlertProps) {
  return (
    <ErrorAlert
      errorType={title}
      message={bodyText}
      type={type}
      className={className}
      closable={false}
      showIcon
    >
      {primaryButtonText && primaryButtonAction && (
        <ButtonContainer>
          {secondaryButtonAction && secondaryButtonText && (
            <Button buttonStyle="secondary" onClick={secondaryButtonAction}>
              {secondaryButtonText}
            </Button>
          )}
          <Button buttonStyle="secondary" onClick={primaryButtonAction}>
            {primaryButtonText}
          </Button>
        </ButtonContainer>
      )}
    </ErrorAlert>
  );
}
