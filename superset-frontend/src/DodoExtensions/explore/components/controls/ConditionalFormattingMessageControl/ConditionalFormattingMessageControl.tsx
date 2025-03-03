// DODO was here
// DODO created 45525377

import { Comparator } from '@superset-ui/chart-controls';
import Icons from 'src/components/Icons';
import {
  ConditionalFormattingConfig,
  ConditionalFormattingControlProps,
} from 'src/explore/components/controls/ConditionalFormattingControl';
import { styled, t, useTheme } from '@superset-ui/core';
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
import {
  RenderAddPopover,
  RenderExistLine,
} from '../ConditionalFormattingControlDodoWrapper/types';

import ConditionalFormattingControlDodoWrapper from '../ConditionalFormattingControlDodoWrapper/ConditionalFormattingControlDodoWrapper';
import { FormattingPopoverMessage } from './FormattingPopoverMessage';

const StyledOptionControlContainer = styled(OptionControlContainer)`
  overflow: hidden;
`;

const StyledLabel = styled(Label)`
  width: calc(100% - 24px);
`;

const createLabel = ({
  column,
  operator,
  targetValue,
  targetValueLeft,
  targetValueRight,
  messageRU,
  messageEN,
}: ConditionalFormattingConfig & {
  messageEN?: string;
  messageRU?: string;
}) => {
  const columnName = column;
  const message = (messageEN ?? messageRU)?.substring(0, 20) ?? '';
  switch (operator) {
    case Comparator.None:
      return `${columnName}`;
    case Comparator.Between:
      return `${targetValueLeft} ${Comparator.LessThan} ${columnName} ${Comparator.LessThan} ${targetValueRight} ${message}`;
    case Comparator.BetweenOrEqual:
      return `${targetValueLeft} ${Comparator.LessOrEqual} ${columnName} ${Comparator.LessOrEqual} ${targetValueRight} ${message}`;
    case Comparator.BetweenOrLeftEqual:
      return `${targetValueLeft} ${Comparator.LessOrEqual} ${columnName} ${Comparator.LessThan} ${targetValueRight} ${message}`;
    case Comparator.BetweenOrRightEqual:
      return `${targetValueLeft} ${Comparator.LessThan} ${columnName} ${Comparator.LessOrEqual} ${targetValueRight} ${message}`;
    default:
      return `${columnName} ${operator} ${targetValue} ${message}`;
  }
};

const ConditionalFormattingMessageControl = (
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

      <FormattingPopoverMessage
        title={t('Edit formatter')}
        config={config}
        columns={columnOptions}
        onChange={(newConfig: ConditionalFormattingConfig) =>
          onEdit(newConfig, index)
        }
        destroyTooltipOnHide
      >
        <StyledOptionControlContainer withCaret>
          <StyledLabel>{createLabel(config)}</StyledLabel>
          <CaretContainer>
            <Icons.CaretRight iconColor={theme.colors.grayscale.light1} />
          </CaretContainer>
        </StyledOptionControlContainer>
      </FormattingPopoverMessage>
    </FormatterContainer>
  );

  const renderAddPopover: RenderAddPopover = ({ columnOptions, onSave }) => (
    <FormattingPopoverMessage
      title={t('Add new formatter')}
      columns={columnOptions}
      onChange={onSave}
      destroyTooltipOnHide
    >
      <AddControlLabel>
        <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
        {t('Add new color formatter')}
      </AddControlLabel>
    </FormattingPopoverMessage>
  );

  return (
    <ConditionalFormattingControlDodoWrapper
      {...props}
      renderExistLine={renderExistLine}
      renderAddPopover={renderAddPopover}
    />
  );
};

export default ConditionalFormattingMessageControl;
