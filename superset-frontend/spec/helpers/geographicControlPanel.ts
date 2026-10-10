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
  DatasourceType,
  QueryFormData,
  getChartControlPanelRegistry,
} from '@superset-ui/core';
import {
  ControlPanelConfig,
  ControlStateMapping,
} from '@superset-ui/chart-controls';
import {
  getAllControlsState,
  getFormDataFromControls,
} from 'src/explore/controlUtils';

/** Registers the Explore save round-trip tests for geographic time provenance. */
export function testGeographicTimeProvenance(
  controlPanel: ControlPanelConfig,
): void {
  test.each(['event_time', null])(
    'Explore saves preserve dashboard-time provenance %s',
    subject => {
      const vizType = 'test-geographic-time-binding';
      const registry = getChartControlPanelRegistry();
      registry.registerValue(vizType, controlPanel);
      try {
        const input: QueryFormData = {
          viz_type: vizType,
          datasource: '3__table',
          mcp_geographic: true,
          _mcp_dashboard_time_filter_subject: subject,
          adhoc_filters: subject
            ? [
                {
                  subject,
                  operator: 'TEMPORAL_RANGE',
                  comparator: 'No filter',
                  clause: 'WHERE',
                  expressionType: 'SIMPLE',
                },
              ]
            : [],
        };
        const controls = getAllControlsState(
          vizType,
          DatasourceType.Table,
          null,
          input,
        );
        const saved = getFormDataFromControls(controls as ControlStateMapping);
        expect(saved._mcp_dashboard_time_filter_subject).toBe(subject);
        expect(saved.adhoc_filters).toEqual(input.adhoc_filters);
      } finally {
        registry.remove(vizType);
      }
    },
  );
}
