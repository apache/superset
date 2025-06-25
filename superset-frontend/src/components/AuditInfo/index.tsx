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
import Owner from 'src/types/Owner';
import { Tooltip } from 'src/components/Tooltip';
import getOwnerName from 'src/utils/getOwnerName';
import { t } from '@superset-ui/core';

export type ModifiedInfoProps = {
  user?: Owner;
  date: string;
};

export const ModifiedInfo = ({ user, date }: ModifiedInfoProps) => {
  const dateSpan = (
    <span className="no-wrap" data-test="audit-info-date">
      {date}
    </span>
  );

  if (user) {
    const userName = getOwnerName(user);
    const title = t('Modified by: %s', userName);
    return (
      <Tooltip title={title} placement="bottom">
        {dateSpan}
      </Tooltip>
    );
  }
  return dateSpan;
};
