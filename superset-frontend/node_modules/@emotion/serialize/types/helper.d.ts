export type Equal<A, B, T, F> = A extends B ? (B extends A ? T : F) : F
