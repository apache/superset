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
import { styled, t } from '@superset-ui/core';
import Alert from 'react-bootstrap/lib/Alert';
import Button from 'src/components/Button';
import Icon from 'src/components/Icon';

const StyledAlert = styled(Alert)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
`;

const StyledTextContainer = styled.div`
  display: flex;
  flex-direction: column;
  text-align: left;
  margin-right: ${({ theme }) => theme.gridUnit}px;
`;

const StyledTitleBox = styled.div`
  display: flex;
  align-items: center;
`;

const StyledAlertTitle = styled.span`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

const StyledAlertText = styled.p`
  margin-left: ${({ theme }) => theme.gridUnit * 9}px;
`;

const StyledButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
`;

const StyledAlertIcon = styled(Icon)`
  color: ${({ theme }) => theme.colors.alert.base};
  margin-right: ${({ theme }) => theme.gridUnit * 3}px;
`;

export interface ConfirmationAlertProps {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function CancelConfirmationAlert({
  title,
  onConfirm,
  onDismiss,
  children,
}: ConfirmationAlertProps) {
  return (
    <StyledAlert bsStyle="warning" key="alert">
      <StyledTextContainer>
        <StyledTitleBox>
          <StyledAlertIcon name="alert-solid" />
          <StyledAlertTitle>{title}</StyledAlertTitle>
        </StyledTitleBox>
        <StyledAlertText>{children}</StyledAlertText>
      </StyledTextContainer>
      <StyledButtonsContainer>
        <Button
          key="submit"
          buttonSize="small"
          buttonStyle="primary"
          onClick={onConfirm}
        >
          {t('Yes, cancel')}
        </Button>
        <Button
          key="cancel"
          buttonSize="small"
          buttonStyle="secondary"
          onClick={onDismiss}
        >
          {t('Keep editing')}
        </Button>
      </StyledButtonsContainer>
    </StyledAlert>
  );
}
