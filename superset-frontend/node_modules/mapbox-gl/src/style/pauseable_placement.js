// @flow

import browser from '../util/browser';

import { Placement } from '../symbol/placement';

import type Transform from '../geo/transform';
import type StyleLayer from './style_layer';
import type Tile from '../source/tile';

class LayerPlacement {
    _currentTileIndex: number;
    _tiles: Array<Tile>;
    _seenCrossTileIDs: { [string | number]: boolean };

    constructor() {
        this._currentTileIndex = 0;
        this._seenCrossTileIDs = {};
    }

    continuePlacement(tiles: Array<Tile>, placement: Placement, showCollisionBoxes: boolean, styleLayer: StyleLayer, shouldPausePlacement) {
        while (this._currentTileIndex < tiles.length) {
            const tile = tiles[this._currentTileIndex];
            placement.placeLayerTile(styleLayer, tile, showCollisionBoxes, this._seenCrossTileIDs);

            this._currentTileIndex++;
            if (shouldPausePlacement()) {
                return true;
            }
        }
    }
}

class PauseablePlacement {
    placement: Placement;
    _done: boolean;
    _currentPlacementIndex: number;
    _forceFullPlacement: boolean;
    _showCollisionBoxes: boolean;
    _inProgressLayer: ?LayerPlacement;

    constructor(transform: Transform, order: Array<string>,
                forceFullPlacement: boolean,
                showCollisionBoxes: boolean,
                fadeDuration: number,
                crossSourceCollisions: boolean) {

        this.placement = new Placement(transform, fadeDuration, crossSourceCollisions);
        this._currentPlacementIndex = order.length - 1;
        this._forceFullPlacement = forceFullPlacement;
        this._showCollisionBoxes = showCollisionBoxes;
        this._done = false;
    }

    isDone(): boolean {
        return this._done;
    }

    continuePlacement(order: Array<string>, layers: {[string]: StyleLayer}, layerTiles: {[string]: Array<Tile>}) {
        const startTime = browser.now();

        const shouldPausePlacement = () => {
            const elapsedTime = browser.now() - startTime;
            return this._forceFullPlacement ? false : elapsedTime > 2;
        };

        while (this._currentPlacementIndex >= 0) {
            const layerId = order[this._currentPlacementIndex];
            const layer = layers[layerId];
            const placementZoom = this.placement.collisionIndex.transform.zoom;
            if (layer.type === 'symbol' &&
                (!layer.minzoom || layer.minzoom <= placementZoom) &&
                (!layer.maxzoom || layer.maxzoom > placementZoom)) {

                if (!this._inProgressLayer) {
                    this._inProgressLayer = new LayerPlacement();
                }

                const pausePlacement = this._inProgressLayer.continuePlacement(layerTiles[layer.source], this.placement, this._showCollisionBoxes, layer, shouldPausePlacement);

                if (pausePlacement) {
                    // We didn't finish placing all layers within 2ms,
                    // but we can keep rendering with a partial placement
                    // We'll resume here on the next frame
                    return;
                }

                delete this._inProgressLayer;
            }

            this._currentPlacementIndex--;
        }

        this._done = true;
    }

    commit(previousPlacement: ?Placement, now: number) {
        this.placement.commit(previousPlacement, now);
        return this.placement;
    }
}

export default PauseablePlacement;
