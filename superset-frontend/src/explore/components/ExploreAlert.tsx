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

import { forwardRef, RefObject, MouseEvent } from 'react';
import { css, styled } from '@superset-ui/core';
import Button, { ButtonStyle } from 'src/components/Button';

interface ControlPanelAlertProps {
  title: string;
  bodyText: string;
  primaryButtonAction?: (e: MouseEvent) => void;
  secondaryButtonAction?: (e: MouseEvent) => void;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  type: 'info' | 'warning' | 'error';
  className?: string;
}

const AlertContainer = styled.div`
  ${({ theme }) => css`
    margin: ${theme.gridUnit * 4}px;
    padding: ${theme.gridUnit * 4}px;

    border: 1px solid ${theme.colors.info.base};
    background-color: ${theme.colors.info.light2};
    border-radius: 2px;

    color: ${theme.colors.info.dark2};
    font-size: ${theme.typography.sizes.m}px;

    p {
      margin-bottom: ${theme.gridUnit}px;
    }

    & a,
    & span[role='button'] {
      color: inherit;
      text-decoration: underline;
      &:hover {
        color: ${theme.colors.info.dark1};
      }
    }

    &.alert-type-warning {
      border-color: ${theme.colors.warning.base};
      background-color: ${theme.colors.warning.light2};

      p {
        color: ${theme.colors.warning.dark2};
      }

      & a:hover,
      & span[role='button']:hover {
        color: ${theme.colors.warning.dark1};
      }
    }
  `}
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

const typeChart = {
  warning: 'warning',
  danger: 'danger',
  error: 'primary',
  info: 'primary',
};

export const ExploreAlert = forwardRef(
  (
    {
      title,
      bodyText,
      primaryButtonAction,
      secondaryButtonAction,
      primaryButtonText,
      secondaryButtonText,
      type = 'info',
      className = '',
    }: ControlPanelAlertProps,
    ref: RefObject<HTMLDivElement>,
  ) => (
    <AlertContainer className={`alert-type-${type} ${className}`} ref={ref}>
      <Title>{title}</Title>
      <p>{bodyText}</p>
      {primaryButtonText && primaryButtonAction && (
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
            buttonStyle={typeChart[type] as ButtonStyle}
            buttonSize="small"
            onClick={primaryButtonAction}
          >
            {primaryButtonText}
          </Button>
        </ButtonContainer>
      )}
    </AlertContainer>
  ),
);
