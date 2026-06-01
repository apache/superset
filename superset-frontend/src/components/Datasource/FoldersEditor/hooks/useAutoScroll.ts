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

import { useEffect, useRef } from 'react';
import type { VariableSizeList as List } from 'react-window';

// Distance from edge where auto-scroll activates (in pixels)
const SCROLL_THRESHOLD = 80;
// Scroll speed (pixels per 16ms frame at ~60fps)
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
  // Use refs for all mutable state to avoid re-creating callbacks
  const scrollStateRef = useRef({
    direction: null as 'up' | 'down' | null,
    speed: 0,
    mouseY: 0,
    rafId: null as number | null,
    lastTime: 0,
    isScrolling: false,
  });

  useEffect(() => {
    if (!isDragging) {
      // Clean up when not dragging
      const state = scrollStateRef.current;
      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      state.direction = null;
      state.speed = 0;
      return;
    }

    const state = scrollStateRef.current;

    // Calculate scroll parameters based on mouse position
    const updateScrollParams = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const relativeY = state.mouseY - containerRect.top;

      // Near top edge - scroll up
      if (relativeY < SCROLL_THRESHOLD && relativeY >= 0) {
        const proximity = 1 - relativeY / SCROLL_THRESHOLD;
        state.direction = 'up';
        state.speed =
          BASE_SCROLL_SPEED * (1 + proximity * (MAX_SPEED_MULTIPLIER - 1));
        return;
      }

      // Near bottom edge - scroll down
      if (
        relativeY > listHeight - SCROLL_THRESHOLD &&
        relativeY <= listHeight
      ) {
        const distanceFromBottom = listHeight - relativeY;
        const proximity = 1 - distanceFromBottom / SCROLL_THRESHOLD;
        state.direction = 'down';
        state.speed =
          BASE_SCROLL_SPEED * (1 + proximity * (MAX_SPEED_MULTIPLIER - 1));
        return;
      }

      // Not in scroll zone
      state.direction = null;
      state.speed = 0;
    };

    // Animation frame callback - uses time-based scrolling for consistent speed
    const scrollFrame = (currentTime: number) => {
      const list = listRef.current;
      const outerElement = (list as any)?._outerRef;

      if (!list || !outerElement || !state.direction) {
        // Restore pointer events when scrolling stops
        const container = containerRef.current;
        if (container && state.isScrolling) {
          container.style.pointerEvents = '';
          state.isScrolling = false;
        }
        state.rafId = null;
        return;
      }

      // Disable pointer events during scroll to prevent hover recalculations
      const container = containerRef.current;
      if (container && !state.isScrolling) {
        container.style.pointerEvents = 'none';
        state.isScrolling = true;
      }

      // Calculate time delta for frame-rate independent scrolling
      const deltaTime = state.lastTime
        ? (currentTime - state.lastTime) / 16
        : 1;
      state.lastTime = currentTime;

      const currentScroll = outerElement.scrollTop;
      const maxScroll = outerElement.scrollHeight - outerElement.clientHeight;
      const scrollAmount = state.speed * deltaTime;

      let newScroll = currentScroll;
      if (state.direction === 'up') {
        newScroll = Math.max(0, currentScroll - scrollAmount);
      } else if (state.direction === 'down') {
        newScroll = Math.min(maxScroll, currentScroll + scrollAmount);
      }

      if (Math.abs(newScroll - currentScroll) > 0.5) {
        // Use direct DOM manipulation for smoother scrolling
        // react-window's scrollTo triggers re-renders which can cause stutter
        outerElement.scrollTop = newScroll;
      }

      // Continue animation loop
      state.rafId = requestAnimationFrame(scrollFrame);
    };

    // Handle mouse move - just update position, let animation loop handle scrolling
    const handleMouseMove = (event: MouseEvent) => {
      state.mouseY = event.clientY;
      updateScrollParams();

      // Start animation loop if entering scroll zone
      if (state.direction && state.rafId === null) {
        state.lastTime = 0;
        state.rafId = requestAnimationFrame(scrollFrame);
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      // Restore pointer events on cleanup
      const container = containerRef.current;
      if (container && state.isScrolling) {
        container.style.pointerEvents = '';
      }
      state.direction = null;
      state.speed = 0;
      state.lastTime = 0;
      state.isScrolling = false;
    };
  }, [isDragging, listRef, containerRef, listHeight]);
}
