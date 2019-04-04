// @flow

import { register } from '../util/web_worker_transfer';

class OpacityState {
    opacity: number;
    targetOpacity: number;
    time: number

    constructor() {
        this.opacity = 0;
        this.targetOpacity = 0;
        this.time = 0;
    }

    clone() {
        const clone = new OpacityState();
        clone.opacity = this.opacity;
        clone.targetOpacity = this.targetOpacity;
        clone.time = this.time;
        return clone;
    }
}

register('OpacityState', OpacityState);

export default OpacityState;
