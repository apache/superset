import isDisabled from './isDisabled';

export default function isEnabled(
  config:
    | {
        [key: string]: any;
      }
    | boolean
    | null
    | undefined,
) {
  return !isDisabled(config);
}
