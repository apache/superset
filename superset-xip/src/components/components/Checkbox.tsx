import React from 'react';
import FormItem from "./FormItem";
import { Checkbox } from 'antd';

export function CheckboxComponent({ field, handleFormInput, formData }) {
  return (
    <FormItem
      name={field.form_id}
      label={field.form_label}
      initialValue={field.field_value}
    >
      <Checkbox
        className="form-check-input"
        id={field.field_id}
        checked={formData[field.field_id]}
        onChange={(e) => handleFormInput(field.field_id, e.target.checked)}
      />
      <label className="form-label checkbox-label form-check-label" htmlFor={field.field_id}>
        <h4> {field.field_label} </h4>
      </label>
    </FormItem>
  );
}
