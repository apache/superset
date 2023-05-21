import { OptionValueType } from 'src/explore/components/controls/DndColumnSelectControl/types';
import { ControlComponentProps } from 'src/explore/components/Control';

export interface colorType {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface contourType extends OptionValueType {
  color?: colorType | undefined;
  lowerThreshold?: any | undefined;
  upperThreshold?: any | undefined;
  strokeWidth?: any | undefined;
}

export interface errorMapType {
  lowerThreshold: string[];
  upperThreshold: string[];
  strokeWidth: string[];
  color: string[];
}

export interface ContourControlProps
  extends ControlComponentProps<OptionValueType[]> {
  contours?: {};
}

export interface ContourPopoverTriggerProps {
  description?: string;
  hovered?: boolean;
  value?: contourType;
  children?: React.ReactNode;
  onChange?: (value: string) => void;
  saveContour: (contour: contourType) => void;
  isControlled?: boolean;
  visible?: boolean;
  toggleVisibility?: (visibility: boolean) => void;
}

export interface ContourPopoverControlProps {
  description?: string;
  hovered?: boolean;
  value?: contourType;
  onSave?: (contour: contourType) => void;
  onClose?: () => void;
}

export interface ContourOptionProps {
  contour: contourType;
  index: number;
  saveContour: (contour: contourType) => void;
  onClose: (index: number) => void;
  onShift: (hoverIndex: number, dragIndex: number) => void;
}
