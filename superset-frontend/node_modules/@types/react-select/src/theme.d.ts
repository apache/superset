import { Theme } from './types';
export const borderRadius: number;

export const colors: {
  text: string;
  textLight: string;
  primary: string;
  primary75: string;
  primary50: string;
  primary25: string;
  danger: string;
  dangerLight: string;

  neutral0: string;
  neutral1: string;
  neutral2: string;
  neutral3: string;
  neutral4: string;
  neutral5: string;
  neutral10: string;
  neutral20: string;
  neutral30: string;
  neutral40: string;
  neutral50: string;
  neutral60: string;
  neutral70: string;
  neutral80: string;
  neutral90: string;
  neutral100: string;

  neutral1a: string;
  neutral2a: string;
  neutral3a: string;
  neutral4a: string;
  neutral5a: string;
  neutral10a: string;
  neutral20a: string;
  neutral30a: string;
  neutral40a: string;
  neutral50a: string;
  neutral60a: string;
  neutral70a: string;
  neutral80a: string;
  neutral90a: string;
};

export const spacing: {
  /* Used to calculate consistent margin/padding on elements */
  baseUnit: number,
  /* The minimum height of the control */
  controlHeight: number,
  /* The amount of space between the control and menu */
  menuGutter: number,
};

export const defaultTheme: Theme;

export type ThemeConfig = Theme | ((theme: Theme) => Theme);
