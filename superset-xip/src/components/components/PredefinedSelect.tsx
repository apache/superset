import React from 'react';
import { Select } from 'antd';
import FormItem from "./FormItem";

export function PredefinedSelect({ field, handleFormInput, formData }) {
  const handleChange = (value: string) => {
    handleFormInput(field.field_id, value)
  };

  return (
    <FormItem
      name={field.form_id}
      label={field.form_label}
      initialValue={field.field_value}
    > <label htmlFor={field.field_id}>
        <h4> {field.field_label} </h4>
    </label>
      <Select
        id={field.field_id}
        defaultValue={formData[field.field_id]}
        onChange={handleChange}
        options={field.field_options.map((option) => {
          return {
            value: option.option_label,
            label: option.option_label
          }
        })}
      />
    </FormItem>
  );
}
