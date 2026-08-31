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
import { Button } from '@superset-ui/core/components';
import { Tag } from 'src/components';
import { FC } from 'react';
import { css } from '@apache-superset/core/theme';
import { LayerTreeItemProps } from './types';

const layerTreeItemLabelCss = css`
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
`;

export const LayerTreeItem: FC<LayerTreeItemProps> = ({
  layerConf,
  onEditClick = () => {},
  onRemoveClick = () => {},
  className,
}) => {
  const onCloseTag = () => {
    onRemoveClick();
  };

  const onEditTag = () => {
    onEditClick();
  };

  return (
    <Tag className={className}>
      <Button
        className="layer-tree-item-close"
        icon={<Icons.CloseOutlined iconSize="m" />}
        onClick={onCloseTag}
        size="small"
      />
      <button
        type="button"
        className="layer-tree-item-type"
        css={layerTreeItemLabelCss}
        onClick={onEditTag}
      >
        {layerConf.type}
      </button>
      <button
        type="button"
        className="layer-tree-item-title"
        css={layerTreeItemLabelCss}
        onClick={onEditTag}
      >
        {layerConf.title}
      </button>
      <Button
        className="layer-tree-item-edit"
        icon={<Icons.RightOutlined />}
        onClick={onEditTag}
        size="small"
      />
    </Tag>
  );
};

export default LayerTreeItem;
