// Check if one JavaScript class inherits from another
export function inheritsFrom(Type, ParentType) {
  while (Type) {
    if (Type === ParentType) {
      return true;
    }
    Type = Object.getPrototypeOf(Type);
  }
  return false;
}
