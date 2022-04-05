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
import qs from 'querystringify';
import {
  WORLD_HEALTH_DASHBOARD,
  WORLD_HEALTH_CHARTS,
  waitForChartLoad,
} from './dashboard.helper';

interface QueryString {
  native_filters_key: string;
}

xdescribe('nativefiler url param key', () => {
  // const urlParams = { param1: '123', param2: 'abc' };
  before(() => {
    cy.login();
  });

  let initialFilterKey: string;
  it('should have cachekey in nativefilter param', () => {
    // things in `before` will not retry and the `waitForChartLoad` check is
    // especically flaky and may need more retries
    cy.visit(WORLD_HEALTH_DASHBOARD);
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    cy.wait(1000); // wait for key to be published (debounced)
    cy.location().then(loc => {
      const queryParams = qs.parse(loc.search) as QueryString;
      expect(typeof queryParams.native_filters_key).eq('string');
    });
  });

  it('should have different key when page reloads', () => {
    cy.visit(WORLD_HEALTH_DASHBOARD);
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
    cy.wait(1000); // wait for key to be published (debounced)
    cy.location().then(loc => {
      const queryParams = qs.parse(loc.search) as QueryString;
      expect(queryParams.native_filters_key).not.equal(initialFilterKey);
    });
  });
});
