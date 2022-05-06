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

/**
 * Pass in a piece of state.
 * This hook returns what the value of that state was in the previous render.
 * Returns undefined (or whatever value you specify) the first time.
 */
export function usePrevious<T>(value: T): T | undefined;
export function usePrevious<T, INIT>(value: T, initialValue: INIT): T | INIT;
export function usePrevious<T>(value: T, initialValue?: any): T {
  const previous = useRef<T>(initialValue);
  useEffect(() => {
    // useEffect runs after the render completes
    previous.current = value;
  }, [value]);
  return previous.current;
}
