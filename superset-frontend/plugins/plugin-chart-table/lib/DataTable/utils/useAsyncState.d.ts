/// <reference types="react" />
import 'regenerator-runtime/runtime';
/**
 * Hook useState to allow always return latest initialValue
 */
export default function useAsyncState<T, F extends (newValue: T) => unknown>(initialValue: T, callback: F, wait?: number): [T, import("react").Dispatch<import("react").SetStateAction<T>>];
//# sourceMappingURL=useAsyncState.d.ts.map