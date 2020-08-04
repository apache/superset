/* global Worker */
import {getWorkerURL, getTransferList} from './worker-utils';

let count = 0;

// By default resolves to the first message the worker sends back
function defaultOnMessage({data, resolve}) {
  resolve(data);
}

export default class WorkerThread {
  constructor({source, name = `web-worker-${count++}`, onMessage}) {
    const url = getWorkerURL(source);
    this.worker = new Worker(url, {name});
    this.name = name;
    this.onMessage = onMessage || defaultOnMessage;
  }

  /**
   * Process binary data in a worker
   * @param data {data containing binary typed arrays} - data to be transferred to worker
   * @returns a Promise with data containing typed arrays transferred back from work
   */
  async process(data) {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = event =>
        this.onMessage({worker: this.worker, data: event.data, resolve, reject});
      this.worker.onerror = error => reject(error);
      const transferList = getTransferList(data);
      this.worker.postMessage(data, transferList);
    });
  }

  destroy() {
    this.worker.terminate();
    this.worker = null;
  }
}
