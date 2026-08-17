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
 * @fileoverview A second control in a widget's own header, beside the remove
 * button — the header-side counterpart to `widgetLabel`. Most widget types
 * have nothing to put there and get nothing rendered. `collapsible` needs an
 * expand/collapse toggle next to its remove control rather than a second bar
 * of its own further down the card (see `CollapsibleWidget`); `carousel`
 * needs a way to add a slide that isn't the dot strip itself, since the dot
 * strip is meant to read as a plain position indicator rather than a row of
 * controls (see `CarouselWidget`).
 */
import type { ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { ActionButton } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { provider } from './store';
import { SLIDE_TYPE, untitledSlideLabel } from './widgets/CarouselWidget';

/**
 * How tall a collapsed widget stays — just enough for `WidgetView`'s
 * own header, plus a little room around it, rather than the bare minimum
 * (`1`) either unit accepts: at exactly the header's own height a collapsed
 * widget reads as clipped rather than deliberately shut. Read in
 * `layout.rowSpan`'s own unit, whatever this node's container happens to
 * interpret that as (a grid row on the root's own grid, a pixel inside a
 * flow area — see the composition/layout design doc).
 */
const COLLAPSED_ROW_SPAN = 2;

/**
 * The height restored on expanding, when nothing narrower was ever
 * authored to begin with — the same default a freshly placed container
 * arrives with (see `placeBlock`), so expanding a widget nobody has resized
 * yet returns it to exactly the size it was placed at.
 */
const DEFAULT_EXPANDED_ROW_SPAN = 4;

function CollapsibleToggle({ nodeId }: { nodeId: string }): ReactElement {
  const node = provider.getNode(nodeId);
  const collapsed = Boolean(node?.props?.collapsed);

  const toggle = (): void => {
    const current = provider.getNode(nodeId);
    if (!current) return;
    if (collapsed) {
      const restored =
        (current.props?.expandedRowSpan as number | undefined) ??
        DEFAULT_EXPANDED_ROW_SPAN;
      provider.updateLayout(nodeId, { rowSpan: restored });
      provider.updateProps(nodeId, { collapsed: false });
    } else {
      // The height about to be given up is saved so expanding again
      // returns to it rather than always to the default — an author who
      // grew a collapsible before collapsing it should not find it back at
      // its original size on the way out.
      provider.updateProps(nodeId, {
        collapsed: true,
        expandedRowSpan: current.layout?.rowSpan ?? DEFAULT_EXPANDED_ROW_SPAN,
      });
      provider.updateLayout(nodeId, { rowSpan: COLLAPSED_ROW_SPAN });
    }
  };

  return (
    <ActionButton
      label={collapsed ? t('Expand widget') : t('Collapse widget')}
      tooltip={collapsed ? t('Expand') : t('Collapse')}
      placement="bottom"
      dataTest={`widget-collapse-toggle-${nodeId}`}
      onClick={toggle}
      icon={
        collapsed ? (
          <Icons.CaretRightOutlined iconSize="s" />
        ) : (
          <Icons.CaretDownOutlined iconSize="s" />
        )
      }
    />
  );
}

/**
 * Appends a new slide and selects nothing itself — `CarouselWidget` notices
 * the growth on its own next render and switches to it (see its own
 * comment). This component can't do that switching directly: it renders as
 * `CarouselWidget`'s sibling in `WidgetView`'s header, not as
 * anything that could hold or reach the active-slide state living inside
 * `CarouselWidget`.
 */
function CarouselAddSlide({ nodeId }: { nodeId: string }): ReactElement {
  const addSlide = (): void => {
    const index = provider.getNode(nodeId)?.children?.length ?? 0;
    provider.addWidget(nodeId, index, {
      type: SLIDE_TYPE,
      props: { label: untitledSlideLabel(index) },
    });
  };

  return (
    <ActionButton
      label={t('Add slide')}
      tooltip={t('Add slide')}
      placement="bottom"
      dataTest={`carousel-add-${nodeId}`}
      onClick={addSlide}
      icon={<Icons.PlusOutlined iconSize="s" />}
    />
  );
}

const HEADER_CONTROLS: Record<string, (nodeId: string) => ReactElement> = {
  collapsible: nodeId => <CollapsibleToggle nodeId={nodeId} />,
  carousel: nodeId => <CarouselAddSlide nodeId={nodeId} />,
};

/**
 * A second control for the widget of `type` to show in its own header,
 * beside the remove button — or `null` for every type that has nothing to
 * put there, which is nearly all of them.
 */
export function widgetHeaderControl(
  type: string,
  nodeId: string,
): ReactElement | null {
  return HEADER_CONTROLS[type]?.(nodeId) ?? null;
}
