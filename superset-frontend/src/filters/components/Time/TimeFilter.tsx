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
import { SupersetClient, TimeRange } from '@superset-ui/core';
import React, { useState } from 'react';
import rison from 'rison';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl/DateFilterControl';
import { getRangeExtraFormData } from 'src/filters/utils';
import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import { PluginFilterTimeProps } from './types';

const getTimeRange = async (value: string): Promise<TimeRange> => {
  const query = rison.encode(value);
  const endpoint = `/api/v1/time_range/?q=${query}`;
  try {
    const response = await SupersetClient.get({ endpoint });
    const { since, until } = response?.json?.result || {};
    return {
      time_range: value,
      since,
      until,
    };
  } catch (response) {
    const clientError = await getClientErrorObject(response);
    throw clientError.message || clientError.error;
  }
};

export default function PluginFilterTime(props: PluginFilterTimeProps) {
  const { formData, setExtraFormData } = props;
  // const {
  //   defaultValue,
  //   enableEmptyFilter,
  //   currentValue,
  //   inverseSelection,
  //   inputRef,
  // } = {
  //   ...DEFAULT_FORM_DATA,
  //   ...formData,
  // };

  const [value, setValue] = useState<string>();

  let { groupby = [] } = formData;
  groupby = Array.isArray(groupby) ? groupby : [groupby];

  const handleChange = (value?: string) => {
    setValue(value);

    const [col] = groupby;

    if (value) {
      getTimeRange(value).then(timeRange => {
        const extraFormData = getRangeExtraFormData(
          col,
          timeRange.since,
          timeRange.until,
        );
        // @ts-ignore
        setExtraFormData({ extraFormData, currentState: { value: [value] } });
      });
    }
  };

  // useEffect(() => {
  //   if (currentValue?.length) {
  //     handleChange(currentValue[0].toString());
  //   } else {
  //     handleChange();
  //   }
  // }, [JSON.stringify(currentValue)]);

  // useEffect(() => {
  //   if (defaultValue?.length) {
  //     handleChange(defaultValue[0].toString());
  //   } else {
  //     handleChange();
  //   }
  // }, [JSON.stringify(defaultValue)]);

  return <DateFilterControl value={value} name="" onChange={handleChange} />;
}
