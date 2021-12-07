import Tree, { DataNode } from 'antd/lib/tree';
import React from 'react';
import { useDashboard } from 'src/common/hooks/apiResources';
import DashboardBuilder from 'src/dashboard/components/DashboardBuilder/DashboardBuilder';

interface Props {
  id: string | number;
}
type ComponentPosition = {
  id: string;
  children?: string[];
  meta?: any;
  parents: string[];
  type: 'CHART' | 'TAB' | 'TABS';
};
type PositionData = {
  [id: string]: ComponentPosition;
};

function buildTree(
  nodeId: string,
  data: PositionData,
  tree: DataNode[],
  traversedIds: any,
) {
  if (nodeId in traversedIds) {
    return traversedIds[nodeId];
  }
  const element = data[nodeId];

  const parents: string[] = element.parents.filter(
    parent => data[parent] && data[parent].type === 'TAB',
  );
  const newNode = {
    key: nodeId,
    title: element.meta.text,
    children: [],
  };

  if (parents.length === 0) {
    tree.push(newNode);
    Object.assign(traversedIds, { nodeId: newNode });
    return newNode;
  }
  // Only take the last parent.
  const parent = parents[parents.length - 1];
  const parentNode = buildTree(parent, data, tree, traversedIds);
  parentNode.children.push(newNode);
  Object.assign(traversedIds, { nodeId: newNode });
  return newNode;
}

const AlertsTabsSelection: React.FC<Props> = (props: Props) => {
  // @ts-ignore
  const dashboardInfo = useDashboard(props.id);
  const positionData: PositionData = dashboardInfo.result?.position_data;
  const tree: DataNode[] = [];
  const traversed = {};
  Object.entries(positionData).forEach(([id, component]) => {
    // @ts-ignore
    if (['TABS'].includes(component.type)) {
      // @ts-ignore
      component.children.forEach(element => {
        buildTree(element, positionData, tree, traversed);
      });
    }
  });
  return (
    <Tree
      checkable
      defaultExpandedKeys={[tree[0].key]}
      defaultSelectedKeys={[tree[0].key]}
      defaultCheckedKeys={[tree[0].key]}
      onSelect={selectedKeys => console.log(selectedKeys)}
      onCheck={check => console.log(check)}
      treeData={tree}
    />
  );
};

export default AlertsTabsSelection;
