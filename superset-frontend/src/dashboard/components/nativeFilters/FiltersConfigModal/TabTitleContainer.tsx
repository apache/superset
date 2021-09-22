import React from 'react';
import { styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { FilterRemoval } from './types';
import DraggableFilter from './DraggableFilter';

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
  onRearrage: (
    dragIndex: number,
    targetIndex: number,
    numberOfelements: number,
  ) => void;
}

const TabTitleContainer: React.FC<Props> = ({
  filterHierarchy,
  getFilterTitle,
  onChange,
  currentFilterId,
  removedFilters,
  onRemove,
  restoreFilter,
  onRearrage,
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
  const recursivelyRender = (
    elementId: string,
    nodeList: Array<{ id: string; parentId: string | null }>,
    rendered: Array<string>,
  ): React.ReactNode => {
    const didAlreadyRender = rendered.indexOf(elementId) >= 0;
    if (didAlreadyRender) {
      return null;
    }
    let parent = null;
    const element = nodeList.filter(el => el.id === elementId)[0];
    if (!element) {
      // eslint-disable-next-line no-console
      console.warn(`Could not find filter with ID ${elementId}`);
      return null;
    }

    rendered.push(elementId);
    if (element.parentId) {
      parent = recursivelyRender(element.parentId, nodeList, rendered);
    }
    const children = nodeList
      .filter(item => item.parentId === elementId)
      .map(item => recursivelyRender(item.id, nodeList, rendered));
    return (
      <>
        {parent}
        {renderComponent(elementId)}
        {children}
      </>
    );
  };

  const renderTree = () => {
    const rendered: Array<string> = [];
    const items: Array<React.ReactNode> = [];
    filterHierarchy.forEach((item, index) => {
      const filterIdsInGroup = [...rendered];
      const element = recursivelyRender(item.id, filterHierarchy, rendered);
      if (!element) {
        return;
      }
      items.push(
        <DraggableFilter
          onRearrage={onRearrage}
          index={index}
          filterIds={rendered.filter(
            element => element && !filterIdsInGroup.includes(element),
          )}
        >
          {element}
        </DraggableFilter>,
      );
    });
    return items;
  };
  return <div>{renderTree()}</div>;
};

export default TabTitleContainer;
