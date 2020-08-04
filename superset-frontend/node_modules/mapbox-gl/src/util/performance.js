// @flow

import type {RequestParameters} from '../util/ajax';

// Wraps performance to facilitate testing
// Not incorporated into browser.js because the latter is poisonous when used outside the main thread
const performanceExists = typeof performance !== 'undefined';
const wrapper = {};

wrapper.getEntriesByName = (url: string) => {
    if (performanceExists && performance && performance.getEntriesByName)
        return performance.getEntriesByName(url);
    else
        return false;
};

wrapper.mark = (name: string) => {
    if (performanceExists && performance && performance.mark)
        return performance.mark(name);
    else
        return false;
};

wrapper.measure = (name: string, startMark: string, endMark: string) => {
    if (performanceExists && performance && performance.measure)
        return performance.measure(name, startMark, endMark);
    else
        return false;
};

wrapper.clearMarks = (name: string) => {
    if (performanceExists && performance && performance.clearMarks)
        return performance.clearMarks(name);
    else
        return false;
};

wrapper.clearMeasures = (name: string) => {
    if (performanceExists && performance && performance.clearMeasures)
        return performance.clearMeasures(name);
    else
        return false;
};

/**
 * Safe wrapper for the performance resource timing API in web workers with graceful degradation
 *
 * @param {RequestParameters} request
 * @private
 */
class Performance {
    _marks: {start: string, end: string, measure: string};

    constructor (request: RequestParameters) {
        this._marks = {
            start: [request.url, 'start'].join('#'),
            end: [request.url, 'end'].join('#'),
            measure: request.url.toString()
        };

        wrapper.mark(this._marks.start);
    }

    finish() {
        wrapper.mark(this._marks.end);
        let resourceTimingData = wrapper.getEntriesByName(this._marks.measure);

        // fallback if web worker implementation of perf.getEntriesByName returns empty
        if (resourceTimingData.length === 0) {
            wrapper.measure(this._marks.measure, this._marks.start, this._marks.end);
            resourceTimingData = wrapper.getEntriesByName(this._marks.measure);

            // cleanup
            wrapper.clearMarks(this._marks.start);
            wrapper.clearMarks(this._marks.end);
            wrapper.clearMeasures(this._marks.measure);
        }

        return resourceTimingData;
    }
}

wrapper.Performance = Performance;

export default wrapper;
