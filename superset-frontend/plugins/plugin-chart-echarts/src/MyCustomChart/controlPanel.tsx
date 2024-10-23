import React from 'react';
import { Form, Select, Checkbox } from 'antd'; // or any other UI library you're using
import { MyCustomChartFormData } from './types';

// Props interface
interface MyCustomChartControlProps {
  formData: MyCustomChartFormData; // The form data type
  setFormData: (data: MyCustomChartFormData) => void; // Function to update the form data
}

const MyCustomChartControl: React.FC<MyCustomChartControlProps> = ({
  formData,
  setFormData,
}) => {
  const handleMetricChange = (value: string) => {
    setFormData({ ...formData, metric: value });
  };

  const handleGroupByChange = (value: string[]) => {
    setFormData({ ...formData, groupby: value });
  };

  const handleShowLabelsChange = (e: any) => {
    setFormData({ ...formData, showLabels: e.target.checked });
  };

  return (
    <Form layout="vertical">
      <Form.Item label="Metric">
        <Select
          value={formData.metric}
          onChange={handleMetricChange}
          options={[
            { label: 'Metric 1', value: 'metric1' },
            { label: 'Metric 2', value: 'metric2' },
            // Add more metrics here
          ]}
        />
      </Form.Item>

      <Form.Item label="Group By">
        <Select
          mode="multiple"
          value={formData.groupby}
          onChange={handleGroupByChange}
          options={[
            { label: 'Category 1', value: 'category1' },
            { label: 'Category 2', value: 'category2' },
            // Add more categories here
          ]}
        />
      </Form.Item>

      <Form.Item>
        <Checkbox
          checked={formData.showLabels}
          onChange={handleShowLabelsChange}
        >
          Show Labels
        </Checkbox>
      </Form.Item>
    </Form>
  );
};

export default MyCustomChartControl;
