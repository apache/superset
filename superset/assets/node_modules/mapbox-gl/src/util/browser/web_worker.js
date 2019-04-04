// @flow

import window from '../window';
import mapboxgl from '../../';

import type {WorkerInterface} from '../web_worker';

export default function (): WorkerInterface {
    return (new window.Worker(mapboxgl.workerUrl): any);
}
