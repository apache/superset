import React from 'react';
import { CheckboxComponent } from './components/Checkbox';
import { Input } from './components/Input';
import { PredefinedSelect } from './components/PredefinedSelect';
import { CubeSelect } from "./components/CubeSelect";
import { Number } from "./components/Number";

export function FormComponent({ field, handleFormInput, formData, filters }) {
  switch (field.field_type) {
    case 'text':
      return (
        <Input
          field={field}
          formData={formData}
          handleFormInput={handleFormInput}
        />
      );
    case 'number':
      return (
        <Number
          field={field}
          formData={formData}
          handleFormInput={handleFormInput}
        />
      );
    case 'select':
      return (
        <PredefinedSelect
          field={field}
          formData={formData}
          handleFormInput={handleFormInput}
        />
      );
    case 'cube-select':
      return (
        <CubeSelect
          field={field}
          formData={formData}
          handleFormInput={handleFormInput}
          filters={filters}
        />
      );
    case 'checkbox':
      return (
        <CheckboxComponent
          field={field}
          formData={formData}
          handleFormInput={handleFormInput}
        />
      );
    default:
      return null;
  }
}
