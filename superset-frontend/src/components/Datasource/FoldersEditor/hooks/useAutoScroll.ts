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

import { useCallback, useEffect, useRef } from 'react';
import type { VariableSizeList as List } from 'react-window';

// Distance from edge where auto-scroll activates (in pixels)
const SCROLL_THRESHOLD = 80;
// Base scroll speed (pixels per frame)
const BASE_SCROLL_SPEED = 8;
// Maximum scroll speed multiplier when at the very edge
const MAX_SPEED_MULTIPLIER = 3;

interface UseAutoScrollOptions {
  listRef: React.RefObject<List>;
  containerRef: React.RefObject<HTMLDivElement>;
  isDragging: boolean;
  listHeight: number;
}

/**
 * Custom auto-scroll hook for virtualized lists during drag operations.
 * This replaces dnd-kit's built-in auto-scroll which conflicts with virtualization.
 *
 * When the user drags near the top or bottom edge of the list container,
 * this hook smoothly scrolls the react-window list.
 */
export function useAutoScroll({
  listRef,
  containerRef,
  isDragging,
  listHeight,
}: UseAutoScrollOptions) {
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollSpeedRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Calculate scroll speed based on how close to the edge the mouse is
  const calculateScrollSpeed = useCallback(
    (
      mouseY: number,
      containerRect: DOMRect,
    ): { direction: 'up' | 'down' | null; speed: number } => {
      const relativeY = mouseY - containerRect.top;

      // Near top edge - scroll up
      if (relativeY < SCROLL_THRESHOLD) {
        const proximity = 1 - relativeY / SCROLL_THRESHOLD;
        const speed =
          BASE_SCROLL_SPEED * (1 + proximity * (MAX_SPEED_MULTIPLIER - 1));
        return { direction: 'up', speed };
      }

      // Near bottom edge - scroll down
      if (relativeY > listHeight - SCROLL_THRESHOLD) {
        const distanceFromBottom = listHeight - relativeY;
        const proximity = 1 - distanceFromBottom / SCROLL_THRESHOLD;
        const speed =
          BASE_SCROLL_SPEED * (1 + proximity * (MAX_SPEED_MULTIPLIER - 1));
        return { direction: 'down', speed };
      }

      return { direction: null, speed: 0 };
    },
    [listHeight],
  );

  // Animation frame callback for smooth scrolling
  const scrollFrame = useCallback(() => {
    const list = listRef.current;
    if (!list || !scrollDirectionRef.current) {
      rafIdRef.current = null;
      return;
    }

    // Access the internal scroll offset through the list's outer element
    const outerElement = (list as any)._outerRef;
    if (!outerElement) {
      rafIdRef.current = null;
      return;
    }

    const currentScroll = outerElement.scrollTop;
    const maxScroll = outerElement.scrollHeight - outerElement.clientHeight;

    let newScroll = currentScroll;
    if (scrollDirectionRef.current === 'up') {
      newScroll = Math.max(0, currentScroll - scrollSpeedRef.current);
    } else if (scrollDirectionRef.current === 'down') {
      newScroll = Math.min(maxScroll, currentScroll + scrollSpeedRef.current);
    }

    if (newScroll !== currentScroll) {
      list.scrollTo(newScroll);
    }

    // Continue scrolling if still in scroll zone
    if (scrollDirectionRef.current) {
      rafIdRef.current = requestAnimationFrame(scrollFrame);
    }
  }, [listRef]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const { direction, speed } = calculateScrollSpeed(
        event.clientY,
        containerRect,
      );

      scrollDirectionRef.current = direction;
      scrollSpeedRef.current = speed;

      // Start scroll animation if entering scroll zone
      if (direction && rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(scrollFrame);
      }
    },
    [isDragging, containerRef, calculateScrollSpeed, scrollFrame],
  );

  // Set up and clean up event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      scrollDirectionRef.current = null;
      scrollSpeedRef.current = 0;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isDragging, handleMouseMove]);

  // Clean up on unmount
  useEffect(
    () => () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    },
    [],
  );
}
