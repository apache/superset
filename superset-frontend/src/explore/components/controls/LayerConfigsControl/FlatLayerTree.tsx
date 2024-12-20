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
import { PlusOutlined } from '@ant-design/icons';
import { css, styled, t } from '@superset-ui/core';
import { Button, Tree } from 'antd';
import { TreeProps } from 'antd/lib/tree';
import { forwardRef } from 'react';
import { FlatLayerDataNode, FlatLayerTreeProps, LayerConf } from './types';
import { handleDrop } from './dragDropUtil';
import LayerTreeItem from './LayerTreeItem';

export const StyledLayerTreeItem = styled(LayerTreeItem)`
  ${({ theme }) => css`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: unset;

    border: none;
    border-radius: ${theme.borderRadius}px;
    background-color: ${theme.colors.grayscale.light3};
    font-size: ${theme.typography.sizes.s}px;
    font-weight: ${theme.typography.weights.normal};

    &:hover {
      background-color: ${theme.colors.grayscale.light3};
    }

    & .layer-tree-item-close {
      border-right: solid;
      border-right-width: 1px;
      border-right-color: ${theme.colors.grayscale.light2};
    }

    & .layer-tree-item-edit {
      border-left: solid;
      border-left-width: 1px;
      border-left-color: ${theme.colors.grayscale.light2};
    }

    & .layer-tree-item-title {
      flex: 1;
      padding-left: 4px;
    }

    & .layer-tree-item-type {
      padding-left: 4px;
      font-size: ${theme.typography.sizes.xs}px;
      font-family: ${theme.typography.families.monospace};
    }

    & > button {
      border: none;
      background-color: unset;
      color: ${theme.colors.grayscale.light1};
    }

    & > button:hover {
      background-color: unset;
      color: ${theme.colors.grayscale.light1};
    }
  `}
`;

// forwardRef is needed here in order for emotion and antd tree to work properly
export const FlatLayerTree = forwardRef<HTMLDivElement, FlatLayerTreeProps>(
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
    const layerConfigsToTreeData = (
      configs: LayerConf[],
    ): FlatLayerDataNode[] =>
      configs.map((config, idx) => ({
        layerConf: config,
        key: idx,
        title: (
          <StyledLayerTreeItem
            layerConf={config}
            onEditClick={() => onEditLayer(config, idx)}
            onRemoveClick={() => onRemoveLayer(idx)}
          />
        ),
        selectable: false,
        isLeaf: true,
        checkable: false,
      }));

    const treeDataToLayerConfigs = (
      treeData: FlatLayerDataNode[],
    ): LayerConf[] => treeData.map(data => data.layerConf);

    const treeData = layerConfigsToTreeData(layerConfigs);

    const onDrop: TreeProps['onDrop'] = info => {
      const data = handleDrop(info, treeData);
      const movedLayerConfigs = treeDataToLayerConfigs(data);
      onMoveLayer(movedLayerConfigs);
    };

    const addLayerLabel = t('Click to add new layer');

    return (
      <div className={className} ref={ref}>
        <Button
          className="add-layer-btn"
          onClick={onAddLayer}
          size="small"
          type="dashed"
          icon={<PlusOutlined />}
        >
          {addLayerLabel}
        </Button>
        <Tree treeData={treeData} draggable={draggable} onDrop={onDrop} />
      </div>
    );
  },
);

export default FlatLayerTree;
