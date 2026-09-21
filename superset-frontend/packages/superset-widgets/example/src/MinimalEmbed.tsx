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
import { Chart, SupersetProvider } from '@apache-superset/widgets';

// No backend: requests carry your Superset login session.
export default function BirthsByState() {
  return (
    <SupersetProvider supersetDomain="http://localhost:8088">
      <Chart
        chartType="bar"
        dataBinding={{
          datasetId: 17,
          metrics: ['sum__num'],
          dimensions: ['state'],
          rowLimit: 10,
        }}
        echartsOptions={{
          xAxis: {
            type: 'category',
            data: { $bind: { source: 'dimension', alias: 'state' } },
          },
          yAxis: { type: 'value' },
        }}
        chrome={{ titleText: 'Births by state' }}
      />
    </SupersetProvider>
  );
}
