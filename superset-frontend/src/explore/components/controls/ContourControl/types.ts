import { OptionValueType } from 'src/explore/components/controls/DndColumnSelectControl/types';
import { ControlComponentProps } from 'src/explore/components/Control';

export interface ColorType {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ContourType extends OptionValueType {
  color?: ColorType | undefined;
  lowerThreshold?: any | undefined;
  upperThreshold?: any | undefined;
  strokeWidth?: any | undefined;
}

export interface ErrorMapType {
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
  value?: ContourType;
  children?: React.ReactNode;
  saveContour: (contour: ContourType) => void;
  isControlled?: boolean;
  visible?: boolean;
  toggleVisibility?: (visibility: boolean) => void;
}

export interface ContourPopoverControlProps {
  description?: string;
  hovered?: boolean;
  value?: ContourType;
  onSave?: (contour: ContourType) => void;
  onClose?: () => void;
}

export interface ContourOptionProps {
  contour: ContourType;
  index: number;
  saveContour: (contour: ContourType) => void;
  onClose: (index: number) => void;
  onShift: (hoverIndex: number, dragIndex: number) => void;
}
