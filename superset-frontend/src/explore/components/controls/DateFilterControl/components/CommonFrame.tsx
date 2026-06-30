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
import { useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { InputNumber, Select } from '@superset-ui/core/components';
import { Radio } from '@superset-ui/core/components/Radio';
import {
  COMMON_RANGE_OPTIONS,
  DateFilterTestKey,
} from 'src/explore/components/controls/DateFilterControl/utils';
import {
  FrameComponentProps,
} from 'src/explore/components/controls/DateFilterControl/types';

const PRESET_VALUES = new Set(COMMON_RANGE_OPTIONS.map(o => o.value as string));

/** Sentinel value used as the radio option value for the custom "Other" row. */
const CUSTOM_SENTINEL = '__custom__';

const UNIT_OPTIONS = [
  { value: 'second', label: t('Seconds') },
  { value: 'minute', label: t('Minutes') },
  { value: 'hour', label: t('Hours') },
  { value: 'day', label: t('Days') },
  { value: 'week', label: t('Weeks') },
  { value: 'month', label: t('Months') },
  { value: 'quarter', label: t('Quarters') },
  { value: 'year', label: t('Years') },
];

/**
 * Parse "Last N unit(s)" into { n, unit }, returns null for preset-style
 * strings without an explicit number (e.g. "Last day").
 */
function parseLastN(value: string): { n: number; unit: string } | null {
  const m = value.match(
    /^[Ll]ast\s+(\d+)\s+(second|minute|hour|day|week|month|quarter|year)s?$/i,
  );
  return m ? { n: Number(m[1]), unit: m[2].toLowerCase() } : null;
}

/** Build the canonical "Last N unit(s)" string from parts. */
function buildLastN(n: number, unit: string): string {
  return `Last ${n} ${unit}${n !== 1 ? 's' : ''}`;
}

export function CommonFrame(props: FrameComponentProps) {
  const isPreset = PRESET_VALUES.has(props.value);
  const parsedCustom = parseLastN(props.value);
  const isCustom = !isPreset && parsedCustom !== null;

  // Local state for the custom inputs — persists across preset ↔ Other switches.
  // Default to 4 hours so the initial "Other" emission ("Last 4 hours") never
  // accidentally matches a preset and causes the radio to snap back.
  const [customN, setCustomN] = useState<number>(parsedCustom?.n ?? 4);
  const [customUnit, setCustomUnit] = useState<string>(
    parsedCustom?.unit ?? 'hour',
  );

  // If the current value doesn't match any known pattern, reset to a default.
  // Use useEffect to avoid calling onChange synchronously during render.
  useEffect(() => {
    if (!isPreset && !isCustom) {
      props.onChange('Last week');
    }
  }, [props.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const radioValue = isCustom ? CUSTOM_SENTINEL : props.value;

  function handleRadioChange(e: any) {
    const val: string = e.target.value;
    if (val === CUSTOM_SENTINEL) {
      props.onChange(buildLastN(customN, customUnit));
    } else {
      props.onChange(val);
    }
  }

  const customLabel = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {t('Other')}
      <InputNumber
        min={1}
        max={10000}
        size="small"
        value={customN}
        disabled={!isCustom}
        style={{ width: 72 }}
        onChange={(n: number | null) => {
          const newN = n ?? 1;
          setCustomN(newN);
          props.onChange(buildLastN(newN, customUnit));
        }}
      />
      {/* Wrapper div absorbs clicks only when the Select is active so they
          don't bubble past the radio label and cause unwanted side-effects. */}
      <div
        style={{ width: 120, display: 'inline-block' }}
        onClick={
          isCustom ? (e: React.MouseEvent) => e.stopPropagation() : undefined
        }
        role="presentation"
      >
        <Select
          value={customUnit}
          options={UNIT_OPTIONS}
          disabled={!isCustom}
          onChange={(u: unknown) => {
            const newUnit = u as string;
            setCustomUnit(newUnit);
            props.onChange(buildLastN(customN, newUnit));
          }}
        />
      </div>
    </span>
  );

  const options = [
    ...COMMON_RANGE_OPTIONS,
    { value: CUSTOM_SENTINEL, label: customLabel },
  ];

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
        value={radioValue}
        onChange={handleRadioChange}
        options={options}
      />
    </>
  );
}
