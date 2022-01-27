import { TIME_COLUMN } from './utils';
export const resampleOperator = (formData, queryObject) => {
    const resampleZeroFill = formData.resample_method === 'zerofill';
    const resampleMethod = resampleZeroFill ? 'asfreq' : formData.resample_method;
    const resampleRule = formData.resample_rule;
    if (resampleMethod && resampleRule) {
        return {
            operation: 'resample',
            options: {
                method: resampleMethod,
                rule: resampleRule,
                fill_value: resampleZeroFill ? 0 : null,
                time_column: TIME_COLUMN,
            },
        };
    }
    return undefined;
};
//# sourceMappingURL=resampleOperator.js.map