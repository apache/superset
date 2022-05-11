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
import { RefObject, useLayoutEffect, useState, useRef } from 'react';

export const useTruncation = (elementRef: RefObject<HTMLElement>) => {
  const [elementsTruncated, setElementsTruncated] = useState(0);
  const [hasHiddenElements, setHasHiddenElements] = useState(false);

  const previousEffectInfoRef = useRef({
    scrollWidth: 0,
    parentElementWidth: 0,
  });

  useLayoutEffect(() => {
    const currentElement = elementRef.current;
    if (!currentElement) {
      return;
    }

    const { scrollWidth, clientWidth, childNodes } = currentElement;

    // By using the result of this effect to truncate content
    // we're effectively changing it's size.
    // That will trigger another pass at this effect.
    // Depending on the content elements width, that second rerender could
    // yield a different truncate count, thus potentially leading to a
    // rendering loop.
    // There's only a need to recompute if the parent width or the width of
    // the child nodes changes.
    const previousEffectInfo = previousEffectInfoRef.current;
    const parentElementWidth = currentElement.parentElement?.clientWidth || 0;
    previousEffectInfoRef.current = {
      scrollWidth,
      parentElementWidth,
    };

    if (
      previousEffectInfo.parentElementWidth === parentElementWidth &&
      previousEffectInfo.scrollWidth === scrollWidth
    ) {
      return;
    }

    if (scrollWidth > clientWidth) {
      // "..." is around 6px wide
      const maxWidth = clientWidth - 6;
      const elementsCount = childNodes.length;
      let width = 0;
      let i = 0;
      while (width < maxWidth) {
        width += (childNodes[i] as HTMLElement).offsetWidth;
        i += 1;
      }
      if (i === elementsCount) {
        setElementsTruncated(1);
        setHasHiddenElements(false);
      } else {
        setElementsTruncated(elementsCount - i);
        setHasHiddenElements(true);
      }
    } else {
      setElementsTruncated(0);
    }
  }, [
    elementRef.current?.offsetWidth,
    elementRef.current?.clientWidth,
    elementRef,
  ]);

  return [elementsTruncated, hasHiddenElements];
};
