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
