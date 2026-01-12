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
import { Dispatch } from 'redux';
import { updateChartFormDataAction } from 'src/components/Chart/chartAction';

let channel: BroadcastChannel | null = null;

export function initChartUpdateChannel(dispatch: Dispatch) {
  if (typeof BroadcastChannel === 'undefined') {
    // BroadcastChannel not supported in this browser
    return null;
  }

  if (channel) {
    // Already initialized
    return channel;
  }

  channel = new BroadcastChannel('superset_chart_updates');

  channel.onmessage = event => {
    if (event.data.type === 'CHART_SAVED') {
      const { sliceId, formData } = event.data;
      dispatch(updateChartFormDataAction(formData, sliceId));
    }
  };

  return channel;
}

export function closeChartUpdateChannel() {
  if (channel) {
    channel.close();
    channel = null;
  }
}
