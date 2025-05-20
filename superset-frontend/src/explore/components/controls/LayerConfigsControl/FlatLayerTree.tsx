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
import { Icons } from '@superset-ui/core/components/Icons';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { FC, forwardRef, useRef } from 'react';
import { DragContainer } from '../OptionControls';
import { FlatLayerTreeProps, LayerConfWithId } from './types';
import LayerTreeItem from './LayerTreeItem';

const LAYER_CONFIG_DRAG_TYPE = 'LAYER_CONFIG_DRAG_ITEM';

interface DragItem {
  dragIndex: number;
  type: string;
}

export const StyledLayerTreeItem = styled(LayerTreeItem)`
  ${({ theme }) => css`
    width: 100%;
    height: ${theme.sizeUnit * 6}px;
    margin-top: 0;
    margin-bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: unset;

    border: none;
    border-radius: ${theme.borderRadius}px;
    background-color: ${theme.colorBgLayout};
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightNormal};

    &:hover {
      background-color: ${theme.colorPrimaryBgHover};
    }

    & .layer-tree-item-close {
      border-right: solid;
      border-right-width: 1px;
      border-right-color: ${theme.colorSplit};
      width: ${theme.sizeUnit * 6}px;
      height: 100%;
      padding: 0;
      border-radius: 0;
    }

    & .layer-tree-item-edit {
      border-left: solid;
      border-left-width: 1px;
      border-left-color: ${theme.colorSplit};
      width: ${theme.sizeUnit * 6}px;
      height: 100%;
      padding: 0;
      border-radius: 0;
    }

    & .layer-tree-item-title {
      display: flex;
      align-items: center;
      flex: 1;
      padding-left: ${theme.sizeUnit}px;
    }

    & .layer-tree-item-type {
      display: flex;
      align-items: center;
      padding-left: ${theme.sizeUnit}px;
      font-size: ${theme.fontSizeXS}px;
      font-family: ${theme.fontFamilyCode};
    }

    & > button {
      border: none;
      background-color: unset;
      color: ${theme.colorTextSecondary};
      box-shadow: none;
    }

    & > button:hover {
      background-color: unset;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

interface DraggableLayerTreeItemProps {
  layerConf: LayerConfWithId;
  index: number;
  draggable?: boolean;
  onEditLayer: (layerConf: LayerConfWithId, idx: number) => void;
  onRemoveLayer: (idx: number) => void;
  onMoveLayerByIndex: (dragIndex: number, hoverIndex: number) => void;
}

const DraggableLayerTreeItem: FC<DraggableLayerTreeItemProps> = ({
  layerConf,
  index,
  draggable = false,
  onEditLayer,
  onRemoveLayer,
  onMoveLayerByIndex,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [, drag] = useDrag<DragItem, void, unknown>({
    item: {
      type: LAYER_CONFIG_DRAG_TYPE,
      dragIndex: index,
    },
    canDrag: draggable,
  });

  const [, drop] = useDrop({
    accept: LAYER_CONFIG_DRAG_TYPE,
    hover(item: DragItem, monitor: DropTargetMonitor) {
      // Stop early when dragging is disabled or the item node is not ready yet
      if (!draggable || !ref.current) {
        return;
      }
      const { dragIndex } = item;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) {
        return;
      }

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset?.y
        ? clientOffset?.y - hoverBoundingRect.top
        : 0;

      // Move only after crossing the middle to avoid jumpy reordering
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      onMoveLayerByIndex(dragIndex, hoverIndex);
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      // eslint-disable-next-line no-param-reassign
      item.dragIndex = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <DragContainer ref={ref}>
      <StyledLayerTreeItem
        layerConf={layerConf}
        onEditClick={() => onEditLayer(layerConf, index)}
        onRemoveClick={() => onRemoveLayer(index)}
      />
    </DragContainer>
  );
};

export const FlatLayerTree: FC<FlatLayerTreeProps> = forwardRef<
  HTMLDivElement,
  FlatLayerTreeProps
>(
  (
    {
      layerConfigs,
      onAddLayer = () => {},
      onRemoveLayer = () => {},
      onEditLayer = () => {},
      onMoveLayer = () => {},
      draggable,
      className,
    },
    ref,
  ) => {
    const onMoveLayerByIndex = (dragIndex: number, hoverIndex: number) => {
      if (!draggable || dragIndex === hoverIndex) {
        return;
      }
      onMoveLayer(dragIndex, hoverIndex);
    };

    const addLayerLabel = t('Click to add new layer');

    return (
      <div className={className} ref={ref}>
        <Button
          className="add-layer-btn"
          onClick={onAddLayer}
          icon={<Icons.PlusOutlined iconSize="m" />}
        >
          {addLayerLabel}
        </Button>
        {layerConfigs.map((layerConf, idx) => (
          <DraggableLayerTreeItem
            key={layerConf.id}
            layerConf={layerConf}
            index={idx}
            draggable={draggable}
            onEditLayer={onEditLayer}
            onRemoveLayer={onRemoveLayer}
            onMoveLayerByIndex={onMoveLayerByIndex}
          />
        ))}
      </div>
    );
  },
);

export default FlatLayerTree;
