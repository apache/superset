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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { styled, t, useTheme } from '@superset-ui/core';
import Popover from 'src/components/Popover';
import Button from 'src/components/Button';
import { Form, FormItem } from 'src/components/Form';
import Icons from 'src/components/Icons';
import { InputNumber, Col, Row } from 'src/common/components';
import { Select } from 'src/components';
import {
  COMPARE_OPERATOR,
  ConditionalFormattingConfig,
  ConditionalFormattingControlProps,
  FormattingPopoverProps,
  MULTIPLE_VALUE_COMPARATORS,
} from './types';
import ControlHeader from '../../ControlHeader';
import {
  AddControlLabel,
  CaretContainer,
  Label,
  OptionControlContainer,
} from '../OptionControls';

const FullWidthInputNumber = styled(InputNumber)`
  width: 100%;
`;

const FormattersContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit}px;
  border: solid 1px ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.gridUnit}px;
`;

export const FormatterContainer = styled(OptionControlContainer)`
  &,
  & > div {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
    :last-child {
      margin-bottom: 0;
    }
  }
`;

export const CloseButton = styled.button`
  color: ${({ theme }) => theme.colors.grayscale.light1};
  height: 100%;
  width: ${({ theme }) => theme.gridUnit * 6}px;
  border: none;
  border-right: solid 1px ${({ theme }) => theme.colors.grayscale.dark2}0C;
  padding: 0;
  outline: none;
  border-bottom-left-radius: 3px;
  border-top-left-radius: 3px;
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
  { value: COMPARE_OPERATOR.GREATER_THAN, label: '>' },
  { value: COMPARE_OPERATOR.LESS_THAN, label: '<' },
  { value: COMPARE_OPERATOR.GREATER_OR_EQUAL, label: '≥' },
  { value: COMPARE_OPERATOR.LESS_OR_EQUAL, label: '≤' },
  { value: COMPARE_OPERATOR.EQUAL, label: '=' },
  { value: COMPARE_OPERATOR.NOT_EQUAL, label: '≠' },
  { value: COMPARE_OPERATOR.BETWEEN, label: '< x <' },
  { value: COMPARE_OPERATOR.BETWEEN_OR_EQUAL, label: '≤ x ≤' },
  { value: COMPARE_OPERATOR.BETWEEN_OR_LEFT_EQUAL, label: '≤ x <' },
  { value: COMPARE_OPERATOR.BETWEEN_OR_RIGHT_EQUAL, label: '< x ≤' },
];

const FormattingPopoverContent = ({
  config,
  onChange,
  columns = [],
}: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string }[];
}) => {
  const isOperatorMultiValue = (operator?: COMPARE_OPERATOR) =>
    operator && MULTIPLE_VALUE_COMPARATORS.includes(operator);

  const operatorField = useMemo(
    () => (
      <FormItem
        name="operator"
        label={t('Operator')}
        rules={[{ required: true, message: t('Required') }]}
        initialValue={operatorOptions[0].value}
      >
        <Select ariaLabel={t('Operator')} options={operatorOptions} />
      </FormItem>
    ),
    [],
  );

  return (
    <div>
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
              rules={[{ required: true, message: t('Required') }]}
              initialValue={columns[0]?.value}
            >
              <Select ariaLabel={t('Select column')} options={columns} />
            </FormItem>
          </Col>
          <Col span={12}>
            <FormItem
              name="colorScheme"
              label={t('Color scheme')}
              rules={[{ required: true, message: t('Required') }]}
              initialValue={colorSchemeOptions[0].value}
            >
              <Select
                ariaLabel={t('Color scheme')}
                options={colorSchemeOptions}
              />
            </FormItem>
          </Col>
        </Row>
        <FormItem
          noStyle
          shouldUpdate={(
            prevValues: ConditionalFormattingConfig,
            currentValues: ConditionalFormattingConfig,
          ) =>
            isOperatorMultiValue(prevValues.operator) !==
            isOperatorMultiValue(currentValues.operator)
          }
        >
          {({ getFieldValue }) =>
            isOperatorMultiValue(getFieldValue('operator')) ? (
              <Row gutter={12}>
                <Col span={9}>
                  <FormItem
                    name="targetValueLeft"
                    label={t('Left value')}
                    rules={[
                      { required: true, message: t('Required') },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (
                            !value ||
                            !getFieldValue('targetValueRight') ||
                            getFieldValue('targetValueRight') > value
                          ) {
                            return Promise.resolve();
                          }
                          return Promise.reject(
                            new Error(
                              t(
                                'This value should be smaller than the right target value',
                              ),
                            ),
                          );
                        },
                      }),
                    ]}
                    dependencies={['targetValueRight']}
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
                    rules={[
                      { required: true, message: t('Required') },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (
                            !value ||
                            !getFieldValue('targetValueLeft') ||
                            getFieldValue('targetValueLeft') < value
                          ) {
                            return Promise.resolve();
                          }
                          return Promise.reject(
                            new Error(
                              t(
                                'This value should be greater than the left target value',
                              ),
                            ),
                          );
                        },
                      }),
                    ]}
                    dependencies={['targetValueLeft']}
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
                    rules={[{ required: true, message: t('Required') }]}
                  >
                    <FullWidthInputNumber />
                  </FormItem>
                </Col>
              </Row>
            )
          }
        </FormItem>
        <FormItem>
          <JustifyEnd>
            <Button htmlType="submit">{t('Apply')}</Button>
          </JustifyEnd>
        </FormItem>
      </Form>
    </div>
  );
};

const FormattingPopover = ({
  title,
  columns,
  onChange,
  config,
  children,
  ...props
}: FormattingPopoverProps) => {
  const [visible, setVisible] = useState(false);

  const handleSave = useCallback(
    (newConfig: ConditionalFormattingConfig) => {
      setVisible(false);
      onChange(newConfig);
    },
    [onChange],
  );

  return (
    <Popover
      title={title}
      content={
        <FormattingPopoverContent
          onChange={handleSave}
          config={config}
          columns={columns}
        />
      }
      visible={visible}
      onVisibleChange={setVisible}
      trigger={['click']}
      overlayStyle={{ width: '450px' }}
      {...props}
    >
      {children}
    </Popover>
  );
};

const ConditionalFormattingControl = ({
  value,
  onChange,
  columnOptions,
  verboseMap,
  ...props
}: ConditionalFormattingControlProps) => {
  const theme = useTheme();
  const [
    conditionalFormattingConfigs,
    setConditionalFormattingConfigs,
  ] = useState<ConditionalFormattingConfig[]>(value ?? []);

  useEffect(() => {
    if (onChange) {
      onChange(conditionalFormattingConfigs);
    }
  }, [conditionalFormattingConfigs, onChange]);

  const onDelete = (index: number) => {
    setConditionalFormattingConfigs(prevConfigs =>
      prevConfigs.filter((_, i) => i !== index),
    );
  };

  const onSave = (config: ConditionalFormattingConfig) => {
    setConditionalFormattingConfigs(prevConfigs => [...prevConfigs, config]);
  };

  const onEdit = (newConfig: ConditionalFormattingConfig, index: number) => {
    const newConfigs = [...conditionalFormattingConfigs];
    newConfigs.splice(index, 1, newConfig);
    setConditionalFormattingConfigs(newConfigs);
  };

  const createLabel = ({
    column,
    operator,
    targetValue,
    targetValueLeft,
    targetValueRight,
  }: ConditionalFormattingConfig) => {
    const columnName = (column && verboseMap?.[column]) ?? column;
    switch (operator) {
      case COMPARE_OPERATOR.BETWEEN:
        return `${targetValueLeft} ${COMPARE_OPERATOR.LESS_THAN} ${columnName} ${COMPARE_OPERATOR.LESS_THAN} ${targetValueRight}`;
      case COMPARE_OPERATOR.BETWEEN_OR_EQUAL:
        return `${targetValueLeft} ${COMPARE_OPERATOR.LESS_OR_EQUAL} ${columnName} ${COMPARE_OPERATOR.LESS_OR_EQUAL} ${targetValueRight}`;
      case COMPARE_OPERATOR.BETWEEN_OR_LEFT_EQUAL:
        return `${targetValueLeft} ${COMPARE_OPERATOR.LESS_OR_EQUAL} ${columnName} ${COMPARE_OPERATOR.LESS_THAN} ${targetValueRight}`;
      case COMPARE_OPERATOR.BETWEEN_OR_RIGHT_EQUAL:
        return `${targetValueLeft} ${COMPARE_OPERATOR.LESS_THAN} ${columnName} ${COMPARE_OPERATOR.LESS_OR_EQUAL} ${targetValueRight}`;
      default:
        return `${columnName} ${operator} ${targetValue}`;
    }
  };

  return (
    <div>
      <ControlHeader {...props} />
      <FormattersContainer>
        {conditionalFormattingConfigs.map((config, index) => (
          <FormatterContainer key={index}>
            <CloseButton onClick={() => onDelete(index)}>
              <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
            </CloseButton>
            <FormattingPopover
              title={t('Edit formatter')}
              config={config}
              columns={columnOptions}
              onChange={(newConfig: ConditionalFormattingConfig) =>
                onEdit(newConfig, index)
              }
              destroyTooltipOnHide
            >
              <OptionControlContainer withCaret>
                <Label>{createLabel(config)}</Label>
                <CaretContainer>
                  <Icons.CaretRight iconColor={theme.colors.grayscale.light1} />
                </CaretContainer>
              </OptionControlContainer>
            </FormattingPopover>
          </FormatterContainer>
        ))}
        <FormattingPopover
          title={t('Add new formatter')}
          columns={columnOptions}
          onChange={onSave}
          destroyTooltipOnHide
        >
          <AddControlLabel>
            <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
            {t('Add new color formatter')}
          </AddControlLabel>
        </FormattingPopover>
      </FormattersContainer>
    </div>
  );
};

export default ConditionalFormattingControl;
