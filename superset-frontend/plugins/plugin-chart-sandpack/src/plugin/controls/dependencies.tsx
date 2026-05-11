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
import { t } from '@apache-superset/core/translation';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { ControlHeader } from '../../components/ControlHeader/controlHeader';
import { debounceFunc, DEFAULT_DEPENDENCIES } from '../../consts';

interface DependenciesControlProps {
  value: string;
}

const DependenciesControl = (
  props: CustomControlConfig<DependenciesControlProps>,
) => (
  <div>
    <ControlHeader>
      <div>{typeof props.label === 'function' ? null : props.label}</div>
    </ControlHeader>
    <CodeEditor
      theme="dark"
      mode="json"
      value={props.value || ''}
      onChange={source => {
        debounceFunc(props.onChange, source || '');
      }}
    />
  </div>
);

export const dependenciesControlSetItem: ControlSetItem = {
  name: 'dependencies',
  config: {
    ...sharedControls.entity,
    type: DependenciesControl,
    label: t('NPM Dependencies'),
    description: t(
      'JSON object of npm packages and versions made available to the app.',
    ),
    default: DEFAULT_DEPENDENCIES,
    isInt: false,
    renderTrigger: true,
    valueKey: null,
    validators: [],
    mapStateToProps: ({ form_data }) => ({
      value: form_data?.dependencies,
    }),
  },
};
