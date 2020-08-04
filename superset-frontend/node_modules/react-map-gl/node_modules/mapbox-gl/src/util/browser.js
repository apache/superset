// @flow

import window from './window';
import type { Cancelable } from '../types/cancelable';

const now = window.performance && window.performance.now ?
    window.performance.now.bind(window.performance) :
    Date.now.bind(Date);

const raf = window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame;

const cancel = window.cancelAnimationFrame ||
    window.mozCancelAnimationFrame ||
    window.webkitCancelAnimationFrame ||
    window.msCancelAnimationFrame;

let linkEl;

/**
 * @private
 */
const exported = {
    /**
     * Provides a function that outputs milliseconds: either performance.now()
     * or a fallback to Date.now()
     */
    now,

    frame(fn: Function): Cancelable {
        const frame = raf(fn);
        return { cancel: () => cancel(frame) };
    },

    getImageData(img: CanvasImageSource): ImageData {
        const canvas = window.document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('failed to create canvas 2d context');
        }
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        return context.getImageData(0, 0, img.width, img.height);
    },

    resolveURL(path: string) {
        if (!linkEl) linkEl = window.document.createElement('a');
        linkEl.href = path;
        return linkEl.href;
    },

    hardwareConcurrency: window.navigator.hardwareConcurrency || 4,
    get devicePixelRatio() { return window.devicePixelRatio; }
};

export default exported;
