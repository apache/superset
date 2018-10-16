export default function transformProps(chartProps) {
  const { formData, payload } = chartProps;
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
