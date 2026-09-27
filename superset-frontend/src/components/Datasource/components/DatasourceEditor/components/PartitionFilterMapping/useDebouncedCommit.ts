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
import { useCallback, useEffect, useRef, useState } from 'react';
import { debounce } from 'lodash-es';
import { Constants } from '@superset-ui/core/components';

/**
 * Local text state that commits upward on a debounce.
 *
 * The dataset editor's commit path is asynchronous and snapshot-based: a value
 * handed to `onChange` travels Field -> Fieldset -> CollectionTable ->
 * DatasourceEditor -> DatasourceModal and arrives back on the `value` prop
 * several renders later, and the callback that commits it was built during an
 * earlier render. An input driven straight off that prop therefore loses any
 * keystroke that lands while a commit is in flight -- which is why every other
 * control in the editor types into local state and commits on a debounce, and
 * why Fieldset's own comment says the editor assumes exactly that. This is
 * TextControl's contract (src/explore/components/controls/TextControl), minus
 * the ControlHeader and the number parsing this field does not want.
 */
export function useDebouncedCommit(
  value: string | null | undefined,
  commit: (next: string) => void,
  delay: number = Constants.FAST_DEBOUNCE,
) {
  const [localValue, setLocalValue] = useState(value ?? '');
  const [prevValue, setPrevValue] = useState(value);

  // The commit fires from a timer, so the callback is handed in at call time
  // rather than captured when the debounce was built -- otherwise it would
  // close over whichever render happened to create it, and the commit reads
  // props (the column's monotonic flag) to decide what to write.
  const debouncedCommit = useRef(
    debounce(
      (next: string, commitFn: (value: string) => void) => commitFn(next),
      delay,
    ),
  );

  useEffect(() => () => debouncedCommit.current.cancel(), []);

  const onChange = useCallback(
    (next: string) => {
      setLocalValue(next);
      debouncedCommit.current(next, commit);
    },
    [commit],
  );

  /**
   * Commit a pending edit now. lodash's `flush` is a no-op when nothing is
   * pending, so a blur with no edit behind it costs nothing.
   */
  const flush = useCallback(() => {
    debouncedCommit.current.flush();
  }, []);

  // Re-seed from the prop only when the prop itself changed. Adjusting state
  // during render is React's documented pattern for this; deriving a display
  // value without writing it back leaves `localValue` holding superseded text,
  // so the next render that changes only an unrelated prop -- and so does not
  // re-enter this branch -- puts the stale value back in the input.
  if (prevValue !== value) {
    setPrevValue(value);
    setLocalValue(value ?? '');
  }

  return { value: localValue, onChange, flush };
}
