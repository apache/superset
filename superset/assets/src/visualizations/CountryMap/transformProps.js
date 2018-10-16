export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
  const {
    linearColorScheme,
    numberFormat,
    selectCountry,
  } = formData;

  return {
    data: payload.data,
    country: selectCountry,
    linearColorScheme,
    numberFormat,
  };
}
