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
import { styled, useTheme } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { ErrorLevel } from './types';

const StyledContainer = styled.div<{ level: ErrorLevel }>`
  display: flex;
  flex-direction: row;
  background-color: ${({ level, theme }) => theme.colors[level].light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  border: 1px solid ${({ level, theme }) => theme.colors[level].base};
  color: ${({ level, theme }) => theme.colors[level].dark2};
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
  width: 100%;
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const StyledTitle = styled.span`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

interface BasicErrorAlertProps {
  title: string;
  body: string;
  level: ErrorLevel;
}

export default function BasicErrorAlert({
  body,
  level = 'error',
  title,
}: BasicErrorAlertProps) {
  const theme = useTheme();
  const iconColor = theme.colors[level].base;

  return (
    <StyledContainer level={level} role="alert">
      {level === 'error' ? (
        <Icons.ErrorSolid iconColor={iconColor} />
      ) : (
        <Icons.WarningSolid iconColor={iconColor} />
      )}
      <StyledContent>
        <StyledTitle>{title}</StyledTitle>
        <p>{body}</p>
      </StyledContent>
    </StyledContainer>
  );
}
