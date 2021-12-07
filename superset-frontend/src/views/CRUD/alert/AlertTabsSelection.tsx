import Tree, { DataNode } from 'antd/lib/tree';
import React from 'react';
import { useDashboard } from 'src/common/hooks/apiResources';
import DashboardBuilder from 'src/dashboard/components/DashboardBuilder/DashboardBuilder';

interface Props {
  id: string | number;
  onSelect: (selectedTabIds: string[]) => void;
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
  data: { [key: string]: any },
  tree: any,
  traversedIds: any,
) {
  if (nodeId in traversedIds) {
    return traversedIds[nodeId];
  }
  const element = data[nodeId];

  const parents: string[] = element.parents.filter(
    (parent: string) => data[parent] && data[parent].type === 'TAB',
  );
  const newNode = {
    key: nodeId,
    title: element.meta.text,
    children: [],
  };

  // eslint-disable-next-line no-param-reassign
  traversedIds[nodeId] = newNode;
  if (parents.length === 0) {
    tree.push(newNode);

    return newNode;
  }
  // Only take the last parent.
  const parent = parents[parents.length - 1];
  const parentNode = buildTree(parent, data, tree, traversedIds);
  parentNode.children.push(newNode);
  return newNode;
}
const AlertsTabsSelection: React.FC<Props> = ({ id, onSelect }: Props) => {
  const dashboardInfo = useDashboard(id);
  const positionData: PositionData | null = dashboardInfo.result?.position_data;
  const tree: DataNode[] = [];
  const traversed = {};
  if (!positionData) {
    return null;
  }
  Object.entries(positionData).forEach(([_, component]) => {
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
      onSelect={onSelect}
      treeData={tree}
    />
  );
};

export default AlertsTabsSelection;
