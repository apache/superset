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
import { Radio, RadioChangeEvent } from '@superset-ui/core/components/Radio';
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import {
  COMMON_RANGE_OPTIONS,
  COMMON_RANGE_SET,
  DateFilterTestKey,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  CommonRangeType,
  FrameComponentProps,
} from 'src/explore/components/controls/DateFilterControl/types';

export function CommonFrame(props: FrameComponentProps) {
  
  const dashboardMetadata = useSelector(
    (state: RootState) => state.dashboardInfo?.metadata,
  );
  const dashboardCustomPresets = dashboardMetadata?.custom_time_presets || [];

  const customOptions = dashboardCustomPresets.map((preset: string) => ({
    value: preset,
    label: preset,
  }));

  const activeOptions = [...COMMON_RANGE_OPTIONS, ...customOptions];

  let commonRange = 'Last week';
  if (COMMON_RANGE_SET.has(props.value as CommonRangeType) || 
      dashboardCustomPresets.includes(props.value)
  ) {
    commonRange = props.value;
  } else {
    props.onChange(commonRange);
  }

  return (
    <>
      <div className="section-title" data-test={DateFilterTestKey.CommonFrame}>
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
        onChange={(e: RadioChangeEvent) => props.onChange(e.target.value)}
        options={activeOptions}
      />
    </>
  );
}
