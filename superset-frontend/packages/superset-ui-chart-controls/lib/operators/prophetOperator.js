export const prophetOperator = (formData, queryObject) => {
    if (formData.forecastEnabled) {
        return {
            operation: 'prophet',
            options: {
                time_grain: formData.time_grain_sqla,
                periods: parseInt(formData.forecastPeriods, 10),
                confidence_interval: parseFloat(formData.forecastInterval),
                yearly_seasonality: formData.forecastSeasonalityYearly,
                weekly_seasonality: formData.forecastSeasonalityWeekly,
                daily_seasonality: formData.forecastSeasonalityDaily,
            },
        };
    }
    return undefined;
};
//# sourceMappingURL=prophetOperator.js.map