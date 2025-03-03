// DODO was here
// DODO created 45525377

import { useState, useEffect } from 'react';
import { styled, SupersetTheme, t, useTheme } from '@superset-ui/core';
import {
  Comparator,
  MultipleValueComparators,
} from '@superset-ui/chart-controls';
import { Form, FormItem, FormProps } from 'src/components/Form';
import Select from 'src/components/Select/Select';
import { Col, Row } from 'src/components';
import { InputNumber } from 'src/components/Input';

import { ConditionalFormattingConfig } from 'src/explore/components/controls/ConditionalFormattingControl';
import { FormatingPopoverRenderFormContent } from './types';

const FullWidthInputNumber = styled(InputNumber)`
  width: 100%;
`;

const colorSchemeOptions = (theme: SupersetTheme) => [
  { value: theme.colors.success.light1, label: t('success') },
  { value: theme.colors.alert.light1, label: t('alert') },
  { value: theme.colors.error.light1, label: t('error') },
  { value: theme.colors.success.dark1, label: t('success dark') },
  { value: theme.colors.alert.dark1, label: t('alert dark') },
  { value: theme.colors.error.dark1, label: t('error dark') },
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

export type GetFieldValue = Pick<Required<FormProps>['form'], 'getFieldValue'>;

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

// DODO changed
export const FormattingPopoverContentDodoWrapper = ({
  config,
  onChange,
  columns = [],
  renderFormContent,
}: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string }[];
  renderFormContent: FormatingPopoverRenderFormContent;
}) => {
  const theme = useTheme();
  const colorScheme = colorSchemeOptions(theme);

  // DODO added
  const [loaded, setLoaded] = useState(false);
  const [chosenColor, setChosenColor] = useState<string>(
    config?.colorScheme || '#000',
  );
  const [colorsValues, setColorsValues] = useState<
    { value: string; label: string }[]
  >([]);

  const alteredColorScheme = colorScheme.concat({
    value: 'custom',
    label: 'custom',
  });

  const parseColorValue = (value: string | 'custom') => {
    if (value === 'custom') {
      setChosenColor(colorsValues[0].value);
    } else {
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
    const initialColor = parseInitialColor(
      config?.colorScheme || '#000',
      colorScheme,
    );
    if (initialColor) {
      setChosenColor(initialColor);
    }
    setColorsValues(alteredColorScheme);
    setLoaded(true);
  }, [config]);

  return (
    <>
      {/* DODO added */}
      {loaded ? (
        <Form
          onFinish={onChange}
          initialValues={config}
          requiredMark="optional"
          layout="vertical"
        >
          {renderFormContent({
            rulesRequired,
            columns,
            colorScheme,
            colorsValues,
            chosenColor,
            setChosenColor,
            shouldFormItemUpdate,
            renderOperatorFields,
            parseColorValue,
          })}
        </Form> // DODO addded
      ) : (
        'Loading...'
      )}
    </>
  );
};
