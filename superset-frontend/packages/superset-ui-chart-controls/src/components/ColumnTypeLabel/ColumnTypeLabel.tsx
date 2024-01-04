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
import React, { ReactNode } from 'react';
import { css, GenericDataType, styled, t } from '@superset-ui/core';
import { ClockCircleOutlined, QuestionOutlined } from '@ant-design/icons';
// TODO: move all icons to superset-ui/core
import FunctionSvg from './type-icons/field_derived.svg';
import BooleanSvg from './type-icons/field_boolean.svg';
import StringSvg from './type-icons/field_abc.svg';
import NumSvg from './type-icons/field_num.svg';

export type ColumnLabelExtendedType = 'expression' | '';

export type ColumnTypeLabelProps = {
  type?: ColumnLabelExtendedType | GenericDataType;
};

const TypeIconWrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    justify-content: center;
    align-items: center;
    width: ${theme.gridUnit * 6}px;
    height: ${theme.gridUnit * 6}px;
    margin-right: ${theme.gridUnit}px;

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
    typeIcon = <FunctionSvg aria-label={t('function type icon')} />;
  } else if (type === GenericDataType.STRING) {
    typeIcon = <StringSvg aria-label={t('string type icon')} />;
  } else if (type === GenericDataType.NUMERIC) {
    typeIcon = <NumSvg aria-label={t('numeric type icon')} />;
  } else if (type === GenericDataType.BOOLEAN) {
    typeIcon = <BooleanSvg aria-label={t('boolean type icon')} />;
  } else if (type === GenericDataType.TEMPORAL) {
    typeIcon = <ClockCircleOutlined aria-label={t('temporal type icon')} />;
  }

  return <TypeIconWrapper>{typeIcon}</TypeIconWrapper>;
}

export default ColumnTypeLabel;
