export type FontFamily =
    | string
    | {
        fontFamily: string;
        src: string;
        fontStyle?: string;
        fontWeight?: string | number;
      };
