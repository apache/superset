export default function transformProps(basicChartInput) {
  const { formData, payload } = basicChartInput;
  const {
    groupby,
    liftvaluePrecision,
    metrics,
    pvaluePrecision,
    significanceLevel,
  } = formData;

  return {
    data: payload.data,
    alpha: significanceLevel,
    groups: groupby,
    liftValPrec: parseInt(liftvaluePrecision, 10),
    metrics,
    pValPrec: parseInt(pvaluePrecision, 10),
  };
}
