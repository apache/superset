import { ForecastSeriesEnum, } from '../types';
import { sanitizeHtml } from './series';
const seriesTypeRegex = new RegExp(`(.+)(${ForecastSeriesEnum.ForecastLower}|${ForecastSeriesEnum.ForecastTrend}|${ForecastSeriesEnum.ForecastUpper})$`);
export const extractForecastSeriesContext = (seriesName) => {
    const name = seriesName;
    const regexMatch = seriesTypeRegex.exec(name);
    if (!regexMatch)
        return { name, type: ForecastSeriesEnum.Observation };
    return {
        name: regexMatch[1],
        type: regexMatch[2],
    };
};
export const extractForecastSeriesContexts = (seriesNames) => seriesNames.reduce((agg, name) => {
    const context = extractForecastSeriesContext(name);
    const currentContexts = agg[context.name] || [];
    currentContexts.push(context.type);
    return { ...agg, [context.name]: currentContexts };
}, {});
export const extractProphetValuesFromTooltipParams = (params) => {
    const values = {};
    params.forEach(param => {
        const { marker, seriesId, value } = param;
        const context = extractForecastSeriesContext(seriesId);
        const numericValue = value[1];
        if (numericValue) {
            if (!(context.name in values))
                values[context.name] = {
                    marker: marker || '',
                };
            const prophetValues = values[context.name];
            if (context.type === ForecastSeriesEnum.Observation)
                prophetValues.observation = numericValue;
            if (context.type === ForecastSeriesEnum.ForecastTrend)
                prophetValues.forecastTrend = numericValue;
            if (context.type === ForecastSeriesEnum.ForecastLower)
                prophetValues.forecastLower = numericValue;
            if (context.type === ForecastSeriesEnum.ForecastUpper)
                prophetValues.forecastUpper = numericValue;
        }
    });
    return values;
};
export const formatProphetTooltipSeries = ({ seriesName, observation, forecastTrend, forecastLower, forecastUpper, marker, formatter, }) => {
    let row = `${marker}${sanitizeHtml(seriesName)}: `;
    let isObservation = false;
    if (observation) {
        isObservation = true;
        row += `${formatter(observation)}`;
    }
    if (forecastTrend) {
        if (isObservation)
            row += ', ';
        row += `ŷ = ${formatter(forecastTrend)}`;
    }
    if (forecastLower && forecastUpper)
        // the lower bound needs to be added to the upper bound
        row = `${row.trim()} (${formatter(forecastLower)}, ${formatter(forecastLower + forecastUpper)})`;
    return `${row.trim()}`;
};
export function rebaseTimeseriesDatum(data, verboseMap = {}) {
    const keys = data.length > 0 ? Object.keys(data[0]) : [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data.map(row => {
        const newRow = { __timestamp: '' };
        keys.forEach(key => {
            const forecastContext = extractForecastSeriesContext(key);
            const lowerKey = `${forecastContext.name}${ForecastSeriesEnum.ForecastLower}`;
            let value = row[key];
            if (forecastContext.type === ForecastSeriesEnum.ForecastUpper &&
                keys.includes(lowerKey) &&
                value !== null &&
                row[lowerKey] !== null) {
                value -= row[lowerKey];
            }
            const newKey = key !== '__timestamp' && verboseMap[key] ? verboseMap[key] : key;
            newRow[newKey] = value;
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return newRow;
    });
}
//# sourceMappingURL=prophet.js.map