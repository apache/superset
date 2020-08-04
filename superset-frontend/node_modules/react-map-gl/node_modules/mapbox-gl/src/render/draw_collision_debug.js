// @flow

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type StyleLayer from '../style/style_layer';
import type {OverscaledTileID} from '../source/tile_id';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import CullFaceMode from '../gl/cull_face_mode';
import { collisionUniformValues } from './program/collision_program';

export default drawCollisionDebug;

function drawCollisionDebugGeometry(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<OverscaledTileID>, drawCircles: boolean) {
    const context = painter.context;
    const gl = context.gl;
    const program = drawCircles ? painter.useProgram('collisionCircle') : painter.useProgram('collisionBox');

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const tile = sourceCache.getTile(coord);
        const bucket: ?SymbolBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;
        const buffers = drawCircles ? bucket.collisionCircle : bucket.collisionBox;
        if (!buffers) continue;

        program.draw(context, drawCircles ? gl.TRIANGLES : gl.LINES,
            DepthMode.disabled, StencilMode.disabled,
            painter.colorModeForRenderPass(),
            CullFaceMode.disabled,
            collisionUniformValues(
                coord.posMatrix,
                painter.transform,
                tile),
            layer.id, buffers.layoutVertexBuffer, buffers.indexBuffer,
            buffers.segments, null, painter.transform.zoom, null, null,
            buffers.collisionVertexBuffer);
    }
}

function drawCollisionDebug(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<OverscaledTileID>) {
    drawCollisionDebugGeometry(painter, sourceCache, layer, coords, false);
    drawCollisionDebugGeometry(painter, sourceCache, layer, coords, true);
}
