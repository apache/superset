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
import { t } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { GenericDataType } from '@apache-superset/core/api/core';
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
  Checkbox,
  type FormProps,
} from '@superset-ui/core/components';
import {
  ConditionalFormattingConfig,
  ConditionalFormattingFlag,
} from './types';

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

// Use theme token names instead of hex values to support theme switching
const colorSchemeOptions = () => [
  { value: 'colorSuccess', label: t('success') },
  { value: 'colorWarning', label: t('alert') },
  { value: 'colorError', label: t('error') },
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

const booleanOperatorOptions = [
  { value: Comparator.IsNull, label: t('is null') },
  { value: Comparator.IsTrue, label: t('is true') },
  { value: Comparator.IsFalse, label: t('is false') },
  { value: Comparator.IsNotNull, label: t('is not null') },
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
  let options;
  switch (columnType) {
    case GenericDataType.String:
      options = stringOperatorOptions;
      break;
    case GenericDataType.Boolean:
      options = booleanOperatorOptions;
      break;
    default:
      options = operatorOptions;
  }

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
  const columnTypeBoolean = columnType === GenericDataType.Boolean;
  const operatorColSpan = columnTypeString || columnTypeBoolean ? 8 : 6;
  const valueColSpan = columnTypeString ? 16 : 18;

  if (columnTypeBoolean) {
    return (
      <Row gutter={12}>
        <Col span={operatorColSpan}>{renderOperator({ columnType })}</Col>
        <Col span={valueColSpan}>
          <FormItem
            name="targetValue"
            label={t('Target value')}
            initialValue={''}
            hidden
          />
        </Col>
      </Row>
    );
  }

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
  conditionalFormattingFlag = {
    toAllRowCheck: false,
    toColorTextCheck: false,
  },
}: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string; dataType: GenericDataType }[];
  extraColorChoices?: { label: string; value: string }[];
  conditionalFormattingFlag?: ConditionalFormattingFlag;
}) => {
  const [form] = Form.useForm();
  const colorScheme = colorSchemeOptions();
  const [showOperatorFields, setShowOperatorFields] = useState(
    config === undefined ||
      (config?.colorScheme !== ColorSchemeEnum.Green &&
        config?.colorScheme !== ColorSchemeEnum.Red),
  );

  const [toAllRow, setToAllRow] = useState(() => Boolean(config?.toAllRow));
  const [toTextColor, setToTextColor] = useState(() =>
    Boolean(config?.toTextColor),
  );
  const [useGradient, setUseGradient] = useState(() =>
    config?.useGradient !== undefined ? config.useGradient : true,
  );

  const useConditionalFormattingFlag = (
    flagKey: 'toAllRowCheck' | 'toColorTextCheck',
    configKey: 'toAllRow' | 'toTextColor',
  ) =>
    useMemo(
      () =>
        conditionalFormattingFlag && conditionalFormattingFlag[flagKey]
          ? config?.[configKey] === undefined
          : config?.[configKey] !== undefined,
      [conditionalFormattingFlag], // oxlint-disable-line react-hooks/exhaustive-deps
    );

  const showToAllRow = useConditionalFormattingFlag(
    'toAllRowCheck',
    'toAllRow',
  );
  const showToColorText = useConditionalFormattingFlag(
    'toColorTextCheck',
    'toTextColor',
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
      let defaultOperator: Comparator;

      switch (newColumnType) {
        case GenericDataType.String:
          defaultOperator = stringOperatorOptions[0].value;
          break;

        case GenericDataType.Boolean:
          defaultOperator = booleanOperatorOptions[0].value;
          break;

        default:
          defaultOperator = operatorOptions[0].value;
      }

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
      <Row gutter={20}>
        <Col span={1}>
          <FormItem
            name="useGradient"
            valuePropName="checked"
            initialValue={useGradient}
          >
            <Checkbox
              onChange={event => setUseGradient(event.target.checked)}
              checked={useGradient}
            />
          </FormItem>
        </Col>
        <Col>
          <FormItem required>{t('Use gradient')}</FormItem>
        </Col>
      </Row>
      <FormItem noStyle shouldUpdate={shouldFormItemUpdate}>
        {showOperatorFields ? (
          (props: GetFieldValue) => renderOperatorFields(props, columnType)
        ) : (
          <Row gutter={12}>
            <Col span={6}>
              {renderOperator({ showOnlyNone: true, columnType })}
            </Col>
          </Row>
        )}
      </FormItem>
      <Row>
        {showOperatorFields && showToAllRow && (
          <Row gutter={20}>
            <Col span={1}>
              <FormItem
                name="toAllRow"
                valuePropName="checked"
                initialValue={toAllRow}
              >
                <Checkbox
                  onChange={event => setToAllRow(event.target.checked)}
                  checked={toAllRow}
                />
              </FormItem>
            </Col>
            <Col>
              <FormItem required>{t('To entire row')}</FormItem>
            </Col>
          </Row>
        )}
        {showOperatorFields && showToColorText && (
          <Row gutter={20}>
            <Col span={1}>
              <FormItem
                name="toTextColor"
                valuePropName="checked"
                initialValue={toTextColor}
              >
                <Checkbox
                  onChange={event => setToTextColor(event.target.checked)}
                  checked={toTextColor}
                />
              </FormItem>
            </Col>
            <Col>
              <FormItem required>{t('To text color')}</FormItem>
            </Col>
          </Row>
        )}
      </Row>

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
