import React, { useState, ChangeEvent } from 'react';

interface NumberInputProps {
  timeUnit: string;
  min: number;
  name: string;
  value: string | number;
  placeholder: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export default function NumberInput({
  timeUnit,
  min,
  name,
  value,
  placeholder,
  onChange,
}: NumberInputProps) {
  const [isFocused, setIsFocused] = useState<boolean>(false);

  return (
    <input
      type="text"
      min={min}
      name={name}
      value={value ? `${value}${!isFocused ? ` ${timeUnit}` : ''}` : ''}
      placeholder={placeholder}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={onChange}
    />
  );
}
