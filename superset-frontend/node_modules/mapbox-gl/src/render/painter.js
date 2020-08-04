// @flow

import browser from '../util/browser';

import { mat4 } from 'gl-matrix';
import SourceCache from '../source/source_cache';
import EXTENT from '../data/extent';
import pixelsToTileUnits from '../source/pixels_to_tile_units';
import SegmentVector from '../data/segment';
import { RasterBoundsArray, PosArray, TriangleIndexArray, LineStripIndexArray } from '../data/array_types';
import rasterBoundsAttributes from '../data/raster_bounds_attributes';
import posAttributes from '../data/pos_attributes';
import ProgramConfiguration from '../data/program_configuration';
import CrossTileSymbolIndex from '../symbol/cross_tile_symbol_index';
import * as shaders from '../shaders';
import Program from './program';
import { programUniforms } from './program/program_uniforms';
import Context from '../gl/context';
import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import Texture from './texture';
import updateTileMasks from './tile_mask';
import { clippingMaskUniformValues } from './program/clipping_mask_program';
import Color from '../style-spec/util/color';
import symbol from './draw_symbol';
import circle from './draw_circle';
import heatmap from './draw_heatmap';
import line from './draw_line';
import fill from './draw_fill';
import fillExtrusion from './draw_fill_extrusion';
import hillshade from './draw_hillshade';
import raster from './draw_raster';
import background from './draw_background';
import debug from './draw_debug';
import custom from './draw_custom';

const draw = {
    symbol,
    circle,
    heatmap,
    line,
    fill,
    'fill-extrusion': fillExtrusion,
    hillshade,
    raster,
    background,
    debug,
    custom
};

import type Transform from '../geo/transform';
import type Tile from '../source/tile';
import type {OverscaledTileID} from '../source/tile_id';
import type Style from '../style/style';
import type StyleLayer from '../style/style_layer';
import type {CrossFaded} from '../style/properties';
import type LineAtlas from './line_atlas';
import type ImageManager from './image_manager';
import type GlyphManager from './glyph_manager';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type {DepthMaskType, DepthFuncType} from '../gl/types';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent';

type PainterOptions = {
    showOverdrawInspector: boolean,
    showTileBoundaries: boolean,
    rotating: boolean,
    zooming: boolean,
    moving: boolean,
    fadeDuration: number
}

/**
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 * @private
 */
class Painter {
    context: Context;
    transform: Transform;
    _tileTextures: { [number]: Array<Texture> };
    numSublayers: number;
    depthEpsilon: number;
    emptyProgramConfiguration: ProgramConfiguration;
    width: number;
    height: number;
    depthRbo: WebGLRenderbuffer;
    depthRboNeedsClear: boolean;
    tileExtentBuffer: VertexBuffer;
    tileExtentSegments: SegmentVector;
    debugBuffer: VertexBuffer;
    debugSegments: SegmentVector;
    rasterBoundsBuffer: VertexBuffer;
    rasterBoundsSegments: SegmentVector;
    viewportBuffer: VertexBuffer;
    viewportSegments: SegmentVector;
    quadTriangleIndexBuffer: IndexBuffer;
    tileBorderIndexBuffer: IndexBuffer;
    _tileClippingMaskIDs: { [number]: number };
    stencilClearMode: StencilMode;
    style: Style;
    options: PainterOptions;
    lineAtlas: LineAtlas;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    depthRange: number;
    renderPass: RenderPass;
    currentLayer: number;
    id: string;
    _showOverdrawInspector: boolean;
    cache: { [string]: Program<*> };
    crossTileSymbolIndex: CrossTileSymbolIndex;
    symbolFadeChange: number;

    constructor(gl: WebGLRenderingContext, transform: Transform) {
        this.context = new Context(gl);
        this.transform = transform;
        this._tileTextures = {};

        this.setup();

        // Within each layer there are multiple distinct z-planes that can be drawn to.
        // This is implemented using the WebGL depth buffer.
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);

        this.depthRboNeedsClear = true;

        this.emptyProgramConfiguration = new ProgramConfiguration();

        this.crossTileSymbolIndex = new CrossTileSymbolIndex();
    }

    /*
     * Update the GL viewport, projection matrix, and transforms to compensate
     * for a new width and height value.
     */
    resize(width: number, height: number) {
        const gl = this.context.gl;

        this.width = width * browser.devicePixelRatio;
        this.height = height * browser.devicePixelRatio;
        this.context.viewport.set([0, 0, this.width, this.height]);

        if (this.style) {
            for (const layerId of this.style._order) {
                this.style._layers[layerId].resize();
            }
        }

        if (this.depthRbo) {
            gl.deleteRenderbuffer(this.depthRbo);
            this.depthRbo = null;
        }
    }

    setup() {
        const context = this.context;

        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        this.tileExtentBuffer = context.createVertexBuffer(tileExtentArray, posAttributes.members);
        this.tileExtentSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const debugArray = new PosArray();
        debugArray.emplaceBack(0, 0);
        debugArray.emplaceBack(EXTENT, 0);
        debugArray.emplaceBack(0, EXTENT);
        debugArray.emplaceBack(EXTENT, EXTENT);
        this.debugBuffer = context.createVertexBuffer(debugArray, posAttributes.members);
        this.debugSegments = SegmentVector.simpleSegment(0, 0, 4, 5);

        const rasterBoundsArray = new RasterBoundsArray();
        rasterBoundsArray.emplaceBack(0, 0, 0, 0);
        rasterBoundsArray.emplaceBack(EXTENT, 0, EXTENT, 0);
        rasterBoundsArray.emplaceBack(0, EXTENT, 0, EXTENT);
        rasterBoundsArray.emplaceBack(EXTENT, EXTENT, EXTENT, EXTENT);
        this.rasterBoundsBuffer = context.createVertexBuffer(rasterBoundsArray, rasterBoundsAttributes.members);
        this.rasterBoundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const viewportArray = new PosArray();
        viewportArray.emplaceBack(0, 0);
        viewportArray.emplaceBack(1, 0);
        viewportArray.emplaceBack(0, 1);
        viewportArray.emplaceBack(1, 1);
        this.viewportBuffer = context.createVertexBuffer(viewportArray, posAttributes.members);
        this.viewportSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const tileLineStripIndices = new LineStripIndexArray();
        tileLineStripIndices.emplaceBack(0);
        tileLineStripIndices.emplaceBack(1);
        tileLineStripIndices.emplaceBack(3);
        tileLineStripIndices.emplaceBack(2);
        tileLineStripIndices.emplaceBack(0);
        this.tileBorderIndexBuffer = context.createIndexBuffer(tileLineStripIndices);

        const quadTriangleIndices = new TriangleIndexArray();
        quadTriangleIndices.emplaceBack(0, 1, 2);
        quadTriangleIndices.emplaceBack(2, 1, 3);
        this.quadTriangleIndexBuffer = context.createIndexBuffer(quadTriangleIndices);

        const gl = this.context.gl;
        this.stencilClearMode = new StencilMode({ func: gl.ALWAYS, mask: 0 }, 0x0, 0xFF, gl.ZERO, gl.ZERO, gl.ZERO);
    }

    /*
     * Reset the drawing canvas by clearing the stencil buffer so that we can draw
     * new tiles at the same location, while retaining previously drawn pixels.
     */
    clearStencil() {
        const context = this.context;
        const gl = context.gl;

        // As a temporary workaround for https://github.com/mapbox/mapbox-gl-js/issues/5490,
        // pending an upstream fix, we draw a fullscreen stencil=0 clipping mask here,
        // effectively clearing the stencil buffer: once an upstream patch lands, remove
        // this function in favor of context.clear({ stencil: 0x0 })

        const matrix = mat4.create();
        mat4.ortho(matrix, 0, this.width, this.height, 0, 0, 1);
        mat4.scale(matrix, matrix, [gl.drawingBufferWidth, gl.drawingBufferHeight, 0]);

        this.useProgram('clippingMask').draw(context, gl.TRIANGLES,
            DepthMode.disabled, this.stencilClearMode, ColorMode.disabled, CullFaceMode.disabled,
            clippingMaskUniformValues(matrix),
            '$clipping', this.viewportBuffer,
            this.quadTriangleIndexBuffer, this.viewportSegments);
    }

    _renderTileClippingMasks(tileIDs: Array<OverscaledTileID>) {
        const context = this.context;
        const gl = context.gl;

        context.setColorMode(ColorMode.disabled);
        context.setDepthMode(DepthMode.disabled);

        const program = this.useProgram('clippingMask');

        let idNext = 1;
        this._tileClippingMaskIDs = {};

        for (const tileID of tileIDs) {
            const id = this._tileClippingMaskIDs[tileID.key] = idNext++;

            program.draw(context, gl.TRIANGLES, DepthMode.disabled,
                // Tests will always pass, and ref value will be written to stencil buffer.
                new StencilMode({ func: gl.ALWAYS, mask: 0 }, id, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE),
                ColorMode.disabled, CullFaceMode.disabled, clippingMaskUniformValues(tileID.posMatrix),
                '$clipping', this.tileExtentBuffer,
                this.quadTriangleIndexBuffer, this.tileExtentSegments);
        }
    }

    stencilModeForClipping(tileID: OverscaledTileID): StencilMode {
        const gl = this.context.gl;
        return new StencilMode({ func: gl.EQUAL, mask: 0xFF }, this._tileClippingMaskIDs[tileID.key], 0x00, gl.KEEP, gl.KEEP, gl.REPLACE);
    }

    colorModeForRenderPass(): $ReadOnly<ColorMode> {
        const gl = this.context.gl;
        if (this._showOverdrawInspector) {
            const numOverdrawSteps = 8;
            const a = 1 / numOverdrawSteps;

            return new ColorMode([gl.CONSTANT_COLOR, gl.ONE], new Color(a, a, a, 0), [true, true, true, true]);
        } else if (this.renderPass === 'opaque') {
            return ColorMode.unblended;
        } else {
            return ColorMode.alphaBlended;
        }
    }

    depthModeForSublayer(n: number, mask: DepthMaskType, func: ?DepthFuncType): DepthMode {
        const depth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
        return new DepthMode(func || this.context.gl.LEQUAL, mask, [depth, depth]);
    }

    render(style: Style, options: PainterOptions) {
        this.style = style;
        this.options = options;

        this.lineAtlas = style.lineAtlas;
        this.imageManager = style.imageManager;
        this.glyphManager = style.glyphManager;

        this.symbolFadeChange = style.placement.symbolFadeChange(browser.now());

        const layerIds = this.style._order;
        const sourceCaches = this.style.sourceCaches;

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (sourceCache.used) {
                sourceCache.prepare(this.context);
            }
        }

        const coordsAscending: {[string]: Array<OverscaledTileID>} = {};
        const coordsDescending: {[string]: Array<OverscaledTileID>} = {};
        const coordsDescendingSymbol: {[string]: Array<OverscaledTileID>} = {};

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            coordsAscending[id] = sourceCache.getVisibleCoordinates();
            coordsDescending[id] = coordsAscending[id].slice().reverse();
            coordsDescendingSymbol[id] = sourceCache.getVisibleCoordinates(true).reverse();
        }

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            const source = sourceCache.getSource();
            if (source.type !== 'raster' && source.type !== 'raster-dem') continue;
            const visibleTiles = [];
            for (const coord of coordsAscending[id]) visibleTiles.push(sourceCache.getTile(coord));
            updateTileMasks(visibleTiles, this.context);
        }

        // Offscreen pass ===============================================
        // We first do all rendering that requires rendering to a separate
        // framebuffer, and then save those for rendering back to the map
        // later: in doing this we avoid doing expensive framebuffer restores.
        this.renderPass = 'offscreen';
        this.depthRboNeedsClear = true;

        for (const layerId of layerIds) {
            const layer = this.style._layers[layerId];
            if (!layer.hasOffscreenPass() || layer.isHidden(this.transform.zoom)) continue;

            const coords = coordsDescending[layer.source];
            if (layer.type !== 'custom' && !coords.length) continue;

            this.renderLayer(this, sourceCaches[layer.source], layer, coords);
        }

        // Rebind the main framebuffer now that all offscreen layers have been rendered:
        this.context.bindFramebuffer.set(null);

        // Clear buffers in preparation for drawing to the main framebuffer
        this.context.clear({ color: options.showOverdrawInspector ? Color.black : Color.transparent, depth: 1 });

        this._showOverdrawInspector = options.showOverdrawInspector;
        this.depthRange = (style._order.length + 2) * this.numSublayers * this.depthEpsilon;

        // Opaque pass ===============================================
        // Draw opaque layers top-to-bottom first.
        this.renderPass = 'opaque';
        let prevSourceId;

        for (this.currentLayer = layerIds.length - 1; this.currentLayer >= 0; this.currentLayer--) {
            const layer = this.style._layers[layerIds[this.currentLayer]];
            const sourceCache = sourceCaches[layer.source];
            const coords = coordsAscending[layer.source];

            if (layer.source !== prevSourceId && sourceCache) {
                this.clearStencil();
                if (sourceCache.getSource().isTileClipped) {
                    this._renderTileClippingMasks(coords);
                }
            }

            this.renderLayer(this, sourceCache, layer, coords);
            prevSourceId = layer.source;
        }

        // Translucent pass ===============================================
        // Draw all other layers bottom-to-top.
        this.renderPass = 'translucent';

        for (this.currentLayer = 0, prevSourceId = null; this.currentLayer < layerIds.length; this.currentLayer++) {
            const layer = this.style._layers[layerIds[this.currentLayer]];
            const sourceCache = sourceCaches[layer.source];

            // For symbol layers in the translucent pass, we add extra tiles to the renderable set
            // for cross-tile symbol fading. Symbol layers don't use tile clipping, so no need to render
            // separate clipping masks
            const coords = (layer.type === 'symbol' ? coordsDescendingSymbol : coordsDescending)[layer.source];

            if (layer.source !== prevSourceId && sourceCache) {
                this.clearStencil();
                if (sourceCache.getSource().isTileClipped) {
                    this._renderTileClippingMasks(coordsAscending[layer.source]);
                }
            }

            this.renderLayer(this, sourceCache, layer, coords);
            prevSourceId = layer.source;
        }

        if (this.options.showTileBoundaries) {
            for (const id in sourceCaches) {
                draw.debug(this, sourceCaches[id], coordsAscending[id]);
                break;
            }
        }

        this.setCustomLayerDefaults();
    }

    setupOffscreenDepthRenderbuffer(): void {
        const context = this.context;
        // All of the 3D textures will use the same depth renderbuffer.
        if (!this.depthRbo) {
            this.depthRbo = context.createRenderbuffer(context.gl.DEPTH_COMPONENT16, this.width, this.height);
        }
    }

    renderLayer(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<OverscaledTileID>) {
        if (layer.isHidden(this.transform.zoom)) return;
        if (layer.type !== 'background' && layer.type !== 'custom' && !coords.length) return;
        this.id = layer.id;

        draw[layer.type](painter, sourceCache, layer, coords);
    }

    /**
     * Transform a matrix to incorporate the *-translate and *-translate-anchor properties into it.
     * @param inViewportPixelUnitsUnits True when the units accepted by the matrix are in viewport pixels instead of tile units.
     * @returns {Float32Array} matrix
     */
    translatePosMatrix(matrix: Float32Array, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport', inViewportPixelUnitsUnits?: boolean) {
        if (!translate[0] && !translate[1]) return matrix;

        const angle = inViewportPixelUnitsUnits ?
            (translateAnchor === 'map' ? this.transform.angle : 0) :
            (translateAnchor === 'viewport' ? -this.transform.angle : 0);

        if (angle) {
            const sinA = Math.sin(angle);
            const cosA = Math.cos(angle);
            translate = [
                translate[0] * cosA - translate[1] * sinA,
                translate[0] * sinA + translate[1] * cosA
            ];
        }

        const translation = [
            inViewportPixelUnitsUnits ? translate[0] : pixelsToTileUnits(tile, translate[0], this.transform.zoom),
            inViewportPixelUnitsUnits ? translate[1] : pixelsToTileUnits(tile, translate[1], this.transform.zoom),
            0
        ];

        const translatedMatrix = new Float32Array(16);
        mat4.translate(translatedMatrix, matrix, translation);
        return translatedMatrix;
    }

    saveTileTexture(texture: Texture) {
        const textures = this._tileTextures[texture.size[0]];
        if (!textures) {
            this._tileTextures[texture.size[0]] = [texture];
        } else {
            textures.push(texture);
        }
    }

    getTileTexture(size: number) {
        const textures = this._tileTextures[size];
        return textures && textures.length > 0 ? textures.pop() : null;
    }

    /**
     * Checks whether a pattern image is needed, and if it is, whether it is not loaded.
     *
     * @returns true if a needed image is missing and rendering needs to be skipped.
     */
    isPatternMissing(image: ?CrossFaded<string>): boolean {
        if (!image) return false;
        const imagePosA = this.imageManager.getPattern(image.from);
        const imagePosB = this.imageManager.getPattern(image.to);
        return !imagePosA || !imagePosB;
    }

    useProgram(name: string, programConfiguration: ProgramConfiguration = this.emptyProgramConfiguration): Program<any> {
        this.cache = this.cache || {};
        const key = `${name}${programConfiguration.cacheKey || ''}${this._showOverdrawInspector ? '/overdraw' : ''}`;
        if (!this.cache[key]) {
            this.cache[key] = new Program(this.context, shaders[name], programConfiguration, programUniforms[name], this._showOverdrawInspector);
        }
        return this.cache[key];
    }

    /*
     * Reset some GL state to default values to avoid hard-to-debug bugs
     * in custom layers.
     */
    setCustomLayerDefaults() {
        // Prevent custom layers from unintentionally modify the last VAO used.
        // All other state is state is restored on it's own, but for VAOs it's
        // simpler to unbind so that we don't have to track the state of VAOs.
        this.context.unbindVAO();

        // The default values for this state is meaningful and often expected.
        // Leaving this state dirty could cause a lot of confusion for users.
        this.context.cullFace.setDefault();
        this.context.activeTexture.setDefault();
        this.context.pixelStoreUnpack.setDefault();
        this.context.pixelStoreUnpackPremultiplyAlpha.setDefault();
        this.context.pixelStoreUnpackFlipY.setDefault();
    }

    /*
     * Set GL state that is shared by all layers.
     */
    setBaseState() {
        const gl = this.context.gl;
        this.context.cullFace.set(false);
        this.context.viewport.set([0, 0, this.width, this.height]);
        this.context.blendEquation.set(gl.FUNC_ADD);
    }
}

export default Painter;
