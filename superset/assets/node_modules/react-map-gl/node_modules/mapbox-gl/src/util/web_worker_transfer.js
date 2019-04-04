// @flow

import assert from 'assert';

import Grid from 'grid-index';
import Color from '../style-spec/util/color';
import { StylePropertyFunction, StyleExpression, ZoomDependentExpression, ZoomConstantExpression } from '../style-spec/expression';
import CompoundExpression from '../style-spec/expression/compound_expression';
import expressions from '../style-spec/expression/definitions';
import window from './window';
const { ImageData } = window;

import type {Transferable} from '../types/transferable';

type SerializedObject = { [string]: Serialized }; // eslint-disable-line
export type Serialized =
    | null
    | void
    | boolean
    | number
    | string
    | Boolean
    | Number
    | String
    | Date
    | RegExp
    | ArrayBuffer
    | $ArrayBufferView
    | ImageData
    | Array<Serialized>
    | SerializedObject;

type Registry = {
    [string]: {
        klass: Class<any>,
        omit: $ReadOnlyArray<string>,
        shallow: $ReadOnlyArray<string>
    }
};

type RegisterOptions<T> = {
    omit?: $ReadOnlyArray<$Keys<T>>,
    shallow?: $ReadOnlyArray<$Keys<T>>
}

const registry: Registry = {};

/**
 * Register the given class as serializable.
 *
 * @param options
 * @param options.omit List of properties to omit from serialization (e.g., cached/computed properties)
 * @param options.shallow List of properties that should be serialized by a simple shallow copy, rather than by a recursive call to serialize().
 *
 * @private
 */
export function register<T: any>(name: string, klass: Class<T>, options: RegisterOptions<T> = {}) {
    assert(!registry[name], `${name} is already registered.`);
    (Object.defineProperty: any)(klass, '_classRegistryKey', {
        value: name,
        writeable: false
    });
    registry[name] = {
        klass,
        omit: options.omit || [],
        shallow: options.shallow || []
    };
}

register('Object', Object);

type SerializedGrid = { buffer: ArrayBuffer };

Grid.serialize = function serialize(grid: Grid, transferables?: Array<Transferable>): SerializedGrid {
    const buffer = grid.toArrayBuffer();
    if (transferables) {
        transferables.push(buffer);
    }
    return {buffer};
};

Grid.deserialize = function deserialize(serialized: SerializedGrid): Grid {
    return new Grid(serialized.buffer);
};
register('Grid', Grid);

register('Color', Color);
register('Error', Error);

register('StylePropertyFunction', StylePropertyFunction);
register('StyleExpression', StyleExpression, {omit: ['_evaluator']});

register('ZoomDependentExpression', ZoomDependentExpression);
register('ZoomConstantExpression', ZoomConstantExpression);
register('CompoundExpression', CompoundExpression, {omit: ['_evaluate']});
for (const name in expressions) {
    if ((expressions[name]: any)._classRegistryKey) continue;
    register(`Expression_${name}`, expressions[name]);
}

/**
 * Serialize the given object for transfer to or from a web worker.
 *
 * For non-builtin types, recursively serialize each property (possibly
 * omitting certain properties - see register()), and package the result along
 * with the constructor's `name` so that the appropriate constructor can be
 * looked up in `deserialize()`.
 *
 * If a `transferables` array is provided, add any transferable objects (i.e.,
 * any ArrayBuffers or ArrayBuffer views) to the list. (If a copy is needed,
 * this should happen in the client code, before using serialize().)
 *
 * @private
 */
export function serialize(input: mixed, transferables?: Array<Transferable>): Serialized {
    if (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp) {
        return input;
    }

    if (input instanceof ArrayBuffer) {
        if (transferables) {
            transferables.push(input);
        }
        return input;
    }

    if (ArrayBuffer.isView(input)) {
        const view: $ArrayBufferView = (input: any);
        if (transferables) {
            transferables.push(view.buffer);
        }
        return view;
    }

    if (input instanceof ImageData) {
        if (transferables) {
            transferables.push(input.data.buffer);
        }
        return input;
    }

    if (Array.isArray(input)) {
        const serialized = [];
        for (const item of input) {
            serialized.push(serialize(item, transferables));
        }
        return serialized;
    }

    if (typeof input === 'object') {
        const klass = (input.constructor: any);
        const name = klass._classRegistryKey;
        if (!name) {
            throw new Error(`can't serialize object of unregistered class`);
        }
        assert(registry[name]);

        const properties: SerializedObject = klass.serialize ?
            // (Temporary workaround) allow a class to provide static
            // `serialize()` and `deserialize()` methods to bypass the generic
            // approach.
            // This temporary workaround lets us use the generic serialization
            // approach for objects whose members include instances of dynamic
            // StructArray types. Once we refactor StructArray to be static,
            // we can remove this complexity.
            (klass.serialize(input, transferables): SerializedObject) : {};

        if (!klass.serialize) {
            for (const key in input) {
                // any cast due to https://github.com/facebook/flow/issues/5393
                if (!(input: any).hasOwnProperty(key)) continue;
                if (registry[name].omit.indexOf(key) >= 0) continue;
                const property = (input: any)[key];
                properties[key] = registry[name].shallow.indexOf(key) >= 0 ?
                    property :
                    serialize(property, transferables);
            }
            if (input instanceof Error) {
                properties.message = input.message;
            }
        } else {
            // make sure statically serialized object survives transfer of $name property
            assert(!transferables || properties !== transferables[transferables.length - 1]);
        }

        if (properties.$name) {
            throw new Error('$name property is reserved for worker serialization logic.');
        }
        if (name !== 'Object') {
            properties.$name = name;
        }

        return properties;
    }

    throw new Error(`can't serialize object of type ${typeof input}`);
}

export function deserialize(input: Serialized): mixed {
    if (input === null ||
        input === undefined ||
        typeof input === 'boolean' ||
        typeof input === 'number' ||
        typeof input === 'string' ||
        input instanceof Boolean ||
        input instanceof Number ||
        input instanceof String ||
        input instanceof Date ||
        input instanceof RegExp ||
        input instanceof ArrayBuffer ||
        ArrayBuffer.isView(input) ||
        input instanceof ImageData) {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map(deserialize);
    }

    if (typeof input === 'object') {
        const name = (input: any).$name || 'Object';

        const {klass} = registry[name];
        if (!klass) {
            throw new Error(`can't deserialize unregistered class ${name}`);
        }

        if (klass.deserialize) {
            return (klass.deserialize: typeof deserialize)(input);
        }

        const result = Object.create(klass.prototype);

        for (const key of Object.keys(input)) {
            if (key === '$name') continue;
            const value = (input: SerializedObject)[key];
            result[key] = registry[name].shallow.indexOf(key) >= 0 ? value : deserialize(value);
        }

        return result;
    }

    throw new Error(`can't deserialize object of type ${typeof input}`);
}
