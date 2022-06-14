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
import React, { useState } from 'react';
import { styled, SupersetTheme, t, useTheme } from '@superset-ui/core';
import { Form, FormItem, FormProps } from 'src/components/Form';
import Select from 'src/components/Select/Select';
import { Col, Row } from 'src/components';
import { InputNumber } from 'src/components/Input';
import Checkbox from 'src/components/Checkbox';
import Button from 'src/components/Button';
import ColorPickerControl from 'src/explore/components/controls/ColorPickerControl';
import { hexToRgb, rgbStringToRgbaObject } from 'src/utils/colorUtils';
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

// not sure if we need this still. Using green for the default color in picker.
const colorSchemeOptions = (theme: SupersetTheme) => [
  {
    value: rgbStringToRgbaObject(hexToRgb(theme.colors.success.light1)),
    label: t('green'),
  },
];

const operatorOptions = [
  { value: COMPARATOR.NONE, label: 'None' },
  { value: COMPARATOR.GREATER_THAN, label: '>' },
  { value: COMPARATOR.LESS_THAN, label: '<' },
  { value: COMPARATOR.GREATER_OR_EQUAL, label: '≥' },
  { value: COMPARATOR.LESS_OR_EQUAL, label: '≤' },
  { value: COMPARATOR.EQUAL, label: '=' },
  { value: COMPARATOR.NOT_EQUAL, label: '≠' },
  { value: COMPARATOR.BETWEEN, label: '< x <' },
  { value: COMPARATOR.BETWEEN_OR_EQUAL, label: '≤ x ≤' },
  { value: COMPARATOR.BETWEEN_OR_LEFT_EQUAL, label: '≤ x <' },
  { value: COMPARATOR.BETWEEN_OR_RIGHT_EQUAL, label: '< x ≤' },
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

const inverseScaleValidator =
  (operator: COMPARATOR) => (_: any, checked: boolean) => {
    if (operator === COMPARATOR.EQUAL && checked) {
      return Promise.reject(
        new Error(t('Inverse Scale does not work with Equals operator')),
      );
    }
    return Promise.resolve();
  };

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

const rulesInverseScale = [
  { required: true, message: '' },
  ({ getFieldValue }: GetFieldValue) => ({
    validator: inverseScaleValidator(getFieldValue('operator')),
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
    <Select ariaLabel={t('Operator')} options={operatorOptions} />
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
}) => {
  const theme = useTheme();
  const colorScheme = colorSchemeOptions(theme);
  const [inverseScale, setInverseScale] = useState(
    config?.inverseScale || false,
  );

  const changeInverseScale = () => {
    setInverseScale(!inverseScale);
  };

  return (
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
        <Col span={5}>
          <FormItem
            name="colorScheme"
            label={t('Base Color')}
            rules={rulesRequired}
            initialValue={colorScheme[0].value}
          >
            <ColorPickerControl />
          </FormItem>
        </Col>
        <Col span={7}>
          <FormItem
            name="inverseScale"
            label={t('Inverse Scale')}
            rules={rulesInverseScale}
            validateTrigger="onChange"
            trigger="onChange"
            tooltip="Invert the color alpha scale. Not valid with the equals operator."
          >
            <Checkbox checked={inverseScale} onChange={changeInverseScale} />
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
};
