export default function transformProps(chartProps) {
    console.log(chartProps);
    const { height , formData, payload , onAddFilter } = chartProps;
    return {
        height,
        formData,
        payload,
        onAddFilter
    };
  }
  