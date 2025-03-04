// DODO was here

import { ReactNode } from 'react';
import { PopoverProps } from 'antd/lib/popover';
import { Comparator, ControlComponentProps } from '@superset-ui/chart-controls';

type ConditionalFormattingConfigDodoExtended = {
  isFixedColor?: boolean; // DODO added 44728517
};
export type ConditionalFormattingConfig = {
  operator?: Comparator;
  targetValue?: number;
  targetValueLeft?: number;
  targetValueRight?: number;
  column?: string;
  colorScheme?: string;
} & ConditionalFormattingConfigDodoExtended;

export type ConditionalFormattingControlProps = ControlComponentProps<
  ConditionalFormattingConfig[]
> & {
  columnOptions: { label: string; value: string }[];
  removeIrrelevantConditions: boolean;
  verboseMap: Record<string, string>;
  label: string;
  description: string;
  extraColorChoices?: { label: string; value: string }[];
};

export type FormattingPopoverProps = PopoverProps & {
  columns: { label: string; value: string }[];
  onChange: (value: ConditionalFormattingConfig) => void;
  config?: ConditionalFormattingConfig;
  title: string;
  children: ReactNode;
  extraColorChoices?: { label: string; value: string }[];
};
