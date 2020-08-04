// @flow

import Color from '../style-spec/util/color';

import type Context from './context';
import type {
    BlendFuncType,
    BlendEquationType,
    ColorMaskType,
    DepthRangeType,
    DepthMaskType,
    StencilFuncType,
    StencilOpType,
    DepthFuncType,
    TextureUnitType,
    ViewportType,
    CullFaceModeType,
    FrontFaceType,
} from './types';

export interface Value<T> {
    current: T;
    default: T;
    dirty: boolean;
    get(): T;
    setDefault(): void;
    set(value: T): void;
}

class BaseValue<T> implements Value<T> {
    gl: WebGLRenderingContext;
    current: T;
    default: T;
    dirty: boolean;

    constructor(context: Context) {
        this.gl = context.gl;
        this.default = this.getDefault();
        this.current = this.default;
        this.dirty = false;
    }

    get(): T {
        return this.current;
    }
    set(value: T) { // eslint-disable-line
        // overridden in child classes;
    }

    getDefault(): T {
        return this.default; // overriden in child classes
    }
    setDefault() {
        this.set(this.default);
    }
}

export class ClearColor extends BaseValue<Color> {
    getDefault(): Color {
        return Color.transparent;
    }
    set(v: Color) {
        const c = this.current;
        if (v.r === c.r && v.g === c.g && v.b === c.b && v.a === c.a && !this.dirty) return;
        this.gl.clearColor(v.r, v.g, v.b, v.a);
        this.current = v;
        this.dirty = false;
    }
}

export class ClearDepth extends BaseValue<number> {
    getDefault(): number {
        return 1;
    }
    set(v: number) {
        if (v === this.current && !this.dirty) return;
        this.gl.clearDepth(v);
        this.current = v;
        this.dirty = false;
    }
}

export class ClearStencil extends BaseValue<number> {
    getDefault(): number {
        return 0;
    }
    set(v: number) {
        if (v === this.current && !this.dirty) return;
        this.gl.clearStencil(v);
        this.current = v;
        this.dirty = false;
    }
}

export class ColorMask extends BaseValue<ColorMaskType> {
    getDefault(): ColorMaskType {
        return [true, true, true, true];
    }
    set(v: ColorMaskType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && v[3] === c[3] && !this.dirty) return;
        this.gl.colorMask(v[0], v[1], v[2], v[3]);
        this.current = v;
        this.dirty = false;
    }
}

export class DepthMask extends BaseValue<DepthMaskType> {
    getDefault(): DepthMaskType {
        return true;
    }
    set(v: DepthMaskType): void {
        if (v === this.current && !this.dirty) return;
        this.gl.depthMask(v);
        this.current = v;
        this.dirty = false;
    }
}

export class StencilMask extends BaseValue<number> {
    getDefault(): number {
        return 0xFF;
    }
    set(v: number): void {
        if (v === this.current && !this.dirty) return;
        this.gl.stencilMask(v);
        this.current = v;
        this.dirty = false;
    }
}

export class StencilFunc extends BaseValue<StencilFuncType> {
    getDefault(): StencilFuncType {
        return {
            func: this.gl.ALWAYS,
            ref: 0,
            mask: 0xFF
        };
    }
    set(v: StencilFuncType): void {
        const c = this.current;
        if (v.func === c.func && v.ref === c.ref && v.mask === c.mask && !this.dirty) return;
        this.gl.stencilFunc(v.func, v.ref, v.mask);
        this.current = v;
        this.dirty = false;
    }
}

export class StencilOp extends BaseValue<StencilOpType> {
    getDefault(): StencilOpType {
        const gl = this.gl;
        return [gl.KEEP, gl.KEEP, gl.KEEP];
    }
    set(v: StencilOpType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && !this.dirty) return;
        this.gl.stencilOp(v[0], v[1], v[2]);
        this.current = v;
        this.dirty = false;
    }
}

export class StencilTest extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    set(v: boolean) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        if (v) {
            gl.enable(gl.STENCIL_TEST);
        } else {
            gl.disable(gl.STENCIL_TEST);
        }
        this.current = v;
        this.dirty = false;
    }
}

export class DepthRange extends BaseValue<DepthRangeType> {
    getDefault(): DepthRangeType {
        return [0, 1];
    }
    set(v: DepthRangeType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && !this.dirty) return;
        this.gl.depthRange(v[0], v[1]);
        this.current = v;
        this.dirty = false;
    }
}

export class DepthTest extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    set(v: boolean) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        if (v) {
            gl.enable(gl.DEPTH_TEST);
        } else {
            gl.disable(gl.DEPTH_TEST);
        }
        this.current = v;
        this.dirty = false;
    }
}

export class DepthFunc extends BaseValue<DepthFuncType> {
    getDefault(): DepthFuncType {
        return this.gl.LESS;
    }
    set(v: DepthFuncType) {
        if (v === this.current && !this.dirty) return;
        this.gl.depthFunc(v);
        this.current = v;
        this.dirty = false;
    }
}

export class Blend extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    set(v: boolean) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        if (v) {
            gl.enable(gl.BLEND);
        } else {
            gl.disable(gl.BLEND);
        }
        this.current = v;
        this.dirty = false;
    }
}

export class BlendFunc extends BaseValue<BlendFuncType> {
    getDefault(): BlendFuncType {
        const gl = this.gl;
        return [gl.ONE, gl.ZERO];
    }
    set(v: BlendFuncType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && !this.dirty) return;
        this.gl.blendFunc(v[0], v[1]);
        this.current = v;
        this.dirty = false;
    }
}

export class BlendColor extends BaseValue<Color> {
    getDefault(): Color {
        return Color.transparent;
    }
    set(v: Color) {
        const c = this.current;
        if (v.r === c.r && v.g === c.g && v.b === c.b && v.a === c.a && !this.dirty) return;
        this.gl.blendColor(v.r, v.g, v.b, v.a);
        this.current = v;
        this.dirty = false;
    }
}

export class BlendEquation extends BaseValue<BlendEquationType> {
    getDefault(): BlendEquationType {
        return this.gl.FUNC_ADD;
    }
    set(v: BlendEquationType) {
        if (v === this.current && !this.dirty) return;
        this.gl.blendEquation(v);
        this.current = v;
        this.dirty = false;
    }
}

export class CullFace extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    set(v: boolean) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        if (v) {
            gl.enable(gl.CULL_FACE);
        } else {
            gl.disable(gl.CULL_FACE);
        }
        this.current = v;
        this.dirty = false;
    }
}

export class CullFaceSide extends BaseValue<CullFaceModeType> {
    getDefault(): CullFaceModeType {
        return this.gl.BACK;
    }
    set(v: CullFaceModeType) {
        if (v === this.current && !this.dirty) return;
        this.gl.cullFace(v);
        this.current = v;
        this.dirty = false;
    }
}

export class FrontFace extends BaseValue<FrontFaceType> {
    getDefault(): FrontFaceType {
        return this.gl.CCW;
    }
    set(v: FrontFaceType) {
        if (v === this.current && !this.dirty) return;
        this.gl.frontFace(v);
        this.current = v;
        this.dirty = false;
    }
}

export class Program extends BaseValue<?WebGLProgram> {
    getDefault(): WebGLProgram {
        return null;
    }
    set(v: ?WebGLProgram) {
        if (v === this.current && !this.dirty) return;
        this.gl.useProgram(v);
        this.current = v;
        this.dirty = false;
    }
}

export class ActiveTextureUnit extends BaseValue<TextureUnitType> {
    getDefault(): TextureUnitType {
        return this.gl.TEXTURE0;
    }
    set(v: TextureUnitType) {
        if (v === this.current && !this.dirty) return;
        this.gl.activeTexture(v);
        this.current = v;
        this.dirty = false;
    }
}

export class Viewport extends BaseValue<ViewportType> {
    getDefault(): ViewportType {
        const gl = this.gl;
        return [0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight];
    }
    set(v: ViewportType) {
        const c = this.current;
        if (v[0] === c[0] && v[1] === c[1] && v[2] === c[2] && v[3] === c[3] && !this.dirty) return;
        this.gl.viewport(v[0], v[1], v[2], v[3]);
        this.current = v;
        this.dirty = false;
    }
}

export class BindFramebuffer extends BaseValue<?WebGLFramebuffer> {
    getDefault(): WebGLFramebuffer {
        return null;
    }
    set(v: ?WebGLFramebuffer) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindRenderbuffer extends BaseValue<?WebGLRenderbuffer> {
    getDefault(): WebGLRenderbuffer {
        return null;
    }
    set(v: ?WebGLRenderbuffer) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.bindRenderbuffer(gl.RENDERBUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindTexture extends BaseValue<?WebGLTexture> {
    getDefault(): WebGLTexture {
        return null;
    }
    set(v: ?WebGLTexture) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindVertexBuffer extends BaseValue<?WebGLBuffer> {
    getDefault(): WebGLBuffer {
        return null;
    }
    set(v: ?WebGLBuffer) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindElementBuffer extends BaseValue<?WebGLBuffer> {
    getDefault(): WebGLBuffer {
        return null;
    }
    set(v: ?WebGLBuffer) {
        // Always rebind
        const gl = this.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}

export class BindVertexArrayOES extends BaseValue<any> {
    vao: any;

    constructor(context: Context) {
        super(context);
        this.vao = context.extVertexArrayObject;
    }
    getDefault(): any {
        return null;
    }
    set(v: any) {
        if (!this.vao || v === this.current && !this.dirty) return;
        this.vao.bindVertexArrayOES(v);
        this.current = v;
        this.dirty = false;
    }
}

export class PixelStoreUnpack extends BaseValue<number> {
    getDefault(): number {
        return 4;
    }
    set(v: number) {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, v);
        this.current = v;
        this.dirty = false;
    }
}

export class PixelStoreUnpackPremultiplyAlpha extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    set(v: boolean): void {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, (v: any));
        this.current = v;
        this.dirty = false;
    }
}

export class PixelStoreUnpackFlipY extends BaseValue<boolean> {
    getDefault(): boolean {
        return false;
    }
    set(v: boolean): void {
        if (v === this.current && !this.dirty) return;
        const gl = this.gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, (v: any));
        this.current = v;
        this.dirty = false;
    }
}

class FramebufferAttachment<T> extends BaseValue<?T> {
    parent: WebGLFramebuffer;
    context: Context;

    constructor(context: Context, parent: WebGLFramebuffer) {
        super(context);
        this.context = context;
        this.parent = parent;
    }
    getDefault() {
        return null;
    }
}

export class ColorAttachment extends FramebufferAttachment<WebGLTexture> {
    setDirty() {
        this.dirty = true;
    }
    set(v: ?WebGLTexture): void {
        if (v === this.current && !this.dirty) return;
        this.context.bindFramebuffer.set(this.parent);
        // note: it's possible to attach a renderbuffer to the color
        // attachment point, but thus far MBGL only uses textures for color
        const gl = this.gl;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, v, 0);
        this.current = v;
        this.dirty = false;
    }
}

export class DepthAttachment extends FramebufferAttachment<WebGLRenderbuffer> {
    set(v: ?WebGLRenderbuffer): void {
        if (v === this.current && !this.dirty) return;
        this.context.bindFramebuffer.set(this.parent);
        // note: it's possible to attach a texture to the depth attachment
        // point, but thus far MBGL only uses renderbuffers for depth
        const gl = this.gl;
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, v);
        this.current = v;
        this.dirty = false;
    }
}
