import React from 'react';
import FormItem from './FormItem';

export function Input({ field, handleFormInput, formData }) {
  return (
    <FormItem
      name={field.form_id}
      label={field.form_label}
      initialValue={field.field_value}
    >
      <label htmlFor={field.field_id} className="form-label">
        <h4>{field.field_label}</h4>
      </label>
      <input
        type="text"
        className="form-control"
        id={field.field_id}
        placeholder={field.field_placeholder ? field.field_placeholder : ''}
        value={formData[field.field_id]}
        onChange={(e) => handleFormInput(field.field_id, e.target.value)}
      />
    </FormItem>
  );
}
