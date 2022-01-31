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
import Button from 'src/components/Button';

interface ControlPanelAlertProps {
  title: string;
  bodyText: string;
  primaryButtonAction: (e: React.MouseEvent) => void;
  secondaryButtonAction?: (e: React.MouseEvent) => void;
  primaryButtonText: string;
  secondaryButtonText?: string;
  type: 'info' | 'warning';
}

const AlertContainer = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 4}px;
  padding: ${({ theme }) => theme.gridUnit * 4}px;

  border: ${({ theme }) => `1px solid ${theme.colors.info.base}`};
  background-color: ${({ theme }) => theme.colors.info.light2};
  border-radius: 2px;

  color: ${({ theme }) => theme.colors.info.dark2};
  font-size: ${({ theme }) => theme.typography.sizes.s};

  &.alert-type-warning {
    border-color: ${({ theme }) => theme.colors.alert.base};
    background-color: ${({ theme }) => theme.colors.alert.light2};

    p {
      color: ${({ theme }) => theme.colors.alert.dark2};
    }
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  button {
    line-height: 1;
  }
`;

const Title = styled.p`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

export const ControlPanelAlert = ({
  title,
  bodyText,
  primaryButtonAction,
  secondaryButtonAction,
  primaryButtonText,
  secondaryButtonText,
  type = 'info',
}: ControlPanelAlertProps) => (
  <AlertContainer className={`alert-type-${type}`}>
    <Title>{title}</Title>
    <p>{bodyText}</p>
    <ButtonContainer>
      {secondaryButtonAction && secondaryButtonText && (
        <Button
          buttonStyle="link"
          buttonSize="small"
          onClick={secondaryButtonAction}
        >
          {secondaryButtonText}
        </Button>
      )}
      <Button
        buttonStyle={type === 'warning' ? 'warning' : 'primary'}
        buttonSize="small"
        onClick={primaryButtonAction}
      >
        {primaryButtonText}
      </Button>
    </ButtonContainer>
  </AlertContainer>
);
