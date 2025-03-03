// DODO was here
// DODO created 45525377

import { t, useTheme } from '@superset-ui/core';
import { Comparator } from '@superset-ui/chart-controls';
import {
  ConditionalFormattingConfig,
  ConditionalFormattingControlProps,
} from 'src/explore/components/controls/ConditionalFormattingControl';
import {
  AddControlLabel,
  CaretContainer,
  Label,
  OptionControlContainer,
} from 'src/explore/components/controls/OptionControls';
import {
  CloseButton,
  FormatterContainer,
} from 'src/explore/components/controls/ConditionalFormattingControl/ConditionalFormattingControl';
import ConditionalFormattingControlDodoWrapper from '../ConditionalFormattingControlDodoWrapper/ConditionalFormattingControlDodoWrapper';
import {
  RenderAddPopover,
  RenderExistLine,
} from '../ConditionalFormattingControlDodoWrapper/types';
import Icons from '../../../../../components/Icons';
import { FormattingPopoverDodo } from './FormattingPopoverDodo';

const createLabel = ({
  operator,
  targetValue,
  targetValueLeft,
  targetValueRight,
}: ConditionalFormattingConfig) => {
  const delta = 'delta';
  switch (operator) {
    case Comparator.None:
      return `${delta}`;
    case Comparator.Between:
      return `${targetValueLeft} ${Comparator.LessThan} ${delta} ${Comparator.LessThan} ${targetValueRight}`;
    case Comparator.BetweenOrEqual:
      return `${targetValueLeft} ${Comparator.LessOrEqual} ${delta} ${Comparator.LessOrEqual} ${targetValueRight}`;
    case Comparator.BetweenOrLeftEqual:
      return `${targetValueLeft} ${Comparator.LessOrEqual} ${delta} ${Comparator.LessThan} ${targetValueRight}`;
    case Comparator.BetweenOrRightEqual:
      return `${targetValueLeft} ${Comparator.LessThan} ${delta} ${Comparator.LessOrEqual} ${targetValueRight}`;
    default:
      return `${delta} ${operator} ${targetValue}`;
  }
};

const ConditionalFormattingControlDodo = (
  props: ConditionalFormattingControlProps,
) => {
  const theme = useTheme();

  const renderExistLine: RenderExistLine = ({
    index,
    onEdit,
    onDelete,
    config,
    columnOptions,
  }) => (
    <FormatterContainer key={index}>
      <CloseButton onClick={() => onDelete(index)}>
        <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
      </CloseButton>
      <FormattingPopoverDodo
        title={t('Edit formatter')}
        config={config}
        columns={columnOptions}
        onChange={(newConfig: ConditionalFormattingConfig) =>
          onEdit(newConfig, index)
        }
        destroyTooltipOnHide
      >
        <OptionControlContainer withCaret>
          <Label>{createLabel(config)}</Label>
          <CaretContainer>
            <Icons.CaretRight iconColor={theme.colors.grayscale.light1} />
          </CaretContainer>
        </OptionControlContainer>
      </FormattingPopoverDodo>
    </FormatterContainer>
  );

  const renderAddPopover: RenderAddPopover = ({ columnOptions, onSave }) => (
    <FormattingPopoverDodo
      title={t('Add new formatter')}
      columns={columnOptions}
      onChange={onSave}
      destroyTooltipOnHide
    >
      <AddControlLabel>
        <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
        {t('Add new color formatter')}
      </AddControlLabel>
    </FormattingPopoverDodo>
  );

  return (
    <ConditionalFormattingControlDodoWrapper
      {...props}
      renderExistLine={renderExistLine}
      renderAddPopover={renderAddPopover}
    />
  );
};

export default ConditionalFormattingControlDodo;
