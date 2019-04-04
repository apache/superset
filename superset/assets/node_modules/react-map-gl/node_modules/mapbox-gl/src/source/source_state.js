// @flow

import { extend } from '../util/util';
import Tile from './tile';
import type {FeatureState} from '../style-spec/expression';

export type FeatureStates = {[feature_id: string]: FeatureState};
export type LayerFeatureStates = {[layer: string]: FeatureStates};

/**
 * SourceFeatureState manages the state and state changes
 * to features in a source, separated by source layer.
 *
 * @private
*/
class SourceFeatureState {
    state: LayerFeatureStates;
    stateChanges: LayerFeatureStates;

    constructor() {
        this.state = {};
        this.stateChanges = {};
    }

    updateState(sourceLayer: string, featureId: number, state: Object) {
        const feature = String(featureId);
        this.stateChanges[sourceLayer] = this.stateChanges[sourceLayer] || {};
        this.stateChanges[sourceLayer][feature] = this.stateChanges[sourceLayer][feature] || {};
        extend(this.stateChanges[sourceLayer][feature], state);
    }

    getState(sourceLayer: string, featureId: number) {
        const feature = String(featureId);
        const base = this.state[sourceLayer] || {};
        const changes = this.stateChanges[sourceLayer] || {};
        return extend({}, base[feature], changes[feature]);
    }

    initializeTileState(tile: Tile, painter: any) {
        tile.setFeatureState(this.state, painter);
    }

    coalesceChanges(tiles: {[any]: Tile}, painter: any) {
        const changes: LayerFeatureStates = {};
        for (const sourceLayer in this.stateChanges) {
            this.state[sourceLayer]  = this.state[sourceLayer] || {};
            const layerStates = {};
            for (const id in this.stateChanges[sourceLayer]) {
                if (!this.state[sourceLayer][id]) {
                    this.state[sourceLayer][id] = {};
                }
                extend(this.state[sourceLayer][id], this.stateChanges[sourceLayer][id]);
                layerStates[id] = this.state[sourceLayer][id];
            }
            changes[sourceLayer] = layerStates;
        }
        this.stateChanges = {};
        if (Object.keys(changes).length === 0) return;

        for (const id in tiles) {
            const tile = tiles[id];
            tile.setFeatureState(changes, painter);
        }
    }
}

export default SourceFeatureState;
