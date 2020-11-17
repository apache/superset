import React, { FC, useState } from 'react';
import { Tree } from 'src/common/components';
import { useFilterScopeTree } from './state';
import { DASHBOARD_ROOT_ID } from '../../util/constants';
import { findRootPath, isShowTypeInTree } from './utils';

type ScopingTreeProps = {
  setFilterScopes: Function;
};

const ScopingTree: FC<ScopingTreeProps> = ({ setFilterScopes }) => {
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
    const checkedItemParents = checkedKeys.map(key =>
      (layout[key].parents || [])
        .filter(parent => isShowTypeInTree(layout[parent].type))
        .sort((p1, p2) => p1.length - p2.length),
    );
    const { rootPath } = findRootPath(checkedItemParents);
    console.log(rootPath);
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
