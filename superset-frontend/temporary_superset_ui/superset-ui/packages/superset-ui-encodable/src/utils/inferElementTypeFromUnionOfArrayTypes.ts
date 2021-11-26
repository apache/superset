type ArrayElement<A> = A extends Array<infer Elem> ? Elem : never;

/**
 * Type workaround for https://github.com/Microsoft/TypeScript/issues/7294#issuecomment-465794460
 * to avoid error "Cannot invoke an expression whose type lacks a call signature"
 * when using array.map
 */
export default function inferElementTypeFromUnionOfArrayTypes<T>(array: T): ArrayElement<T>[] {
  return array as any;
}
