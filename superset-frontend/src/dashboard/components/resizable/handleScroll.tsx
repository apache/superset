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
const THRESHOLD = 50;

function getScrollDirection(
  mouseY: number | undefined,
  upperBounds = Infinity,
  lowerBounds = -Infinity,
) {
  if (mouseY === undefined) {
    return 'hold';
  }
  if (mouseY > lowerBounds - THRESHOLD) {
    return 'bottom';
  }
  if (mouseY < upperBounds + THRESHOLD) {
    return 'top';
  }
  return 'hold';
}

export function handleScroll(allowScroll: boolean, mouseY: number | undefined) {
  console.log(mouseY, window.innerHeight);
  const scrollSpeed = 1;
  let scrollTimer: NodeJS.Timeout;
  const handleScrollInterval = () => {
    const bounds = window.innerHeight;
    const direction = getScrollDirection(mouseY, 0, bounds);
    if (direction !== 'hold' && allowScroll) {
      window.scrollBy(0, scrollSpeed * (direction === 'top' ? -1 : 1));
    } else {
      clearInterval(scrollTimer);
    }
  };
  scrollTimer = setInterval(handleScrollInterval, 1);
  return () => clearInterval(scrollTimer as NodeJS.Timeout);
}
