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
import { App as EventFlowApp } from '@data-ui/event-flow';
import { t, TimeseriesDataRecord } from '@superset-ui/core';

export interface EventFlowProps {
  data: TimeseriesDataRecord[];
  height: number;
  width: number;
  initialMinEventCount: number;
}

export default function EventFlow({
  data,
  initialMinEventCount,
  height = 400,
  width = 400,
}: EventFlowProps) {
  if (data) {
    return (
      <EventFlowApp
        width={width}
        height={height}
        data={data}
        initialMinEventCount={initialMinEventCount}
        initialShowControls={false}
      />
    );
  }

  return (
    <div style={{ height, width }}>
      <div>{t('Sorry, there appears to be no data')}</div>
    </div>
  );
}
