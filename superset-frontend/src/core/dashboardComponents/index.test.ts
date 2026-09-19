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
import { dashboardComponents } from './index';

const Noop = () => null;
const def = (id: string) => ({ id, name: id });

test('registerDashboardComponent makes a component retrievable', () => {
  const disposable = dashboardComponents.registerDashboardComponent(
    def('acme.widget'),
    Noop,
  );
  expect(dashboardComponents.getDashboardComponent('acme.widget')).toEqual({
    definition: def('acme.widget'),
    Component: Noop,
  });
  expect(
    dashboardComponents
      .getDashboardComponents()
      .some(r => r.definition.id === 'acme.widget'),
  ).toBe(true);
  disposable.dispose();
});

test('disposing the registration unregisters the component', () => {
  const disposable = dashboardComponents.registerDashboardComponent(
    def('acme.temp'),
    Noop,
  );
  expect(dashboardComponents.getDashboardComponent('acme.temp')).toBeDefined();
  disposable.dispose();
  expect(
    dashboardComponents.getDashboardComponent('acme.temp'),
  ).toBeUndefined();
});

test('registering the same id twice replaces the first', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const A = () => null;
  const B = () => null;
  dashboardComponents.registerDashboardComponent(def('acme.dup'), A);
  const second = dashboardComponents.registerDashboardComponent(
    def('acme.dup'),
    B,
  );
  expect(dashboardComponents.getDashboardComponent('acme.dup')?.Component).toBe(
    B,
  );
  jest.restoreAllMocks();
  second.dispose();
});

test('disposing a stale registration does not remove the active one', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const A = () => null;
  const B = () => null;
  const first = dashboardComponents.registerDashboardComponent(
    def('acme.stale'),
    A,
  );
  const second = dashboardComponents.registerDashboardComponent(
    def('acme.stale'),
    B,
  );
  // Disposing the superseded registration is a no-op.
  first.dispose();
  expect(
    dashboardComponents.getDashboardComponent('acme.stale')?.Component,
  ).toBe(B);
  jest.restoreAllMocks();
  second.dispose();
});
