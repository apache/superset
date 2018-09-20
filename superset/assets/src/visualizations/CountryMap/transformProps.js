export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const {
    linearColorScheme,
    numberFormat,
    selectCountry: country,
  } = formData;

  return {
    data: payload.data,
    country,
    linearColorScheme,
    numberFormat,
  };
}
