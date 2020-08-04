export type AutoSizeType = 'pad' | 'fit' | 'fit-x' | 'fit-y' | 'none';
export type AutoSize =
  | AutoSizeType
  | {
      type: AutoSizeType;
      resize?: boolean;
      contains?: 'content' | 'padding';
    };
