import WorkerPool from './worker-pool';

const DEFAULT_MAX_CONCURRENCY = 5;

/**
 * Process multiple data messages with a "farm" of different workers (in worker pools)
 */
export default class WorkerFarm {
  /**
   * @param processor {function | string} - worker function
   * @param maxConcurrency {number} - max count of workers
   */
  constructor({maxConcurrency = DEFAULT_MAX_CONCURRENCY, onMessage, onDebug = () => {}}) {
    this.maxConcurrency = maxConcurrency;
    this.onMessage = onMessage;
    this.onDebug = onDebug;
    this.workerPools = new Map();
  }

  setProps(props) {
    if ('maxConcurrency' in props) {
      this.maxConcurrency = props.maxConcurrency;
    }

    if ('onDebug' in props) {
      this.onDebug = props.onDebug;
    }
  }

  destroy() {
    this.workerPools.forEach(workerPool => workerPool.destroy());
  }

  /**
   * Process binary data in a worker
   * @param data {data containing binary typed arrays} - data to be transferred to worker
   * @returns a Promise with data containing typed arrays transferred back from work
   */
  async process(workerSource, workerName, data) {
    const workerPool = this._getWorkerPool(workerSource, workerName);
    return workerPool.process(data);
  }

  // PRIVATE

  _getWorkerPool(workerSource, workerName) {
    let workerPool = this.workerPools.get(workerName);
    if (!workerPool) {
      workerPool = new WorkerPool({
        source: workerSource,
        name: workerName,
        onMessage: this.onMessage,
        maxConcurrency: this.maxConcurrency,
        onDebug: this.onDebug
      });
      this.workerPools.set(workerName, workerPool);
    }
    return workerPool;
  }
}
