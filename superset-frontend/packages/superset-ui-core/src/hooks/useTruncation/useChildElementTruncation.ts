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

/**
 * This hook encapsulates logic to support truncation of child HTML
 * elements contained in a fixed-width parent HTML element.  Given
 * a ref to the parent element and optionally a ref to the "+x"
 * component that shows the number of truncated items, this hook
 * will return the number of elements that are not fully visible
 * (including those completely hidden) and whether any elements
 * are completely hidden.
 */
const useChildElementTruncation = (
  elementRef: RefObject<HTMLElement>,
  plusRef?: RefObject<HTMLElement>,
) => {
  const [elementsTruncated, setElementsTruncated] = useState(0);
  const [hasHiddenElements, setHasHiddenElements] = useState(false);

  const previousEffectInfoRef = useRef({
    scrollWidth: 0,
    parentElementWidth: 0,
    plusRefWidth: 0,
  });

  useLayoutEffect(() => {
    const currentElement = elementRef.current;
    const plusRefElement = plusRef?.current;

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
    const plusRefWidth = plusRefElement?.offsetWidth || 0;
    previousEffectInfoRef.current = {
      scrollWidth,
      parentElementWidth,
      plusRefWidth,
    };

    if (
      previousEffectInfo.parentElementWidth === parentElementWidth &&
      previousEffectInfo.scrollWidth === scrollWidth &&
      previousEffectInfo.plusRefWidth === plusRefWidth
    ) {
      return;
    }

    if (scrollWidth > clientWidth) {
      // "..." is around 6px wide
      const truncationWidth = 6;
      const plusSize = plusRefElement?.offsetWidth || 0;
      const maxWidth = clientWidth - truncationWidth;
      const elementsCount = childNodes.length;

      let width = 0;
      let hiddenElements = 0;
      for (let i = 0; i < elementsCount; i += 1) {
        const itemWidth = (childNodes[i] as HTMLElement).offsetWidth;
        const remainingWidth = maxWidth - truncationWidth - width - plusSize;

        // assures it shows +{number} only when the item is not visible
        if (remainingWidth <= 0) {
          hiddenElements += 1;
        }
        width += itemWidth;
      }

      if (elementsCount > 1 && hiddenElements) {
        setHasHiddenElements(true);
        setElementsTruncated(hiddenElements);
      } else {
        setHasHiddenElements(false);
        setElementsTruncated(1);
      }
    } else {
      setHasHiddenElements(false);
      setElementsTruncated(0);
    }
  }, [
    elementRef.current?.offsetWidth,
    elementRef.current?.clientWidth,
    elementRef,
  ]);

  return [elementsTruncated, hasHiddenElements];
};

export default useChildElementTruncation;
