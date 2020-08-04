import { Ref } from 'react';
declare type OptionalRef<T> = Ref<T> | undefined;
export default function composeRefs<T>(...refs: [OptionalRef<T>, OptionalRef<T>, ...Array<OptionalRef<T>>]): Ref<T>;
export {};
//# sourceMappingURL=composeRefs.d.ts.map