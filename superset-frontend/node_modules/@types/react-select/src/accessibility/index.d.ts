export interface InstructionsContext { isSearchable?: boolean; isMulti?: boolean; label?: string; }
export interface ValueEventContext { value: string; }

export function instructionsAriaMessage(event: any, context?: InstructionsContext): string;

export function valueEventAriaMessage(event: any, context: ValueEventContext): string;

export function valueFocusAriaMessage({ focusedValue, getOptionLabel, selectValue }: any): string;
export function optionFocusAriaMessage({ focusedOption, getOptionLabel, options }: any): string;
export function resultsAriaMessage({ inputValue, screenReaderMessage }: any): string;
