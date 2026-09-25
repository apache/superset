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

/**
 * The `@apache-superset/core` an extension's frontend gets when it runs in an
 * embedded page instead of in Superset.
 *
 * The bundle is the same one Superset loads: it registers its widget with
 * `views.registerView(view, 'dashboard.widgets', Component)` and renders from
 * a node id. Here `views` lands that registration in the widget registry, and
 * `dashboard` is backed by the embedded widget's own bus and data client
 * rather than the builder's node tree — so an extension widget embeds with no
 * knowledge that it is embedded.
 */
// eslint-disable-next-line no-restricted-syntax
import * as supersetCore from '@apache-superset/core';
import { useEffect, useReducer, useRef, type ComponentType } from 'react';
import type {
  common,
  dashboard as dashboardApi,
  views as viewsApi,
} from '@apache-superset/core';
import { DASHBOARD_WIDGETS_LOCATION } from '@apache-superset/core/widgets';
import { getActiveResolvedFilters } from '../activeFilters';
import { useWidgetBus } from '../bus';
import { useWidgetDataClient } from '../dataClient';
import {
  registerWidgetComponent,
  unregisterWidgetComponent,
} from '../registry';
import type {
  DataBindingSpec,
  Disposable,
  QueryDataResult,
  WidgetBus,
  WidgetComponent,
  WidgetDataClient,
  WidgetEvent,
  WidgetProps,
} from '../types';

/**
 * The widget type a bare `dataBinding` executes as. `DataBindingWidget`
 * server-side reads nothing but `props.dataBinding`, so an extension's
 * `fetchQueryData` runs through the same validated inline path (and the same
 * guest dataset allowlist) as any other embedded widget, without the widget
 * API needing a second way in.
 */
const QUERY_WIDGET_TYPE = 'echarts';

/** Extension metadata as `GET /api/v1/extensions/<publisher>/<name>` returns it. */
export interface ExtensionInfo {
  id: string;
  publisher?: string;
  name: string;
  version?: string;
  description?: string;
  dependencies?: string[];
  remoteEntry?: string;
  moduleFederationName?: string;
}

class EmbeddedDisposable {
  constructor(private readonly callOnDispose: () => void) {}

  static from(...disposables: { dispose: () => unknown }[]) {
    return new EmbeddedDisposable(() =>
      disposables.forEach(disposable => disposable.dispose()),
    );
  }

  dispose(): void {
    this.callOnDispose();
  }
}

const disposable = (callOnDispose: () => void = () => {}) =>
  new EmbeddedDisposable(callOnDispose) as unknown as common.Disposable;

const notAvailable = (api: string) => () => {
  throw new Error(`${api} is not available to an embedded widget.`);
};

interface ExtensionInstance {
  type: string;
  /** What the host passed; it wins over `overrides` on every render. */
  props: Record<string, unknown>;
  /** Props the extension wrote with `updateProps`, for this session only. */
  overrides: Record<string, unknown>;
  bus: WidgetBus;
  client: WidgetDataClient;
  rerender: () => void;
}

const instances = new Map<string, ExtensionInstance>();

/**
 * The page services the last rendered extension widget was given.
 * `dashboard.fetchQueryData` carries no node id, so it runs through these:
 * every widget under one provider shares a client and a bus, and the id only
 * decides which filters a widget excludes as its own.
 *
 * Deliberately not cleared when a widget unmounts. A widget fetches from an
 * effect, and React runs a child's effects before its parent's — so anything
 * this pointer had to be restored by the adapter would already be gone by the
 * time the extension's own effect asks for it (strict mode makes that the
 * normal path, not an edge case).
 */
let active: { id: string; bus: WidgetBus; client: WidgetDataClient } | undefined;

const buses = new Set<WidgetBus>();

interface Subscription {
  eventType: string;
  listener: (event: WidgetEvent) => void;
  attached: Map<WidgetBus, Disposable>;
}

const subscriptions = new Set<Subscription>();

/**
 * Widgets from one extension can sit under different providers, each with its
 * own bus, so a listener follows every bus the extension is rendered under.
 * Buses are kept for the life of the page — they belong to a provider, not to
 * a widget.
 */
function trackBus(bus: WidgetBus): void {
  if (buses.has(bus)) return;
  buses.add(bus);
  subscriptions.forEach(subscription =>
    subscription.attached.set(
      bus,
      bus.on(subscription.eventType, subscription.listener),
    ),
  );
}

function getNode(id: string): dashboardApi.DashboardNode | undefined {
  const instance = instances.get(id);
  if (!instance) return undefined;
  return {
    id,
    type: instance.type,
    props: { ...instance.props, ...instance.overrides },
  };
}

function updateProps(id: string, props: Record<string, unknown>): void {
  const instance = instances.get(id);
  if (!instance) return;
  instance.overrides = { ...instance.overrides, ...props };
  instance.rerender();
}

function fetchQueryData(binding: DataBindingSpec): Promise<QueryDataResult> {
  if (!active) {
    throw new Error(
      'dashboard.fetchQueryData is only available to a rendered widget.',
    );
  }
  const { id, bus, client } = active;
  return client.fetchData({
    instanceId: id,
    widget: { type: QUERY_WIDGET_TYPE, props: { dataBinding: binding } },
    filters: getActiveResolvedFilters(bus, binding.datasetId, id),
  });
}

const dashboard = {
  ...supersetCore.dashboard,
  getDashboardId: () => undefined,
  getRoot: () => ({
    id: 'root',
    type: 'grid',
    children: [...instances.keys()],
  }),
  getNode,
  // The host page owns where a widget sits and what it holds; an embedded
  // widget cannot place or resize itself.
  addWidget: notAvailable('dashboard.addWidget'),
  removeWidget: notAvailable('dashboard.removeWidget'),
  moveWidget: notAvailable('dashboard.moveWidget'),
  updateLayout: notAvailable('dashboard.updateLayout'),
  updateProps,
  onDidLayoutChange: () => disposable(),
  emit: (nodeId: string, eventType: string, payload: unknown) =>
    instances.get(nodeId)?.bus.emit(nodeId, eventType, payload),
  getValue: (nodeId: string, eventType: string) =>
    instances.get(nodeId)?.bus.getValue(nodeId, eventType),
  on: (eventType: string, listener: (event: WidgetEvent) => void) => {
    const subscription: Subscription = {
      eventType,
      listener,
      attached: new Map(),
    };
    subscriptions.add(subscription);
    buses.forEach(bus =>
      subscription.attached.set(bus, bus.on(eventType, listener)),
    );
    return disposable(() => {
      subscriptions.delete(subscription);
      subscription.attached.forEach(attached => attached.dispose());
    });
  },
  fetchQueryData,
} as unknown as typeof supersetCore.dashboard;

/**
 * Renders an extension's widget view from the embedded widget's props: the
 * instance id is the node id the view is handed, so every `dashboard.*` call
 * it makes resolves against this instance.
 */
export function adaptExtensionWidget(
  type: string,
  View: ComponentType<{ nodeId: string }>,
): WidgetComponent {
  function ExtensionWidget({ instanceId, props }: WidgetProps) {
    const bus = useWidgetBus();
    const client = useWidgetDataClient();
    const [, rerender] = useReducer((tick: number) => tick + 1, 0);
    const instance = useRef<ExtensionInstance>();

    // Written during render, not in an effect: the view reads its node while
    // it renders, which happens before any effect of ours would have run.
    instance.current = {
      type,
      props,
      overrides: instances.get(instanceId)?.overrides ?? {},
      bus,
      client,
      rerender,
    };
    instances.set(instanceId, instance.current);
    active = { id: instanceId, bus, client };
    trackBus(bus);

    useEffect(() => {
      // Strict mode runs the cleanup and this effect again without rendering
      // in between, which would otherwise leave the view without its node.
      if (instance.current) instances.set(instanceId, instance.current);
      return () => {
        instances.delete(instanceId);
      };
    }, [instanceId]);

    return <View nodeId={instanceId} />;
  }
  ExtensionWidget.displayName = `ExtensionWidget(${type})`;
  return ExtensionWidget;
}

const registeredViews = new Map<string, viewsApi.View>();

const views = {
  ...supersetCore.views,
  registerView: (
    view: viewsApi.View,
    location: string,
    component: ComponentType<{ nodeId: string }>,
  ) => {
    // An embedded page renders widgets and nothing else, so a contribution to
    // any other location is accepted and ignored rather than failing the load.
    if (location !== DASHBOARD_WIDGETS_LOCATION) return disposable();
    registerWidgetComponent(view.id, adaptExtensionWidget(view.id, component));
    registeredViews.set(view.id, view);
    return disposable(() => {
      unregisterWidgetComponent(view.id);
      registeredViews.delete(view.id);
    });
  },
  getViews: (location: string) =>
    location === DASHBOARD_WIDGETS_LOCATION
      ? [...registeredViews.values()]
      : undefined,
  onDidRegisterView: () => disposable(),
  onDidUnregisterView: () => disposable(),
} as unknown as typeof supersetCore.views;

/**
 * Anything the embedded host has no implementation for. Registrations are
 * tolerated — an extension that also contributes a command or a menu item
 * must still be able to load its widget — and every other call names itself
 * in the error it throws.
 */
function embeddedStub<T extends object>(namespace: string, real: T): T {
  return new Proxy(
    { ...real },
    {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (value !== undefined || typeof property !== 'string') return value;
        if (property.startsWith('register') || property.startsWith('onDid')) {
          return () => disposable();
        }
        return notAvailable(`${namespace}.${property}`);
      },
    },
  ) as T;
}

/**
 * The module an extension's `import ... from '@apache-superset/core'` resolves
 * to, scoped to that extension the way Superset's own loader scopes it.
 */
export function createExtensionCore(
  extension: ExtensionInfo,
): typeof supersetCore {
  const context = {
    extension,
    get storage(): never {
      throw new Error(
        'Extension storage is not available to an embedded widget.',
      );
    },
  };
  return {
    ...supersetCore,
    common: { ...supersetCore.common, Disposable: EmbeddedDisposable },
    views,
    dashboard,
    extensions: {
      ...supersetCore.extensions,
      getContext: () => context,
      getExtension: (id: string) =>
        id === extension.id ? extension : undefined,
      getAllExtensions: () => [extension],
    },
    authentication: embeddedStub('authentication', supersetCore.authentication),
    chat: embeddedStub('chat', supersetCore.chat),
    commands: embeddedStub('commands', supersetCore.commands),
    editors: embeddedStub('editors', supersetCore.editors),
    menus: embeddedStub('menus', supersetCore.menus),
    navigation: embeddedStub('navigation', supersetCore.navigation),
    sqlLab: embeddedStub('sqlLab', supersetCore.sqlLab),
  } as unknown as typeof supersetCore;
}

/** Test seam: drops every instance and bus this module is holding. */
export function resetExtensionHost(): void {
  instances.clear();
  buses.clear();
  subscriptions.clear();
  registeredViews.clear();
  active = undefined;
}
