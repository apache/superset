import { FC, forwardRef, MouseEvent } from 'react';
import { styled, t } from '@superset-ui/core';
import { Icons } from 'src/components/Icons';
import { ChartCustomizationItem } from './types';

interface Props {
  items: ChartCustomizationItem[];
  currentId: string | null;
  onChange: (id: string) => void;
  removeTimerId?: number;
  onRemove: (id: string, shouldRemove?: boolean) => void;
}

const ListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
`;

const FilterTitle = styled.div<{ selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.gridUnit * 2}px
    ${({ theme }) => theme.gridUnit * 3}px;
  background-color: ${({ theme, selected }) =>
    selected ? theme.colors.primary.light5 : theme.colors.grayscale.light4};
  border: 1px solid
    ${({ theme, selected }) =>
      selected ? theme.colors.primary.base : 'transparent'};
  border-radius: ${({ theme }) => theme.gridUnit}px;
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.colors.grayscale.light3};
  }
`;

const LabelWrapper = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
`;

const TitleText = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UndoButton = styled.span`
  margin-left: auto;
  color: ${({ theme }) => theme.colors.primary.base};
  cursor: pointer;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;

  &:hover {
    text-decoration: underline;
  }
`;

const TrashIcon = styled(Icons.DeleteOutlined)`
  cursor: pointer;
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};

  &:hover {
    color: ${({ theme }) => theme.colors.error.base};
  }
`;

const ChartCustomizationTitleContainer: FC<Props> = forwardRef(
  ({ items, currentId, onChange, onRemove }, ref) => (
    <ListContainer ref={ref as any}>
      {items.map(item => {
        const isRemoved = item.removed;
        const selected = item.id === currentId;
        const displayName = item.customization.name?.trim() || t('[untitled]');

        return (
          <FilterTitle
            key={`group-by-title-${item.id}`}
            role="tab"
            selected={selected}
            onClick={() => onChange(item.id)}
          >
            <LabelWrapper>
              <TitleText>{isRemoved ? t('(Removed)') : displayName}</TitleText>
              {isRemoved && (
                <UndoButton
                  role="button"
                  tabIndex={0}
                  onClick={(e: MouseEvent<HTMLElement>) => {
                    e.stopPropagation();
                    onRemove(item.id, false);
                  }}
                >
                  {t('Undo?')}
                </UndoButton>
              )}
            </LabelWrapper>
            {!isRemoved && (
              <TrashIcon
                iconSize="m"
                onClick={(e: MouseEvent<HTMLElement>) => {
                  e.stopPropagation();
                  onRemove(item.id, true);
                }}
                alt="RemoveGroupBy"
              />
            )}
          </FilterTitle>
        );
      })}
    </ListContainer>
  ),
);

export default ChartCustomizationTitleContainer;
