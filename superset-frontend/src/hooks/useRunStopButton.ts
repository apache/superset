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
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

type ButtonAction = 'run' | 'stop';
type PointerPress = {
  action: ButtonAction;
  button: HTMLButtonElement;
  pointerType: string;
};
type KeyPress = {
  action: ButtonAction;
  button: HTMLButtonElement;
  key: string;
  cancelled: boolean;
};

/** Find the main button even when capture handlers live on a split-button wrapper. */
const getButton = (target: EventTarget | null) =>
  target instanceof Element ? target.closest('button') : null;

/** Preserve press intent without treating independent clicks as part of a press. */
export default function useRunStopButton(
  isStopAction: boolean,
  onClick: () => void,
) {
  const currentAction: ButtonAction = isStopAction ? 'stop' : 'run';
  const pointersRef = useRef(new Map<number, PointerPress>());
  const keyRef = useRef<KeyPress | null>(null);
  const releasedPointersRef = useRef<number[]>([]);
  const latestRef = useRef({ currentAction, onClick });
  latestRef.current = { currentAction, onClick };

  useEffect(() => {
    const pointers = pointersRef.current;
    const onPointerUp = (event: globalThis.PointerEvent) => {
      const press = pointers.get(event.pointerId);
      if (press && getButton(event.target) !== press.button) {
        pointers.delete(event.pointerId);
        releasedPointersRef.current = releasedPointersRef.current.filter(
          pointerId => pointerId !== event.pointerId,
        );
      } else if (
        press &&
        !releasedPointersRef.current.includes(event.pointerId)
      ) {
        releasedPointersRef.current.push(event.pointerId);
      }
      // Keep matching intent until click, including across implicit capture loss
      // and touch compatibility-event delays. Detail-zero clicks bypass this map.
    };
    const onPointerCancel = (event: globalThis.PointerEvent) => {
      pointers.delete(event.pointerId);
      releasedPointersRef.current = releasedPointersRef.current.filter(
        pointerId => pointerId !== event.pointerId,
      );
    };
    const onKeyUp = (event: globalThis.KeyboardEvent) => {
      const press = keyRef.current;
      if (
        !press ||
        event.key !== press.key ||
        getButton(event.target) !== press.button
      ) {
        return;
      }
      // Own keyboard activation: native keyboard clicks have no press identity,
      // so retaining one to match a later click could swallow an AT activation.
      event.preventDefault();
      keyRef.current = null;
      const latest = latestRef.current;
      if (
        press.key === ' ' &&
        !press.cancelled &&
        !press.button.disabled &&
        press.action === latest.currentAction
      ) {
        latest.onClick();
      }
    };
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerCancel, true);
      document.removeEventListener('keyup', onKeyUp, true);
      pointers.clear();
      releasedPointersRef.current = [];
      keyRef.current = null;
    };
  }, []);

  return {
    onPointerDownCapture: (event: PointerEvent<HTMLElement>) => {
      const button = getButton(event.target);
      if (button && !button.disabled && event.button === 0) {
        releasedPointersRef.current = releasedPointersRef.current.filter(
          pointerId => pointerId !== event.pointerId,
        );
        pointersRef.current.set(event.pointerId, {
          action: currentAction,
          button,
          pointerType: event.pointerType,
        });
      }
    },
    onBlurCapture: () => {
      if (keyRef.current) keyRef.current.cancelled = true;
    },
    onKeyDownCapture: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape' && keyRef.current) {
        keyRef.current.cancelled = true;
      }
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const button = getButton(event.target);
      if (!button || button.disabled) return;
      event.preventDefault();
      // Repeats are not new intent, even if the first run already completed.
      if (event.repeat) return;
      keyRef.current = {
        action: currentAction,
        button,
        key: event.key,
        cancelled: false,
      };
      if (event.key === 'Enter') onClick();
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      const native = event.nativeEvent as Partial<globalThis.PointerEvent>;
      const pointers = pointersRef.current;
      const button = getButton(event.target);
      const hasPointerIdentity =
        native.pointerId !== undefined && !!native.pointerType;
      // Compatibility MouseEvents have no pointer identity, but their positive
      // detail still distinguishes them from AT and HTMLElement.click(). Match
      // releases in order, not another pointer still held on this button.
      const pointerId = hasPointerIdentity
        ? native.pointerId
        : event.detail > 0
          ? releasedPointersRef.current[0]
          : undefined;
      const press =
        pointerId !== undefined ? pointers.get(pointerId) : undefined;
      if (
        press &&
        (!hasPointerIdentity || press.pointerType === native.pointerType) &&
        press.button === button
      ) {
        if (pointerId !== undefined) pointers.delete(pointerId);
        releasedPointersRef.current = releasedPointersRef.current.filter(
          releasedPointerId => releasedPointerId !== pointerId,
        );
        if (press.action !== currentAction) return;
      }
      onClick();
    },
  };
}
