// // DODO was here

import { ConditionalFormattingConfig } from 'src/explore/components/controls/ConditionalFormattingControl';
import React from 'react';
import { Col, Row } from 'src/components';
import { FormItem } from 'src/components/Form';
import Select from 'src/components/Select/Select';
import { styled, t } from '@superset-ui/core';
import Button from 'src/components/Button';
import ColorPickerControlDodo from '../ColorPickerControlDodo';
import { FormattingPopoverContentDodoWrapper } from '../ConditionalFormattingControlDodoWrapper/FormattingPopoverContentDodoWrapper';
import { FormatingPopoverRenderFormContent } from '../ConditionalFormattingControlDodoWrapper/types';

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export const FormattingPopoverContentNoGradient = (props: {
  config?: ConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig) => void;
  columns: { label: string; value: string }[];
}) => {
  const renderFormContent: FormatingPopoverRenderFormContent = ({
    rulesRequired,
    columns,
    colorScheme,
    colorsValues,
    chosenColor,
    setChosenColor,
    shouldFormItemUpdate,
    renderOperatorFields,
    parseColorValue,
  }) => (
    <>
      <Row gutter={12}>
        <Col span={24}>
          <FormItem
            name="column"
            label={t('Column')}
            rules={rulesRequired}
            initialValue={columns[0]?.value}
          >
            <Select ariaLabel={t('Select column')} options={columns} />
          </FormItem>
        </Col>
      </Row>
      {/* DODO added */}
      <Row gutter={12}>
        <Col span={12}>
          <FormItem
            name="colorScheme"
            label={t('Color scheme')}
            rules={rulesRequired}
            initialValue={colorScheme[0].value}
          >
            {/* DODO changed */}
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
        <Col span={12}>
          <FormItem
            name="colorScheme"
            label={t('Color')}
            initialValue={chosenColor}
          >
            <ColorPickerControlDodo // DODO changed
              onChange={(picked: string) => {
                setChosenColor(picked);
              }}
              value={chosenColor}
              isHex
            />
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
    </>
  );

  return (
    <FormattingPopoverContentDodoWrapper
      {...props}
      renderFormContent={renderFormContent}
    />
  );
};
