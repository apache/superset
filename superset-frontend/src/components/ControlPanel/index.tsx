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

import React, { useState } from 'react';
import { Tree, Input, InputNumber, Select, Slider } from 'antd';

const { Option } = Select;

const ControlPanel = (props) => {
  const [treeData, setTreeData] = useState([
    {
      title: 'Root Node',
      key: '0',
      children: [
        { title: 'Numeric Input', key: '0-0', value: 10, type: 'number' },
        { title: 'Slider Input', key: '0-1', value: 50, type: 'number', range: [0, 100] },
        { title: 'Text Input', key: '0-2', value: 'Initial Text', type: 'string' },
        {
          title: 'Select Input',
          key: '0-3',
          value: 'option1',
          type: 'enum',
          options: ['option1', 'option2', 'option3'],
        },
      ],
    },
  ]);

  const onInputChange = (key, value) => {
    const newTreeData = [...treeData];
    const updateTreeData = (data) => {
      data.forEach((item) => {
        if (item.key === key) {
          item.value = value;
        }
        if (item.children) {
          updateTreeData(item.children);
        }
      });
    };
    updateTreeData(newTreeData);
    setTreeData(newTreeData);
  };

  const renderInputComponent = (node) => {
    if (node.type === 'number') {
      if (node.range) {
        return (
          <Slider
            style={{ marginRight: '8px', width: 150 }}
            value={node.value}
            min={node.range[0]}
            max={node.range[1]}
            onChange={(value) => onInputChange(node.key, value)}
          />
        );
      } else {
        return (
          <InputNumber
            style={{ marginRight: '8px' }}
            value={node.value}
            onChange={(value) => onInputChange(node.key, value)}
          />
        );
      }
    } else if (node.type === 'enum') {
      return (
        <Select
          style={{ marginRight: '8px', width: 120 }}
          value={node.value}
          onChange={(value) => onInputChange(node.key, value)}
        >
          {node.options &&
            node.options.map((option) => (
              <Option key={option} value={option}>
                {option}
              </Option>
            ))}
        </Select>
      );
    } else if (node.type === 'string') {
      return (
        <Input
          style={{ marginRight: '8px' }}
          value={node.value}
          onChange={(e) => onInputChange(node.key, e.target.value)}
        />
      );
    } else {
      return null;
    }
  };

  const renderTreeNode = (nodeData) => {
    return {
      title: (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {renderInputComponent(nodeData)}
          {nodeData.title}
        </div>
      ),
      key: nodeData.key,
      children: nodeData.children ? nodeData.children.map(renderTreeNode) : [],
    };
  };

  return (
    <Tree 
      {...props}
      showLine 
      treeData={treeData.map(renderTreeNode)}
    />
  );
};

export default ControlPanel;
