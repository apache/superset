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
const stopPeriodicRender = (refreshTimer?: number) => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
};

interface SetPeriodicRunnerProps {
  interval?: number;
  periodicRender: TimerHandler;
  refreshTimer?: number;
}

export default function setPeriodicRunner({
  interval = 0,
  periodicRender,
  refreshTimer,
}: SetPeriodicRunnerProps) {
  stopPeriodicRender(refreshTimer);

  if (interval > 0) {
    return setInterval(periodicRender, interval);
  }
  return 0;
}
