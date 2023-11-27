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
import React, { useState, useCallback, useRef, FocusEvent } from 'react';
import { t, useTheme } from '@superset-ui/core';

import { AntdInput, RadioChangeEvent } from 'src/components';
import { Input } from 'src/components/Input';
import { Radio } from 'src/components/Radio';
import { CronPicker, CronError } from 'src/components/CronPicker';
import { StyledInputContainer } from '../AlertReportModal';

export interface AlertReportCronSchedulerProps {
  value: string;
  onChange: (change: string) => any;
}

export const AlertReportCronScheduler: React.FC<AlertReportCronSchedulerProps> =
  ({ value, onChange }) => {
    const theme = useTheme();
    const inputRef = useRef<AntdInput>(null);
    const [scheduleFormat, setScheduleFormat] = useState<'picker' | 'input'>(
      'picker',
    );

    const handleRadioButtonChange = useCallback(
      (e: RadioChangeEvent) => setScheduleFormat(e.target.value),
      [],
    );

    const customSetValue = useCallback(
      (newValue: string) => {
        onChange(newValue);
        inputRef.current?.setValue(newValue);
      },
      [inputRef, onChange],
    );

    const handleBlur = useCallback(
      (event: FocusEvent<HTMLInputElement>) => {
        onChange(event.target.value);
      },
      [onChange],
    );

    const handlePressEnter = useCallback(() => {
      onChange(inputRef.current?.input.value || '');
    }, [onChange]);

    const [error, onError] = useState<CronError>();

    return (
      <>
        <Radio.Group onChange={handleRadioButtonChange} value={scheduleFormat}>
          <div className="inline-container add-margin">
            <Radio data-test="picker" value="picker" />
            <CronPicker
              clearButton={false}
              value={value}
              setValue={customSetValue}
              disabled={scheduleFormat !== 'picker'}
              displayError={scheduleFormat === 'picker'}
              onError={onError}
            />
          </div>
          <div className="inline-container add-margin">
            <Radio data-test="input" value="input" />
            <span className="input-label">{t('CRON Schedule')}</span>
            <StyledInputContainer
              data-test="input-content"
              className="styled-input"
            >
              <div className="input-container">
                <Input
                  type="text"
                  name="crontab"
                  ref={inputRef}
                  style={error ? { borderColor: theme.colors.error.base } : {}}
                  placeholder={t('CRON expression')}
                  disabled={scheduleFormat !== 'input'}
                  onBlur={handleBlur}
                  onPressEnter={handlePressEnter}
                />
              </div>
            </StyledInputContainer>
          </div>
        </Radio.Group>
      </>
    );
  };
