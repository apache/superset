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
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import {
  Comparator,
  MultipleValueComparators,
  ObjectFormattingEnum,
  ColorSchemeEnum,
  BoundUnit,
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
  colorScheme,
  boundUnitOptions,
  percentDenominatorOptions,
} from './constants';
import ColorPickerControl from '../ColorPickerControl';

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
      targetValue === null ||
      targetValue === undefined ||
      compareValue === null ||
      compareValue === undefined ||
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

const minBoundValidator = targetValueValidator(
  (max: number, min: number) => min < max,
  t('Min bound should be smaller than max bound'),
);

const maxBoundValidator = targetValueValidator(
  (min: number, max: number) => max > min,
  t('Max bound should be greater than min bound'),
);

const minBoundTargetValidator = targetValueValidator(
  (target: number, min: number) => min < target,
  t('Min bound should be smaller than target value'),
);

const maxBoundTargetValidator = targetValueValidator(
  (target: number, max: number) => max > target,
  t('Max bound should be greater than target value'),
);

const centerValueMinValidator = targetValueValidator(
  (min: number, center: number) => center > min,
  t('Center value should be greater than min bound'),
);

const centerValueMaxValidator = targetValueValidator(
  (max: number, center: number) => center < max,
  t('Center value should be smaller than max bound'),
);

const normalizeOptionalNumber = (value: number | string | null | undefined) =>
  value === '' || value === null || value === undefined
    ? undefined
    : Number(value);

const isOperatorMultiValue = (operator?: Comparator) =>
  operator && MultipleValueComparators.includes(operator);

const isOperatorNone = (operator?: Comparator) =>
  !operator || operator === Comparator.None;

type BoundVisibility = { showMin: boolean; showMax: boolean };

// `>`/`>=` only use maxBound and `<`/`<=` only use minBound; targetValue
// covers the other end, so only show the bound that actually applies.
const getBoundVisibility = (operator?: Comparator): BoundVisibility => {
  if (isOperatorNone(operator)) {
    return { showMin: true, showMax: true };
  }
  if (
    operator === Comparator.GreaterThan ||
    operator === Comparator.GreaterOrEqual
  ) {
    return { showMin: false, showMax: true };
  }
  if (operator === Comparator.LessThan || operator === Comparator.LessOrEqual) {
    return { showMin: true, showMax: false };
  }
  return { showMin: false, showMax: false };
};

const isOperatorBoundable = (operator?: Comparator) => {
  const { showMin, showMax } = getBoundVisibility(operator);
  return showMin || showMax;
};

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

const rulesMinBound = [
  ({ getFieldValue }: GetFieldValue) => ({
    validator: minBoundValidator(getFieldValue('maxBound')),
  }),
];

const rulesMaxBound = [
  ({ getFieldValue }: GetFieldValue) => ({
    validator: maxBoundValidator(getFieldValue('minBound')),
  }),
];

const rulesMinBoundTarget = [
  ({ getFieldValue }: GetFieldValue) => ({
    validator:
      getFieldValue('boundUnit') === BoundUnit.Percent
        ? () => Promise.resolve()
        : minBoundTargetValidator(getFieldValue('targetValue')),
  }),
];

const rulesMaxBoundTarget = [
  ({ getFieldValue }: GetFieldValue) => ({
    validator:
      getFieldValue('boundUnit') === BoundUnit.Percent
        ? () => Promise.resolve()
        : maxBoundTargetValidator(getFieldValue('targetValue')),
  }),
];

const minBoundDeps = ['maxBound'];
const maxBoundDeps = ['minBound'];
const targetValueDeps = ['targetValue', 'boundUnit'];

const rulesCenterValue = [
  ({ getFieldValue }: GetFieldValue) => ({
    validator: centerValueMinValidator(getFieldValue('minBound')),
  }),
  ({ getFieldValue }: GetFieldValue) => ({
    validator: centerValueMaxValidator(getFieldValue('maxBound')),
  }),
];

const centerValueDeps = ['minBound', 'maxBound'];

const shouldFormItemUpdate = (
  prevValues: ConditionalFormattingConfig,
  currentValues: ConditionalFormattingConfig,
) => {
  const prevBounds = getBoundVisibility(prevValues.operator);
  const currentBounds = getBoundVisibility(currentValues.operator);
  return (
    isOperatorNone(prevValues.operator) !==
      isOperatorNone(currentValues.operator) ||
    isOperatorMultiValue(prevValues.operator) !==
      isOperatorMultiValue(currentValues.operator) ||
    prevBounds.showMin !== currentBounds.showMin ||
    prevBounds.showMax !== currentBounds.showMax
  );
};

const boundUnitShouldUpdate = (
  prevValues: ConditionalFormattingConfig,
  currentValues: ConditionalFormattingConfig,
) => prevValues.boundUnit !== currentValues.boundUnit;

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

const renderBoundFields = (
  operator?: Comparator,
  serverPagination?: boolean,
) => {
  const { showMin, showMax } = getBoundVisibility(operator);
  // Cross-validate min/max only when both are shown; a lone bound
  // validates against targetValue instead, its other end of the scale.
  const useCrossFieldRules = showMin && showMax;
  const minRules = useCrossFieldRules ? rulesMinBound : rulesMinBoundTarget;
  const maxRules = useCrossFieldRules ? rulesMaxBound : rulesMaxBoundTarget;
  const minDependencies = useCrossFieldRules ? minBoundDeps : targetValueDeps;
  const maxDependencies = useCrossFieldRules ? maxBoundDeps : targetValueDeps;
  // Percentage bounds require the complete result set. Existing percentage
  // configurations remain editable here, but formatters use automatic bounds
  // while server pagination is enabled.
  const boundUnitSelectOptions = serverPagination
    ? boundUnitOptions.map(option =>
        option.value === boundUnitOptions[1].value
          ? { ...option, disabled: true }
          : option,
      )
    : boundUnitOptions;

  return (
    <>
      <Row gutter={12}>
        <Col span={12}>
          <FormItem
            name="boundUnit"
            label={t('Bound unit')}
            initialValue={boundUnitOptions[0].value}
            tooltip={
              serverPagination
                ? t(
                    'Value: type the exact numbers used for coloring below. % of column is unavailable with Server pagination enabled, since each page would compute a different percentage. Existing percentage rules use the automatic data range while Server pagination is enabled.',
                  )
                : t(
                    'Value: type the exact numbers used for coloring below. % of column: type a percentage of the column maximum or sum selected below, so the rule keeps working as the data changes. Column sum adds the absolute values so positive and negative values do not cancel each other out.',
                  )
            }
          >
            <Select
              ariaLabel={t('Bound unit')}
              options={boundUnitSelectOptions}
            />
          </FormItem>
        </Col>
        <Col span={12}>
          <FormItem noStyle shouldUpdate={boundUnitShouldUpdate}>
            {({ getFieldValue }: GetFieldValue) =>
              getFieldValue('boundUnit') === boundUnitOptions[1].value ? (
                <FormItem
                  name="percentDenominator"
                  label={t('% of')}
                  initialValue={percentDenominatorOptions[0].value}
                >
                  <Select
                    ariaLabel={t('Percent denominator')}
                    options={percentDenominatorOptions}
                  />
                </FormItem>
              ) : null
            }
          </FormItem>
        </Col>
      </Row>
      <Row gutter={12}>
        {showMin && (
          <Col span={showMax ? 12 : 24}>
            <FormItem
              name="minBound"
              label={t('Min bound')}
              rules={minRules}
              dependencies={minDependencies}
              normalize={normalizeOptionalNumber}
              validateTrigger="onBlur"
              tooltip={t(
                'Overrides the lowest value used for coloring. Leave blank to use the lowest value in the data.',
              )}
            >
              <FullWidthInputNumber />
            </FormItem>
          </Col>
        )}
        {showMax && (
          <Col span={showMin ? 12 : 24}>
            <FormItem
              name="maxBound"
              label={t('Max bound')}
              rules={maxRules}
              dependencies={maxDependencies}
              normalize={normalizeOptionalNumber}
              validateTrigger="onBlur"
              tooltip={t(
                'Overrides the highest value used for coloring. Leave blank to use the highest value in the data.',
              )}
            >
              <FullWidthInputNumber />
            </FormItem>
          </Col>
        )}
      </Row>
    </>
  );
};

const renderDivergingFields = () => (
  <>
    <Row gutter={12}>
      <Col span={24}>
        <FormItem
          name="centerValue"
          label={t('Center value')}
          rules={rulesCenterValue}
          dependencies={centerValueDeps}
          normalize={normalizeOptionalNumber}
          validateTrigger="onBlur"
          tooltip={t(
            'Optional. When set together with Low color, Mid color, and High color below, colors diverge from Mid color at this value toward Low color below it and High color above it, instead of a single color fading in and out. For % of column with Column sum, the resolved center must still fall inside the color range; otherwise the rule uses its single color.',
          )}
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
    </Row>
    <Row gutter={12}>
      <Col span={8}>
        <FormItem name="lowColor" label={t('Low color')}>
          <ColorPickerControl ariaLabel={t('Low color')} outputFormat="hex" />
        </FormItem>
      </Col>
      <Col span={8}>
        <FormItem name="midColor" label={t('Mid color')}>
          <ColorPickerControl ariaLabel={t('Mid color')} outputFormat="hex" />
        </FormItem>
      </Col>
      <Col span={8}>
        <FormItem name="highColor" label={t('High color')}>
          <ColorPickerControl ariaLabel={t('High color')} outputFormat="hex" />
        </FormItem>
      </Col>
    </Row>
  </>
);

const renderOperatorFields = (
  { getFieldValue }: GetFieldValue,
  columnType?: GenericDataType,
  serverPagination?: boolean,
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
            initialValue=""
            hidden
          />
        </Col>
      </Row>
    );
  }

  const operator = getFieldValue('operator');
  const showBoundFields = !columnTypeString && isOperatorBoundable(operator);
  const showDivergingFields = !columnTypeString && isOperatorNone(operator);

  return isOperatorNone(operator) ? (
    <>
      <Row gutter={12}>
        <Col span={operatorColSpan}>{renderOperator({ columnType })}</Col>
      </Row>
      {showBoundFields && renderBoundFields(operator, serverPagination)}
      {showDivergingFields && renderDivergingFields()}
    </>
  ) : isOperatorMultiValue(operator) ? (
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
    <>
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
      {showBoundFields && renderBoundFields(operator, serverPagination)}
    </>
  );
};

export const FormattingPopoverContent = ({
  config,
  onChange,
  columns = [],
  extraColorChoices = [],
  allColumns = [],
  serverPagination = false,
}: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string; dataType: GenericDataType }[];
  extraColorChoices?: { label: string; colors: string[] }[];
  allColumns?: ColumnOption[];
  serverPagination?: boolean;
}) => {
  const [form] = Form.useForm();
  const colors = colorScheme();
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
  const defaultColorToken = colors[0]?.colors?.[0];

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

  const trendColorsTooltip = (
    <div>
      <div>{t('Trend colors are added (for time-based comparison):')}</div>
      <div>{t('green — increase / red — decrease')}</div>
      <div>{t('red — increase / green — decrease')}</div>
    </div>
  );

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
            initialValue={defaultColorToken}
            tooltip={extraColorChoices.length > 0 ? trendColorsTooltip : ''}
          >
            <ColorPickerControl
              ariaLabel={t('Color scheme')}
              onChange={event => handleChange(event)}
              presets={[...colors, ...extraColorChoices]}
              resolveThemeTokens
              outputFormat="hex"
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
          (props: GetFieldValue) =>
            renderOperatorFields(props, columnType, serverPagination)
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
