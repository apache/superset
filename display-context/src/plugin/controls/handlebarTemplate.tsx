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
import { t, validateNonEmpty } from '@superset-ui/core';
import React from 'react';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { ControlHeader } from '../../components/ControlHeader/controlHeader';
import { debounceFunc } from '../../consts';

interface HandlebarsCustomControlProps {
  value: string;
}

const HandlebarsTemplateControl = (
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
        value={val}
        onChange={source => {
          debounceFunc(props.onChange, source || '');
        }}
      />
    </div>
  );
};

export const handlebarsDataTemplateControlSetItem: ControlSetItem = {
  name: 'handlebarsDataTemplate',
  config: {
    ...sharedControls.entity,
    type: HandlebarsTemplateControl,
    label: t('Handlebars Data Template'),
    description: t('A handlebars template that is applied to the data'),
    default: `<span>
  {{data.all}}
</span>`,
    isInt: false,
    renderTrigger: true,

    validators: [validateNonEmpty],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};

export const handlebarsEmptyTemplateControlSetItem: ControlSetItem = {
  name: 'handlebarsEmptyTemplate',
  config: {
    ...sharedControls.entity,
    type: HandlebarsTemplateControl,
    label: t('Handlebars Empty Template'),
    description: t('A handlebars template when there is no data'),
    default: `<span>No data</span>`,
    isInt: false,
    renderTrigger: true,

    validators: [validateNonEmpty],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};
