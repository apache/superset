import { FC, useRef } from 'react';
import { styled, t, useTheme } from '@superset-ui/core';
import Button from 'src/components/Button';
import { Icons } from 'src/components/Icons';
import ChartCustomizationTitleContainer from './ChartCustomizationTitleContainer';
import { ChartCustomizationItem } from './types';

interface Props {
  items: ChartCustomizationItem[];
  currentId: string | null;
  onChange: (id: string) => void;
  onAdd: (item: ChartCustomizationItem) => void;
  onRemove: (id: string, shouldRemove?: boolean) => void;
  setCurrentId: (id: string) => void;
}

const PaneContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ListWrapper = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ActionsWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ChartCustomizationTitlePane: FC<Props> = ({
  items,
  currentId,
  onChange,
  onAdd,
  onRemove,
  setCurrentId,
}) => {
  const theme = useTheme();
  const listRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    const newItem: ChartCustomizationItem = {
      id: `group-by-${Date.now()}`,
      title: t('[untitled]'),
      dataset: null,
      description: '',
      removed: false,
      settings: {
        sortFilter: false,
        hasDefaultValue: false,
        isRequired: false,
        selectFirstByDefault: false,
      },
      customization: {
        name: '',
        dataset: null,
        sortAscending: true,
        hasDefaultValue: false,
        isRequired: false,
        selectFirst: false,
      },
    };

    onAdd(newItem);
    setCurrentId(newItem.id);

    setTimeout(() => {
      listRef.current?.scroll({
        top: listRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);
  };

  return (
    <PaneContainer>
      <ListWrapper ref={listRef}>
        <ChartCustomizationTitleContainer
          items={items}
          currentId={currentId}
          onChange={onChange}
          onRemove={onRemove}
        />
      </ListWrapper>

      <ActionsWrapper>
        <Button
          buttonStyle="secondary"
          icon={
            <Icons.BarChartOutlined
              iconColor={theme.colors.primary.dark1}
              iconSize="m"
            />
          }
          onClick={handleAdd}
          data-test="add-groupby-button"
        >
          {t('Add dynamic group by')}
        </Button>
      </ActionsWrapper>
    </PaneContainer>
  );
};

export default ChartCustomizationTitlePane;
