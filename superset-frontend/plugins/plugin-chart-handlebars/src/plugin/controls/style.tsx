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
import {
  ControlSetItem,
  CustomControlConfig,
  sharedControls,
  InfoTooltipWithTrigger,
} from '@superset-ui/chart-controls';
import { t, useTheme } from '@superset-ui/core';
import React from 'react';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { ControlHeader } from '../../components/ControlHeader/controlHeader';
import { debounceFunc } from '../../consts';

interface StyleCustomControlProps {
  value: string;
}

const StyleControl = (props: CustomControlConfig<StyleCustomControlProps>) => {
  const theme = useTheme();

  const defaultValue = props?.value
    ? undefined
    : `/*
  .data-list {
    background-color: yellow;
  }
*/`;

  return (
    <div>
      <ControlHeader>
        <div>
          {props.label}
          <InfoTooltipWithTrigger
            iconsStyle={{ marginLeft: theme.gridUnit }}
            tooltip={t('You need to configure HTML sanitization to use CSS')}
          />
        </div>
      </ControlHeader>
      <CodeEditor
        theme="dark"
        mode="css"
        value={props.value}
        defaultValue={defaultValue}
        onChange={source => {
          debounceFunc(props.onChange, source || '');
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
    isInt: false,
    renderTrigger: true,

    validators: [],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};
