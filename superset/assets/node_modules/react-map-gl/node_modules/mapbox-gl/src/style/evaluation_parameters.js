// @flow

import ZoomHistory from './zoom_history';
import {isStringInSupportedScript} from '../util/script_detection';
import {plugin as rtlTextPlugin} from '../source/rtl_text_plugin';

import type {TransitionSpecification} from '../style-spec/types';

export type CrossfadeParameters = {
    fromScale: number,
    toScale: number,
    t: number
};

class EvaluationParameters {
    zoom: number;
    now: number;
    fadeDuration: number;
    zoomHistory: ZoomHistory;
    transition: TransitionSpecification;

    // "options" may also be another EvaluationParameters to copy, see CrossFadedProperty.possiblyEvaluate
    constructor(zoom: number, options?: *) {
        this.zoom = zoom;

        if (options) {
            this.now = options.now;
            this.fadeDuration = options.fadeDuration;
            this.zoomHistory = options.zoomHistory;
            this.transition = options.transition;
        } else {
            this.now = 0;
            this.fadeDuration = 0;
            this.zoomHistory = new ZoomHistory();
            this.transition = {};
        }
    }

    isSupportedScript(str: string): boolean {
        return isStringInSupportedScript(str, rtlTextPlugin.isLoaded());
    }

    crossFadingFactor() {
        if (this.fadeDuration === 0) {
            return 1;
        } else {
            return Math.min((this.now - this.zoomHistory.lastIntegerZoomTime) / this.fadeDuration, 1);
        }
    }

    getCrossfadeParameters(): CrossfadeParameters {
        const z = this.zoom;
        const fraction = z - Math.floor(z);
        const t = this.crossFadingFactor();

        return z > this.zoomHistory.lastIntegerZoom ?
            { fromScale: 2, toScale: 1, t: fraction + (1 - fraction) * t } :
            { fromScale: 0.5, toScale: 1, t: 1 - (1 - t) * fraction };
    }
}

export default EvaluationParameters;
