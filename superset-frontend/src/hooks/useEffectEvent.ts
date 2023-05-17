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
// TODO: Replace to react-use-event-hook once https://github.com/facebook/react/pull/25881 is released
import useEventCallback from 'use-event-callback';

declare type Fn<ARGS extends any[], R> = (...args: ARGS) => R;

/**
 * Similar to useCallback, with a few subtle differences:
 * @external
 * https://github.com/reactjs/rfcs/blob/useevent/text/0000-useevent.md#internal-implementation
 * @example
 * const onStateChanged = useEffectEvent((state: T) => log(['clicked', state]));
 *
 * useEffect(() => {
 *   onStateChanged(state);
 * }, [onStateChanged, state]);
 * // ^ onStateChanged is guaranteed to never change and always be up to date!
 */
export default function useEffectEvent<A extends any[], R>(
  fn: Fn<A, R>,
): Fn<A, R> {
  return useEventCallback(fn);
}
