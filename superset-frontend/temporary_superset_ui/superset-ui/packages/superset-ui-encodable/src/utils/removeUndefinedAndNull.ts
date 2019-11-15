export default function removeUndefinedAndNull<T>(array: T[]) {
  return array.filter(x => typeof x !== 'undefined' && x !== null) as Exclude<
    T,
    undefined | null
  >[];
}
