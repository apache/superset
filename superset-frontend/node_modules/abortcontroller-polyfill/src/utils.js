export function nativeAbortControllerIsBroken(self) {
  return self.navigator && (
    (self.navigator.vendor && self.navigator.vendor.startsWith('Apple Computer')) ||
    (self.navigator.userAgent && self.navigator.userAgent.match(/ (crios|gsa|fxios)\//i))
  );
}
