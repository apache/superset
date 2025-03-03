// DODO was here
// DODO created 45525377

export enum ValueToShowEnum {
  OLDEST = 'oldest',
  AVERAGE = 'average',
  LATEST = 'latest',
}

export enum AlignmentName {
  LEFT = 'left',
  CENTER = 'center',
  RIGHT = 'right',
}

export enum AlignmentValue {
  LEFT = 'flex-start',
  CENTER = 'center',
  RIGHT = 'flex-end',
}

export type ColorFormattersWithConditionalMessage = Array<{
  column: string;
  getColorFromValue: (value: number) => string | undefined;
  message?: string;
  messageRU?: string;
  messageEN?: string;
}>;
