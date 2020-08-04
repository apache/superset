// @flow

import WebWorker from './web_worker';
import type {WorkerInterface} from './web_worker';
import browser from './browser';

/**
 * Constructs a worker pool.
 * @private
 */
export default class WorkerPool {
    static workerCount: number;

    active: {[number]: boolean};
    workers: Array<WorkerInterface>;

    constructor() {
        this.active = {};
    }

    acquire(mapId: number): Array<WorkerInterface> {
        if (!this.workers) {
            // Lazily look up the value of mapboxgl.workerCount so that
            // client code has had a chance to set it.
            this.workers = [];
            while (this.workers.length < WorkerPool.workerCount) {
                this.workers.push(new WebWorker());
            }
        }

        this.active[mapId] = true;
        return this.workers.slice();
    }

    release(mapId: number) {
        delete this.active[mapId];
        if (Object.keys(this.active).length === 0) {
            this.workers.forEach((w) => {
                w.terminate();
            });
            this.workers = (null: any);
        }
    }
}

const availableLogicalProcessors = Math.floor(browser.hardwareConcurrency / 2);
WorkerPool.workerCount = Math.max(Math.min(availableLogicalProcessors, 6), 1);
