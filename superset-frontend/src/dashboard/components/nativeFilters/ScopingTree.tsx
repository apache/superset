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

import React, { FC, useState } from 'react';
import { Tree } from 'src/common/components';
import { useFilterScopeTree } from './state';
import { DASHBOARD_ROOT_ID } from '../../util/constants';
import { findFilterScope } from './utils';

type ScopingTreeProps = {
  setFilterScope: Function;
};

const ScopingTree: FC<ScopingTreeProps> = ({ setFilterScope }) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    DASHBOARD_ROOT_ID,
  ]);

  const { treeData, layout } = useFilterScopeTree();

  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

  const onExpand = (expandedKeys: string[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  const onCheck = (checkedKeys: string[]) => {
    setCheckedKeys(checkedKeys);
    setFilterScope(findFilterScope(checkedKeys, layout));
  };

  return (
    <Tree
      checkable
      selectable={false}
      onExpand={onExpand}
      expandedKeys={expandedKeys}
      autoExpandParent={autoExpandParent}
      onCheck={onCheck}
      checkedKeys={checkedKeys}
      treeData={treeData}
    />
  );
};

export default ScopingTree;
