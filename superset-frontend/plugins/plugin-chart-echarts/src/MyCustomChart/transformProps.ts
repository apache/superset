import { MyCustomChartFormData, MyCustomChartTransformedProps } from './types';

export function transformProps(
  formData: MyCustomChartFormData,
  rawData: any, // Replace `any` with the actual type of your raw data
  height: number, // Add height parameter
  width: number, // Add width parameter
  echartOptions: any, // Add echartOptions parameter
  refs: any, // Add refs parameter
): MyCustomChartTransformedProps {
  const transformedData = rawData.map((item: any) => ({
    label: item.label,
    value: item.value,
  }));

  return {
    data: transformedData,
    formData: formData, // Include the formData
    height: height, // Include the height
    width: width, // Include the width
    echartOptions: echartOptions, // Include echartOptions
    refs: refs, // Include refs
  };
}
