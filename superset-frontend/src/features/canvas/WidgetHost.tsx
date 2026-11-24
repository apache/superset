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
import { ReactNode } from 'react';
import type { canvas as canvasApi } from '@apache-superset/core';
import { t } from '@apache-superset/core/translation';
import { EmptyState, Loading } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import { useWidgetRenderers } from 'src/core';
import type {
  CanvasChild,
  CanvasColors,
  CanvasEvent,
  FilterValue,
} from 'src/core/canvas/types';
import { useApiV1Resource } from 'src/hooks/apiResources';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import {
  registerBuiltinRenderers,
  RENDERERS_WITHOUT_CANVAS,
} from './builtinRenderers';
import { TitledWidget, WidgetPlaceholder } from './CanvasGrid';
import { Interactive, overflowFor, WidgetBody } from './CanvasGridSurface';

// A built-in runs here only while the registry holds it, so a page without a
// canvas registers them too; registering them again is a no-op.
registerBuiltinRenderers();

/** A saved widget, as `GET /api/v1/widget/<uuid>` answers it. */
interface SavedWidget {
  uuid: string;
  widget_type: string;
  name: string;
  schema_version?: number;
  props?: Record<string, unknown>;
}

const NO_VALUES: FilterValue[] = [];
const NO_EVENTS: CanvasEvent[] = [];
const NO_CHILDREN: CanvasChild[] = [];
const NO_COLORS: CanvasColors = { labelColors: {} };
// The widget is its bus's only node, so a value it sets reaches nothing.
const reachesNothing = () => undefined;
// Saved widgets are never containers, so there are no children to lay out.
const noGrid = () => null;

/** The cell a canvas draws around a placement, read-only. */
function Cell({ children }: { children: ReactNode }) {
  return (
    <Interactive className="canvas-interactive" data-test="widget-host">
      <WidgetBody
        editable={false}
        offset={0}
        overflow={overflowFor(false, false)}
      >
        {children}
      </WidgetBody>
    </Interactive>
  );
}

/** See `canvas.WidgetHost` in `@apache-superset/core`. */
export default function WidgetHost({
  widgetId,
  refreshKey = 0,
  showTitle = true,
}: canvasApi.WidgetHostProps) {
  const widget = useApiV1Resource<SavedWidget>(
    `/api/v1/widget/${encodeURIComponent(widgetId)}`,
  );
  const getRenderer = useWidgetRenderers();

  if (widget.status === ResourceStatus.Loading) {
    return (
      <Cell>
        <Loading position="inline-centered" />
      </Cell>
    );
  }
  if (widget.status === ResourceStatus.Error) {
    return (
      <Cell>
        <EmptyState
          size="medium"
          title={t(
            'This widget does not exist, or you do not have access to it',
          )}
        />
      </Cell>
    );
  }

  const saved = widget.result;
  const builtin = RENDERERS_WITHOUT_CANVAS.get(saved.widget_type);
  // Any other renderer, one that replaced a built-in included, is promised
  // the canvas it renders on, and there is none here.
  const Renderer =
    builtin !== undefined && getRenderer(saved.widget_type) === builtin
      ? builtin
      : undefined;
  const title = showTitle ? saved.name : undefined;
  const content = Renderer ? (
    <ErrorBoundary>
      <Renderer
        nodeId={saved.uuid}
        widgetType={saved.widget_type}
        widgetId={saved.uuid}
        props={saved.props}
        schemaVersion={saved.schema_version}
        title={title}
        filters={NO_VALUES}
        crossFilters={NO_VALUES}
        customizations={NO_VALUES}
        setFilterValue={reachesNothing}
        setCrossFilter={reachesNothing}
        crossFiltersEnabled={false}
        setCustomizationValue={reachesNothing}
        events={NO_EVENTS}
        publish={reachesNothing}
        colors={NO_COLORS}
        showTimestamp={false}
        refreshKey={refreshKey}
        childNodes={NO_CHILDREN}
        renderGrid={noGrid}
      />
    </ErrorBoundary>
  ) : (
    // The type id would mean nothing to a viewer.
    <WidgetPlaceholder>
      <span>{t('This widget is unavailable')}</span>
    </WidgetPlaceholder>
  );
  return (
    <Cell>
      {title ? <TitledWidget title={title}>{content}</TitledWidget> : content}
    </Cell>
  );
}
