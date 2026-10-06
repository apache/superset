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
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Input } from '@superset-ui/core/components';
import { Radio, RadioChangeEvent } from '@superset-ui/core/components/Radio';
import { RootState } from 'src/dashboard/types';

// Minimum custom refresh interval in seconds
export const MINIMUM_REFRESH_INTERVAL = 1;

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

/**
 * Structured refresh frequency option representation.
 */
export interface RefreshFrequencyOption {
  value: number;
  label: string;
}

// Standard refresh frequency options used across modals
export const REFRESH_FREQUENCY_OPTIONS: RefreshFrequencyOption[] = [
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
  { value: -1, label: t('Custom') },
];

/**
 * Checks if a given frequency matches one of the preset options.
 *
 * @param frequency The refresh frequency in seconds to check.
 * @param options The list of available refresh frequency options to match against.
 * @returns True if frequency is found in preset options, false otherwise.
 */
export const isPresetValue = (
  frequency: number,
  options: RefreshFrequencyOption[] = REFRESH_FREQUENCY_OPTIONS,
) =>
  options.some((option) => option.value === frequency && option.value !== -1);

/**
 * Formats a custom frequency as a string value for the custom input.
 *
 * @param frequency The refresh frequency in seconds.
 * @param options The list of active preset options.
 * @returns The custom frequency formatted as string if not a preset, or empty string.
 */
export const getCustomValue = (
  frequency: number,
  options: RefreshFrequencyOption[] = REFRESH_FREQUENCY_OPTIONS,
) =>
  !isPresetValue(frequency, options) && frequency > 0
    ? frequency.toString()
    : '';

/**
 * Normalizes refresh limit value from milliseconds to seconds if needed.
 */
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

/**
 * Props for the RefreshFrequencySelect component.
 */
export interface RefreshFrequencySelectProps {
  /** The currently selected refresh frequency in seconds. */
  value: number;
  /** Callback fired when a new refresh frequency is selected or typed. */
  onChange: (value: number) => void;
  /** Optional override for available interval options as [seconds, label] tuples. */
  options?: [number, string][];
}

/**
 * Shared refresh frequency select component.
 *
 * Renders radio buttons for available auto refresh frequencies.
 * Reads configured intervals dynamically from Redux store
 * (state.dashboardInfo.common.conf.DASHBOARD_AUTO_REFRESH_INTERVALS)
 * with a fallback to REFRESH_FREQUENCY_OPTIONS if unconfigured.
 * Also supports direct options prop override and custom numeric interval entry.
 */
export const RefreshFrequencySelect = ({
  value,
  onChange,
  options: optionsProp,
}: RefreshFrequencySelectProps) => {
  const configuredIntervals = useSelector(
    (state: RootState) =>
      state.dashboardInfo?.common?.conf?.DASHBOARD_AUTO_REFRESH_INTERVALS,
  );

  const activeOptions = useMemo(() => {
    const rawOptions = optionsProp ?? configuredIntervals;
    if (Array.isArray(rawOptions) && rawOptions.length > 0) {
      const validOptions = rawOptions
        .filter(
          (item) =>
            Array.isArray(item) &&
            typeof item[0] === 'number' &&
            !Number.isNaN(item[0]) &&
            typeof item[1] === 'string',
        )
        .map(([interval, label]) => ({
          value: interval,
          label: t(label),
        }));
      if (validOptions.length > 0) {
        return validOptions;
      }
    }
    return REFRESH_FREQUENCY_OPTIONS.slice(0, -1);
  }, [optionsProp, configuredIntervals]);

  const isPreset = useCallback(
    (frequency: number) => isPresetValue(frequency, activeOptions),
    [activeOptions],
  );

  const getCustom = useCallback(
    (frequency: number) => getCustomValue(frequency, activeOptions),
    [activeOptions],
  );

  // Separate radio selection state from value state
  const [radioSelection, setRadioSelection] = useState(() =>
    isPreset(value) ? value : -1,
  );

  const [customValue, setCustomValue] = useState(() => getCustom(value));

  useEffect(() => {
    const selection = isPreset(value) ? value : -1;
    setRadioSelection(selection);
    setCustomValue(selection === -1 ? getCustom(value) : '');
  }, [value, isPreset, getCustom]);

  const handleRadioChange = (event: RadioChangeEvent) => {
    const selectedValue = Number(event.target.value);
    setRadioSelection(selectedValue);

    if (selectedValue === -1) {
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

  return (
    <StyledRadioGroup value={radioSelection} onChange={handleRadioChange}>
      {activeOptions.map((option) => (
        <Radio key={option.value} value={option.value}>
          {option.label}
        </Radio>
      ))}

      <Radio value={-1}>
        <CustomContent>
          {t('Custom')}
          <Input
            type="number"
            min={MINIMUM_REFRESH_INTERVAL}
            value={customValue}
            onChange={handleCustomInputChange}
            placeholder={`${MINIMUM_REFRESH_INTERVAL}+`}
            disabled={radioSelection !== -1}
            onClick={(e) => e.stopPropagation()}
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
