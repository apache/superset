import {toArrayBuffer} from '../../javascript-utils/binary-utils';
import WorkerFarm from '../../worker-utils/worker-farm';
import {parse} from '../parse';

import {getTransferList} from '../../worker-utils/worker-utils';

let _workerFarm = null;

function getWorkerFarm(options = {}) {
  const props = {};
  if (options.maxConcurrency) {
    props.maxConcurrency = options.maxConcurrency;
  }
  if (options.onDebug) {
    props.onDebug = options.onDebug;
  }

  if (!_workerFarm) {
    _workerFarm = new WorkerFarm({onMessage: onWorkerMessage});
  }
  _workerFarm.setProps(props);

  return _workerFarm;
}

async function onWorkerMessage({worker, data, resolve, reject}) {
  switch (data.type) {
    case 'done':
      resolve(data.result);
      break;

    case 'process':
      try {
        const result = await parse(data.arraybuffer, data.options, data.url);
        worker.postMessage({type: 'process-done', id: data.id, result}, getTransferList(result));
      } catch (error) {
        worker.postMessage({type: 'process-error', id: data.id, message: error.message});
      }
      break;

    case 'error':
      reject(data.message);
      break;

    default:
    // TODO - is this not an error case? Log a warning?
  }
}

/**
 * this function expects that the worker function sends certain messages,
 * this can be automated if the worker is wrapper by a call to createWorker in @loaders.gl/loader-utils.
 */
export default function parseWithWorker(
  workerSource,
  workerName,
  data,
  options = {},
  context = {}
) {
  const workerFarm = getWorkerFarm(options);

  // options.log object contains functions which cannot be transferred
  // TODO - decide how to handle logging on workers
  options = JSON.parse(JSON.stringify(options));

  return workerFarm.process(workerSource, `loaders.gl-${workerName}`, {
    arraybuffer: toArrayBuffer(data),
    options,
    source: 'loaders.gl', // Lets worker ignore unrelated messages
    type: 'process' // For future extension
  });
}
