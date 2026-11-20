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

/**
 * @fileoverview The widget a person is working on.
 *
 * Which widget is selected belongs to one person looking at one screen, not to
 * the canvas: two people with the same draft open are each working on
 * something different. So it is held here, beside the canvas rather than in
 * it, and never reaches an operation, a draft or the undo history.
 *
 * Deliberately not part of `useCanvasDrag`, whose job is a registry of where
 * the grids are. A selection has nothing to do with geometry.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { GridPlacement } from './types';

export interface CanvasSelection {
  /** The selected widget, if any. */
  selectedId?: string;
  /** Selects a widget, or clears the selection with no argument. */
  select: (nodeId?: string) => void;
}

/**
 * What a grid rendered outside a canvas sees: nothing is selected and nothing
 * can be. Lets a surface be rendered on its own -- as the tests do -- without
 * a provider around it.
 */
const NO_SELECTION: CanvasSelection = { select: () => {} };

export const CanvasSelectionContext =
  createContext<CanvasSelection>(NO_SELECTION);

export const useCanvasSelection = () => useContext(CanvasSelectionContext);

/**
 * Holds the selection for one canvas.
 *
 * Only while it may be edited: on a published canvas a selection drives
 * nothing, and the canvas should look the same for everyone looking at it.
 */
export function useCanvasSelectionState({
  editable,
  placements,
}: {
  editable: boolean;
  /** Every placed node, so a selection that leaves the canvas can be let go. */
  placements: Record<string, GridPlacement>;
}): CanvasSelection {
  const [selectedId, setSelectedId] = useState<string>();

  const select = useCallback(
    (nodeId?: string) => {
      if (!editable) return;
      setSelectedId(nodeId);
    },
    [editable],
  );

  // Editing stopped -- the draft was published, discarded, or closed -- so
  // there is nothing to be working on.
  useEffect(() => {
    if (!editable) setSelectedId(undefined);
  }, [editable]);

  // The widget is gone: undone, removed by the agent, or dropped by a poll.
  // Letting the selection outlive it would leave the next widget to take that
  // id selected by inheritance.
  useEffect(() => {
    setSelectedId(current =>
      current !== undefined && !placements[current] ? undefined : current,
    );
  }, [placements]);

  return { selectedId: editable ? selectedId : undefined, select };
}
