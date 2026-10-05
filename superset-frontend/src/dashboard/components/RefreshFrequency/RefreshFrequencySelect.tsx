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
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Input } from '@superset-ui/core/components';
import { Radio, RadioChangeEvent } from '@superset-ui/core/components/Radio';
import { RootState } from 'src/dashboard/types';

// Minimum custom refresh interval in seconds
export const MINIMUM_REFRESH_INTERVAL = 1;

// Radio value that selects the free-form interval input rather than a preset
export const CUSTOM_REFRESH_FREQUENCY = -1;

export type RefreshFrequencyOption = { value: number; label: string };

const StyledRadioGroup = styled(Radio.Group)`
  padding-left: ${({ theme }) => theme.sizeUnit * 2}px;

  .ant-radio-wrapper {
    display: flex;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.sizeUnit * 0.5}px;

    &:last-child {
      margin-bottom: ${({ theme }) => theme.sizeUnit}px;
    }
  }
`;

const CustomContent = styled.div`
  display: flex;
  align-items: center;

  .ant-input {
    width: 80px;
    margin-left: ${({ theme }) => theme.sizeUnit}px;
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

// Standard refresh frequency options used when the deployment ships no
// DASHBOARD_AUTO_REFRESH_INTERVALS value (embedded or partially bootstrapped
// payloads). The `Custom` entry is a UI affordance, not an interval, so it is
// kept out of the configured list.
export const REFRESH_FREQUENCY_OPTIONS = [
  { value: 0, label: t("Don't refresh") },
  { value: 10, label: t('10 seconds') },
  { value: 30, label: t('30 seconds') },
  { value: 60, label: t('1 minute') },
  { value: 300, label: t('5 minutes') },
  { value: 1800, label: t('30 minutes') },
  { value: 3600, label: t('1 hour') },
  { value: 21600, label: t('6 hours') },
  { value: 43200, label: t('12 hours') },
  { value: 86400, label: t('24 hours') },
  { value: CUSTOM_REFRESH_FREQUENCY, label: t('Custom') },
];

const isPresetValue = (frequency: number, options: RefreshFrequencyOption[]) =>
  options.some(
    option =>
      option.value === frequency && option.value !== CUSTOM_REFRESH_FREQUENCY,
  );

// `Number(null)`, `Number('')` and `Number([])` all yield 0, and 0 is a real
// interval, so a bare Number() would smuggle malformed entries in as valid.
const toIntervalSeconds = (value: unknown): number => {
  const isNumeric = typeof value === 'number' || typeof value === 'string';
  return isNumeric && String(value).trim() !== '' ? Number(value) : Number.NaN;
};

/**
 * Builds the interval list from DASHBOARD_AUTO_REFRESH_INTERVALS, which reaches
 * the browser as a list of `[seconds, label]` pairs. Labels stay verbatim: the
 * deployment authored them, so translating them here would rewrite operator
 * wording. Anything that is not a well-formed non-empty list falls back to the
 * built-in options rather than rendering an empty selector.
 */
export const getRefreshFrequencyOptions = (
  configuredIntervals?: unknown,
): RefreshFrequencyOption[] => {
  const options: RefreshFrequencyOption[] = [];
  const seen = new Set<number>();

  (Array.isArray(configuredIntervals) ? configuredIntervals : []).forEach(
    pair => {
      if (!Array.isArray(pair)) {
        return;
      }
      const [value, label] = pair;
      const seconds = toIntervalSeconds(value);
      const isLabelled = typeof label === 'string' && label.trim() !== '';
      if (!Number.isFinite(seconds) || seconds < 0 || !isLabelled) {
        return;
      }
      // Deployment overrides are unvalidated; a repeated interval would render
      // duplicate React keys and two simultaneously-checked radios.
      if (seen.has(seconds)) {
        return;
      }
      seen.add(seconds);
      options.push({ value: seconds, label });
    },
  );

  const baseOptions = options.length ? options : REFRESH_FREQUENCY_OPTIONS;
  const hasCustom = baseOptions.some(
    option => option.value === CUSTOM_REFRESH_FREQUENCY,
  );

  return hasCustom
    ? baseOptions
    : [...baseOptions, { value: CUSTOM_REFRESH_FREQUENCY, label: t('Custom') }];
};

const getCustomValue = (
  frequency: number,
  options: RefreshFrequencyOption[],
) =>
  !isPresetValue(frequency, options) && frequency > 0
    ? frequency.toString()
    : '';

const normalizeRefreshLimitSeconds = (
  refreshLimit?: number,
): number | undefined => {
  if (!refreshLimit || refreshLimit <= 0) {
    return undefined;
  }

  if (refreshLimit >= 1000 && refreshLimit % 1000 === 0) {
    return refreshLimit / 1000;
  }

  return refreshLimit;
};

interface RefreshFrequencySelectProps {
  value: number;
  onChange: (value: number) => void;
}

/**
 * Shared refresh frequency select component
 * Used in both PropertiesModal and RefreshIntervalModal
 */
export const RefreshFrequencySelect = ({
  value,
  onChange,
}: RefreshFrequencySelectProps) => {
  const configuredIntervals = useSelector(
    (state: RootState) =>
      state.dashboardInfo?.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS,
  );
  const options = useMemo(
    () => getRefreshFrequencyOptions(configuredIntervals),
    [configuredIntervals],
  );
  const presets = options.filter(
    option => option.value !== CUSTOM_REFRESH_FREQUENCY,
  );

  // Separate radio selection state from value state
  const [radioSelection, setRadioSelection] = useState(() =>
    isPresetValue(value, options) ? value : CUSTOM_REFRESH_FREQUENCY,
  );

  const [customValue, setCustomValue] = useState(() =>
    getCustomValue(value, options),
  );

  useEffect(() => {
    const selection = isPresetValue(value, options)
      ? value
      : CUSTOM_REFRESH_FREQUENCY;
    setRadioSelection(selection);
    setCustomValue(
      selection === CUSTOM_REFRESH_FREQUENCY
        ? getCustomValue(value, options)
        : '',
    );
  }, [value, options]);

  const handleRadioChange = (event: RadioChangeEvent) => {
    const selectedValue = Number(event.target.value);
    setRadioSelection(selectedValue);

    if (selectedValue === CUSTOM_REFRESH_FREQUENCY) {
      // Custom selected - use current custom value or minimum
      const numValue = parseInt(customValue, 10) || MINIMUM_REFRESH_INTERVAL;
      onChange(numValue);
      if (!customValue) {
        setCustomValue(MINIMUM_REFRESH_INTERVAL.toString());
      }
    } else {
      onChange(selectedValue);
    }
  };

  const handleCustomInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setCustomValue(inputValue);

    const numValue = parseInt(inputValue, 10);
    if (numValue >= MINIMUM_REFRESH_INTERVAL) {
      onChange(numValue);
    }
  };

  const isCustomSelected = radioSelection === CUSTOM_REFRESH_FREQUENCY;

  return (
    <StyledRadioGroup value={radioSelection} onChange={handleRadioChange}>
      {presets.map(option => (
        <Radio key={option.value} value={option.value}>
          {option.label}
        </Radio>
      ))}

      <Radio value={CUSTOM_REFRESH_FREQUENCY}>
        <CustomContent>
          {t('Custom')}
          <Input
            type="number"
            min={MINIMUM_REFRESH_INTERVAL}
            value={customValue}
            onChange={handleCustomInputChange}
            placeholder={`${MINIMUM_REFRESH_INTERVAL}+`}
            disabled={!isCustomSelected}
            onClick={e => e.stopPropagation()}
          />
          <span>{t('seconds')}</span>
        </CustomContent>
      </Radio>
    </StyledRadioGroup>
  );
};

/**
 * Validates refresh frequency against minimum limit
 */
export const validateRefreshFrequency = (
  frequency: number,
  refreshLimit?: number,
): string[] => {
  const errors = [];
  const normalizedLimit = normalizeRefreshLimitSeconds(refreshLimit);
  if (normalizedLimit && frequency > 0 && frequency < normalizedLimit) {
    errors.push(
      t('Refresh frequency must be at least %s seconds', normalizedLimit),
    );
  }
  return errors;
};

/**
 * Generates warning message for low refresh frequencies
 */
export const getRefreshWarningMessage = (
  frequency: number,
  refreshLimit?: number,
  refreshWarning?: string,
): string | null => {
  const normalizedLimit = normalizeRefreshLimitSeconds(refreshLimit);
  if (
    frequency > 0 &&
    normalizedLimit &&
    frequency < normalizedLimit &&
    refreshWarning
  ) {
    return refreshWarning;
  }
  return null;
};
