export type Element = string;
export interface BaseBinding {
  type?: string;
  element?: Element;
  debounce?: number;
  name?: string;
}
export interface InputBinding extends BaseBinding {
  input?: string;
  placeholder?: string;
  autocomplete?: string;
}
export interface BindCheckbox extends BaseBinding {
  input: 'checkbox';
}
export interface BindRadioSelect extends BaseBinding {
  input: 'radio' | 'select';
  options: any[];
  labels?: string[];
}
export interface BindRange extends BaseBinding {
  input: 'range';
  min?: number;
  max?: number;
  step?: number;
}
export type Binding = BindCheckbox | BindRadioSelect | BindRange | InputBinding;
