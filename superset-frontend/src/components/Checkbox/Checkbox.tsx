// DODO was here
import { CSSProperties } from 'react';
import { styled } from '@superset-ui/core';
import { CheckboxChecked, CheckboxUnchecked } from 'src/components/Checkbox';

interface CheckboxPropsDodoExtended {
  disabled?: boolean; // DODO added 44211792
}
export interface CheckboxProps extends CheckboxPropsDodoExtended {
  checked: boolean;
  onChange: (val?: boolean) => void;
  style?: CSSProperties;
  className?: string;
}

const Styles = styled.span`
  &,
  & svg {
    vertical-align: top;
  }
`;

export default function Checkbox({
  checked,
  onChange,
  style,
  className,
  disabled,
}: CheckboxProps) {
  return (
    <Styles
      style={style}
      onClick={() => {
        onChange(!checked);
      }}
      role="checkbox"
      tabIndex={0}
      aria-checked={checked}
      aria-label="Checkbox"
      className={className || ''}
    >
      {/* {checked ? <CheckboxChecked /> : <CheckboxUnchecked />} */}
      {checked ? (
        <CheckboxChecked disabled={disabled} />
      ) : (
        <CheckboxUnchecked disabled={disabled} />
      )}
    </Styles>
  );
}
