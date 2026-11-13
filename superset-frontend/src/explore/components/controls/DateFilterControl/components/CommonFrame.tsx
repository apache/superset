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
import { t } from '@apache-superset/core/translation';
import { Radio } from '@superset-ui/core/components/Radio';
import {
  COMMON_RANGE_OPTIONS,
  COMMON_RANGE_SET,
  DateFilterTestKey,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CommonRangeType,
  FrameComponentProps,
} from 'src/explore/components/controls/DateFilterControl/types';
import { defaultPreset, presetGroup, presetOptions } from './limitFields';

export function CommonFrame(props: FrameComponentProps) {
  const presets = props.limits?.presets;
  let commonRange = defaultPreset(COMMON_RANGE_OPTIONS, 'Last week', presets);
  if (COMMON_RANGE_SET.has(props.value as CommonRangeType)) {
    commonRange = props.value;
  } else {
    props.onChange(commonRange);
  }
  const options = presetOptions(
    COMMON_RANGE_OPTIONS,
    commonRange,
    presets,
    props.limits,
  );
  const group = presetGroup(props.limits, options);

  return (
    <>
      <div
        className="section-title"
        data-test={DateFilterTestKey.CommonFrame}
        id={group.titleId}
      >
        {t('Configure Time Range: Last...')}
      </div>
      <Radio.GroupWrapper
        spaceConfig={{
          direction: 'vertical',
          size: 15,
          align: 'start',
          wrap: false,
        }}
        size="large"
        value={commonRange}
        onChange={(e: any) => props.onChange(e.target.value)}
        options={options}
        {...group.groupProps}
      />
      {group.note}
    </>
  );
}
