// @flow

import { OverscaledTileID, CanonicalTileID } from '../source/tile_id';

import type Tile from './../source/tile';
import type Context from '../gl/context';

type Mask = {
    [number]: CanonicalTileID
};

// Updates the TileMasks for all renderable tiles. A TileMask describes all regions
// within that tile that are *not* covered by other renderable tiles.
// Example: renderableTiles in our list are 2/1/3, 3/3/6, and 4/5/13. The schematic for creating the
// TileMask for 2/1/3 looks like this:
//
//    ┌────────┬────────┬─────────────────┐
//    │        │        │#################│
//    │ 4/4/12 │ 4/5/12 │#################│
//    │        │        │#################│
//    ├──────3/2/6──────┤#####3/3/6#######│
//    │        │########│#################│
//    │ 4/4/13 │#4/5/13#│#################│
//    │        │########│#################│
//    ├────────┴──────2/1/3───────────────┤
//    │                 │                 │
//    │                 │                 │
//    │                 │                 │
//    │      3/2/7      │      3/3/7      │
//    │                 │                 │
//    │                 │                 │
//    │                 │                 │
//    └─────────────────┴─────────────────┘
//
// The TileMask for 2/1/3 thus consists of the tiles 4/4/12, 4/5/12, 4/4/13, 3/2/7, and 3/3/7,
// but it does *not* include 4/5/13, and 3/3/6, since these are other renderableTiles.
// A TileMask always contains TileIDs *relative* to the tile it is generated for, so 2/1/3 is
// "subtracted" from these TileIDs. The final TileMask for 2/1/3 will thus be:
//
//    ┌────────┬────────┬─────────────────┐
//    │        │        │#################│
//    │ 2/0/0  │ 2/1/0  │#################│
//    │        │        │#################│
//    ├────────┼────────┤#################│
//    │        │########│#################│
//    │ 2/0/1  │########│#################│
//    │        │########│#################│
//    ├────────┴────────┼─────────────────┤
//    │                 │                 │
//    │                 │                 │
//    │                 │                 │
//    │      1/0/1      │      1/1/1      │
//    │                 │                 │
//    │                 │                 │
//    │                 │                 │
//    └─────────────────┴─────────────────┘
//
// Only other renderable tiles that are *children* of the tile we are generating the mask for will
// be considered. For example, adding TileID 4/8/13 to renderableTiles won't affect the TileMask for
// 2/1/3, since it is not a descendant of it.


export default function(renderableTiles: Array<Tile>, context: Context) {
    const sortedRenderables = renderableTiles.sort((a, b) => { return a.tileID.isLessThan(b.tileID) ? -1 : b.tileID.isLessThan(a.tileID) ? 1 : 0; });

    for (let i = 0; i < sortedRenderables.length; i++) {
        const mask = {};
        const tile =  sortedRenderables[i];
        const childArray = sortedRenderables.slice(i + 1);
        // Try to add all remaining ids as children. We sorted the tile list
        // by z earlier, so all preceding items cannot be children of the current
        // tile. We also compute the lower bound of the next wrap, because items of the next wrap
        // can never be children of the current wrap.

        computeTileMasks(tile.tileID.wrapped(), tile.tileID, childArray, new OverscaledTileID(0, tile.tileID.wrap + 1, 0, 0, 0), mask);
        tile.setMask(mask, context);
    }
}

function computeTileMasks(rootTile: OverscaledTileID, ref: OverscaledTileID, childArray: Array<Tile>, lowerBound: OverscaledTileID, mask: Mask) {
    // If the reference or any of its children is found in the list, we need to recurse.
    for (let i = 0; i < childArray.length; i++) {
        const childTile = childArray[i];
        // childTile is from a larger wrap than the rootTile so it cannot be a child tile
        if (lowerBound.isLessThan(childTile.tileID)) break;
        // The current tile is masked out, so we don't need to add them to the mask set.
        if (ref.key === childTile.tileID.key) {
            return;
        } else if (childTile.tileID.isChildOf(ref)) {
            // There's at least one child tile that is masked out, so recursively descend
            const children = ref.children(Infinity);
            for (let j = 0; j < children.length; j++) {
                const child = children[j];
                computeTileMasks(rootTile, child, childArray.slice(i), lowerBound, mask);
            }
            return;
        }
    }
    // We couldn't find a child, so it's definitely a masked part.
    // Compute the difference between the root tile ID and the reference tile ID, since TileMask
    // elements are always relative (see below for explanation).
    const diffZ = ref.overscaledZ - rootTile.overscaledZ;
    const maskTileId = new CanonicalTileID(diffZ, ref.canonical.x - (rootTile.canonical.x << diffZ), ref.canonical.y - (rootTile.canonical.y << diffZ));
    mask[maskTileId.key] = mask[maskTileId.key] || maskTileId;
}
