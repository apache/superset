'use strict';

if (typeof module !== 'undefined' && module.exports) {
    module.exports = isSupported;
} else if (window) {
    window.mapboxgl = window.mapboxgl || {};
    window.mapboxgl.supported = isSupported;
    window.mapboxgl.notSupportedReason = notSupportedReason;
}

/**
 * Test whether the current browser supports Mapbox GL JS
 * @param {Object} options
 * @param {boolean} [options.failIfMajorPerformanceCaveat=false] Return `false`
 *   if the performance of Mapbox GL JS would be dramatically worse than
 *   expected (i.e. a software renderer is would be used)
 * @return {boolean}
 */
function isSupported(options) {
    return !notSupportedReason(options);
}

function notSupportedReason(options) {
    if (!isBrowser()) return 'not a browser';
    if (!isArraySupported()) return 'insufficent Array support';
    if (!isFunctionSupported()) return 'insufficient Function support';
    if (!isObjectSupported()) return 'insufficient Object support';
    if (!isJSONSupported()) return 'insufficient JSON support';
    if (!isWorkerSupported()) return 'insufficient worker support';
    if (!isUint8ClampedArraySupported()) return 'insufficient Uint8ClampedArray support';
    if (!isArrayBufferSupported()) return 'insufficient ArrayBuffer support';
    if (!isCanvasGetImageDataSupported()) return 'insufficient Canvas/getImageData support';
    if (!isWebGLSupportedCached(options && options.failIfMajorPerformanceCaveat)) return 'insufficient WebGL support';
}

function isBrowser() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isArraySupported() {
    return (
        Array.prototype &&
        Array.prototype.every &&
        Array.prototype.filter &&
        Array.prototype.forEach &&
        Array.prototype.indexOf &&
        Array.prototype.lastIndexOf &&
        Array.prototype.map &&
        Array.prototype.some &&
        Array.prototype.reduce &&
        Array.prototype.reduceRight &&
        Array.isArray
    );
}

function isFunctionSupported() {
    return Function.prototype && Function.prototype.bind;
}

function isObjectSupported() {
    return (
        Object.keys &&
        Object.create &&
        Object.getPrototypeOf &&
        Object.getOwnPropertyNames &&
        Object.isSealed &&
        Object.isFrozen &&
        Object.isExtensible &&
        Object.getOwnPropertyDescriptor &&
        Object.defineProperty &&
        Object.defineProperties &&
        Object.seal &&
        Object.freeze &&
        Object.preventExtensions
    );
}

function isJSONSupported() {
    return 'JSON' in window && 'parse' in JSON && 'stringify' in JSON;
}

function isWorkerSupported() {
    if (!('Worker' in window && 'Blob' in window && 'URL' in window)) {
        return false;
    }

    var blob = new Blob([''], { type: 'text/javascript' });
    var workerURL = URL.createObjectURL(blob);
    var supported;
    var worker;

    try {
        worker = new Worker(workerURL);
        supported = true;
    } catch (e) {
        supported = false;
    }

    if (worker) {
        worker.terminate();
    }
    URL.revokeObjectURL(workerURL);

    return supported;
}

// IE11 only supports `Uint8ClampedArray` as of version
// [KB2929437](https://support.microsoft.com/en-us/kb/2929437)
function isUint8ClampedArraySupported() {
    return 'Uint8ClampedArray' in window;
}

// https://github.com/mapbox/mapbox-gl-supported/issues/19
function isArrayBufferSupported() {
    return ArrayBuffer.isView;
}

// Some browsers or browser extensions block access to canvas data to prevent fingerprinting.
// Mapbox GL uses this API to load sprites and images in general.
function isCanvasGetImageDataSupported() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) {
        return false;
    }
    const imageData = context.getImageData(0, 0, 1, 1);
    return imageData && imageData.width === canvas.width;
}

var isWebGLSupportedCache = {};
function isWebGLSupportedCached(failIfMajorPerformanceCaveat) {

    if (isWebGLSupportedCache[failIfMajorPerformanceCaveat] === undefined) {
        isWebGLSupportedCache[failIfMajorPerformanceCaveat] = isWebGLSupported(failIfMajorPerformanceCaveat);
    }

    return isWebGLSupportedCache[failIfMajorPerformanceCaveat];
}

isSupported.webGLContextAttributes = {
    antialias: false,
    alpha: true,
    stencil: true,
    depth: true
};

function getWebGLContext(failIfMajorPerformanceCaveat) {
    var canvas = document.createElement('canvas');

    var attributes = Object.create(isSupported.webGLContextAttributes);
    attributes.failIfMajorPerformanceCaveat = failIfMajorPerformanceCaveat;

    if (canvas.probablySupportsContext) {
        return (
            canvas.probablySupportsContext('webgl', attributes) ||
            canvas.probablySupportsContext('experimental-webgl', attributes)
        );

    } else if (canvas.supportsContext) {
        return (
            canvas.supportsContext('webgl', attributes) ||
            canvas.supportsContext('experimental-webgl', attributes)
        );

    } else {
        return (
            canvas.getContext('webgl', attributes) ||
            canvas.getContext('experimental-webgl', attributes)
        );
    }
}

function isWebGLSupported(failIfMajorPerformanceCaveat) {
    const gl = getWebGLContext(failIfMajorPerformanceCaveat);
    if (!gl) {
        return false;
    }

    // Try compiling a shader and get its compile status. Some browsers like Brave block this API
    // to prevent fingerprinting. Unfortunately, this also means that Mapbox GL won't work.
    const shader = gl.createShader(gl.VERTEX_SHADER);
    if (!shader || gl.isContextLost()) {
        return false;
    }
    gl.shaderSource(shader, 'void main() {}');
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true;
}
