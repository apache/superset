// @flow

import { bindAll } from './util';
import { serialize, deserialize } from './web_worker_transfer';

import type {Transferable} from '../types/transferable';
import type {Cancelable} from '../types/cancelable';

/**
 * An implementation of the [Actor design pattern](http://en.wikipedia.org/wiki/Actor_model)
 * that maintains the relationship between asynchronous tasks and the objects
 * that spin them off - in this case, tasks like parsing parts of styles,
 * owned by the styles
 *
 * @param {WebWorker} target
 * @param {WebWorker} parent
 * @param {string|number} mapId A unique identifier for the Map instance using this Actor.
 * @private
 */
class Actor {
    target: any;
    parent: any;
    mapId: string;
    callbacks: any;
    callbackID: number;
    name: string;

    constructor(target: any, parent: any, mapId: any) {
        this.target = target;
        this.parent = parent;
        this.mapId = mapId;
        this.callbacks = {};
        this.callbackID = 0;
        bindAll(['receive'], this);
        this.target.addEventListener('message', this.receive, false);
    }

    /**
     * Sends a message from a main-thread map to a Worker or from a Worker back to
     * a main-thread map instance.
     *
     * @param type The name of the target method to invoke or '[source-type].[source-name].name' for a method on a WorkerSource.
     * @param targetMapId A particular mapId to which to send this message.
     * @private
     */
    send(type: string, data: mixed, callback: ?Function, targetMapId: ?string): ?Cancelable {
        const id = callback ? `${this.mapId}:${this.callbackID++}` : null;
        if (callback) this.callbacks[id] = callback;
        const buffers: Array<Transferable> = [];
        this.target.postMessage({
            targetMapId,
            sourceMapId: this.mapId,
            type,
            id: String(id),
            data: serialize(data, buffers)
        }, buffers);
        if (callback) {
            return {
                cancel: () => {
                    // Set the callback to null so that it never fires after the request is aborted.
                    this.callbacks[id] = null;
                    this.target.postMessage({
                        targetMapId,
                        sourceMapId: this.mapId,
                        type: '<cancel>',
                        id: String(id)
                    });
                }
            };
        }
    }

    receive(message: Object) {
        const data = message.data,
            id = data.id;
        let callback;

        if (data.targetMapId && this.mapId !== data.targetMapId)
            return;

        const done = (err, data) => {
            delete this.callbacks[id];
            const buffers: Array<Transferable> = [];
            this.target.postMessage({
                sourceMapId: this.mapId,
                type: '<response>',
                id: String(id),
                error: err ? serialize(err) : null,
                data: serialize(data, buffers)
            }, buffers);
        };

        if (data.type === '<response>' || data.type === '<cancel>') {
            callback = this.callbacks[data.id];
            delete this.callbacks[data.id];
            if (callback && data.error) {
                callback(deserialize(data.error));
            } else if (callback) {
                callback(null, deserialize(data.data));
            }
        } else if (typeof data.id !== 'undefined' && this.parent[data.type]) {
            // data.type == 'loadTile', 'removeTile', etc.
            // Add a placeholder so that we can discover when the done callback was called already.
            this.callbacks[data.id] = null;
            const cancelable = this.parent[data.type](data.sourceMapId, deserialize(data.data), done);
            if (cancelable && this.callbacks[data.id] === null) {
                // Only add the cancelable callback if the done callback wasn't already called.
                // Otherwise we will never be able to delete it.
                this.callbacks[data.id] = cancelable.cancel;
            }
        } else if (typeof data.id !== 'undefined' && this.parent.getWorkerSource) {
            // data.type == sourcetype.method
            const keys = data.type.split('.');
            const params = (deserialize(data.data): any);
            const workerSource = (this.parent: any).getWorkerSource(data.sourceMapId, keys[0], params.source);
            workerSource[keys[1]](params, done);
        } else {
            this.parent[data.type](deserialize(data.data));
        }
    }

    remove() {
        this.target.removeEventListener('message', this.receive, false);
    }
}

export default Actor;
