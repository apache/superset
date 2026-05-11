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
import { validateNonEmpty } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/theme';
import { InfoTooltip } from '@superset-ui/core/components';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { ControlHeader } from '../../components/ControlHeader/controlHeader';
import { debounceFunc, DEFAULT_APP_CODE } from '../../consts';

interface AppCodeControlProps {
  value: string;
}

const AppCodeControl = (props: CustomControlConfig<AppCodeControlProps>) => {
  const theme = useTheme();
  const val = String(
    props?.value ? props?.value : props?.default ? props?.default : '',
  );

  return (
    <div>
      <ControlHeader>
        <div>
          {typeof props.label === 'function' ? null : props.label}
          <InfoTooltip
            iconStyle={{ marginLeft: theme.sizeUnit }}
            tooltip={t(
              'Query results are exposed to the app as `./data.json`. ' +
                'Import it from your entry file to render the data.',
            )}
          />
        </div>
      </ControlHeader>
      <CodeEditor
        theme="dark"
        mode="javascript"
        value={val}
        onChange={source => {
          debounceFunc(props.onChange, source || '');
        }}
      />
    </div>
  );
};

export const appCodeControlSetItem: ControlSetItem = {
  name: 'appCode',
  config: {
    ...sharedControls.entity,
    type: AppCodeControl,
    label: t('App Code'),
    description: t(
      'Source code for the Sandpack app entry file. The query result is ' +
        'available as `./data.json`.',
    ),
    default: DEFAULT_APP_CODE,
    isInt: false,
    renderTrigger: true,
    valueKey: null,
    validators: [validateNonEmpty],
    mapStateToProps: ({ form_data }) => ({
      value: form_data?.appCode ?? form_data?.app_code,
    }),
  },
};
