// // DODO was here

import { styled, t } from '@superset-ui/core';
import React from 'react';
import { Col, Row } from 'src/components';
import { FormItem } from 'src/components/Form';
import Select from 'src/components/Select/Select';
import Button from 'src/components/Button';
import ColorPickerControlDodo from '../ColorPickerControlDodo';
import {
  FormatingPopoverRenderFormContent,
  FormattingPopoverContentProps,
} from '../ConditionalFormattingControlDodoWrapper/types';
import { FormattingPopoverContentDodoWrapper } from '../ConditionalFormattingControlDodoWrapper/FormattingPopoverContentDodoWrapper';

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export const FormattingPopoverContentDodo = (
  props: FormattingPopoverContentProps,
) => {
  const renderFormContent: FormatingPopoverRenderFormContent = ({
    rulesRequired,
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
        <Col span={16}>
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
        <Col span={8}>
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
