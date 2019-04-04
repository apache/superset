// Extracted from https://github.com/facebook/react/blob/7bdf93b17a35a5d8fcf0ceae0bf48ed5e6b16688/src/renderers/shared/fiber/ReactFiberTreeReflection.js#L104-L228
function findCurrentFiberUsingSlowPath(fiber) {
  const { alternate } = fiber;
  if (!alternate) {
    return fiber;
  }
  // If we have two possible branches, we'll walk backwards up to the root
  // to see what path the root points to. On the way we may hit one of the
  // special cases and we'll deal with them.
  let a = fiber;
  let b = alternate;
  while (true) { // eslint-disable-line
    const parentA = a.return;
    const parentB = parentA ? parentA.alternate : null;
    if (!parentA || !parentB) {
      // We're at the root.
      break;
    }

    // If both copies of the parent fiber point to the same child, we can
    // assume that the child is current. This happens when we bailout on low
    // priority: the bailed out fiber's child reuses the current child.
    if (parentA.child === parentB.child) {
      let { child } = parentA;
      while (child) {
        if (child === a) {
          // We've determined that A is the current branch.
          return fiber;
        }
        if (child === b) {
          // We've determined that B is the current branch.
          return alternate;
        }
        child = child.sibling;
      }
      // We should never have an alternate for any mounting node. So the only
      // way this could possibly happen is if this was unmounted, if at all.
      throw new Error('Unable to find node on an unmounted component.');
    }

    if (a.return !== b.return) {
      // The return pointer of A and the return pointer of B point to different
      // fibers. We assume that return pointers never criss-cross, so A must
      // belong to the child set of A.return, and B must belong to the child
      // set of B.return.
      a = parentA;
      b = parentB;
    } else {
      // The return pointers point to the same fiber. We'll have to use the
      // default, slow path: scan the child sets of each parent alternate to see
      // which child belongs to which set.
      //
      // Search parent A's child set
      let didFindChild = false;
      let { child } = parentA;
      while (child) {
        if (child === a) {
          didFindChild = true;
          a = parentA;
          b = parentB;
          break;
        }
        if (child === b) {
          didFindChild = true;
          b = parentA;
          a = parentB;
          break;
        }
        child = child.sibling;
      }
      if (!didFindChild) {
        // Search parent B's child set
        ({ child } = parentB);
        while (child) {
          if (child === a) {
            didFindChild = true;
            a = parentB;
            b = parentA;
            break;
          }
          if (child === b) {
            didFindChild = true;
            b = parentB;
            a = parentA;
            break;
          }
          child = child.sibling;
        }
        if (!didFindChild) {
          throw new Error('Child was not found in either parent set. This indicates a bug '
            + 'in React related to the return pointer. Please file an issue.');
        }
      }
    }
  }
  if (a.stateNode.current === a) {
    // We've determined that A is the current branch.
    return fiber;
  }
  // Otherwise B has to be current branch.
  return alternate;
}

module.exports = findCurrentFiberUsingSlowPath;
