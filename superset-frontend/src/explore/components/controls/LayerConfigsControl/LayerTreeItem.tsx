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
import { CloseOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';
import { FC } from 'react';
import { LayerTreeItemProps } from './types';

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
        icon={<CloseOutlined />}
        onClick={onCloseTag}
        size="small"
      />
      <span
        className="layer-tree-item-type"
        onClick={onEditTag}
        role="button"
        tabIndex={0}
      >
        {layerConf.type}
      </span>
      <span
        className="layer-tree-item-title"
        onClick={onEditTag}
        role="button"
        tabIndex={0}
      >
        {layerConf.title}
      </span>
      <Button
        className="layer-tree-item-edit"
        icon={<RightOutlined />}
        onClick={onEditTag}
        size="small"
      />
    </Tag>
  );
};

export default LayerTreeItem;
