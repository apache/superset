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
import { createElement } from 'react';
import type { dashboards as dashboardsApi } from '@apache-superset/core';
import { dashboards } from './index';
import DashboardRendererProviders from './DashboardRendererProviders';

const component: dashboardsApi.DashboardRendererComponent = () =>
  createElement('div', null, 'Custom renderer');

beforeEach(() => {
  DashboardRendererProviders.getInstance().reset();
});

test('getDashboardRenderer returns the built-in default when nothing is registered', () => {
  expect(dashboards.getDashboardRenderer()?.renderer.id).toBe(
    'superset.dashboard-renderer',
  );
});

test('getDefaultDashboardRenderer always returns the built-in provider', () => {
  expect(dashboards.getDefaultDashboardRenderer()?.renderer.id).toBe(
    'superset.dashboard-renderer',
  );

  // Registering an override does not change the default
  const disposable = dashboards.registerDashboardRenderer(
    { id: 'acme.renderer', name: 'Acme Renderer' },
    component,
  );
  expect(dashboards.getDefaultDashboardRenderer()?.renderer.id).toBe(
    'superset.dashboard-renderer',
  );
  disposable.dispose();
});

test('registerDashboardRenderer makes the provider retrievable', () => {
  const descriptor = { id: 'acme.renderer', name: 'Acme Renderer' };
  dashboards.registerDashboardRenderer(descriptor, component);

  const provider = dashboards.getDashboardRenderer();
  expect(provider?.renderer).toEqual(descriptor);
  expect(provider?.component).toBe(component);
});

test('the last-registered renderer wins when multiple are registered', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  dashboards.registerDashboardRenderer(
    { id: 'first.renderer', name: 'First' },
    component,
  );
  dashboards.registerDashboardRenderer(
    { id: 'second.renderer', name: 'Second' },
    component,
  );

  expect(dashboards.getDashboardRenderer()?.renderer.id).toBe(
    'second.renderer',
  );
  jest.restoreAllMocks();
});

test('disposing the registration falls back to the built-in default', () => {
  const disposable = dashboards.registerDashboardRenderer(
    { id: 'acme.renderer', name: 'Acme Renderer' },
    component,
  );

  expect(dashboards.getDashboardRenderer()?.renderer.id).toBe('acme.renderer');
  disposable.dispose();
  expect(dashboards.getDashboardRenderer()?.renderer.id).toBe(
    'superset.dashboard-renderer',
  );
});

test('registration events fire through the public API', () => {
  const registered = jest.fn();
  const unregistered = jest.fn();
  dashboards.onDidRegisterDashboardRenderer(registered);
  dashboards.onDidUnregisterDashboardRenderer(unregistered);

  const descriptor = { id: 'acme.renderer', name: 'Acme Renderer' };
  const disposable = dashboards.registerDashboardRenderer(
    descriptor,
    component,
  );
  disposable.dispose();

  expect(registered).toHaveBeenCalledWith({ renderer: descriptor });
  expect(unregistered).toHaveBeenCalledWith({ renderer: descriptor });
});
