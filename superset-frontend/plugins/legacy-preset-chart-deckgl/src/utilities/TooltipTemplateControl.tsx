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

import { useCallback } from 'react';
import { debounce } from 'lodash';
import { t, useTheme } from '@superset-ui/core';
import { InfoTooltip, Constants } from '@superset-ui/core/components';
import { ControlHeader } from '@superset-ui/chart-controls';
import { TooltipTemplateEditor } from './TooltipTemplateEditor';

interface TooltipTemplateControlProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  name: string;
  height?: number;
}

const debounceFunc = debounce(
  (func: (val: string) => void, source: string) => func(source),
  Constants.SLOW_DEBOUNCE,
);

export function TooltipTemplateControl({
  value,
  onChange,
  label,
  name,
}: TooltipTemplateControlProps) {
  const theme = useTheme();

  const handleTemplateChange = useCallback(
    (newValue: string) => {
      debounceFunc(onChange, newValue || '');
    },
    [onChange],
  );

  const tooltipContent = t(
    'Use Handlebars syntax to create custom tooltips. Available variables are based on your tooltip contents selection above.',
  );

  return (
    <div>
      <ControlHeader
        name={name}
        label={
          <>
            {label || t('Customize tooltips template')}
            <InfoTooltip
              iconStyle={{ marginLeft: theme.sizeUnit }}
              tooltip={tooltipContent}
            />
          </>
        }
      />
      <TooltipTemplateEditor
        value={value}
        onChange={handleTemplateChange}
        name={name}
      />
    </div>
  );
}

export default TooltipTemplateControl;
