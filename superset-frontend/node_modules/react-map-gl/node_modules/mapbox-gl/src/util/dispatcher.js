// @flow

import { uniqueId, asyncAll } from './util';
import Actor from './actor';

import type WorkerPool from './worker_pool';

/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 *
 * @private
 */
class Dispatcher {
    workerPool: WorkerPool;
    actors: Array<Actor>;
    currentActor: number;
    id: number;

    // exposed to allow stubbing in unit tests
    static Actor: Class<Actor>;

    constructor(workerPool: WorkerPool, parent: any) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = uniqueId();
        const workers = this.workerPool.acquire(this.id);
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const actor = new Dispatcher.Actor(worker, parent, this.id);
            actor.name = `Worker ${i}`;
            this.actors.push(actor);
        }
    }

    /**
     * Broadcast a message to all Workers.
     */
    broadcast(type: string, data: mixed, cb?: Function) {
        cb = cb || function () {};
        asyncAll(this.actors, (actor, done) => {
            actor.send(type, data, done);
        }, cb);
    }

    /**
     * Send a message to a Worker.
     * @param targetID The ID of the Worker to which to send this message. Omit to allow the dispatcher to choose.
     * @returns The ID of the worker to which the message was sent.
     */
    send(type: string, data: mixed, callback?: ?Function, targetID?: number): number {
        if (typeof targetID !== 'number' || isNaN(targetID)) {
            // Use round robin to send requests to web workers.
            targetID = this.currentActor = (this.currentActor + 1) % this.actors.length;
        }

        this.actors[targetID].send(type, data, callback);
        return targetID;
    }

    remove() {
        this.actors.forEach((actor) => { actor.remove(); });
        this.actors = [];
        this.workerPool.release(this.id);
    }
}

Dispatcher.Actor = Actor;

export default Dispatcher;
