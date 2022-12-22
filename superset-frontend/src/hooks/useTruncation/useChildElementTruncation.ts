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
import { RefObject, useLayoutEffect, useState } from 'react';

/**
 * This hook encapsulates logic to support truncation of child HTML
 * elements contained in a fixed-width parent HTML element.  Given
 * a ref to the parent element and optionally a ref to the "+x"
 * component that shows the number of truncated items, this hook
 * will return the number of elements that are not fully visible
 * (including those completely hidden) and whether any elements
 * are completely hidden.
 */
// Using DEFAULT_ARRAY the dependency array is not getting a new array every time this runs for
// an null / undefined elementRef or elementRef with no childeNodes
const DEFAULT_ARRAY: HTMLElement[] = [];

/**
 * Evaluates if an HTMLElement has truncated (clipped / partialy visible / hidden) content
 * and calculates the number of child elements that are completely hidden.
 * NOTE: Any child element that has at least 1px of visible content
 * will be excluded from the hiddenElementCount.
 * @param elementRef HTMLElement that will be checked to see if the sum of child element widths
 * exceeds the visible clientWidth of the elementRef.
 * @returns [isTruncated: boolean, hiddenElementCount: number]
 */
const useChildElementTruncation = (elementRef: RefObject<HTMLElement>) => {
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const [hiddenElementCount, setHiddenElementCount] = useState<number>(0);

  const { scrollWidth, clientWidth, childNodes } = elementRef?.current ?? {
    scrollWidth: 0,
    clientWidth: 0,
    childNodes: DEFAULT_ARRAY,
  };

  useLayoutEffect(() => {
    if (scrollWidth > clientWidth) {
      const elementsCount = childNodes.length;

      let width = 0;
      let hiddenElementCounter = 0;
      childNodes.forEach((node: HTMLElement) => {
        const itemWidth = node?.offsetWidth;
        const remainingWidth = clientWidth - width;
        /**
         * Evaluate if hiddenElementCounter should increment before adding to width
         * to ensure we do not count partially hidden / clipped / truncated element as a hidden item
         */
        if (remainingWidth <= 0) {
          hiddenElementCounter += 1;
        }
        width += itemWidth;
      });
      if (elementsCount > 1 && hiddenElementCounter) {
        // The last element is partially visible (truncated)
        // and some elements are fully hidden
        setHiddenElementCount(hiddenElementCounter);
        setIsTruncated(true);
      } else {
        // The last element is partially visible (truncated)
        setHiddenElementCount(0);
        setIsTruncated(true);
      }
    } else {
      // All items are fully visible
      setHiddenElementCount(0);
      setIsTruncated(false);
    }
  }, [scrollWidth, clientWidth, childNodes]);

  return [isTruncated, hiddenElementCount];
};

export default useChildElementTruncation;
