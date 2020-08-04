// @flow

import { warnOnce } from '../util/util';

import { register } from '../util/web_worker_transfer';

import type VertexArrayObject from '../render/vertex_array_object';
import type {StructArray} from '../util/struct_array';

export type Segment = {
    sortKey: number | void,
    vertexOffset: number,
    primitiveOffset: number,
    vertexLength: number,
    primitiveLength: number,
    vaos: {[string]: VertexArrayObject}
}

class SegmentVector {
    static MAX_VERTEX_ARRAY_LENGTH: number;
    segments: Array<Segment>;

    constructor(segments?: Array<Segment> = []) {
        this.segments = segments;
    }

    prepareSegment(numVertices: number, layoutVertexArray: StructArray, indexArray: StructArray, sortKey?: number): Segment {
        let segment: Segment = this.segments[this.segments.length - 1];
        if (numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH) warnOnce(`Max vertices per segment is ${SegmentVector.MAX_VERTEX_ARRAY_LENGTH}: bucket requested ${numVertices}`);
        if (!segment || segment.vertexLength + numVertices > SegmentVector.MAX_VERTEX_ARRAY_LENGTH || segment.sortKey !== sortKey) {
            segment = ({
                vertexOffset: layoutVertexArray.length,
                primitiveOffset: indexArray.length,
                vertexLength: 0,
                primitiveLength: 0
            }: any);
            if (sortKey !== undefined) segment.sortKey = sortKey;
            this.segments.push(segment);
        }
        return segment;
    }

    get() {
        return this.segments;
    }

    destroy() {
        for (const segment of this.segments) {
            for (const k in segment.vaos) {
                segment.vaos[k].destroy();
            }
        }
    }

    static simpleSegment(vertexOffset: number, primitiveOffset: number, vertexLength: number, primitiveLength: number): SegmentVector {
        return new SegmentVector([{
            vertexOffset,
            primitiveOffset,
            vertexLength,
            primitiveLength,
            vaos: {},
            sortKey: 0
        }]);
    }
}

/*
 * The maximum size of a vertex array. This limit is imposed by WebGL's 16 bit
 * addressing of vertex buffers.
 * @private
 * @readonly
 */
SegmentVector.MAX_VERTEX_ARRAY_LENGTH = Math.pow(2, 16) - 1;

register('SegmentVector', SegmentVector);
export default SegmentVector;
