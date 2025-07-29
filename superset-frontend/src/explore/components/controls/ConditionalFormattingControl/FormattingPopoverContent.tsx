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
import { useMemo, useState, useEffect } from 'react';
import {
  GenericDataType,
  styled,
  SupersetTheme,
  t,
  useTheme,
} from '@superset-ui/core';
import {
  Comparator,
  MultipleValueComparators,
} from '@superset-ui/chart-controls';
import {
  Select,
  Button,
  Form,
  FormItem,
  InputNumber,
  Input,
  Col,
  Row,
  type FormProps,
} from '@superset-ui/core/components';
import { ConditionalFormattingConfig } from './types';

// TODO: tangled redefinition that aligns with @superset-ui/plugin-chart-table
// used to be imported but main app shouldn't depend on plugins...
export enum ColorSchemeEnum {
  'Green' = 'Green',
  'Red' = 'Red',
}

const FullWidthInputNumber = styled(InputNumber)`
  width: 100%;
`;

const FullWidthInput = styled(Input)`
  width: 100%;
`;

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const colorSchemeOptions = (theme: SupersetTheme) => [
  { value: theme.colorSuccessBg, label: t('success') },
  { value: theme.colorWarningBg, label: t('alert') },
  { value: theme.colorErrorBg, label: t('error') },
];

const operatorOptions = [
  { value: Comparator.None, label: t('None') },
  { value: Comparator.GreaterThan, label: '>' },
  { value: Comparator.LessThan, label: '<' },
  { value: Comparator.GreaterOrEqual, label: '≥' },
  { value: Comparator.LessOrEqual, label: '≤' },
  { value: Comparator.Equal, label: '=' },
  { value: Comparator.NotEqual, label: '≠' },
  { value: Comparator.Between, label: '< x <' },
  { value: Comparator.BetweenOrEqual, label: '≤ x ≤' },
  { value: Comparator.BetweenOrLeftEqual, label: '≤ x <' },
  { value: Comparator.BetweenOrRightEqual, label: '< x ≤' },
];

const stringOperatorOptions = [
  { value: Comparator.None, label: t('None') },
  { value: Comparator.Equal, label: '=' },
  { value: Comparator.BeginsWith, label: t('begins with') },
  { value: Comparator.EndsWith, label: t('ends with') },
  { value: Comparator.Containing, label: t('containing') },
  { value: Comparator.NotContaining, label: t('not containing') },
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

const isOperatorMultiValue = (operator?: Comparator) =>
  operator && MultipleValueComparators.includes(operator);

const isOperatorNone = (operator?: Comparator) =>
  !operator || operator === Comparator.None;

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

const renderOperator = ({
  showOnlyNone,
  columnType,
}: { showOnlyNone?: boolean; columnType?: GenericDataType } = {}) => {
  const options =
    columnType === GenericDataType.String
      ? stringOperatorOptions
      : operatorOptions;

  return (
    <FormItem
      name="operator"
      label={t('Operator')}
      rules={rulesRequired}
      initialValue={options[0].value}
    >
      <Select
        ariaLabel={t('Operator')}
        options={showOnlyNone ? [options[0]] : options}
      />
    </FormItem>
  );
};

const renderOperatorFields = (
  { getFieldValue }: GetFieldValue,
  columnType?: GenericDataType,
) => {
  const columnTypeString = columnType === GenericDataType.String;
  const operatorColSpan = columnTypeString ? 8 : 6;
  const valueColSpan = columnTypeString ? 16 : 18;

  return isOperatorNone(getFieldValue('operator')) ? (
    <Row gutter={12}>
      <Col span={operatorColSpan}>{renderOperator({ columnType })}</Col>
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
      <Col span={6}>{renderOperator({ columnType })}</Col>
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
      <Col span={operatorColSpan}>{renderOperator({ columnType })}</Col>
      <Col span={valueColSpan}>
        <FormItem
          name="targetValue"
          label={t('Target value')}
          rules={rulesRequired}
        >
          {columnTypeString ? <FullWidthInput /> : <FullWidthInputNumber />}
        </FormItem>
      </Col>
    </Row>
  );
};

export const FormattingPopoverContent = ({
  config,
  onChange,
  columns = [],
  extraColorChoices = [],
}: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string; dataType: GenericDataType }[];
  extraColorChoices?: { label: string; value: string }[];
}) => {
  const theme = useTheme();
  const [form] = Form.useForm();
  const colorScheme = colorSchemeOptions(theme);
  const [showOperatorFields, setShowOperatorFields] = useState(
    config === undefined ||
      (config?.colorScheme !== ColorSchemeEnum.Green &&
        config?.colorScheme !== ColorSchemeEnum.Red),
  );
  const handleChange = (event: any) => {
    setShowOperatorFields(
      !(event === ColorSchemeEnum.Green || event === ColorSchemeEnum.Red),
    );
  };

  const [column, setColumn] = useState<string>(
    config?.column || columns[0]?.value,
  );
  const [previousColumnType, setPreviousColumnType] = useState<
    GenericDataType | undefined
  >();

  const columnType = useMemo(
    () => columns.find(item => item.value === column)?.dataType,
    [columns, column],
  );

  const handleColumnChange = (value: string) => {
    const newColumnType = columns.find(item => item.value === value)?.dataType;
    if (newColumnType !== previousColumnType) {
      const defaultOperator =
        newColumnType === GenericDataType.String
          ? stringOperatorOptions[0].value
          : operatorOptions[0].value;

      form.setFieldsValue({
        operator: defaultOperator,
      });
    }
    setColumn(value);
    setPreviousColumnType(newColumnType);
  };

  useEffect(() => {
    if (column && !previousColumnType) {
      setPreviousColumnType(
        columns.find(item => item.value === column)?.dataType,
      );
    }
  }, [column, columns, previousColumnType]);

  return (
    <Form
      form={form}
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
            <Select
              ariaLabel={t('Select column')}
              options={columns}
              onChange={value => {
                handleColumnChange(value as string);
              }}
            />
          </FormItem>
        </Col>
        <Col span={12}>
          <FormItem
            name="colorScheme"
            label={t('Color scheme')}
            rules={rulesRequired}
            initialValue={colorScheme[0].value}
          >
            <Select
              onChange={event => handleChange(event)}
              ariaLabel={t('Color scheme')}
              options={[...colorScheme, ...extraColorChoices]}
            />
          </FormItem>
        </Col>
      </Row>
      <FormItem noStyle shouldUpdate={shouldFormItemUpdate}>
        {showOperatorFields ? (
          (props: GetFieldValue) => renderOperatorFields(props, columnType)
        ) : (
          <Row gutter={12}>
            {showOperatorFields && (
              <Col span={6}>
                {renderOperator({ showOnlyNone: true, columnType })}
              </Col>
            )}
          </Row>
        )}
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
