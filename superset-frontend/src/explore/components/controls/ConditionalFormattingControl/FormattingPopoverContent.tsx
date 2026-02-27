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
import { useMemo, useState, useEffect, useCallback } from 'react';
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { GenericDataType } from '@apache-superset/core/api/core';
import {
  Comparator,
  MultipleValueComparators,
  ObjectFormattingEnum,
  ColorSchemeEnum,
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
import { ConditionalFormattingConfig, ColumnOption } from './types';
import {
  operatorOptions,
  stringOperatorOptions,
  booleanOperatorOptions,
  formattingOptions,
  colorSchemeOptions,
} from './constants';

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
  allColumns = [],
}: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string; dataType: GenericDataType }[];
  extraColorChoices?: { label: string; value: string }[];
  allColumns?: ColumnOption[];
}) => {
  const [form] = Form.useForm();
  const colorScheme = colorSchemeOptions();
  const [showOperatorFields, setShowOperatorFields] = useState(
    config === undefined ||
      (config?.colorScheme !== ColorSchemeEnum.Green &&
        config?.colorScheme !== ColorSchemeEnum.Red),
  );

  const [useGradient, setUseGradient] = useState(() =>
    config?.useGradient !== undefined ? config.useGradient : true,
  );

  const handleChange = (event: any) => {
    setShowOperatorFields(
      !(event === ColorSchemeEnum.Green || event === ColorSchemeEnum.Red),
    );
  };

  const [column, setColumn] = useState<string>(
    config?.column || columns[0]?.value,
  );
  const visibleAllColumns = useMemo(
    () => !!(allColumns && Array.isArray(allColumns) && allColumns.length),
    [allColumns],
  );

  const [columnFormatting, setColumnFormatting] = useState<string | undefined>(
    config?.columnFormatting ??
      (Array.isArray(allColumns)
        ? allColumns.find(item => item.value === column)?.value
        : undefined),
  );

  const [objectFormatting, setObjectFormatting] =
    useState<ObjectFormattingEnum>(
      config?.objectFormatting || formattingOptions[0].value,
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

  const handleAllColumnChange = (value: string | undefined) => {
    setColumnFormatting(value);
  };
  const numericColumns = useMemo(
    () => allColumns.filter(col => col.dataType === GenericDataType.Numeric),
    [allColumns],
  );

  const visibleUseGradient = useMemo(
    () =>
      numericColumns.length > 0
        ? numericColumns.some((col: ColumnOption) => col.value === column) &&
          objectFormatting === ObjectFormattingEnum.BACKGROUND_COLOR
        : false,
    [column, numericColumns, objectFormatting],
  );

  const handleObjectChange = (value: ObjectFormattingEnum) => {
    setObjectFormatting(value);

    if (value === ObjectFormattingEnum.CELL_BAR) {
      const currentColumnValue = form.getFieldValue('columnFormatting');

      const isCurrentColumnNumeric = numericColumns.some(
        col => col.value === currentColumnValue,
      );

      if (!isCurrentColumnNumeric && numericColumns.length > 0) {
        const newValue = numericColumns[0]?.value || '';
        form.setFieldsValue({
          columnFormatting: newValue,
        });
        setColumnFormatting(newValue);
      }
    }
  };

  const getColumnOptions = useCallback(
    () =>
      objectFormatting === ObjectFormattingEnum.CELL_BAR
        ? numericColumns
        : allColumns,
    [objectFormatting, numericColumns, allColumns],
  );

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
      {visibleAllColumns && showOperatorFields ? (
        <Row gutter={12}>
          <Col span={12}>
            <FormItem
              name="columnFormatting"
              label={t('Formatting column')}
              rules={rulesRequired}
              initialValue={columnFormatting}
            >
              <Select
                ariaLabel={t('Select column name')}
                options={getColumnOptions()}
                onChange={(value: string | undefined) => {
                  handleAllColumnChange(value as string);
                }}
              />
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem
              name="objectFormatting"
              label={t('Formatting object')}
              rules={rulesRequired}
              initialValue={objectFormatting}
              tooltip={
                objectFormatting === ObjectFormattingEnum.CELL_BAR
                  ? t(
                      'Applies only when "Cell bars" formatting is selected: the background of the histogram columns is displayed if the "Show cell bars" flag is enabled.',
                    )
                  : null
              }
            >
              <Select
                ariaLabel={t('Select object name')}
                options={formattingOptions}
                onChange={(value: ObjectFormattingEnum) => {
                  handleObjectChange(value);
                }}
              />
            </FormItem>
          </Col>
        </Row>
      ) : null}
      {visibleUseGradient && (
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
      )}
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
