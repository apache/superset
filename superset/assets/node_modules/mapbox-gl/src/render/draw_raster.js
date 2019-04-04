// @flow

import { clamp } from '../util/util';

import ImageSource from '../source/image_source';
import browser from '../util/browser';
import StencilMode from '../gl/stencil_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import { rasterUniformValues } from './program/raster_program';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type RasterStyleLayer from '../style/style_layer/raster_style_layer';
import type {OverscaledTileID} from '../source/tile_id';

export default drawRaster;

function drawRaster(painter: Painter, sourceCache: SourceCache, layer: RasterStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;
    if (layer.paint.get('raster-opacity') === 0) return;

    const context = painter.context;
    const gl = context.gl;
    const source = sourceCache.getSource();
    const program = painter.useProgram('raster');

    const stencilMode = StencilMode.disabled;
    const colorMode = painter.colorModeForRenderPass();
    const minTileZ = coords.length && coords[0].overscaledZ;
    const align = !painter.options.moving;
    for (const coord of coords) {
        // Set the lower zoom level to sublayer 0, and higher zoom levels to higher sublayers
        // Use gl.LESS to prevent double drawing in areas where tiles overlap.
        const depthMode = painter.depthModeForSublayer(coord.overscaledZ - minTileZ,
            layer.paint.get('raster-opacity') === 1 ? DepthMode.ReadWrite : DepthMode.ReadOnly, gl.LESS);

        const tile = sourceCache.getTile(coord);
        const posMatrix = painter.transform.calculatePosMatrix(coord.toUnwrapped(), align);

        tile.registerFadeDuration(layer.paint.get('raster-fade-duration'));

        const parentTile = sourceCache.findLoadedParent(coord, 0),
            fade = getFadeValues(tile, parentTile, sourceCache, layer, painter.transform);

        let parentScaleBy, parentTL;

        const textureFilter = layer.paint.get('raster-resampling') === 'nearest' ?  gl.NEAREST : gl.LINEAR;

        context.activeTexture.set(gl.TEXTURE0);
        tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

        context.activeTexture.set(gl.TEXTURE1);

        if (parentTile) {
            parentTile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
            parentScaleBy = Math.pow(2, parentTile.tileID.overscaledZ - tile.tileID.overscaledZ);
            parentTL = [tile.tileID.canonical.x * parentScaleBy % 1, tile.tileID.canonical.y * parentScaleBy % 1];

        } else {
            tile.texture.bind(textureFilter, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);
        }

        const uniformValues = rasterUniformValues(posMatrix, parentTL || [0, 0], parentScaleBy || 1, fade, layer);

        if (source instanceof ImageSource) {
            program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, source.boundsBuffer,
                painter.quadTriangleIndexBuffer, source.boundsSegments);
        } else if (tile.maskedBoundsBuffer && tile.maskedIndexBuffer && tile.segments) {
            program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, tile.maskedBoundsBuffer,
                tile.maskedIndexBuffer, tile.segments, layer.paint,
                painter.transform.zoom);
        } else {
            program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                uniformValues, layer.id, painter.rasterBoundsBuffer,
                painter.quadTriangleIndexBuffer, painter.rasterBoundsSegments);
        }
    }
}

function getFadeValues(tile, parentTile, sourceCache, layer, transform) {
    const fadeDuration = layer.paint.get('raster-fade-duration');

    if (fadeDuration > 0) {
        const now = browser.now();
        const sinceTile = (now - tile.timeAdded) / fadeDuration;
        const sinceParent = parentTile ? (now - parentTile.timeAdded) / fadeDuration : -1;

        const source = sourceCache.getSource();
        const idealZ = transform.coveringZoomLevel({
            tileSize: source.tileSize,
            roundZoom: source.roundZoom
        });

        // if no parent or parent is older, fade in; if parent is younger, fade out
        const fadeIn = !parentTile || Math.abs(parentTile.tileID.overscaledZ - idealZ) > Math.abs(tile.tileID.overscaledZ - idealZ);

        const childOpacity = (fadeIn && tile.refreshedUponExpiration) ? 1 : clamp(fadeIn ? sinceTile : 1 - sinceParent, 0, 1);

        // we don't crossfade tiles that were just refreshed upon expiring:
        // once they're old enough to pass the crossfading threshold
        // (fadeDuration), unset the `refreshedUponExpiration` flag so we don't
        // incorrectly fail to crossfade them when zooming
        if (tile.refreshedUponExpiration && sinceTile >= 1) tile.refreshedUponExpiration = false;

        if (parentTile) {
            return {
                opacity: 1,
                mix: 1 - childOpacity
            };
        } else {
            return {
                opacity: childOpacity,
                mix: 0
            };
        }
    } else {
        return {
            opacity: 1,
            mix: 0
        };
    }
}
