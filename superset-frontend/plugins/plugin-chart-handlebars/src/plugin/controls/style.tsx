import {
  ControlSetItem,
  CustomControlConfig,
  sharedControls,
} from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import React from 'react';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { ControlHeader } from '../../components/ControlHeader/controlHeader';

interface StyleCustomControlProps {
  value: string;
}

const StyleControl = (props: CustomControlConfig<StyleCustomControlProps>) => {
  const val = String(
    props?.value ? props?.value : props?.default ? props?.default : '',
  );

  const updateConfig = (source: string) => {
    props.onChange(source);
  };
  return (
    <div>
      <ControlHeader>{props.label}</ControlHeader>
      <CodeEditor
        theme="dark"
        mode="css"
        value={val}
        onChange={source => {
          updateConfig(source || '');
        }}
      />
    </div>
  );
};

export const styleControlSetItem: ControlSetItem = {
  name: 'styleTemplate',
  config: {
    ...sharedControls.entity,
    type: StyleControl,
    label: t('CSS Styles'),
    description: t('CSS applied to the chart'),
    default: '',
    isInt: false,
    renderTrigger: true,

    validators: [],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};
