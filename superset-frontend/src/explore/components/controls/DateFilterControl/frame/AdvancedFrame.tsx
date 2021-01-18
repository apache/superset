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
import { t, useTheme } from '@superset-ui/core';
import { SEPARATOR } from 'src/explore/dateFilterUtils';
import { Input } from 'src/common/components';
import Icon from 'src/components/Icon';
import { Tooltip } from 'src/common/components/Tooltip';
import { ClassNames } from '@emotion/core';
import { FrameComponentProps } from '../types';

const TIME_PICKER_HELPER = (
  <>
    <div>
      <h3>1. datetime</h3>
      <p>Return to specific datetime</p>
      <h4>Syntax</h4>
      <pre>
        <code>datetime([string])</code>
      </pre>
      <h4>Example</h4>
      <pre>
        <code>{`datetime("2020-03-01 12:00:00")
datetime("now")
datetime("last year")`}</code>
      </pre>
    </div>
    <div>
      <h3>2. dateadd</h3>
      <p>Moves the given set of dates by a specified interval.</p>
      <h4>Syntax</h4>
      <pre>
        <code>{`dateadd([datetime], [integer], [dateunit])
dateunit = (year | quarter | month | week | day | hour | minute | second)`}</code>
      </pre>
      <h4>Example</h4>
      <pre>
        <code>{`dateadd(datetime("today"), -13, day)
dateadd(datetime("2020-03-01"), 2, day)`}</code>
      </pre>
    </div>
    <div>
      <h3>3. datetrunc</h3>
      <p>
        Truncates the specified date to the accuracy specified by the date unit.
      </p>
      <h4>Syntax</h4>
      <pre>
        <code>{`datetrunc([datetime], [dateunit])
dateunit = (year | month | week)`}</code>
      </pre>
      <h4>Example</h4>
      <pre>
        <code>{`datetrunc(datetime("2020-03-01"), week)
datetrunc(datetime("2020-03-01"), month)`}</code>
      </pre>
    </div>
    <div>
      <h3>4. lastday</h3>
      <p>Get the last date by the date unit</p>
      <h4>Syntax</h4>
      <pre>
        <code>{`lastday([datetime], [dateunit])
dateunit = (year | month | week)`}</code>
      </pre>
      <h4>Example</h4>
      <pre>
        <code>lastday(datetime("today"), month)</code>
      </pre>
    </div>
    <div>
      <h3>5. holiday</h3>
      <p>Get the specify date for the holiday</p>
      <h4>Syntax</h4>
      <pre>
        <code>{`holiday([string])
holiday([holiday string], [datetime])
holiday([holiday string], [datetime], [country name])`}</code>
      </pre>
      <h4>Example</h4>
      <pre>
        <code>{`holiday("new year")
holiday("christmas", datetime("2019"))
holiday("christmas", dateadd(datetime("2019"), 1, year))
holiday("christmas", datetime("2 years ago"))
holiday("Easter Monday", datetime("2019"), "UK")`}</code>
      </pre>
    </div>
  </>
);

const StyledTooltip = (props: any) => {
  const theme = useTheme();
  return (
    <ClassNames>
      {({ css }) => (
        <Tooltip
          overlayClassName={css`
            .ant-tooltip-content {
              min-width: ${theme.gridUnit * 125}px;
              max-height: 600px;
              overflow-y: scroll;

              .ant-tooltip-inner {
                max-width: ${theme.gridUnit * 125}px;
                h3 {
                  font-size: ${theme.typography.sizes.m}px;
                  font-weight: ${theme.typography.weights.bold};
                }
                h4 {
                  font-size: ${theme.typography.sizes.m}px;
                  font-weight: ${theme.typography.weights.bold};
                }
                pre {
                  border: none;
                  text-align: left;
                  word-break: break-word;
                  font-size: ${theme.typography.sizes.s}px;
                }
              }
            }
          `}
          {...props}
        />
      )}
    </ClassNames>
  );
};

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
        <StyledTooltip title={TIME_PICKER_HELPER} placement="right">
          <Icon name="info" width={20} height={20} />
        </StyledTooltip>
      </div>
      <div className="section-title">{t('Configure advanced time range')}</div>
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
