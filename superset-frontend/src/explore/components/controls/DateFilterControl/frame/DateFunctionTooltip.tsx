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
import { useTheme, t } from '@superset-ui/core';

import { Tooltip } from 'src/common/components/Tooltip';
import { ClassNames } from '@emotion/core';

const TIME_PICKER_HELPER = (
  <>
    <div>
      <h3>DATETIME</h3>
      <p>{t('Return to specific datetime.')}</p>
      <h4>{t('Syntax')}</h4>
      <pre>
        <code>datetime([string])</code>
      </pre>
      <h4>{t('Example')}</h4>
      <pre>
        <code>{`datetime("2020-03-01 12:00:00")
datetime("now")
datetime("last year")`}</code>
      </pre>
    </div>
    <div>
      <h3>DATEADD</h3>
      <p>{t('Moves the given set of dates by a specified interval.')}</p>
      <h4>{t('Syntax')}</h4>
      <pre>
        <code>{`dateadd([datetime], [integer], [dateunit])
dateunit = (year | quarter | month | week | day | hour | minute | second)`}</code>
      </pre>
      <h4>{t('Example')}</h4>
      <pre>
        <code>{`dateadd(datetime("today"), -13, day)
dateadd(datetime("2020-03-01"), 2, day)`}</code>
      </pre>
    </div>
    <div>
      <h3>DATETRUNC</h3>
      <p>
        {t(
          'Truncates the specified date to the accuracy specified by the date unit.',
        )}
      </p>
      <h4>{t('Syntax')}</h4>
      <pre>
        <code>{`datetrunc([datetime], [dateunit])
dateunit = (year | month | week)`}</code>
      </pre>
      <h4>{t('Example')}</h4>
      <pre>
        <code>{`datetrunc(datetime("2020-03-01"), week)
datetrunc(datetime("2020-03-01"), month)`}</code>
      </pre>
    </div>
    <div>
      <h3>LASTDAY</h3>
      <p>{t('Get the last date by the date unit.')}</p>
      <h4>{t('Syntax')}</h4>
      <pre>
        <code>{`lastday([datetime], [dateunit])
dateunit = (year | month | week)`}</code>
      </pre>
      <h4>{t('Example')}</h4>
      <pre>
        <code>lastday(datetime("today"), month)</code>
      </pre>
    </div>
    <div>
      <h3>HOLIDAY</h3>
      <p>{t('Get the specify date for the holiday')}</p>
      <h4>{t('Syntax')}</h4>
      <pre>
        <code>{`holiday([string])
holiday([holiday string], [datetime])
holiday([holiday string], [datetime], [country name])`}</code>
      </pre>
      <h4>{t('Example')}</h4>
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
              max-height: 410px;
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

export default function DateFunctionTooltip(props: any) {
  return <StyledTooltip title={TIME_PICKER_HELPER} {...props} />;
}
