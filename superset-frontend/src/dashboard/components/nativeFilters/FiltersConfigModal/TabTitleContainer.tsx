import React from 'react';
import { styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { FilterRemoval } from './types';

const FilterTitle = styled.div`
  ${({ theme }) => ` 
      display: flex;
      padding: ${theme.gridUnit * 2}px;
      cursor: pointer;
      width: 100%;
      &.active {
        background-color: ${theme.colors.secondary.light4};
        span {
          color:  ${theme.colors.secondary.base};
        }
      }
`}
`;

const StyledTrashIcon = styled(Icons.Trash)`
  color: ${({ theme }) => theme.colors.grayscale.light3};
`;

interface Props {
  filterHierarchy: Array<{ id: string; parentId: string | null }>;
  getFilterTitle: (filterId: string) => string;
  onChange: (filterId: string) => void;
  currentFilterId: string;
  removedFilters: Record<string, FilterRemoval>;
  onRemove: (id: string) => void;
  restoreFilter: (id: string) => void;
  onRearrage: (itemId: string, targetIndex: number) => void;
}

const buildFlatTree = (
  nodeList: Array<{ id: string; parentId: string | null }>,
) => {
  const buildTree = (
    elementId: string,
    elementTree: Map<string, { children: Array<string> }>,
  ) => {
    const filterNode = nodeList.filter(el => el.id === elementId)[0];
    const parentId = filterNode ? filterNode.parentId : undefined;
    if (elementTree.get(elementId)) {
      return elementTree;
    }
    const setChildren = (id: string) => {
      elementTree.set(id, {
        children: nodeList
          .filter(child => child.parentId !== null && child.parentId === id)
          .map(node => node.id),
      });
    };
    if (!parentId) {
      setChildren(elementId);
    } else {
      buildTree(parentId, elementTree);
      setChildren(elementId);
    }
    return elementTree;
  };
  const tree = new Map<string, { children: Array<string> }>();
  nodeList.forEach(element => {
    buildTree(element.id, tree);
  });
  return tree;
};

const TabTitleContainer: React.FC<Props> = ({
  filterHierarchy,
  getFilterTitle,
  onChange,
  currentFilterId,
  removedFilters,
  onRemove,
  restoreFilter,
}) => {
  const renderComponent = (id: string) => {
    const isRemoved = !!removedFilters[id];
    return (
      <FilterTitle
        role="tab"
        key={`filter-title-tab-${id}`}
        onClick={() => onChange(id)}
        className={currentFilterId === id ? 'active' : ''}
      >
        <div>{isRemoved ? t('(Removed)') : getFilterTitle(id)}</div>
        {isRemoved && (
          <span
            role="button"
            data-test="undo-button"
            tabIndex={0}
            onClick={() => restoreFilter(id)}
          >
            {t('Undo?')}
          </span>
        )}
        <div css={{ alignSelf: 'flex-end', marginLeft: 'auto' }}>
          {isRemoved ? (
            <></>
          ) : (
            <StyledTrashIcon
              onClick={event => {
                event.stopPropagation();
                onRemove(id);
              }}
            />
          )}
        </div>
      </FilterTitle>
    );
  };
  const tree = buildFlatTree(filterHierarchy);
  const recursivelyRender = (
    flatMap: Map<string, { children: Array<string> }>,
    element: string,
    renderedElements: Array<string>,
  ) => {
    const childFilters = flatMap.get(element)?.children;
    const didAlreadyRender = renderedElements.indexOf(element) >= 0;
    if (didAlreadyRender) {
      return null;
    }
    const node = (
      <div>
        {renderedElements.push(element) && renderComponent(element)}
        {childFilters?.map(el =>
          recursivelyRender(flatMap, el, renderedElements),
        )}
      </div>
    );
    return node;
  };
  const renderTree = () => {
    const items: any[] = [];
    const rendered: string[] = [];
    tree.forEach((val, key) => {
      const node = recursivelyRender(tree, key, rendered);
      if (node !== null) {
        items.push(node);
      }
    });
    return items;
  };
  return <div>{renderTree()}</div>;
};

export default TabTitleContainer;
