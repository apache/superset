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

import React, { FC, useMemo, useState } from 'react';
import { FormInstance, Tree } from 'src/common/components';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { useFilterScopeTree } from './state';
import { setFilterFieldValues, useForceUpdate } from '../utils';
import { findFilterScope, getTreeCheckedItems } from './utils';
import { NativeFiltersForm } from '../../types';
import { Scope } from '../../../types';

type ScopingTreeProps = {
  form: FormInstance<NativeFiltersForm>;
  filterId: string;
  initialScope: Scope;
};

const ScopingTree: FC<ScopingTreeProps> = ({
  form,
  filterId,
  initialScope,
}) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    DASHBOARD_ROOT_ID,
  ]);

  const formFilter = form.getFieldValue('filters')[filterId];

  const { treeData, layout } = useFilterScopeTree();
  const [autoExpandParent, setAutoExpandParent] = useState<boolean>(true);

  const handleExpand = (expandedKeys: string[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };
  const forceUpdate = useForceUpdate();
  const handleCheck = (checkedKeys: string[]) => {
    forceUpdate();
    setFilterFieldValues(form, filterId, {
      scope: findFilterScope(checkedKeys, layout),
    });
  };

  const checkedKeys = useMemo(
    () =>
      getTreeCheckedItems({ ...(formFilter.scope || initialScope) }, layout),
    [formFilter.scope, initialScope, layout],
  );

  return (
    <Tree
      checkable
      selectable={false}
      onExpand={handleExpand}
      expandedKeys={expandedKeys}
      autoExpandParent={autoExpandParent}
      onCheck={handleCheck}
      checkedKeys={checkedKeys}
      treeData={treeData}
    />
  );
};

export default ScopingTree;
