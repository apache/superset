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
let scrollTopDashboardInterval: any;
const SCROLL_STEP = 120;
const INTERVAL_DELAY = 50;

export default function handleScroll(scroll: string) {
  const setupScroll =
    scroll === 'SCROLL_TOP' &&
    !scrollTopDashboardInterval &&
    document.documentElement.scrollTop !== 0;

  const clearScroll =
    scrollTopDashboardInterval &&
    (scroll !== 'SCROLL_TOP' || document.documentElement.scrollTop === 0);

  if (setupScroll) {
    scrollTopDashboardInterval = setInterval(() => {
      if (document.documentElement.scrollTop === 0) {
        clearInterval(scrollTopDashboardInterval);
        scrollTopDashboardInterval = null;
        return;
      }

      let scrollTop = document.documentElement.scrollTop - SCROLL_STEP;
      if (scrollTop < 0) {
        scrollTop = 0;
      }
      window.scroll({
        top: scrollTop,
        behavior: 'smooth',
      });
    }, INTERVAL_DELAY);
  } else if (clearScroll) {
    clearInterval(scrollTopDashboardInterval);
    scrollTopDashboardInterval = null;
  }
}
