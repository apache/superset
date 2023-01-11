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
import { RefObject, useEffect, useState, useRef } from 'react';

// Using DEFAULT_ARRAY so the dependency array is not getting a new array every time this runs for
// an null / undefined elementRef or elementRef with no childeNodes
const DEFAULT_ARRAY: HTMLElement[] = [];
// Represents and approximate pixel width for space use by three ellipsis text overflow '...' added by CSS if text does not fit in container element
const ELLIPSIS_BUFFER_WIDTH = 50;
// Represents a margin of size change that will ignore re-calculation if the width increases or addresses less than this buffer value
// to avoid infinite re-renders that can occur with ping pong size changes
const MEASUREMENT_BUFFER = 1;

/**
 * This Hook evaluates if an HTMLElement has truncated (clipped / partially visible / hidden) content (child elements)
 * and calculates the number of child elements that are completely hidden.
 * NOTE: Any child element that has at least 1px of visible content
 * will be excluded from the hiddenElementCount.
 * @param elementRef HTMLElement that will be checked to see if the sum of child element widths
 * exceeds the visible clientWidth of the elementRef.
 * @param visible optional boolean representing the visibility of the parent element so we can skip processing on hidden elements
 * @returns [isTruncated: boolean, hiddenElementCount: number]
 */
const useChildElementTruncation = (
  elementRef: RefObject<HTMLElement>,
  visible = true,
) => {
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const [hiddenElementCount, setHiddenElementCount] = useState<number>(0);
  const prevClientWidth = useRef(0);
  const prevScrollWidth = useRef(0);

  const { scrollWidth, clientWidth, childNodes } = elementRef?.current ?? {
    scrollWidth: 0,
    clientWidth: 0,
    childNodes: DEFAULT_ARRAY,
  };

  // This check will avoid a scenario where the width of a sibling element showing the hiddenElementCount like +4
  // may adjust the client width by a single pixel entering an infinite render loop toggling between +3 and +4
  // We are adding a buffer to avoid infinite rendering loops which has been an issue with this hook in the past
  // If the width changes less than the buffer we will skip recalculation
  const prevWidth = prevClientWidth.current;
  if (
    clientWidth > prevWidth + MEASUREMENT_BUFFER ||
    clientWidth < prevWidth - MEASUREMENT_BUFFER
  ) {
    prevClientWidth.current = clientWidth;
    prevScrollWidth.current = scrollWidth;
  }

  const curClientWidth = prevClientWidth.current;
  const curScrollWidth = prevScrollWidth.current;

  useEffect(() => {
    if (visible) {
      const elementCount = childNodes?.length ?? 0;
      if (elementCount > 0) {
        if (curScrollWidth > curClientWidth) {
          const elementCount = childNodes?.length ?? 0;
          let hiddenElementCounter = 0;
          let remainingWidth = curClientWidth;
          childNodes?.forEach?.((node: HTMLElement) => {
            const itemWidth = node?.getBoundingClientRect?.()?.width ?? 0;
            // Evaluate if hiddenElementCounter should increment before reducing remaining width
            // to ensure we do not count partially hidden / clipped / truncated element as a hidden item
            if (remainingWidth <= ELLIPSIS_BUFFER_WIDTH) {
              hiddenElementCounter += 1;
            }
            remainingWidth -= itemWidth;
          });

          if (elementCount > 1 && hiddenElementCounter > 0) {
            // One element is partially visible (truncated with ...)
            // and one or more elements are hidden
            setHiddenElementCount(hiddenElementCounter);
            setIsTruncated(true);
          } else if (remainingWidth < curClientWidth) {
            // The last element is partially visible (truncated) but no items are hidden
            setHiddenElementCount(0);
            setIsTruncated(true);
          } else {
            // All elements are fully visible
            setHiddenElementCount(0);
            setIsTruncated(false);
          }
        } else if (elementCount === 0 && isTruncated === true) {
          // There are no child elements now but previously there was truncation we need to reset the state
          setHiddenElementCount(0);
          setIsTruncated(false);
        }
      }
    }
  }, [curScrollWidth, curClientWidth, visible, childNodes, isTruncated]);
  return [isTruncated, hiddenElementCount];
};

export default useChildElementTruncation;
