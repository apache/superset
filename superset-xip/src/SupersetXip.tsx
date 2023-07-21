import React, { createRef } from 'react';
import { styled } from '@superset-ui/core';
import { SupersetXipProps, SupersetXipStylesProps } from './types';
import { FormComponent } from './components/FormComponent';
import { Button } from 'antd';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

// const websocketOption = new WebSocketTransport({
//   authorization: "d60cb603dde98ba3037f2de9eda44938",
//   apiUrl: "ws://93.119.15.212:4000/"
// });

const Styles = styled.div<SupersetXipStylesProps>`
  //background-color: ${({ theme }) => theme.colors.secondary.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;

  h3 {
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    font-size: ${({ theme, headerFontSize }) =>
      theme.typography.sizes[headerFontSize]}px;
  }
  
  h4 {
    font-size: 12px;
  }

  .checkbox-label {
    margin-left: 8px;
  }

  .ant-form-item {
    margin-bottom: 12px;
  }
`;

export default function SupersetXip(props: SupersetXipProps) {
  const { data, height, width } = props;
  const rootElem = createRef<HTMLDivElement>();

  const initialState: Record<string, string | boolean> = {};

  props.formObject.forEach((field) => {
    if (field.field_type === 'checkbox') {
      initialState[field.field_id] = !!field.field_value;
      return;
    }

    initialState[field.field_id] = field.field_value;
  });

  const [formData, setFormData] = React.useState(initialState);

  function handleFormInput(form_id: string, value: any) {
    setFormData({ ...formData, [form_id]: value });
  }

  function handleSubmit() {
    console.log('submitting form action with ID', props.actionIdentifier);
    console.log(formData);
  }

  return (
    <Styles
      ref={rootElem}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <form onSubmit={handleSubmit}>
        {props.formObject
          ? props.formObject.map((field, i) => {
              return (
                <FormComponent
                  key={i}
                  field={field}
                  formData={formData}
                  handleFormInput={handleFormInput}
                />
              );
            })
          : null}
        <br />
        <Button
          onClick={() => handleSubmit()}
          type="primary">{props.buttonText}</Button>
      </form>
    </Styles>
  );
}
