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
import config from './controlPanel';

type ControlConfig = {
  label?: unknown;
  description?: unknown;
};

type ControlItem = {
  config: ControlConfig;
} | null;

function collectFunctionProps(cfg: typeof config) {
  const fns: Array<() => unknown> = [];
  cfg.controlPanelSections.forEach(section => {
    section?.controlSetRows.forEach(row => {
      (row as ControlItem[]).forEach(item => {
        if (item && typeof item === 'object' && 'config' in item) {
          const { label, description } = item.config;
          if (typeof label === 'function') fns.push(label as () => unknown);
          if (typeof description === 'function')
            fns.push(description as () => unknown);
        }
      });
    });
  });
  return fns;
}

test('TimeGrain controlPanel label and description functions return strings', () => {
  const fns = collectFunctionProps(config);
  expect(fns.length).toBeGreaterThan(0);
  fns.forEach(fn => {
    expect(typeof fn()).toBe('string');
  });
});
