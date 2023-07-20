import React from 'react';
import cubejs from "@cubejs-client/core";
import {HandlebarsViewer} from "../Handlebars/HandlebarsViewer";
import {Select} from "antd";
import FormItem from "./FormItem";

export function CubeSelect({ field, handleFormInput, formData }) {
  const [selectOptions, setSelectOptions] = React.useState([]);

  const options = {
    apiToken: 'd60cb603dde98ba3037f2de9eda44938',
    apiUrl: 'http://93.119.15.212:4000/cubejs-api/v1',
  };

  const sortDimention = field.field_options.findIndex((option) => option.sort !== undefined);
  
  let labelIndex = field.field_options.findIndex((option) => option.show === true);
  labelIndex = labelIndex === -1 ? 0 : labelIndex;

  const order = {};
  if (sortDimention !== -1) {
    order[field.field_options[sortDimention].dimentions] = field.field_options[sortDimention].sort;
  }

  const handleChange = (value: string) => {
    handleFormInput(field.field_id, value)
  };

  const cubejsApi = cubejs(options.apiToken, options);
  cubejsApi
    .load({
      dimensions: field.field_options.map((option) => option.dimentions),
      order,
    })
    .then((result) => {
      setSelectOptions(result.loadResponse.results[0].data.map((item) =>  {
        return {
          value: JSON.stringify(item),
          label: item[field.field_options[labelIndex].dimentions]
        }
      }));
    });

  return (
    <FormItem
      name={field.form_id}
      label={field.form_label}
      initialValue={field.field_value}
    >
      <label htmlFor={field.field_id} className="form-label">
        <h4>{field.field_label}</h4>
      </label>
      <Select
        defaultValue={field.field_value}
        onChange={handleChange}
        options={selectOptions}
      />
    </FormItem>
  );
}
