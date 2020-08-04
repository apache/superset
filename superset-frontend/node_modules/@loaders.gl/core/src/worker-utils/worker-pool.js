import WorkerThread from './worker-thread';

/**
 * Process multiple data messages with small pool of identical workers
 */
export default class WorkerPool {
  /**
   * @param processor {function | string} - worker function
   * @param maxConcurrency {number} - max count of workers
   */
  constructor({source, name = 'unnamed', maxConcurrency = 1, onMessage, onDebug = () => {}}) {
    this.source = source;
    this.name = name;
    this.maxConcurrency = maxConcurrency;
    this.onMessage = onMessage;
    this.onDebug = onDebug;

    this.jobQueue = [];
    this.idleQueue = [];
    this.count = 0;
    this.isDestroyed = false;
  }

  destroy() {
    // Destroy idle workers, active Workers will be destroyed on completion
    this.idleQueue.forEach(worker => worker.destroy());
    this.isDestroyed = true;
  }

  /**
   * Process binary data in a worker
   * @param data {data containing binary typed arrays} - data to be transferred to worker
   * @returns a Promise with data containing typed arrays transferred back from work
   */
  async process(data, jobName) {
    return new Promise((resolve, reject) => {
      this.jobQueue.push({data, jobName, resolve, reject});
      this._startQueuedJob();
    });
  }

  // PRIVATE

  _startQueuedJob() {
    if (!this.jobQueue.length) {
      return;
    }
    const worker = this._getAvailableWorker();
    if (!worker) {
      return;
    }

    // We have a worker, dequeue and start the job
    const job = this.jobQueue.shift();

    this.onDebug({
      message: 'processing',
      worker: worker.name,
      job: job.jobName,
      backlog: this.jobQueue.length
    });

    worker
      .process(job.data)
      .then(result => job.resolve(result))
      .catch(error => job.reject(error))
      .then(() => this._onWorkerDone(worker));
  }

  _onWorkerDone(worker) {
    if (this.isDestroyed) {
      worker.destroy();
    } else {
      this.idleQueue.push(worker);
      this._startQueuedJob();
    }
  }

  _getAvailableWorker() {
    // If a worker has completed and returned to the queue, it can be used
    if (this.idleQueue.length > 0) {
      return this.idleQueue.shift();
    }

    // Create fresh worker if we haven't yet created the max amount of worker threads for this worker source
    if (this.count < this.maxConcurrency) {
      this.count++;
      const name = `${this.name.toLowerCase()}-worker-${this.count}-of-${this.maxConcurrency}`;
      return new WorkerThread({source: this.source, onMessage: this.onMessage, name});
    }

    // No worker available, have to wait
    return null;
  }
}
