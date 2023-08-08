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
} from '@superset-ui/chart-controls';
import {t, validateNonEmpty} from '@superset-ui/core';
import React from 'react';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { ControlHeader } from '../../components/ControlHeader/controlHeader';
import { debounceFunc } from '../../consts';

interface HandlebarsCustomControlProps {
  value: string;
}

const JsonTemplateControl = (
  props: CustomControlConfig<HandlebarsCustomControlProps>,
) => {
  const val = String(
    props?.value ? props?.value : props?.default ? props?.default : '',
  );

  return (
    <div>
      <ControlHeader>{props.label}</ControlHeader>
      <CodeEditor
        theme="dark"
        mode="json"
        value={val}
        onChange={source => {
          debounceFunc(props.onChange, source || '');
        }}
      />
    </div>
  );
};

export const cubeTotalQueryControlSetItem: ControlSetItem = {
  name: 'cube_total_query_control',
  config: {
    ...sharedControls.entity,
    type: JsonTemplateControl,
    label: t('The query used to determine the total value of the progress'),
    description: t('The query used to determine the total value of the progress'),
    default: `INSERT JSON HERE`,
    isInt: false,
    renderTrigger: true,

    validators: [validateNonEmpty],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};

export const cubeValueQueryControlSetItem: ControlSetItem = {
  name: 'cube_value_query_control',
  config: {
    ...sharedControls.entity,
    type: JsonTemplateControl,
    label: t('The query used to determine the value of the progress'),
    description: t('The query used to determine the value of the progress'),
    default: `INSERT JSON HERE`,
    isInt: false,
    renderTrigger: true,

    validators: [validateNonEmpty],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};
