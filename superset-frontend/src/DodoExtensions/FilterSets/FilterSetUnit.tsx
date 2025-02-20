// DODO was here
import { AntdDropdown, Typography } from 'src/components';
import { Menu } from 'src/components/Menu';
import { FC } from 'react';
import {
  DataMaskState,
  FilterSet,
  HandlerFunction,
  styled,
  useTheme,
  t,
} from '@superset-ui/core';
import Icons from 'src/components/Icons';
import Button from 'src/components/Button';
import { Tooltip } from 'src/components/Tooltip';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import Loading from 'src/components/Loading';
import { getFilterBarTestId } from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import FiltersHeader from './FiltersHeader';

const HeaderButton = styled(Button)`
  padding: 0;
`;

const TitleText = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const IconsBlock = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  & > *,
  & > button.superset-button {
    ${({ theme }) => `margin-left: ${theme.gridUnit * 2}px`};
  }
`;

type FilterSetUnitPropsDodoExtended = {
  onSetPrimary?: HandlerFunction;
  isPrimary?: boolean;
  isFilterSetPrimary?: boolean;
  setIsFilterSetPrimary?: (value: boolean) => void;
  isInPending?: boolean;
};

export type FilterSetUnitProps = {
  editMode?: boolean;
  isApplied?: boolean;
  filterSet?: FilterSet;
  filterSetName?: string;
  dataMaskSelected?: DataMaskState;
  setFilterSetName?: (name: string) => void;
  onDelete?: HandlerFunction;
  onEdit?: HandlerFunction;
  onRebuild?: HandlerFunction;
} & FilterSetUnitPropsDodoExtended;

const FilterSetUnit: FC<FilterSetUnitProps> = ({
  editMode,
  setFilterSetName,
  onDelete,
  onEdit,
  filterSetName,
  dataMaskSelected,
  filterSet,
  isApplied,
  onRebuild,
  // DODO added start 38080573
  isPrimary,
  onSetPrimary,
  isFilterSetPrimary,
  setIsFilterSetPrimary,
  isInPending,
  // DODO added stop 38080573
}) => {
  const theme = useTheme();

  const menu = (
    <Menu>
      <Menu.Item onClick={onEdit}>{t('Edit')}</Menu.Item>
      {/* DODO added start 38080573 */}
      <Menu.Item onClick={onSetPrimary} disabled={isPrimary}>
        <Tooltip
          placement="right"
          title={t('The primary set of filters will be applied automatically')}
        >
          {t('Set as primary')}
        </Tooltip>
      </Menu.Item>
      {/* DODO added stop 38080573 */}
      <Menu.Item onClick={onRebuild}>
        <Tooltip placement="right" title={t('Remove invalid filters')}>
          {t('Rebuild')}
        </Tooltip>
      </Menu.Item>
      <Menu.Item onClick={onDelete} danger>
        {t('Delete')}
      </Menu.Item>
    </Menu>
  );

  return (
    <>
      {/* DODO added 38080573 */}
      {isInPending && <Loading />}

      <TitleText>
        <Typography.Text
          strong
          editable={{
            editing: editMode,
            icon: <span />,
            onChange: setFilterSetName,
          }}
        >
          {filterSet?.name ?? filterSetName}
        </Typography.Text>
        <IconsBlock>
          {isPrimary && (
            <Icons.StarOutlined
              iconSize="m"
              iconColor={theme.colors.alert.dark1}
            />
          )}
          {isApplied && (
            <Icons.CheckOutlined
              iconSize="m"
              iconColor={theme.colors.success.base}
            />
          )}
          {onDelete && (
            <AntdDropdown
              overlay={menu}
              placement="bottomRight"
              trigger={['click']}
            >
              <HeaderButton
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                {...getFilterBarTestId('filter-set-menu-button')}
                buttonStyle="link"
                buttonSize="xsmall"
              >
                <Icons.EllipsisOutlined iconSize="m" />
              </HeaderButton>
            </AntdDropdown>
          )}
        </IconsBlock>
      </TitleText>
      {/* DODO added start 38080573 */}
      {editMode && setIsFilterSetPrimary && (
        <CheckboxControl
          hovered
          label={t('Set as primary')}
          description={t(
            'The primary set of filters will be applied automatically',
          )}
          value={isFilterSetPrimary}
          onChange={setIsFilterSetPrimary}
        />
      )}
      {/* DODO added stop 38080573 */}
      <FiltersHeader
        filterSet={filterSet}
        dataMask={filterSet?.dataMask ?? dataMaskSelected}
      />
    </>
  );
};

export default FilterSetUnit;
