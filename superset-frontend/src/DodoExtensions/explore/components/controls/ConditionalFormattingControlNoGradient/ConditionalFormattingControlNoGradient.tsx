// DODO was here

import React from 'react';
import Icons from 'src/components/Icons';
import {
  ConditionalFormattingConfig,
  ConditionalFormattingControlProps,
} from 'src/explore/components/controls/ConditionalFormattingControl';
import { t, useTheme } from '@superset-ui/core';
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
import { FormattingPopoverNoGradient } from './FormattingPopoverNoGradient';
import ConditionalFormattingControlDodoWrapper from '../ConditionalFormattingControlDodoWrapper/ConditionalFormattingControlDodoWrapper';

const ConditionalFormattingControlNoGradient = (
  props: ConditionalFormattingControlProps,
) => {
  const theme = useTheme();

  const renderExistLine: RenderExistLine = ({
    index,
    onEdit,
    onDelete,
    config,
    columnOptions,
    createLabel,
  }) => (
    <FormatterContainer key={index}>
      <CloseButton onClick={() => onDelete(index)}>
        <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
      </CloseButton>

      <FormattingPopoverNoGradient
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
      </FormattingPopoverNoGradient>
    </FormatterContainer>
  );

  const renderAddPopover: RenderAddPopover = ({ columnOptions, onSave }) => (
    <FormattingPopoverNoGradient
      title={t('Add new formatter')}
      columns={columnOptions}
      onChange={onSave}
      destroyTooltipOnHide
    >
      <AddControlLabel>
        <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
        {t('Add new color formatter')}
      </AddControlLabel>
    </FormattingPopoverNoGradient>
  );

  return (
    <ConditionalFormattingControlDodoWrapper
      {...props}
      renderExistLine={renderExistLine}
      renderAddPopover={renderAddPopover}
    />
  );
};

export default ConditionalFormattingControlNoGradient;
