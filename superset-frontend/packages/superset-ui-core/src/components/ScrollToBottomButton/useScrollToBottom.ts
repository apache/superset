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
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

const DEFAULT_THRESHOLD = 32;

function getDistanceFromBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

export function useScrollToBottom(
  targetRef: RefObject<HTMLElement | null>,
  threshold = DEFAULT_THRESHOLD,
) {
  const [isAtBottom, setIsAtBottom] = useState(true);

  const updatePosition = useCallback(() => {
    const element = targetRef.current;
    if (!element) {
      setIsAtBottom(true);
      return;
    }
    setIsAtBottom(getDistanceFromBottom(element) <= threshold);
  }, [targetRef, threshold]);

  const scrollToBottom = useCallback(() => {
    const element = targetRef.current;
    if (!element) {
      return;
    }
    element.scrollTo({
      top: element.scrollHeight,
      behavior: 'smooth',
    });
  }, [targetRef]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    const element = targetRef.current;
    if (!element) {
      return undefined;
    }

    updatePosition();

    element.addEventListener('scroll', updatePosition, { passive: true });

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(element);

    const mutationObserver = new MutationObserver(updatePosition);
    mutationObserver.observe(element, { childList: true, subtree: true });

    return () => {
      element.removeEventListener('scroll', updatePosition);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [targetRef, updatePosition, targetRef.current]);

  return { isAtBottom, scrollToBottom, updatePosition };
}
