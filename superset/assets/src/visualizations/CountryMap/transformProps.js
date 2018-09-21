export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
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
