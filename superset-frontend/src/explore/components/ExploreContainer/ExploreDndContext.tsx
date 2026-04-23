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
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  FC,
  Dispatch,
  useReducer,
} from 'react';
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { DatasourcePanelDndItem } from '../DatasourcePanel/types';

/**
 * Type for the active drag item data
 */
export interface ActiveDragData {
  type: string;
  value?: unknown;
  dragIndex?: number;
  // For sortable items - callback to handle reorder
  onShiftOptions?: (dragIndex: number, hoverIndex: number) => void;
  onMoveLabel?: (dragIndex: number, hoverIndex: number) => void;
  onDropLabel?: () => void;
}

/**
 * Context to track if something is being dragged (for visual feedback)
 */
export const DraggingContext = createContext(false);

/**
 * Context exposing the active drag item, if any
 */
export const ActiveDragContext = createContext<ActiveDragData | null>(null);

/**
 * Dropzone validation - used by controls to register what they can accept
 */
type CanDropValidator = (item: DatasourcePanelDndItem) => boolean;
type DropzoneSet = Record<string, CanDropValidator>;
type Action = { key: string; canDrop?: CanDropValidator };

export const DropzoneContext = createContext<[DropzoneSet, Dispatch<Action>]>([
  {},
  () => {},
]);

const dropzoneReducer = (state: DropzoneSet = {}, action: Action) => {
  if (action.canDrop) {
    return {
      ...state,
      [action.key]: action.canDrop,
    };
  }
  if (action.key) {
    const newState = { ...state };
    delete newState[action.key];
    return newState;
  }
  return state;
};

/**
 * Context for handling drag end events - controls register their onDrop handlers
 */
type DropHandler = (
  activeId: UniqueIdentifier,
  overId: UniqueIdentifier,
  activeData: ActiveDragData,
) => void;
type DropHandlerSet = Record<string, DropHandler>;

export const DropHandlersContext = createContext<{
  register: (id: string, handler: DropHandler) => void;
  unregister: (id: string) => void;
}>({
  register: () => {},
  unregister: () => {},
});

interface ExploreDndContextProps {
  children: React.ReactNode;
}

/**
 * DnD context provider for the Explore view.
 * Wraps @dnd-kit/core's DndContext and provides:
 * - Dragging state tracking (for visual feedback)
 * - Dropzone registration (for validation)
 * - Drop handler registration (for handling drops)
 */
export const ExploreDndContextProvider: FC<ExploreDndContextProps> = ({
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activeData, setActiveData] = useState<ActiveDragData | null>(null);
  const [dropHandlers, setDropHandlers] = useState<DropHandlerSet>({});

  const dropzoneValue = useReducer(dropzoneReducer, {});

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as ActiveDragData | undefined;

    // Don't set dragging state for reordering within a list
    if (data && 'dragIndex' in data) {
      return;
    }

    setIsDragging(true);
    setActiveData(data || null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setIsDragging(false);
      setActiveData(null);

      if (over && active.id !== over.id) {
        const activeDataCurrent = active.data.current as
          | ActiveDragData
          | undefined;
        const overDataCurrent = over.data.current as ActiveDragData | undefined;

        // Check if this is a sortable reorder operation
        // Both items need dragIndex and the same type
        if (
          activeDataCurrent &&
          overDataCurrent &&
          typeof activeDataCurrent.dragIndex === 'number' &&
          typeof overDataCurrent.dragIndex === 'number' &&
          activeDataCurrent.type === overDataCurrent.type
        ) {
          const { dragIndex } = activeDataCurrent;
          const hoverIndex = overDataCurrent.dragIndex;

          // Call the appropriate reorder callback
          const reorderCallback =
            activeDataCurrent.onShiftOptions || activeDataCurrent.onMoveLabel;
          if (reorderCallback) {
            reorderCallback(dragIndex, hoverIndex);
          }

          // Call onDropLabel if provided (for finalization after reorder)
          activeDataCurrent.onDropLabel?.();
          return;
        }

        // Handle external drop (from DatasourcePanel to dropzone).
        // Droppable zones (e.g., DndSelectLabel) register their drop callbacks
        // via `data` on useDroppable, which surfaces here as `over.data.current`.
        // Prefer that inline metadata; fall back to the registered handler map
        // for any consumers that don't attach data to their droppable.
        const droppableData = over.data.current as
          | {
              accept?: string[];
              onDrop?: (item: { type: string; value?: unknown }) => void;
              onDropValue?: (value: unknown) => void;
              canDrop?: (item: DatasourcePanelDndItem) => boolean;
            }
          | undefined;

        if (activeDataCurrent && droppableData) {
          const { accept, onDrop, onDropValue, canDrop } = droppableData;
          const typeAccepted =
            !accept || accept.includes(activeDataCurrent.type);

          if (typeAccepted && (onDrop || onDropValue)) {
            const item = {
              type: activeDataCurrent.type,
              value: activeDataCurrent.value,
            };
            // Apply the droppable's canDrop validator (e.g., duplicate or
            // disallow_adhoc_metrics checks) so the runtime drop behavior
            // matches the visual "cannot drop" feedback. Skip the drop
            // entirely when the validator rejects the item.
            if (canDrop && !canDrop(item as DatasourcePanelDndItem)) {
              return;
            }
            onDrop?.(item);
            if (activeDataCurrent.value !== undefined) {
              onDropValue?.(activeDataCurrent.value);
            }
            return;
          }
        }

        const overId = String(over.id);
        const handler = dropHandlers[overId];

        if (handler && activeDataCurrent) {
          handler(active.id, over.id, activeDataCurrent);
        }
      }
    },
    [dropHandlers],
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setActiveData(null);
  }, []);

  const registerDropHandler = useCallback(
    (id: string, handler: DropHandler) => {
      setDropHandlers(prev => ({ ...prev, [id]: handler }));
    },
    [],
  );

  const unregisterDropHandler = useCallback((id: string) => {
    setDropHandlers(prev => {
      const newHandlers = { ...prev };
      delete newHandlers[id];
      return newHandlers;
    });
  }, []);

  const dropHandlersContextValue = useMemo(
    () => ({
      register: registerDropHandler,
      unregister: unregisterDropHandler,
    }),
    [registerDropHandler, unregisterDropHandler],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DropzoneContext.Provider value={dropzoneValue}>
        <DropHandlersContext.Provider value={dropHandlersContextValue}>
          <DraggingContext.Provider value={isDragging}>
            <ActiveDragContext.Provider value={activeData}>
              {children}
            </ActiveDragContext.Provider>
          </DraggingContext.Provider>
        </DropHandlersContext.Provider>
      </DropzoneContext.Provider>
    </DndContext>
  );
};

/**
 * Hook reporting whether a drag is in progress
 */
export const useIsDragging = () => useContext(DraggingContext);

/**
 * Hook to get the active drag data
 */
export const useActiveDrag = () => useContext(ActiveDragContext);
