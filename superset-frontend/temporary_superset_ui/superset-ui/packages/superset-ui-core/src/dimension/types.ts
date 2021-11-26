export interface TextStyle {
  font?: string;
  fontFamily?: string;
  fontSize?: string | number;
  fontStyle?: string;
  fontWeight?: string | number;
  letterSpacing?: string | number;
}

export interface Margin {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Dimension {
  width: number;
  height: number;
}

export default {};
