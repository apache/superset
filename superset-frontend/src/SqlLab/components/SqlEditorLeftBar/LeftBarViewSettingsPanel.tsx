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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  Button,
  Checkbox,
  Flex,
  Typography,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { useManageableLeftBarEntries } from 'src/SqlLab/hooks/useManageableLeftBarEntries';
import {
  applyLeftBarViewSettings,
  orderViewsBySettings,
  useLeftBarViewSettings,
} from 'src/SqlLab/hooks/useLeftBarViewSettings';

const RowStyles = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit}px ${theme.sizeUnit * 2}px;
    border-bottom: 1px solid ${theme.colorSplit};
  `}
`;

interface SettingsRowProps {
  id: string;
  name: string;
  checked: boolean;
  onToggle: () => void;
}

const SettingsRow = ({ id, name, checked, onToggle }: SettingsRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };

  return (
    <RowStyles
      ref={setNodeRef}
      style={style}
      data-test={`left-bar-settings-row-${id}`}
    >
      <span
        ref={setActivatorNodeRef}
        css={{ cursor: 'grab', display: 'inline-flex' }}
        {...attributes}
        {...listeners}
      >
        <Icons.Drag aria-hidden />
      </span>
      <Checkbox checked={checked} onChange={onToggle}>
        {name}
      </Checkbox>
    </RowStyles>
  );
};

const LeftBarViewSettingsPanel = () => {
  const views = useManageableLeftBarEntries();
  const settings = useLeftBarViewSettings();

  const [orderIds, setOrderIds] = useState<string[]>(() =>
    orderViewsBySettings(views, settings.order).map(view => view.id),
  );
  const [hidden, setHidden] = useState<Set<string>>(
    () =>
      new Set(settings.hidden.filter(id => views.some(view => view.id === id))),
  );

  const viewsById = new Map(views.map(view => [view.id, view]));
  const rows = orderIds
    .map(id => viewsById.get(id))
    .filter((view): view is NonNullable<typeof view> => !!view);
  const rowIds = rows.map(view => view.id);
  const checkedCount = rows.length - hidden.size;
  const hasNoVisiblePanels = checkedCount <= 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = rowIds.indexOf(String(active.id));
      const newIndex = rowIds.indexOf(String(over.id));
      setOrderIds(arrayMove(rowIds, oldIndex, newIndex));
    }
  };

  const toggleHidden = (id: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApply = () => {
    applyLeftBarViewSettings({ order: orderIds, hidden: Array.from(hidden) });
  };

  const handleCancel = () => {
    setOrderIds(
      orderViewsBySettings(views, settings.order).map(view => view.id),
    );
    setHidden(
      new Set(settings.hidden.filter(id => views.some(view => view.id === id))),
    );
  };

  return (
    <div
      data-test="left-bar-view-settings-panel"
      css={css`
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      `}
    >
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('Arrange sidebar menu')}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        {t(
          'Reorder the panels below by dragging them, and use the checkboxes to show or hide them in the sidebar.',
        )}
      </Typography.Paragraph>
      <div
        css={css`
          flex: 1;
          min-height: 0;
          overflow: auto;
        `}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={rowIds}
            strategy={verticalListSortingStrategy}
          >
            {rows.map(view => (
              <SettingsRow
                key={view.id}
                id={view.id}
                name={view.name}
                checked={!hidden.has(view.id)}
                onToggle={() => toggleHidden(view.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <Flex justify="flex-end" gap="small">
        <Button buttonStyle="tertiary" onClick={handleCancel}>
          {t('Cancel')}
        </Button>
        <Button
          type="primary"
          onClick={handleApply}
          disabled={hasNoVisiblePanels}
        >
          {t('Apply')}
        </Button>
      </Flex>
    </div>
  );
};

export default LeftBarViewSettingsPanel;
