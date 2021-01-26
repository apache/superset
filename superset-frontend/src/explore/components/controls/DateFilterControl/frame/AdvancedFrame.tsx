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
import React from 'react';
import { t } from '@superset-ui/core';
import { SEPARATOR } from 'src/explore/dateFilterUtils';
import { Input } from 'src/common/components';
import { FrameComponentProps } from '../types';
import DateFunctionTooltip from './DateFunctionTooltip';

export function AdvancedFrame(props: FrameComponentProps) {
  const advancedRange = getAdvancedRange(props.value || '');
  const [since, until] = advancedRange.split(SEPARATOR);
  if (advancedRange !== props.value) {
    props.onChange(getAdvancedRange(props.value || ''));
  }

  function getAdvancedRange(value: string): string {
    if (value.includes(SEPARATOR)) {
      return value;
    }
    if (value.startsWith('Last')) {
      return [value, ''].join(SEPARATOR);
    }
    if (value.startsWith('Next')) {
      return ['', value].join(SEPARATOR);
    }
    return SEPARATOR;
  }

  function onChange(control: 'since' | 'until', value: string) {
    if (control === 'since') {
      props.onChange(`${value}${SEPARATOR}${until}`);
    } else {
      props.onChange(`${since}${SEPARATOR}${value}`);
    }
  }

  return (
    <>
      <div className="section-title">
        {t('Configure Advanced Time Range ')}
        <DateFunctionTooltip placement="rightBottom">
          <i className="fa fa-info-circle text-muted" />
        </DateFunctionTooltip>
      </div>
      <div className="control-label">{t('START')}</div>
      <Input
        key="since"
        value={since}
        onChange={e => onChange('since', e.target.value)}
      />
      <div className="control-label">{t('END')}</div>
      <Input
        key="until"
        value={until}
        onChange={e => onChange('until', e.target.value)}
      />
    </>
  );
}
