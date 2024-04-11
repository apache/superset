// DODO added file with types

import React from 'react';
import { ConditionalFormattingConfig } from '@superset-ui/chart-controls';
import { ConditionalFormattingControlProps } from 'src/explore/components/controls/ConditionalFormattingControl';
import { GetFieldValue } from './FormattingPopoverContentDodoWrapper';

type RenderExistLinParams = {
  index: number;
  onEdit: (newConfig: ConditionalFormattingConfig, index: number) => void;
  onDelete: (index: number) => void;
  config: ConditionalFormattingConfig;
  columnOptions: { label: string; value: string }[];
  createLabel: (config: ConditionalFormattingConfig) => string;
};

type RenderAddPopoverParams = {
  columnOptions: { label: string; value: string }[];
  onSave: (config: ConditionalFormattingConfig) => void;
};

type RenderExistLine = (params: RenderExistLinParams) => React.ReactNode;

type RenderAddPopover = (params: RenderAddPopoverParams) => React.ReactNode;

type ConditionalFormattingControlWrapperDodoProps =
  ConditionalFormattingControlProps & {
    renderExistLine: RenderExistLine;
    renderAddPopover: RenderAddPopover;
  };

type FormatingPopoverRenderFormContent = (params: {
  rulesRequired: Array<{ required: boolean; message: string }>;
  columns: { label: string; value: string }[];
  colorScheme: { value: string; label: string }[];
  colorsValues: { value: string; label: string }[];
  chosenColor: string;
  setChosenColor: React.Dispatch<React.SetStateAction<string>>;
  shouldFormItemUpdate(
    prevValues: ConditionalFormattingConfig,
    currentValues: ConditionalFormattingConfig,
  ): boolean;
  renderOperatorFields({ getFieldValue }: GetFieldValue): JSX.Element;
  parseColorValue(value: string | 'custom'): void;
}) => React.ReactNode;

export type {
  ConditionalFormattingControlWrapperDodoProps,
  RenderExistLine,
  RenderAddPopover,
  FormatingPopoverRenderFormContent,
};
