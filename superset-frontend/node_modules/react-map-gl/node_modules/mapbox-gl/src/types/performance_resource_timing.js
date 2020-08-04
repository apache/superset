// @flow

export type PerformanceResourceTiming = {
    connectEnd: number,
    connectStart: number,
    decodedBodySize: number,
    domainLookupEnd: number,
    domainLookupStart: number,
    duration: number,
    encodedBodySize: number,
    entryType: string,
    fetchStart: number,
    initiatorType: string,
    name: string,
    nextHopProtocol: string,
    redirectEnd: number,
    redirectStart: number,
    requestStart: number,
    responseEnd: number,
    responseStart: number,
    secureConnectionStart: number,
    startTime: number,
    transferSize: number,
    workerStart: number
};
