// @flow

// This file is intended for use in the GL-JS test suite
// It implements a MessageBus main thread interface for use in Node environments
// In a browser environment, this file is replaced with ./src/util/browser/web_worker.js
// when Rollup builds the main bundle.
// See https://github.com/mapbox/mapbox-gl-js/blob/master/package.json#L104-L108

import Worker from '../source/worker';

import type {WorkerSource} from '../source/worker_source';

type MessageListener = ({data: Object}) => mixed;

// The main thread interface. Provided by Worker in a browser environment,
// and MessageBus below in a node environment.
export interface WorkerInterface {
    addEventListener(type: 'message', listener: MessageListener): void;
    removeEventListener(type: 'message', listener: MessageListener): void;
    postMessage(message: any): void;
    terminate(): void;
}

export interface WorkerGlobalScopeInterface {
    importScripts(...urls: Array<string>): void;

    registerWorkerSource: (string, Class<WorkerSource>) => void,
    registerRTLTextPlugin: (any) => void
}

class MessageBus implements WorkerInterface, WorkerGlobalScopeInterface {
    addListeners: Array<MessageListener>;
    postListeners: Array<MessageListener>;
    target: MessageBus;
    registerWorkerSource: *;
    registerRTLTextPlugin: *;

    constructor(addListeners: Array<MessageListener>, postListeners: Array<MessageListener>) {
        this.addListeners = addListeners;
        this.postListeners = postListeners;
    }

    addEventListener(event: 'message', callback: MessageListener) {
        if (event === 'message') {
            this.addListeners.push(callback);
        }
    }

    removeEventListener(event: 'message', callback: MessageListener) {
        const i = this.addListeners.indexOf(callback);
        if (i >= 0) {
            this.addListeners.splice(i, 1);
        }
    }

    postMessage(data: Object) {
        setImmediate(() => {
            try {
                for (const listener of this.postListeners) {
                    listener({data, target: this.target});
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    terminate() {
        this.addListeners.splice(0, this.addListeners.length);
        this.postListeners.splice(0, this.postListeners.length);
    }

    importScripts() {}
}

export default function WebWorker(): WorkerInterface {
    const parentListeners = [],
        workerListeners = [],
        parentBus = new MessageBus(workerListeners, parentListeners),
        workerBus = new MessageBus(parentListeners, workerListeners);

    parentBus.target = workerBus;
    workerBus.target = parentBus;

    new WebWorker.Worker(workerBus);

    return parentBus;
}

// expose to allow stubbing in unit tests
WebWorker.Worker = Worker;
