// @flow

import DEMData from '../data/dem_data';

import type Actor from '../util/actor';
import type {
    WorkerDEMTileParameters,
    WorkerDEMTileCallback,
    TileParameters
} from './worker_source';


class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[string]: DEMData};

    constructor() {
        this.loaded = {};
    }

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData} = params;
        const dem = new DEMData(uid, rawImageData, encoding);

        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;
        callback(null, dem);
    }

    removeTile(params: TileParameters) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}

export default RasterDEMTileWorkerSource;
