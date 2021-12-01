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
import { Form, FormItem, FormProps } from 'src/components/Form';
import Select, { propertyComparator } from 'src/components/Select/Select';
import { Col, InputNumber, Row } from 'src/common/components';
import Button from 'src/components/Button';
import {
  COMPARATOR,
  ConditionalFormattingConfig,
  MULTIPLE_VALUE_COMPARATORS,
} from './types';

const FullWidthInputNumber = styled(InputNumber)`
  width: 100%;
`;

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const colorSchemeOptions = [
  { value: 'rgb(0,255,0)', label: t('green') },
  { value: 'rgb(255,255,0)', label: t('yellow') },
  { value: 'rgb(255,0,0)', label: t('red') },
];

const operatorOptions = [
  { value: COMPARATOR.NONE, label: 'None', order: 0 },
  { value: COMPARATOR.GREATER_THAN, label: '>', order: 1 },
  { value: COMPARATOR.LESS_THAN, label: '<', order: 2 },
  { value: COMPARATOR.GREATER_OR_EQUAL, label: '≥', order: 3 },
  { value: COMPARATOR.LESS_OR_EQUAL, label: '≤', order: 4 },
  { value: COMPARATOR.EQUAL, label: '=', order: 5 },
  { value: COMPARATOR.NOT_EQUAL, label: '≠', order: 6 },
  { value: COMPARATOR.BETWEEN, label: '< x <', order: 7 },
  { value: COMPARATOR.BETWEEN_OR_EQUAL, label: '≤ x ≤', order: 8 },
  { value: COMPARATOR.BETWEEN_OR_LEFT_EQUAL, label: '≤ x <', order: 9 },
  { value: COMPARATOR.BETWEEN_OR_RIGHT_EQUAL, label: '< x ≤', order: 10 },
];

const targetValueValidator =
  (
    compare: (targetValue: number, compareValue: number) => boolean,
    rejectMessage: string,
  ) =>
  (targetValue: number | string) =>
  (_: any, compareValue: number | string) => {
    if (
      !targetValue ||
      !compareValue ||
      compare(Number(targetValue), Number(compareValue))
    ) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(rejectMessage));
  };

const targetValueLeftValidator = targetValueValidator(
  (target: number, val: number) => target > val,
  t('This value should be smaller than the right target value'),
);

const targetValueRightValidator = targetValueValidator(
  (target: number, val: number) => target < val,
  t('This value should be greater than the left target value'),
);

const isOperatorMultiValue = (operator?: COMPARATOR) =>
  operator && MULTIPLE_VALUE_COMPARATORS.includes(operator);

const isOperatorNone = (operator?: COMPARATOR) =>
  !operator || operator === COMPARATOR.NONE;

const rulesRequired = [{ required: true, message: t('Required') }];

type GetFieldValue = Pick<Required<FormProps>['form'], 'getFieldValue'>;
const rulesTargetValueLeft = [
  { required: true, message: t('Required') },
  ({ getFieldValue }: GetFieldValue) => ({
    validator: targetValueLeftValidator(getFieldValue('targetValueRight')),
  }),
];

const rulesTargetValueRight = [
  { required: true, message: t('Required') },
  ({ getFieldValue }: GetFieldValue) => ({
    validator: targetValueRightValidator(getFieldValue('targetValueLeft')),
  }),
];

const targetValueLeftDeps = ['targetValueRight'];
const targetValueRightDeps = ['targetValueLeft'];

const shouldFormItemUpdate = (
  prevValues: ConditionalFormattingConfig,
  currentValues: ConditionalFormattingConfig,
) =>
  isOperatorNone(prevValues.operator) !==
    isOperatorNone(currentValues.operator) ||
  isOperatorMultiValue(prevValues.operator) !==
    isOperatorMultiValue(currentValues.operator);

const operatorField = (
  <FormItem
    name="operator"
    label={t('Operator')}
    rules={rulesRequired}
    initialValue={operatorOptions[0].value}
  >
    <Select
      ariaLabel={t('Operator')}
      options={operatorOptions}
      sortComparator={propertyComparator('order')}
    />
  </FormItem>
);

const renderOperatorFields = ({ getFieldValue }: GetFieldValue) =>
  isOperatorNone(getFieldValue('operator')) ? (
    <Row gutter={12}>
      <Col span={6}>{operatorField}</Col>
    </Row>
  ) : isOperatorMultiValue(getFieldValue('operator')) ? (
    <Row gutter={12}>
      <Col span={9}>
        <FormItem
          name="targetValueLeft"
          label={t('Left value')}
          rules={rulesTargetValueLeft}
          dependencies={targetValueLeftDeps}
          validateTrigger="onBlur"
          trigger="onBlur"
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
      <Col span={6}>{operatorField}</Col>
      <Col span={9}>
        <FormItem
          name="targetValueRight"
          label={t('Right value')}
          rules={rulesTargetValueRight}
          dependencies={targetValueRightDeps}
          validateTrigger="onBlur"
          trigger="onBlur"
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
    </Row>
  ) : (
    <Row gutter={12}>
      <Col span={6}>{operatorField}</Col>
      <Col span={18}>
        <FormItem
          name="targetValue"
          label={t('Target value')}
          rules={rulesRequired}
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
    </Row>
  );

export const FormattingPopoverContent = ({
  config,
  onChange,
  columns = [],
}: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string }[];
}) => (
  <Form
    onFinish={onChange}
    initialValues={config}
    requiredMark="optional"
    layout="vertical"
  >
    <Row gutter={12}>
      <Col span={12}>
        <FormItem
          name="column"
          label={t('Column')}
          rules={rulesRequired}
          initialValue={columns[0]?.value}
        >
          <Select ariaLabel={t('Select column')} options={columns} />
        </FormItem>
      </Col>
      <Col span={12}>
        <FormItem
          name="colorScheme"
          label={t('Color scheme')}
          rules={rulesRequired}
          initialValue={colorSchemeOptions[0].value}
        >
          <Select ariaLabel={t('Color scheme')} options={colorSchemeOptions} />
        </FormItem>
      </Col>
    </Row>
    <FormItem noStyle shouldUpdate={shouldFormItemUpdate}>
      {renderOperatorFields}
    </FormItem>
    <FormItem>
      <JustifyEnd>
        <Button htmlType="submit" buttonStyle="primary">
          {t('Apply')}
        </Button>
      </JustifyEnd>
    </FormItem>
  </Form>
);
