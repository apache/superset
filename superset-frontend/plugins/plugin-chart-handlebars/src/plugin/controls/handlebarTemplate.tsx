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
import { t, validateNonEmpty, useTheme, SafeMarkdown } from '@superset-ui/core';
import { CodeEditor } from '../../components/CodeEditor/CodeEditor';
import { ControlHeader } from '../../components/ControlHeader/controlHeader';
import { debounceFunc } from '../../consts';

interface HandlebarsCustomControlProps {
  value: string;
}

const HandlebarsTemplateControl = (
  props: CustomControlConfig<HandlebarsCustomControlProps>,
) => {
  const theme = useTheme();

  const val = String(
    props?.value ? props?.value : props?.default ? props?.default : '',
  );

  const helperDescriptionsHeader = t(
    'Available Handlebars Helpers in Superset:',
  );

  const helperDescriptions = [
    { key: 'dateFormat', descKey: 'Formats a date using a specified format.' },
    { key: 'stringify', descKey: 'Converts an object to a JSON string.' },
    {
      key: 'formatNumber',
      descKey: 'Formats a number using locale-specific formatting.',
    },
    {
      key: 'parseJson',
      descKey: 'Parses a JSON string into a JavaScript object.',
    },
  ];

  const helpersTooltipContent = `
${helperDescriptionsHeader}

${helperDescriptions
  .map(({ key, descKey }) => `- **${key}**: ${t(descKey)}`)
  .join('\n')}
`;

  return (
    <div>
      <ControlHeader>
        <div>
          {props.label}
          <InfoTooltipWithTrigger
            iconsStyle={{ marginLeft: theme.gridUnit }}
            tooltip={<SafeMarkdown source={helpersTooltipContent} />}
          />
        </div>
      </ControlHeader>
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

export const handlebarsTemplateControlSetItem: ControlSetItem = {
  name: 'handlebarsTemplate',
  config: {
    ...sharedControls.entity,
    type: HandlebarsTemplateControl,
    label: t('Handlebars Template'),
    description: t('A handlebars template that is applied to the data'),
    default: `<ul class="data-list">
  {{#each data}}
    <li>{{stringify this}}</li>
  {{/each}}
</ul>`,
    isInt: false,
    renderTrigger: true,
    valueKey: null,

    validators: [validateNonEmpty],
    mapStateToProps: ({ controls }) => ({
      value: controls?.handlebars_template?.value,
    }),
  },
};
