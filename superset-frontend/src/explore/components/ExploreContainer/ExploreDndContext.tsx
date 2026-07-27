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
  FC,
  Dispatch,
  useReducer,
} from 'react';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragStartEvent,
  DragEndEvent,
  UniqueIdentifier,
  CollisionDetection,
  closestCenter,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { css, styled } from '@apache-superset/core/theme';
import {
  ColumnOptionProps,
  MetricOptionProps,
} from '@superset-ui/chart-controls';
import { Flex } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { DndItemType } from 'src/explore/components/DndItemType';
import {
  StyledColumnOption,
  StyledMetricOption,
} from 'src/explore/components/optionRenderers';
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
 * Container for the <DragOverlay> preview. Mirrors DatasourceItemContainer
 * (the lifted row from DatasourcePanelDragOption) so the item following the
 * cursor reads as the raised source row. Fully opaque on purpose — the faded
 * source row is what signals "in flight", not the overlay.
 */
const DragOverlayContainer = styled(Flex)`
  ${({ theme }) => css`
    width: 100%;
    height: ${theme.sizeUnit * 6}px;
    padding: 0 ${theme.sizeUnit}px;
    color: ${theme.colorText};
    background-color: ${theme.colorBgElevated};
    border-radius: 4px;
    box-shadow: 0 2px 8px ${theme.colorSplit};
    cursor: grabbing;

    > div {
      min-width: 0;
      margin-right: ${theme.sizeUnit * 2}px;
    }
  `}
`;

/**
 * Context to track if something is being dragged (for visual feedback)
 */
export const DraggingContext = createContext(false);

/**
 * Context to access the currently active drag item
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
 * Shape of the data a droppable (e.g. DndSelectLabel) exposes via its
 * `useDroppable` data object so that drops can be dispatched on drag end.
 */
export interface DroppableData {
  accept?: string[];
  canDrop?: (item: DatasourcePanelDndItem) => boolean;
  onDrop?: (item: DatasourcePanelDndItem) => void;
  onDropValue?: (value: DatasourcePanelDndItem['value']) => void;
}

/**
 * Pure dispatch logic for a @dnd-kit drag-end event, extracted so it can be
 * unit-tested without simulating pointer events (which jsdom cannot drive).
 *
 * Mirrors the original react-dnd behavior:
 * - Same-list sortable reorder fires the active item's reorder callback.
 * - External drops (DatasourcePanel -> control) only fire `onDrop` when the
 *   dragged item's type is accepted AND the droppable's `canDrop` validator
 *   passes (react-dnd never fired `drop` when `canDrop` was false).
 */
export function resolveDragEnd(
  active: { id: UniqueIdentifier; data: { current?: ActiveDragData } },
  over: {
    id: UniqueIdentifier;
    data: { current?: Partial<ActiveDragData> & DroppableData };
  } | null,
): void {
  if (!over || active.id === over.id) {
    return;
  }

  const activeData = active.data.current;
  const overData = over.data.current;

  // Same-list sortable reorder: both endpoints carry a dragIndex and type.
  if (
    activeData &&
    overData &&
    typeof activeData.dragIndex === 'number' &&
    typeof overData.dragIndex === 'number' &&
    activeData.type === overData.type
  ) {
    const reorderCallback = activeData.onShiftOptions || activeData.onMoveLabel;
    reorderCallback?.(activeData.dragIndex, overData.dragIndex);
    return;
  }

  // External drop onto a droppable that exposes an onDrop handler.
  if (activeData && overData?.onDrop) {
    const { accept, canDrop, onDrop, onDropValue } = overData;
    const item: DatasourcePanelDndItem = {
      type: activeData.type as DatasourcePanelDndItem['type'],
      value: activeData.value as DatasourcePanelDndItem['value'],
    };
    const typeAccepted = !accept || accept.includes(item.type);
    if (typeAccepted && (canDrop?.(item) ?? true)) {
      onDrop(item);
      onDropValue?.(item.value);
    }
  }
}

/**
 * Type guard for a drag that reorders an existing pill within a control, as
 * opposed to a new item dragged in from the DatasourcePanel. Reorder sources
 * (pills) register through `useSortable`, which stamps a numeric `dragIndex`
 * onto the drag data.
 */
export const isReorderDrag = (data?: Partial<ActiveDragData> | null): boolean =>
  typeof data?.dragIndex === 'number';

/**
 * `useSortable` stamps a `sortable.containerId` (one per enclosing
 * `SortableContext`) onto every sortable's droppable data. It uniquely
 * identifies the control a pill belongs to, letting us tell sibling pills
 * apart from same-type pills in a *different* control rendered on the same
 * page — e.g. Mixed Timeseries' `adhoc_filters` + `adhoc_filters_b`, or a
 * plugin's `metrics` + `percent_metrics`, all of which share one unscoped
 * `type`.
 */
type SortableMeta = { sortable?: { containerId?: UniqueIdentifier } };
const getSortableContainerId = (data: unknown): UniqueIdentifier | undefined =>
  (data as SortableMeta | undefined)?.sortable?.containerId;

/**
 * Collision detection tuned for the Explore DnD tree, where two kinds of
 * droppables overlap in space:
 * - each control registers a large parent dropzone (`dropzone-<name>`) that
 *   accepts items dragged in from the DatasourcePanel, and
 * - each selected pill registers a sortable droppable used for reordering.
 *
 * The default `rectIntersection` strategy ranks droppables by intersection
 * ratio, but the parent dropzone encloses every pill, so during a reorder it
 * can still out-rank the sibling pill the pointer is over. `over` then
 * resolves to the parent dropzone, which carries no `dragIndex`, so the
 * reorder is dropped (and for pills that also carry a `value` the parent's
 * external-drop `onDrop` can even misfire). This broke pill reordering when
 * Explore controls migrated from react-dnd to @dnd-kit.
 *
 * We scope the candidate droppables to the drag's intent:
 * - reordering an existing pill only collides with pills in its own
 *   `SortableContext` (matched by `containerId`, not merely by `type` —
 *   same-type controls can coexist on one page), resolved by proximity; and
 * - dragging a new item in from the panel only collides with the parent
 *   dropzones that expose an `onDrop` handler.
 *
 * Because a reorder drag is scoped to sortables, dragging an existing pill
 * *onto another control's dropzone* no longer registers. In practice this only
 * affected the legacy MetricsControl gesture of dropping a metric pill into a
 * filter control; it is intentionally left unsupported so reorder and
 * cross-control drops can't compete for the same drag (see PR discussion).
 */
export const exploreCollisionDetection: CollisionDetection = args => {
  const activeData = args.active.data.current as ActiveDragData | undefined;

  if (isReorderDrag(activeData)) {
    const activeContainerId = getSortableContainerId(args.active.data.current);
    const sortableContainers = args.droppableContainers.filter(container => {
      const data = container.data.current as
        Partial<ActiveDragData> | undefined;
      if (!isReorderDrag(data)) {
        return false;
      }
      const containerId = getSortableContainerId(container.data.current);
      // Prefer SortableContext identity. Fall back to type only when neither
      // endpoint carries sortable metadata (no known reorder source omits it).
      if (activeContainerId != null || containerId != null) {
        return containerId === activeContainerId;
      }
      return data?.type === activeData?.type;
    });
    return closestCenter({ ...args, droppableContainers: sortableContainers });
  }

  const dropzoneContainers = args.droppableContainers.filter(container => {
    const data = container.data.current as DroppableData | undefined;
    return typeof data?.onDrop === 'function';
  });
  const pointerCollisions = pointerWithin({
    ...args,
    droppableContainers: dropzoneContainers,
  });
  return pointerCollisions.length > 0
    ? pointerCollisions
    : rectIntersection({ ...args, droppableContainers: dropzoneContainers });
};

interface ExploreDndContextProps {
  children: React.ReactNode;
}

/**
 * DnD context provider for the Explore view.
 * Wraps @dnd-kit/core's DndContext and provides:
 * - Dragging state tracking (for visual feedback)
 * - Dropzone registration (for validation)
 * - Drop dispatch via each droppable's `useDroppable` data object
 */
export const ExploreDndContextProvider: FC<ExploreDndContextProps> = ({
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [activeData, setActiveData] = useState<ActiveDragData | null>(null);

  const dropzoneValue = useReducer(dropzoneReducer, {});

  // Configure sensors for drag detection. PointerSensor drives mouse/touch
  // drags; KeyboardSensor adds keyboard-accessible reordering (an a11y win
  // over the previous react-dnd HTML5 backend, which had none).
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as ActiveDragData | undefined;

    // Don't set dragging state for reordering within a list
    if (isReorderDrag(data)) {
      return;
    }

    setIsDragging(true);
    setActiveData(data || null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    setIsDragging(false);
    setActiveData(null);

    resolveDragEnd(
      active as Parameters<typeof resolveDragEnd>[0],
      over as Parameters<typeof resolveDragEnd>[1],
    );
  }, []);

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setActiveData(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={exploreCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DropzoneContext.Provider value={dropzoneValue}>
        <DraggingContext.Provider value={isDragging}>
          <ActiveDragContext.Provider value={activeData}>
            {children}
          </ActiveDragContext.Provider>
        </DraggingContext.Provider>
      </DropzoneContext.Provider>
      {/*
        @dnd-kit has no native drag image (unlike react-dnd's HTML5 backend),
        so the item following the cursor must be rendered explicitly here.
        Reorder drags leave activeData null on purpose, so only external
        DatasourcePanel drags (which carry a value) get a preview.
      */}
      <DragOverlay dropAnimation={null}>
        {activeData?.value ? (
          <DragOverlayContainer align="center" justify="space-between">
            {activeData.type === DndItemType.Column ? (
              <StyledColumnOption
                column={activeData.value as ColumnOptionProps['column']}
                showType
              />
            ) : (
              <StyledMetricOption
                metric={activeData.value as MetricOptionProps['metric']}
                showType
              />
            )}
            <Icons.Drag iconSize="xl" />
          </DragOverlayContainer>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

/**
 * Hook to check if something is currently being dragged
 */
export const useIsDragging = () => useContext(DraggingContext);

/**
 * Hook to get the active drag data
 */
export const useActiveDrag = () => useContext(ActiveDragContext);
