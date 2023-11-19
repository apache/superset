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
import { Radio } from 'src/components/Radio';
import { useTimeFilterShortcuts } from 'src/explore/components/controls/DateFilterControl/utils';
import { FrameComponentProps } from 'src/explore/components/controls/DateFilterControl/types';

export function ShortcutsFrame(props: FrameComponentProps) {
  const shortcuts = useTimeFilterShortcuts();

  return (
    <>
      <div className="section-title">{t('Configure Time Range:')}</div>
      <Radio.Group
        value={props.value}
        onChange={(e: any) => props.onChange(e.target.value)}
      >
        {shortcuts.map(([key, value]: [string, string]) => (
          <Radio key={key} value={value} className="vertical-radio">
            {key}
          </Radio>
        ))}
      </Radio.Group>
    </>
  );
}
