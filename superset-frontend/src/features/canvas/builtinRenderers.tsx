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
import type { ComponentType } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { SafeMarkdown, Tabs, Typography } from '@superset-ui/core/components';
import { canvas } from 'src/core';

type Props = canvasApi.CanvasWidgetProps;

const text = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const TabsRenderer = ({ childNodes }: Props) => (
  <Tabs
    items={childNodes.map(child => ({
      key: child.nodeId,
      label: text(child.props?.title) || t('Untitled tab'),
      children: child.element,
    }))}
  />
);

const GridRenderer = ({ renderGrid }: Props) => <>{renderGrid()}</>;

const GroupRenderer = ({ props, renderGrid }: Props) => (
  <section>
    {text(props?.title) && (
      <Typography.Title level={5}>{text(props?.title)}</Typography.Title>
    )}
    {renderGrid()}
  </section>
);

const MarkdownRenderer = ({ props }: Props) => (
  <SafeMarkdown source={text(props?.content)} />
);

/** Renderers for the core widgets that need no data: containers and text. */
export const BUILTIN_RENDERERS: Record<string, ComponentType<Props>> = {
  tabs: TabsRenderer,
  tab: GridRenderer,
  group: GroupRenderer,
  'filter.bar': GridRenderer,
  markdown: MarkdownRenderer,
};

let registered = false;

/** Registers the built-in renderers once, before the first canvas renders. */
export function registerBuiltinRenderers(): void {
  if (registered) return;
  registered = true;
  Object.entries(BUILTIN_RENDERERS).forEach(([widgetType, component]) =>
    canvas.registerWidgetRenderer(widgetType, component),
  );
}
