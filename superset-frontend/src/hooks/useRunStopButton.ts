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
import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

type ButtonAction = 'run' | 'stop';

/** Preserve the starting action of a Run/Stop pointer or Enter/Space gesture. */
export default function useRunStopButton(
  isStopAction: boolean,
  onClick: () => void,
) {
  const currentAction: ButtonAction = isStopAction ? 'stop' : 'run';
  const gestureActionRef = useRef<ButtonAction | null>(null);
  const keyboardActionRef = useRef<ButtonAction | null>(null);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelReleaseTimer = useCallback(() => {
    if (releaseTimerRef.current !== null) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, []);

  const clearGesture = useCallback(() => {
    cancelReleaseTimer();
    gestureActionRef.current = null;
    keyboardActionRef.current = null;
  }, [cancelReleaseTimer]);

  const releaseGesture = useCallback(() => {
    if (gestureActionRef.current === null) return;
    cancelReleaseTimer();
    // Native pointer/Space clicks follow release in the same event turn.
    // Expire the saved action if that release does not produce a click.
    releaseTimerRef.current = setTimeout(clearGesture, 0);
  }, [cancelReleaseTimer, clearGesture]);

  useEffect(() => {
    const onKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        keyboardActionRef.current = null;
        releaseGesture();
      }
    };
    // Release may happen outside the button, including after pointer capture.
    document.addEventListener('pointerup', releaseGesture, true);
    document.addEventListener('lostpointercapture', releaseGesture, true);
    document.addEventListener('pointercancel', clearGesture, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('pointerup', releaseGesture, true);
      document.removeEventListener('lostpointercapture', releaseGesture, true);
      document.removeEventListener('pointercancel', clearGesture, true);
      document.removeEventListener('keyup', onKeyUp, true);
      clearGesture();
    };
  }, [clearGesture, releaseGesture]);

  return {
    onPointerDownCapture: () => {
      clearGesture();
      gestureActionRef.current = currentAction;
    },
    onBlurCapture: () => {
      if (keyboardActionRef.current !== null) clearGesture();
    },
    onKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape' && keyboardActionRef.current !== null) {
        clearGesture();
      }
      if (event.key === 'Enter' || event.key === ' ') {
        cancelReleaseTimer();
        if (!event.repeat) {
          keyboardActionRef.current = currentAction;
        }
        // Enter repeats click after the pending gesture has been consumed.
        // Keep each repeat tied to the action at the original key press.
        gestureActionRef.current = keyboardActionRef.current ?? currentAction;
      }
    },
    onClick: () => {
      cancelReleaseTimer();
      const gestureAction = gestureActionRef.current ?? currentAction;
      gestureActionRef.current = null;
      if (gestureAction === currentAction) {
        onClick();
      }
    },
  };
}
