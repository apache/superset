/* eslint-disable theme-colors/no-literal-colors */
// DODO was here
import React, { useEffect, useState } from 'react';
import { styled, SupersetTheme, t, useTheme } from '@superset-ui/core';
import { Form, FormItem, FormProps } from 'src/components/Form';
import Select from 'src/components/Select/Select';
import { Col, Row } from 'src/components';
import { InputNumber } from 'src/components/Input';
import Button from 'src/components/Button';
import { Switch } from 'src/components/Switch';
import ColorPickerControl from 'src/explore/components/controls/ColorPickerControl';

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

const colorSchemeOptions = (theme: SupersetTheme) => [
  { value: theme.colors.success.light1, label: t('green') },
  { value: theme.colors.alert.light1, label: t('yellow') },
  { value: theme.colors.error.light1, label: t('red') },
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

  const alteredColorScheme = colorScheme.concat({
    value: 'custom',
    label: 'Custom',
  });

  const [control, setControl] = useState(config?.isFixedColor);
  const [loaded, setLoaded] = useState(false);
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [chosenColor, setChosenColor] = useState<string>(
    config?.colorScheme || '#000',
  );
  const [colorsValues, setColorsValues] = useState<
    { value: string; label: string }[]
  >([]);

  const parseColorValue = (value: string | 'custom') => {
    if (value === 'custom') {
      setPickerVisible(true);
      setChosenColor(colorsValues[0].value);
    } else {
      setPickerVisible(false);
      setChosenColor(value || '#000');
    }
  };

  const parseInitialColor = (
    value: string,
    values: { value: string; label: string }[],
  ) => {
    const filteredColorScheme = values.filter(val => val.value === value);

    if (filteredColorScheme.length) {
      return filteredColorScheme[0].value;
    }
    return value;
  };

  useEffect(() => {
    const chosenColorValue = parseInitialColor(
      config?.colorScheme || '#000',
      colorScheme,
    );
    if (chosenColorValue) {
      setChosenColor(chosenColorValue);
    }
    setColorsValues(alteredColorScheme);
    setLoaded(true);
  }, [config]);

  return (
    <>
      {loaded ? (
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
                initialValue={columns[0].value}
              >
                <Select ariaLabel={t('Select column')} options={columns} />
              </FormItem>
            </Col>
            <Col span={12}>
              <FormItem
                name="colorScheme"
                label={t('Color scheme')}
                rules={rulesRequired}
                initialValue={colorsValues[0].value}
              >
                <Select
                  ariaLabel={t('Color scheme')}
                  options={colorsValues}
                  onChange={value => {
                    // @ts-ignore
                    parseColorValue(value);
                  }}
                />
              </FormItem>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <FormItem
                name="isFixedColor"
                label={t('Fixed color')}
                initialValue={control}
              >
                <Switch
                  data-test="toggle-active"
                  checked={control}
                  onClick={(checked: boolean) => {
                    setControl(checked);
                  }}
                  size="default"
                />
              </FormItem>
            </Col>

            {isPickerVisible && (
              <Col span={12}>
                <FormItem
                  name="colorScheme"
                  label={t('Color')}
                  initialValue={chosenColor}
                >
                  <ColorPickerControl
                    onChange={(picked: string) => {
                      setChosenColor(picked);
                    }}
                    value={chosenColor}
                    isHex
                  />
                </FormItem>
              </Col>
            )}
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
      ) : (
        'Loading...'
      )}
    </>
  );
};
