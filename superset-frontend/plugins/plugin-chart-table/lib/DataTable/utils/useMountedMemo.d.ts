/**
 * Execute a memoized callback only when mounted. Execute again when factory updated.
 * Returns undefined if not mounted yet.
 */
export default function useMountedMemo<T>(factory: () => T, deps?: unknown[]): T | undefined;
//# sourceMappingURL=useMountedMemo.d.ts.map