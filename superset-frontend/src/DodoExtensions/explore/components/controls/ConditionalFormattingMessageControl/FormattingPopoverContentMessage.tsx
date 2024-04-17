// DODO was here
// DODO added #32232659
import React from 'react';
import { styled, t } from '@superset-ui/core';
import { Input } from 'antd';
import { FormattingPopoverContentDodoWrapper } from '../ConditionalFormattingControlDodoWrapper/FormattingPopoverContentDodoWrapper';
import {
  FormatingPopoverRenderFormContent,
  FormattingPopoverContentProps,
} from '../ConditionalFormattingControlDodoWrapper/types';
import { Col, Row } from '../../../../../components';
import { FormItem } from '../../../../../components/Form';
import Select from '../../../../../components/Select/Select';
import ColorPickerControlDodo from '../ColorPickerControlDodo';
import Button from '../../../../../components/Button';
import { StyledFlag } from '../../../../../../plugins/plugin-chart-echarts/src/DodoExtensions/common';

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const FormattingPopoverContentMessage = (
  props: FormattingPopoverContentProps,
) => {
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
      <Row>
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

      <Row>
        <Col span={24}>
          <FormItem
            label={
              <>
                <StyledFlag
                  style={{ display: 'inline', marginRight: '0.5rem' }}
                  language="ru"
                  pressToTheBottom={false}
                />
                <span>{t('Message')}</span>
              </>
            }
            name="messageRU"
            rules={[{ required: true, message: 'Message RU is required' }]}
          >
            <Input />
          </FormItem>
        </Col>
      </Row>

      <Row>
        <Col span={24}>
          <FormItem
            label={
              <>
                <StyledFlag
                  style={{ display: 'inline', marginRight: '0.5rem' }}
                  language="gb"
                  pressToTheBottom={false}
                />
                <span>{t('Message')}</span>
              </>
            }
            name="messageEN"
            rules={[{ required: true, message: 'Message EN is required' }]}
          >
            <Input />
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

export { FormattingPopoverContentMessage };
