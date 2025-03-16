// DODO was here
import { useTheme } from '@superset-ui/core';

// DODO changed 44211792
export const CheckboxChecked = ({ disabled }: { disabled?: boolean }) => {
  const theme = useTheme();
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 0H2C0.89 0 0 0.9 0 2V16C0 17.1 0.89 18 2 18H16C17.11 18 18 17.1 18 16V2C18 0.9 17.11 0 16 0Z"
        // fill={theme.colors.primary.base}
        fill={disabled ? '#ffe2cf' : theme.colors.primary.base} // DODO changed 44211792
      />
      <path
        d="M7 14L2 9L3.41 7.59L7 11.17L14.59 3.58L16 5L7 14Z"
        // fill="white"
        fill={disabled ? '#f5f5f5' : 'white'} // DODO changed 44211792
      />
    </svg>
  );
};

// DODO changed 44211792
export const CheckboxHalfChecked = ({ disabled }: { disabled?: boolean }) => {
  const theme = useTheme();
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 0H2C0.9 0 0 0.9 0 2V16C0 17.1 0.9 18 2 18H16C17.1 18 18 17.1 18 16V2C18 0.9 17.1 0 16 0Z"
        // fill={theme.colors.grayscale.light1}
        fill={disabled ? '#ffe2cf' : theme.colors.grayscale.light1} // DODO changed 44211792
      />
      <path
        d="M14 10H4V8H14V10Z"
        // fill="white"
        fill={disabled ? '#f5f5f5' : 'white'} // DODO changed 44211792
      />
    </svg>
  );
};

// DODO changed 44211792
export const CheckboxUnchecked = ({ disabled }: { disabled?: boolean }) => {
  const theme = useTheme();
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 0H2C0.9 0 0 0.9 0 2V16C0 17.1 0.9 18 2 18H16C17.1 18 18 17.1 18 16V2C18 0.9 17.1 0 16 0Z"
        fill={theme.colors.grayscale.light2}
      />
      <path
        d="M16 2V16H2V2H16V2Z"
        // fill="white"
        fill={disabled ? '#f5f5f5' : 'white'} // DODO changed 44211792
      />
    </svg>
  );
};
