/* eslint-disable no-nested-ternary */
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
import { ReactNode } from 'react';
import { css, GenericDataType, styled, t } from '@superset-ui/core';
import {
  ClockCircleOutlined,
  QuestionOutlined,
  FunctionOutlined,
  FieldBinaryOutlined,
  FieldStringOutlined,
  NumberOutlined,
} from '@ant-design/icons';

export type ColumnLabelExtendedType = 'expression' | '';

export type ColumnTypeLabelProps = {
  type?: ColumnLabelExtendedType | GenericDataType;
};

const TypeIconWrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: center;
    align-items: center;
    width: ${theme.sizeUnit * 6}px;
    height: ${theme.sizeUnit * 6}px;
    margin-right: ${theme.sizeUnit}px;

    && svg {
      margin-right: 0;
      margin-left: 0;
      width: 100%;
      height: 100%;
    }
  `};
`;

export function ColumnTypeLabel({ type }: ColumnTypeLabelProps) {
  let typeIcon: ReactNode = (
    <QuestionOutlined aria-label={t('unknown type icon')} />
  );

  if (type === '' || type === 'expression') {
    typeIcon = <FunctionOutlined aria-label={t('function type icon')} />;
  } else if (type === GenericDataType.String) {
    typeIcon = <FieldStringOutlined aria-label={t('string type icon')} />;
  } else if (type === GenericDataType.Numeric) {
    typeIcon = <NumberOutlined aria-label={t('numeric type icon')} />;
  } else if (type === GenericDataType.Boolean) {
    typeIcon = <FieldBinaryOutlined aria-label={t('boolean type icon')} />;
  } else if (type === GenericDataType.Temporal) {
    typeIcon = <ClockCircleOutlined aria-label={t('temporal type icon')} />;
  }

  return <TypeIconWrapper>{typeIcon}</TypeIconWrapper>;
}

export default ColumnTypeLabel;
