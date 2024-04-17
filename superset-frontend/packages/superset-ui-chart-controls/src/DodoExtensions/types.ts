// DODO was here

type ConditionalFormattingConfigDodo = {
  isFixedColor?: boolean;
  messageRU?: string;
  messageEN?: string;
};

type ColorFormattersWithConditionalMessage = Array<{
  column: string;
  getColorFromValue: (value: number) => string | undefined;
  message?: string;
  messageRU?: string;
  messageEN?: string;
}>;

export type {
  ConditionalFormattingConfigDodo,
  ColorFormattersWithConditionalMessage,
};
