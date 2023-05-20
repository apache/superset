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
  lowerThreshold?: number | undefined;
  upperThreshold?: number | undefined;
  strokeWidth?: number | undefined;
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
  onEdit?: () => void;
  saveContour: (contour: contourType) => void;
  isControlled?: boolean;
  visible?: boolean;
  toggleVisibility?: (visibility: boolean) => void;
}

export interface ContourPopoverControlProps {
  description?: string;
  hovered?: boolean;
  value?: contourType;
  onChange?: (value: string) => void;
  onSave?: (contour: contourType) => void;
  onClose?: () => void;
}

export interface ContourOptionProps {
  contour: contourType;
  index: number;
  onClose: (index: number) => void;
  onShift: (hoverIndex: number, dragIndex: number) => void;
}
