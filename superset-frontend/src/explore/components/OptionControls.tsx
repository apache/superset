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
import { ColumnOption } from '@superset-ui/chart-controls';
import Icon from '../../components/Icon';
import { savedMetricType } from '../types';

const OptionControlContainer = styled.div<{ isAdhoc?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  height: ${({ theme }) => theme.gridUnit * 6}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light3};
  border-radius: 3px;
  cursor: ${({ isAdhoc }) => (isAdhoc ? 'pointer' : 'default')};
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
  :last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.div`
  display: flex;
  align-items: center;
  padding-left: ${({ theme }) => theme.gridUnit}px;
  svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

const CaretContainer = styled.div`
  height: 100%;
  border-left: solid 1px ${({ theme }) => theme.colors.grayscale.dark2}0C;
  margin-left: auto;
`;

const CloseContainer = styled.div`
  height: 100%;
  width: ${({ theme }) => theme.gridUnit * 6}px;
  border-right: solid 1px ${({ theme }) => theme.colors.grayscale.dark2}0C;
  cursor: pointer;
`;

export const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const LabelsContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit}px;
  border: solid 1px ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 3px;
`;

export const AddControlLabel = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${({ theme }) => theme.gridUnit * 6}px;
  padding-left: ${({ theme }) => theme.gridUnit}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  border: dashed 1px ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: 3px;
  cursor: pointer;

  :hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light4};
  }

  :active {
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
  }
`;

export const AddIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${({ theme }) => theme.gridUnit * 4}px;
  width: ${({ theme }) => theme.gridUnit * 4}px;
  padding: 0;
  background-color: ${({ theme }) => theme.colors.primary.dark1};
  border: none;
  border-radius: 2px;

  :disabled {
    cursor: not-allowed;
    background-color: ${({ theme }) => theme.colors.grayscale.light1};
  }
`;

export const OptionControlLabel = ({
  label,
  savedMetric,
  onRemove,
  isAdhoc,
  isFunction,
  ...props
}: {
  label: string | React.ReactNode;
  savedMetric?: savedMetricType;
  onRemove: () => void;
  isAdhoc?: boolean;
  isFunction?: boolean;
}) => {
  const theme = useTheme();
  const getLabelContent = () => {
    if (savedMetric?.metric_name) {
      // add column_name to fix typescript error
      const column = { ...savedMetric, column_name: '' };
      if (!column.verbose_name) {
        column.verbose_name = column.metric_name;
      }
      return <ColumnOption column={column} />;
    }
    return label;
  };
  return (
    <OptionControlContainer
      isAdhoc={isAdhoc}
      data-test="option-label"
      {...props}
    >
      <CloseContainer
        role="button"
        data-test="remove-control-button"
        onClick={onRemove}
      >
        <Icon name="x-small" color={theme.colors.grayscale.light1} />
      </CloseContainer>
      <Label data-test="control-label">
        {isFunction && <Icon name="function" viewBox="0 0 16 11" />}
        {getLabelContent()}
      </Label>
      {isAdhoc && (
        <CaretContainer>
          <Icon name="caret-right" color={theme.colors.grayscale.light1} />
        </CaretContainer>
      )}
    </OptionControlContainer>
  );
};
