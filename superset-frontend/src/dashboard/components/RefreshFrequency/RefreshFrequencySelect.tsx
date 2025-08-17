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
import { useState } from 'react';
import { t, styled } from '@superset-ui/core';
import { Radio, Input } from '@superset-ui/core/components';

// Minimum safe refresh interval to prevent server overload
export const MINIMUM_REFRESH_INTERVAL = 10;

const StyledRadioGroup = styled(Radio.Group)`
  padding-left: ${({ theme }) => theme.sizeUnit * 2}px;

  .ant-radio-wrapper {
    display: flex;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.sizeUnit * 0.5}px;

    &:last-child {
      margin-bottom: 0;
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

// Standard refresh frequency options used across modals
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
  { value: -1, label: t('Custom') },
];

interface RefreshFrequencySelectProps {
  value: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
}

/**
 * Shared refresh frequency select component
 * Used in both PropertiesModal and RefreshIntervalModal
 */
export const RefreshFrequencySelect = ({
  value,
  onChange,
  ariaLabel = t('Refresh frequency'),
}: RefreshFrequencySelectProps) => {
  // Separate radio selection state from value state
  const [radioSelection, setRadioSelection] = useState(() =>
    REFRESH_FREQUENCY_OPTIONS.find(opt => opt.value === value) ? value : -1,
  );

  const [customValue, setCustomValue] = useState(() =>
    REFRESH_FREQUENCY_OPTIONS.find(opt => opt.value === value)
      ? ''
      : value.toString(),
  );

  const handleRadioChange = (e: any) => {
    const selectedValue = parseInt(e.target.value, 10);
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

  const handleCustomInputChange = (e: any) => {
    const inputValue = e.target.value;
    setCustomValue(inputValue);

    const numValue = parseInt(inputValue, 10);
    if (numValue >= MINIMUM_REFRESH_INTERVAL) {
      onChange(numValue);
    }
  };

  return (
    <StyledRadioGroup value={radioSelection} onChange={handleRadioChange}>
      {REFRESH_FREQUENCY_OPTIONS.slice(0, -1).map(option => (
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
  if (refreshLimit && frequency > 0 && frequency < refreshLimit) {
    errors.push(
      t('Refresh frequency must be at least %s seconds', refreshLimit / 1000),
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
  if (
    frequency > 0 &&
    refreshLimit &&
    frequency < refreshLimit &&
    refreshWarning
  ) {
    return refreshWarning;
  }
  return null;
};
