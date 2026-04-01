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

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Modifier } from '@dnd-kit/core';

/**
 * Finds the nearest ancestor element that creates a containing block for
 * position:fixed elements. Per CSS spec, an ancestor with transform,
 * will-change:transform, filter, perspective, or contain:paint establishes
 * a new containing block for fixed-position descendants.
 */
function findContainingBlockAncestor(element: HTMLElement): HTMLElement | null {
  let ancestor = element.parentElement;
  while (ancestor && ancestor !== document.documentElement) {
    const style = window.getComputedStyle(ancestor);
    if (
      (style.transform && style.transform !== 'none') ||
      style.willChange === 'transform' ||
      (style.filter && style.filter !== 'none') ||
      (style.perspective && style.perspective !== 'none')
    ) {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }
  return null;
}

/**
 * Hook that returns a DragOverlay modifier to compensate for CSS transform
 * on ancestor elements. When the FoldersEditor is rendered inside a draggable
 * modal (react-draggable), the modal's transform: translate() creates a new
 * containing block for position:fixed elements. dnd-kit's DragOverlay uses
 * position:fixed with viewport-relative coordinates, causing it to be offset
 * by the ancestor's position. This modifier subtracts that offset.
 */
export function useContainingBlockModifier(
  containerRef: React.RefObject<HTMLElement | null>,
): Modifier[] {
  const containingBlockRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containingBlockRef.current = findContainingBlockAncestor(
        containerRef.current,
      );
    }
  }, [containerRef]);

  const modifier: Modifier = useCallback(({ transform }) => {
    if (!containingBlockRef.current) return transform;
    const rect = containingBlockRef.current.getBoundingClientRect();
    return {
      ...transform,
      x: transform.x - rect.left,
      y: transform.y - rect.top,
    };
  }, []);

  return useMemo(() => [modifier], [modifier]);
}
