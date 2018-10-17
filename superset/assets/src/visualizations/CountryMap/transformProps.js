export default function transformProps(chartProps) {
  const { width, height, formData, payload } = chartProps;
  const {
    linearColorScheme,
    numberFormat,
    selectCountry,
  } = formData;

  return {
    width,
    height,
    data: payload.data,
    country: selectCountry,
    linearColorScheme,
    numberFormat,
  };
}
