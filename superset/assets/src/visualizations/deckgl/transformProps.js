export default function transformProps(chartProps) {
  const {
    width,
    height,
    rawFormData,
    payload,
    setControlValue,
    onAddFilter,
    setTooltip,
  } = chartProps;

  return {
    formData: rawFormData,
    payload,
    setControlValue,
    viewport: {
      ...rawFormData.viewport,
      width,
      height,
    },
    onAddFilter,
    setTooltip,
  };
}
