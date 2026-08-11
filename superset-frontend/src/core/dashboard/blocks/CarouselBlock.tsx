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
import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { EmptyState } from '@superset-ui/core/components';
import { provider, useDashboardRevision } from '../store';
import { PALETTE_MIME, placeBlock } from '../placement';
import { FlowContent } from './flowContent';

/**
 * A slide's own child type — the vertical-navigation counterpart to
 * `TabsBlock`'s `TAB_TYPE`, and not registered as a building block for the
 * identical reason: nothing ever resolves one through
 * `resolveBuildingBlockView`, since `CarouselBlock` renders a slide's
 * children directly. It only needs to be a recognized container type so
 * `addBuildingBlock` gives it a `children` array (see `registerContainerType`
 * in `DashboardProvider`).
 */
export const SLIDE_TYPE = 'slide';

/**
 * The negative margin is what keeps the nav column full-height — see
 * `TabsBlock`'s own `Root`, which this mirrors for the identical reason: the
 * card's own padding (`BuildingBlockView`) is right for a single thing
 * filling the card, but wrong for chrome that has to reach the card's own
 * edges to read as one. The top is left alone: `carousel` has no *title* in
 * its header (see `blockLabel`'s `UNNAMED` set), but the header itself —
 * carrying at least the remove control — is still there for every non-root
 * node, so this box starts below it rather than at the card's true top edge
 * regardless.
 */
const Root = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    margin: 0 -${theme.padding}px -${theme.padding}px;
  `}
`;

/**
 * The dot strip itself — shown only once there is something to navigate
 * between (see `CarouselBlock`'s own render). A dot rather than a labelled
 * button: this is the one built-in container whose own switching control is
 * meant to read as a lightweight indicator of position among slides, the
 * way a carousel's dots do elsewhere, rather than as a row of named
 * destinations the way `TabsBlock`'s tab bar is.
 */
const NavColumn = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px;
    border-right: 1px solid ${theme.colorBorderSecondary};
    overflow-y: auto;
  `}
`;

const Dot = styled.button<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    appearance: none;
    border: none;
    padding: 0;
    flex: 0 0 auto;
    width: ${theme.sizeUnit * 2}px;
    height: ${theme.sizeUnit * 2}px;
    border-radius: 50%;
    background-color: ${$active ? theme.colorPrimary : theme.colorBorder};
    cursor: pointer;
    transition: background-color ${theme.motionDurationMid};

    &:hover {
      background-color: ${
        $active ? theme.colorPrimary : theme.colorPrimaryBorder
      };
    }

    &:focus-visible {
      outline: 2px solid ${theme.colorPrimaryBorder};
      outline-offset: 2px;
    }
  `}
`;

/**
 * Where a carousel with no slides yet still has to take a drop — a fresh
 * `FlowContent` area has a `containerId` to drop into from the moment it
 * exists (see its own comment), but a carousel with zero slides has no
 * slide node at all yet for one to be the content of. This is that same
 * drop target one level up: it makes the first `slide` itself, then hands
 * the dropped type to `placeBlock` the same way `FlowContent` would have.
 */
const EmptyArea = styled.div`
  width: 100%;
  height: 100%;
`;

/** What a slide is called before an author (or the assistant) names it. */
export const untitledSlideLabel = (index: number): string =>
  t('Slide %s', index + 1);

/**
 * The built-in `carousel` building block — a container whose own children
 * (each a `slide`, itself a container) are switchable one at a time through
 * a vertical strip of dots, rather than the horizontal tab bar `TabsBlock`
 * uses for the same idea. Registered like any other block (see
 * `registerBuiltInBuildingBlocks`), and like `tabs`, it has no grid of its
 * own: which slide is showing is this component's own concern, not a
 * `layout` fact the document carries (composition/layout design doc).
 *
 * Unlike `tabs`, nothing here fills a carousel in on its own — a fresh one
 * shows the same empty state a fresh pane would, rather than one slide
 * already made for it, which is what keeps the dots from ever needing to
 * appear over a single slide nobody asked for. They join the moment a first
 * slide actually exists.
 *
 * Which slide is *active* is intentionally not persisted, for the identical
 * reason `TabsBlock`'s active pane is not: it is a fact about who is looking
 * at the dashboard right now, not about the dashboard itself. It resets to
 * the first slide whenever the previously active one no longer exists.
 */
export default function CarouselBlock({
  nodeId,
}: {
  nodeId: string;
}): ReactElement | null {
  useDashboardRevision();
  const node = provider.getNode(nodeId);
  const slides = node?.children ?? [];

  const [activeSlideId, setActiveSlideId] = useState<string | undefined>(
    slides[0],
  );
  const activeIsValid =
    activeSlideId !== undefined && slides.includes(activeSlideId);
  if (!activeIsValid && activeSlideId !== slides[0]) {
    setActiveSlideId(slides[0]);
  }

  // A slide added since the last render — whether from `blockHeaderControl`'s
  // "+" (see its own comment) or a palette drop into an empty carousel above
  // — is one nobody has seen yet, so it becomes the one shown rather than
  // landing silently behind whichever slide was already active. Both of
  // those additions always append, so the newest slide is always the last
  // one; a ref rather than a prop is what lets this component notice the
  // growth at all, since the button that causes it renders as this one's
  // sibling in `BuildingBlockView`'s header, not as anything that could pass
  // it a callback.
  const previousSlideCount = useRef(slides.length);
  if (slides.length > previousSlideCount.current) {
    setActiveSlideId(slides[slides.length - 1]);
  }
  previousSlideCount.current = slides.length;

  if (!node) return null;

  return (
    <Root data-test={`carousel-${nodeId}`}>
      {slides.length > 0 && (
        <NavColumn
          role="tablist"
          aria-label={t('Carousel slides')}
          aria-orientation="vertical"
        >
          {slides.map((slideId, index) => {
            const active = slideId === activeSlideId;
            return (
              <Dot
                key={slideId}
                type="button"
                role="tab"
                tabIndex={0}
                aria-selected={active}
                aria-label={t('Slide %s', index + 1)}
                $active={active}
                data-test={`slide-${slideId}`}
                onClick={() => setActiveSlideId(slideId)}
              />
            );
          })}
        </NavColumn>
      )}
      {activeSlideId ? (
        <FlowContent
          containerId={activeSlideId}
          emptyTitle={t('Nothing on this slide yet')}
          emptyDescription={t('Ask the assistant to add something here.')}
          dataTest={`carousel-slide-${nodeId}`}
        />
      ) : (
        <EmptyArea
          data-test={`carousel-empty-${nodeId}`}
          data-container-id={nodeId}
          onDragOver={event => {
            if (event.dataTransfer.types.includes(PALETTE_MIME)) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={event => {
            const type = event.dataTransfer.getData(PALETTE_MIME);
            if (type !== '') {
              event.preventDefault();
              event.stopPropagation();
              const slideId = provider.addBuildingBlock(nodeId, 0, {
                type: SLIDE_TYPE,
                props: { label: untitledSlideLabel(0) },
              });
              placeBlock(slideId, type);
            }
          }}
        >
          <EmptyState
            size="small"
            image="empty.svg"
            title={t('Nothing in this carousel yet')}
            description={t('Ask the assistant to add a slide.')}
          />
        </EmptyArea>
      )}
    </Root>
  );
}
