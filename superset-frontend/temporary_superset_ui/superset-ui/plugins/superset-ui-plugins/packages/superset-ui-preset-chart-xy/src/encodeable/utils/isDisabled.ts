export default function isDisabled(
  config:
    | {
        [key: string]: any;
      }
    | boolean
    | null
    | undefined,
) {
  return config === false || config === null;
}
