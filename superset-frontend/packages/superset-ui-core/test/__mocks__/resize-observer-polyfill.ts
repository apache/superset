/*
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

interface ResizeObserverEntry {
  contentRect: {
    height: number;
    width: number;
  };
}
type ObserveCallback = (entries: ResizeObserverEntry[]) => void;

const allCallbacks: ObserveCallback[] = [];

export default function ResizeObserver(callback: ObserveCallback) {
  return {
    disconnect() {
      allCallbacks.splice(allCallbacks.indexOf(callback), 1);
    },
    observe() {
      if (callback) {
        allCallbacks.push(callback);
      }
    },
  };
}

export const DEFAULT_OUTPUT: ResizeObserverEntry[] = [
  { contentRect: { height: 300, width: 300 } },
];

export function triggerResizeObserver(entries = DEFAULT_OUTPUT) {
  allCallbacks.forEach(fn => {
    fn(entries);
  });
}
