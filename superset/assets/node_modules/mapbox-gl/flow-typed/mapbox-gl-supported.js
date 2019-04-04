// @flow
'use strict';
declare module "@mapbox/mapbox-gl-supported" {
    declare type isSupported = (options?: {failIfMajorPerformanceCaveat: boolean}) => boolean;
    declare module.exports: isSupported;
}
