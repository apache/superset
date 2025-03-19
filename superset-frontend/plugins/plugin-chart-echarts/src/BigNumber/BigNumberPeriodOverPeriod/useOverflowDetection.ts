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
import { useEffect, useRef, useState } from 'react';
import { debounce } from 'lodash';

export const useOverflowDetection = (flexGap: number) => {
  const symbolContainerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    let obs: ResizeObserver;
    const symbolContainerElem = symbolContainerRef.current;
    const wrapperElem = wrapperRef.current;
    if (symbolContainerElem && wrapperElem) {
      const symbolContainerChildrenElems = Array.from(
        symbolContainerElem.children,
      );
      obs = new ResizeObserver(
        debounce(() => {
          const totalChildrenWidth = symbolContainerChildrenElems.reduce(
            (acc, element) =>
              // take symbol container's child's scroll width to account for the container growing with display: flex
              acc + (element.firstElementChild?.scrollWidth ?? 0),
            0,
          );
          if (
            totalChildrenWidth +
              flexGap * Math.max(symbolContainerChildrenElems.length - 1, 0) >
            wrapperElem.clientWidth
          ) {
            setIsOverflowing(true);
          } else {
            setIsOverflowing(false);
          }
        }, 500),
      );
      obs.observe(document.body);
      symbolContainerChildrenElems.forEach(elem => {
        obs.observe(elem);
      });
    }
    return () => obs?.disconnect();
  }, [flexGap]);

  return { isOverflowing, symbolContainerRef, wrapperRef };
};
