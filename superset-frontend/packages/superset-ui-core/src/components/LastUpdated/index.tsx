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
import { useEffect, useState, FunctionComponent } from 'react';

import { t, styled, css, useTheme } from '@superset-ui/core';
import dayjs from 'dayjs';
import { extendedDayjs } from '../../utils/dates';
import { Icons } from '../Icons';
import type { LastUpdatedProps } from './types';

const REFRESH_INTERVAL = 60000; // every minute

extendedDayjs.updateLocale('en', {
  calendar: {
    lastDay: '[Yesterday at] LTS',
    sameDay: '[Today at] LTS',
    nextDay: '[Tomorrow at] LTS',
    lastWeek: '[last] dddd [at] LTS',
    nextWeek: 'dddd [at] LTS',
    sameElse: 'L',
  },
});

const TextStyles = styled.span`
  color: ${({ theme }) => theme.colorText};
`;

export const LastUpdated: FunctionComponent<LastUpdatedProps> = ({
  updatedAt,
  update,
}) => {
  const theme = useTheme();
  const [timeSince, setTimeSince] = useState<dayjs.Dayjs>(
    extendedDayjs(updatedAt),
  );

  useEffect(() => {
    setTimeSince(() => extendedDayjs(updatedAt));

    // update UI every minute in case day changes
    const interval = setInterval(() => {
      setTimeSince(() => extendedDayjs(updatedAt));
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [updatedAt]);

  return (
    <TextStyles>
      {t('Last Updated %s', timeSince.isValid() ? timeSince.calendar() : '--')}
      {update && (
        <Icons.SyncOutlined
          css={css`
            margin-left: ${theme.sizeUnit * 2}px;
          `}
          onClick={update}
        />
      )}
    </TextStyles>
  );
};

export type { LastUpdatedProps };
