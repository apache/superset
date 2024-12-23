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
import {
  useEffect,
  useState,
  FunctionComponent,
  MouseEventHandler,
} from 'react';

import { extendedDayjs } from 'src/utils/dates';
import { t, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import dayjs from 'dayjs';

const REFRESH_INTERVAL = 60000; // every minute

interface LastUpdatedProps {
  updatedAt: string | number | Date | undefined;
  update?: MouseEventHandler<HTMLSpanElement>;
}
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
  color: ${({ theme }) => theme.colors.grayscale.base};
`;

const Refresh = styled(Icons.Refresh)`
  color: ${({ theme }) => theme.colors.primary.base};
  width: auto;
  height: ${({ theme }) => theme.gridUnit * 5}px;
  position: relative;
  top: ${({ theme }) => theme.gridUnit}px;
  left: ${({ theme }) => theme.gridUnit}px;
  cursor: pointer;
`;

export const LastUpdated: FunctionComponent<LastUpdatedProps> = ({
  updatedAt,
  update,
}) => {
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
      {update && <Refresh onClick={update} />}
    </TextStyles>
  );
};

export default LastUpdated;
