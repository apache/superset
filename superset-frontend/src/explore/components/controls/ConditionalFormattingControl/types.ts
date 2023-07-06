// DODO was here

import { ReactNode } from 'react';
import { PopoverProps } from 'antd/lib/popover';
import { ControlComponentProps } from '@superset-ui/chart-controls';

export enum COMPARATOR {
  NONE = 'None',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  GREATER_OR_EQUAL = '≥',
  LESS_OR_EQUAL = '≤',
  EQUAL = '=',
  NOT_EQUAL = '≠',
  BETWEEN = '< x <',
  BETWEEN_OR_EQUAL = '≤ x ≤',
  BETWEEN_OR_LEFT_EQUAL = '≤ x <',
  BETWEEN_OR_RIGHT_EQUAL = '< x ≤',
}

export const MULTIPLE_VALUE_COMPARATORS = [
  COMPARATOR.BETWEEN,
  COMPARATOR.BETWEEN_OR_EQUAL,
  COMPARATOR.BETWEEN_OR_LEFT_EQUAL,
  COMPARATOR.BETWEEN_OR_RIGHT_EQUAL,
];

export type ConditionalFormattingConfig = {
  operator?: COMPARATOR;
  targetValue?: number;
  targetValueLeft?: number;
  targetValueRight?: number;
  column?: string;
  colorScheme?: string;
  // DODO changed
  isFixedColor?: boolean;
};

export type ConditionalFormattingControlProps = ControlComponentProps<
  ConditionalFormattingConfig[]
> & {
  columnOptions: { label: string; value: string }[];
  verboseMap: Record<string, string>;
  label: string;
  description: string;
};

export type FormattingPopoverProps = PopoverProps & {
  columns: { label: string; value: string }[];
  onChange: (value: ConditionalFormattingConfig) => void;
  config?: ConditionalFormattingConfig;
  title: string;
  children: ReactNode;
};
