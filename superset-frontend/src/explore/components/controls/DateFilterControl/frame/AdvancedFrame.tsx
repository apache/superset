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
import {t, useTheme} from '@superset-ui/core';
import { SEPARATOR } from 'src/explore/dateFilterUtils';
import { Input } from 'src/common/components';
import Icon from 'src/components/Icon';
import { Tooltip } from 'src/common/components/Tooltip';
import { FrameComponentProps } from '../types';
import {ClassNames} from "@emotion/core";

const TIME_PICKER_HELPER = <>
  <div>
    <h3>1. Datetime</h3>
    <p>Return to specific datetime</p>
    <h4>Syntax</h4>
    <pre>
      <code>{`
        Datetime([string])
      `}</code>
    </pre>
    <h4>Example</h4>
    <pre>
      <code>{`
        DATETIME("2020-03-01 12:00:00")
        DATETIME("now")
        DATETIME("last year")
      `}</code>
    </pre>
  </div>
  <div>
    <h3>2. Dateadd</h3>
    <p>Moves the given set of dates by a specified interval.</p>
    <h4>Syntax</h4>
    <pre>
      <code>{`
          Dateadd([datetime], [integer], [dateunit])
          dateunit = (YEAR | QUARTER | MONTH | WEEK | DAY | HOUR | MINUTE | SECOND)
      `}</code>
    </pre>
    <h4>Example</h4>
    <pre>
      <code>{`
        DATEADD(DATETIME("TODAY"), -13, DAY)
        DATEADD(DATETIME("2020-03-01"), 2, DAY)
      `}</code>
    </pre>
  </div>
  <div>
    <h3>3. Datetrunc</h3>
    <p>Truncates the specified date to the accuracy specified by the date unit.</p>
    <h4>Syntax</h4>
    <pre>
      <code>{`
          Datetrunc([datetime], [dateunit])
      `}</code>
    </pre>
    <h4>Example</h4>
    <pre>
      <code>{`
          Datetrunc(DATETIME("2020-03-01"), week)
          Datetrunc(DATETIME("2020-03-01"), month)
      `}</code>
    </pre>
  </div>
  <div>
    <h3>4. Lastday</h3>
    <p>Get the last date by the date unit</p>
    <h4>Syntax</h4>
    <pre>
      <code>{`
          Lastday([datetime], [dateunit])
          dateunit = (YEAR | MONTH | WEEK)
      `}</code>
    </pre>
    <h4>Example</h4>
    <pre>
      <code>{`
        lastday(DATETIME("today"), month)
      `}</code>
    </pre>
  </div>
  <div>
    <h3>5. Holiday</h3>
    <p>Get the last date by the date unit</p>
    <h4>Syntax</h4>
    <pre>
      <code>{`
          Holiday([string])
          Python-holidays library（https://github.com/dr-prodigy/python-holidays）
      `}</code>
    </pre>
    <h4>Example</h4>
    <pre>
      <code>{`
        HOLIDAY("new year")
        HOLIDAY("christmas", datetime("2019"))
        HOLIDAY("christmas", dateadd(datetime("2019"), 1, year))
        HOLIDAY("christmas", datetime("2 years ago"))
        HOLIDAY("Easter Monday", datetime("2019"), "UK")
      `}</code>
    </pre>
  </div>
</>

const StyledTooltip = (props: any) => {
  const theme = useTheme();
  return (
    <ClassNames>
      {({ css }) => (
        <Tooltip
          overlayClassName={css`
            .ant-tooltip-content{
              min-width: 600px;

              .ant-tooltip-inner {
                max-width: ${theme.gridUnit * 125}px;
                overflow: auto;
                pre {
                  // background: transparent;
                  border: none;
                  text-align: left;
                  font-size: ${theme.typography.sizes.xs}px;
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
        {t('Configure Advanced Time Range')}
        <StyledTooltip title={TIME_PICKER_HELPER} placement="right" trigger="click">
          <Icon name="info" />
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
