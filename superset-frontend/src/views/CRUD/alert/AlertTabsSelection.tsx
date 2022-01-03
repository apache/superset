import Tree from 'antd/lib/tree';
import React from 'react';
import { styled, t } from '@superset-ui/core';
import { useDashboardTabTree } from '../utils';

interface Props {
  id: string | number;
  onSelect: (selectedTabIds: string[]) => void;
  selectedKeys: string[];
}

const StyledSectionTitle = styled.div`
  display: flex;
  align-items: center;
  margin: ${({ theme }) => theme.gridUnit * 2}px auto
    ${({ theme }) => theme.gridUnit * 4}px auto;

  h4 {
    margin: 0;
  }

  .required {
    margin-left: ${({ theme }) => theme.gridUnit}px;
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

const AlertsTabsSelection: React.FC<Props> = ({
  id,
  onSelect,
  selectedKeys,
}: Props) => {
  const tree = useDashboardTabTree(id);
  // onTabsLoaded(tree);
  return tree && tree.length > 0 ? (
    <>
      <StyledSectionTitle>
        <h4>{t('Select tabs to send')}</h4>
      </StyledSectionTitle>
      <Tree
        checkable
        defaultExpandedKeys={[tree[0].key]}
        defaultSelectedKeys={[tree[0].key]}
        defaultCheckedKeys={[tree[0].key]}
        onSelect={onSelect}
        treeData={tree}
        selectedKeys={selectedKeys}
      />
    </>
  ) : null;
};

export default AlertsTabsSelection;
