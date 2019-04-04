# Function reference

## Core functions

Function | Description
---- | -----------
[math.config(config:&nbsp;Object):&nbsp;Object](functions/config.md) | Set configuration options for math.
[math.typed(name,&nbsp;signatures)&nbsp;:&nbsp;function](functions/typed.md) | Create a typed-function which checks the types of the arguments and can match them against multiple provided signatures.

## Construction functions

Function | Description
---- | -----------
[math.bignumber(x)](functions/bignumber.md) | Create a BigNumber, which can store numbers with arbitrary precision.
[math.boolean(x)](functions/boolean.md) | Create a boolean or convert a string or number to a boolean.
[math.chain(value)](functions/chain.md) | Wrap any value in a chain, allowing to perform chained operations on the value.
[math.complex(re,&nbsp;im)](functions/complex.md) | Create a complex value or convert a value to a complex value.
[math.createUnit(units)](functions/createUnit.md) | Create a user-defined unit and register it with the Unit type.
[math.fraction(numerator,&nbsp;denominator)](functions/fraction.md) | Create a fraction convert a value to a fraction.
[math.index(range1,&nbsp;range2,&nbsp;...)](functions/index.md) | Create an index.
[math.matrix(x)](functions/matrix.md) | Create a Matrix.
[math.number(value)](functions/number.md) | Create a number or convert a string, boolean, or unit to a number.
[math.sparse(x)](functions/sparse.md) | Create a Sparse Matrix.
[math.splitUnit(unit,&nbsp;parts)](functions/splitUnit.md) | Split a unit in an array of units whose sum is equal to the original unit.
[math.string(value)](functions/string.md) | Create a string or convert any object into a string.
[math.unit(x)](functions/unit.md) | Create a unit.

## Expression functions

Function | Description
---- | -----------
[math.compile(expr)](functions/compile.md) | Parse and compile an expression.
[math.eval(expr&nbsp;[,&nbsp;scope])](functions/eval.md) | Evaluate an expression.
[math.help(search)](functions/help.md) | Retrieve help on a function or data type.
[math.parse(expr&nbsp;[,&nbsp;scope])](functions/parse.md) | Parse an expression.
[math.parser()](functions/parser.md) | Create a parser.

## Algebra functions

Function | Description
---- | -----------
[derivative(expr,&nbsp;variable)](functions/derivative.md) | Takes the derivative of an expression expressed in parser Nodes.
[math.lsolve(L,&nbsp;b)](functions/lsolve.md) | Solves the linear equation system by forwards substitution.
[math.lup(A)](functions/lup.md) | Calculate the Matrix LU decomposition with partial pivoting.
[math.lusolve(A,&nbsp;b)](functions/lusolve.md) | Solves the linear system `A * x = b` where `A` is an [n x n] matrix and `b` is a [n] column vector.
[math.qr(A)](functions/qr.md) | Calculate the Matrix QR decomposition.
[rationalize(expr)](functions/rationalize.md) | Transform a rationalizable expression in a rational fraction.
[simplify(expr)](functions/simplify.md) | Simplify an expression tree.
[math.slu(A,&nbsp;order,&nbsp;threshold)](functions/slu.md) | Calculate the Sparse Matrix LU decomposition with full pivoting.
[math.usolve(U,&nbsp;b)](functions/usolve.md) | Solves the linear equation system by backward substitution.

## Arithmetic functions

Function | Description
---- | -----------
[math.abs(x)](functions/abs.md) | Calculate the absolute value of a number.
[math.add(x,&nbsp;y)](functions/add.md) | Add two or more values, `x + y`.
[math.cbrt(x&nbsp;[,&nbsp;allRoots])](functions/cbrt.md) | Calculate the cubic root of a value.
[math.ceil(x)](functions/ceil.md) | Round a value towards plus infinity If `x` is complex, both real and imaginary part are rounded towards plus infinity.
[math.cube(x)](functions/cube.md) | Compute the cube of a value, `x * x * x`.
[math.divide(x,&nbsp;y)](functions/divide.md) | Divide two values, `x / y`.
[math.dotDivide(x,&nbsp;y)](functions/dotDivide.md) | Divide two matrices element wise.
[math.dotMultiply(x,&nbsp;y)](functions/dotMultiply.md) | Multiply two matrices element wise.
[math.dotPow(x,&nbsp;y)](functions/dotPow.md) | Calculates the power of x to y element wise.
[math.exp(x)](functions/exp.md) | Calculate the exponent of a value.
[math.fix(x)](functions/fix.md) | Round a value towards zero.
[math.floor(x)](functions/floor.md) | Round a value towards minus infinity.
[math.gcd(a,&nbsp;b)](functions/gcd.md) | Calculate the greatest common divisor for two or more values or arrays.
[math.hypot(a,&nbsp;b,&nbsp;...)](functions/hypot.md) | Calculate the hypotenusa of a list with values.
[math.lcm(a,&nbsp;b)](functions/lcm.md) | Calculate the least common multiple for two or more values or arrays.
[math.log(x&nbsp;[,&nbsp;base])](functions/log.md) | Calculate the logarithm of a value.
[math.log10(x)](functions/log10.md) | Calculate the 10-base logarithm of a value.
[math.mod(x,&nbsp;y)](functions/mod.md) | Calculates the modulus, the remainder of an integer division.
[math.multiply(x,&nbsp;y)](functions/multiply.md) | Multiply two or more values, `x * y`.
[math.norm(x&nbsp;[,&nbsp;p])](functions/norm.md) | Calculate the norm of a number, vector or matrix.
[math.nthRoot(a)](functions/nthRoot.md) | Calculate the nth root of a value.
[math.pow(x,&nbsp;y)](functions/pow.md) | Calculates the power of x to y, `x ^ y`.
[math.round(x&nbsp;[,&nbsp;n])](functions/round.md) | Round a value towards the nearest integer.
[math.sign(x)](functions/sign.md) | Compute the sign of a value.
[math.sqrt(x)](functions/sqrt.md) | Calculate the square root of a value.
[math.square(x)](functions/square.md) | Compute the square of a value, `x * x`.
[math.subtract(x,&nbsp;y)](functions/subtract.md) | Subtract two values, `x - y`.
[math.unaryMinus(x)](functions/unaryMinus.md) | Inverse the sign of a value, apply a unary minus operation.
[math.unaryPlus(x)](functions/unaryPlus.md) | Unary plus operation.
[math.xgcd(a,&nbsp;b)](functions/xgcd.md) | Calculate the extended greatest common divisor for two values.

## Bitwise functions

Function | Description
---- | -----------
[math.bitAnd(x,&nbsp;y)](functions/bitAnd.md) | Bitwise AND two values, `x & y`.
[math.bitNot(x)](functions/bitNot.md) | Bitwise NOT value, `~x`.
[math.bitOr(x,&nbsp;y)](functions/bitOr.md) | Bitwise OR two values, `x | y`.
[math.bitXor(x,&nbsp;y)](functions/bitXor.md) | Bitwise XOR two values, `x ^ y`.
[math.leftShift(x,&nbsp;y)](functions/leftShift.md) | Bitwise left logical shift of a value x by y number of bits, `x << y`.
[math.rightArithShift(x,&nbsp;y)](functions/rightArithShift.md) | Bitwise right arithmetic shift of a value x by y number of bits, `x >> y`.
[math.rightLogShift(x,&nbsp;y)](functions/rightLogShift.md) | Bitwise right logical shift of value x by y number of bits, `x >>> y`.

## Combinatorics functions

Function | Description
---- | -----------
[math.bellNumbers(n)](functions/bellNumbers.md) | The Bell Numbers count the number of partitions of a set.
[math.catalan(n)](functions/catalan.md) | The Catalan Numbers enumerate combinatorial structures of many different types.
[math.composition(n,&nbsp;k)](functions/composition.md) | The composition counts of n into k parts.
[math.stirlingS2(n,&nbsp;k)](functions/stirlingS2.md) | The Stirling numbers of the second kind, counts the number of ways to partition a set of n labelled objects into k nonempty unlabelled subsets.

## Complex functions

Function | Description
---- | -----------
[math.arg(x)](functions/arg.md) | Compute the argument of a complex value.
[math.conj(x)](functions/conj.md) | Compute the complex conjugate of a complex value.
[math.im(x)](functions/im.md) | Get the imaginary part of a complex number.
[math.re(x)](functions/re.md) | Get the real part of a complex number.

## Geometry functions

Function | Description
---- | -----------
[math.distance([x1,&nbsp;y1],&nbsp;[x2,&nbsp;y2])](functions/distance.md) | Calculates:    The eucledian distance between two points in 2 and 3 dimensional spaces.
[math.intersect(endPoint1Line1, endPoint2Line1, endPoint1Line2, endPoint2Line2)](functions/intersect.md) | Calculates the point of intersection of two lines in two or three dimensions and of a line and a plane in three dimensions.

## Logical functions

Function | Description
---- | -----------
[math.and(x,&nbsp;y)](functions/and.md) | Logical `and`.
[math.not(x)](functions/not.md) | Logical `not`.
[math.or(x,&nbsp;y)](functions/or.md) | Logical `or`.
[math.xor(x,&nbsp;y)](functions/xor.md) | Logical `xor`.

## Matrix functions

Function | Description
---- | -----------
[math.concat(a,&nbsp;b,&nbsp;c,&nbsp;...&nbsp;[,&nbsp;dim])](functions/concat.md) | Concatenate two or more matrices.
[math.cross(x,&nbsp;y)](functions/cross.md) | Calculate the cross product for two vectors in three dimensional space.
[math.det(x)](functions/det.md) | Calculate the determinant of a matrix.
[math.diag(X)](functions/diag.md) | Create a diagonal matrix or retrieve the diagonal of a matrix  When `x` is a vector, a matrix with vector `x` on the diagonal will be returned.
[math.dot(x,&nbsp;y)](functions/dot.md) | Calculate the dot product of two vectors.
[math.eye(n)](functions/eye.md) | Create a 2-dimensional identity matrix with size m x n or n x n.
[math.filter(x,&nbsp;test)](functions/filter.md) | Filter the items in an array or one dimensional matrix.
[math.flatten(x)](functions/flatten.md) | Flatten a multi dimensional matrix into a single dimensional matrix.
[math.forEach(x,&nbsp;callback)](functions/forEach.md) | Iterate over all elements of a matrix/array, and executes the given callback function.
[math.inv(x)](functions/inv.md) | Calculate the inverse of a square matrix.
[math.kron(x,&nbsp;y)](functions/kron.md) | Calculates the kronecker product of 2 matrices or vectors.
[math.map(x,&nbsp;callback)](functions/map.md) | Create a new matrix or array with the results of the callback function executed on each entry of the matrix/array.
[math.ones(m,&nbsp;n,&nbsp;p,&nbsp;...)](functions/ones.md) | Create a matrix filled with ones.
[math.partitionSelect(x,&nbsp;k)](functions/partitionSelect.md) | Partition-based selection of an array or 1D matrix.
[math.range(start,&nbsp;end&nbsp;[,&nbsp;step])](functions/range.md) | Create an array from a range.
[math.reshape(x,&nbsp;sizes)](functions/reshape.md) | Reshape a multi dimensional array to fit the specified dimensions.
[math.resize(x,&nbsp;size&nbsp;[,&nbsp;defaultValue])](functions/resize.md) | Resize a matrix.
[math.size(x)](functions/size.md) | Calculate the size of a matrix or scalar.
[math.sort(x)](functions/sort.md) | Sort the items in a matrix.
[math.squeeze(x)](functions/squeeze.md) | Squeeze a matrix, remove inner and outer singleton dimensions from a matrix.
[math.subset(x,&nbsp;index&nbsp;[,&nbsp;replacement])](functions/subset.md) | Get or set a subset of a matrix or string.
[math.trace(x)](functions/trace.md) | Calculate the trace of a matrix: the sum of the elements on the main diagonal of a square matrix.
[math.transpose(x)](functions/transpose.md) | Transpose a matrix.
[math.zeros(m,&nbsp;n,&nbsp;p,&nbsp;...)](functions/zeros.md) | Create a matrix filled with zeros.

## Probability functions

Function | Description
---- | -----------
[math.combinations(n,&nbsp;k)](functions/combinations.md) | Compute the number of ways of picking `k` unordered outcomes from `n` possibilities.
[math.factorial(n)](functions/factorial.md) | Compute the factorial of a value  Factorial only supports an integer value as argument.
[math.gamma(n)](functions/gamma.md) | Compute the gamma function of a value using Lanczos approximation for small values, and an extended Stirling approximation for large values.
[math.kldivergence(x,&nbsp;y)](functions/kldivergence.md) | Calculate the Kullback-Leibler (KL) divergence  between two distributions.
[math.multinomial(a)](functions/multinomial.md) | Multinomial Coefficients compute the number of ways of picking a1, a2, .
[math.permutations(n&nbsp;[,&nbsp;k])](functions/permutations.md) | Compute the number of ways of obtaining an ordered subset of `k` elements from a set of `n` elements.
[math.pickRandom(array)](functions/pickRandom.md) | Random pick one or more values from a one dimensional array.
[math.random([min,&nbsp;max])](functions/random.md) | Return a random number larger or equal to `min` and smaller than `max` using a uniform distribution.
[math.randomInt([min,&nbsp;max])](functions/randomInt.md) | Return a random integer number larger or equal to `min` and smaller than `max` using a uniform distribution.

## Relational functions

Function | Description
---- | -----------
[math.compare(x,&nbsp;y)](functions/compare.md) | Compare two values.
[math.compareNatural(x,&nbsp;y)](functions/compareNatural.md) | Compare two values of any type in a deterministic, natural way.
[math.deepEqual(x,&nbsp;y)](functions/deepEqual.md) | Test element wise whether two matrices are equal.
[math.equal(x,&nbsp;y)](functions/equal.md) | Test whether two values are equal.
[math.larger(x,&nbsp;y)](functions/larger.md) | Test whether value x is larger than y.
[math.largerEq(x,&nbsp;y)](functions/largerEq.md) | Test whether value x is larger or equal to y.
[math.smaller(x,&nbsp;y)](functions/smaller.md) | Test whether value x is smaller than y.
[math.smallerEq(x,&nbsp;y)](functions/smallerEq.md) | Test whether value x is smaller or equal to y.
[math.unequal(x,&nbsp;y)](functions/unequal.md) | Test whether two values are unequal.

## Set functions

Function | Description
---- | -----------
[math.setCartesian(set1,&nbsp;set2)](functions/setCartesian.md) | Create the cartesian product of two (multi)sets.
[math.setDifference(set1,&nbsp;set2)](functions/setDifference.md) | Create the difference of two (multi)sets: every element of set1, that is not the element of set2.
[math.setDistinct(set)](functions/setDistinct.md) | Collect the distinct elements of a multiset.
[math.setIntersect(set1,&nbsp;set2)](functions/setIntersect.md) | Create the intersection of two (multi)sets.
[math.setIsSubset(set1,&nbsp;set2)](functions/setIsSubset.md) | Check whether a (multi)set is a subset of another (multi)set.
[math.setMultiplicity(element,&nbsp;set)](functions/setMultiplicity.md) | Count the multiplicity of an element in a multiset.
[math.setPowerset(set)](functions/setPowerset.md) | Create the powerset of a (multi)set.
[math.setSize(set)](functions/setSize.md) | Count the number of elements of a (multi)set.
[math.setSymDifference(set1,&nbsp;set2)](functions/setSymDifference.md) | Create the symmetric difference of two (multi)sets.
[math.setUnion(set1,&nbsp;set2)](functions/setUnion.md) | Create the union of two (multi)sets.

## Special functions

Function | Description
---- | -----------
[math.erf(x)](functions/erf.md) | Compute the erf function of a value using a rational Chebyshev approximations for different intervals of x.

## Statistics functions

Function | Description
---- | -----------
[math.mad(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/mad.md) | Compute the median absolute deviation of a matrix or a list with values.
[math.max(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/max.md) | Compute the maximum value of a matrix or a  list with values.
[math.mean(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/mean.md) | Compute the mean value of matrix or a list with values.
[math.median(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/median.md) | Compute the median of a matrix or a list with values.
[math.min(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/min.md) | Compute the maximum value of a matrix or a  list of values.
[math.mode(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/mode.md) | Computes the mode of a set of numbers or a list with values(numbers or characters).
[math.prod(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/prod.md) | Compute the product of a matrix or a list with values.
[math.quantileSeq(A,&nbsp;prob[,&nbsp;sorted])](functions/quantileSeq.md) | Compute the prob order quantile of a matrix or a list with values.
[math.std(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/std.md) | Compute the standard deviation of a matrix or a  list with values.
[math.sum(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/sum.md) | Compute the sum of a matrix or a list with values.
[math.var(a,&nbsp;b,&nbsp;c,&nbsp;...)](functions/var.md) | Compute the variance of a matrix or a  list with values.

## String functions

Function | Description
---- | -----------
[math.format(value&nbsp;[,&nbsp;precision])](functions/format.md) | Format a value of any type into a string.
[math.print(template, values [, precision])](functions/print.md) | Interpolate values into a string template.

## Trigonometry functions

Function | Description
---- | -----------
[math.acos(x)](functions/acos.md) | Calculate the inverse cosine of a value.
[math.acosh(x)](functions/acosh.md) | Calculate the hyperbolic arccos of a value, defined as `acosh(x) = ln(sqrt(x^2 - 1) + x)`.
[math.acot(x)](functions/acot.md) | Calculate the inverse cotangent of a value, defined as `acot(x) = atan(1/x)`.
[math.acoth(x)](functions/acoth.md) | Calculate the hyperbolic arccotangent of a value, defined as `acoth(x) = atanh(1/x) = (ln((x+1)/x) + ln(x/(x-1))) / 2`.
[math.acsc(x)](functions/acsc.md) | Calculate the inverse cosecant of a value, defined as `acsc(x) = asin(1/x)`.
[math.acsch(x)](functions/acsch.md) | Calculate the hyperbolic arccosecant of a value, defined as `acsch(x) = asinh(1/x) = ln(1/x + sqrt(1/x^2 + 1))`.
[math.asec(x)](functions/asec.md) | Calculate the inverse secant of a value.
[math.asech(x)](functions/asech.md) | Calculate the hyperbolic arcsecant of a value, defined as `asech(x) = acosh(1/x) = ln(sqrt(1/x^2 - 1) + 1/x)`.
[math.asin(x)](functions/asin.md) | Calculate the inverse sine of a value.
[math.asinh(x)](functions/asinh.md) | Calculate the hyperbolic arcsine of a value, defined as `asinh(x) = ln(x + sqrt(x^2 + 1))`.
[math.atan(x)](functions/atan.md) | Calculate the inverse tangent of a value.
[math.atan2(y,&nbsp;x)](functions/atan2.md) | Calculate the inverse tangent function with two arguments, y/x.
[math.atanh(x)](functions/atanh.md) | Calculate the hyperbolic arctangent of a value, defined as `atanh(x) = ln((1 + x)/(1 - x)) / 2`.
[math.cos(x)](functions/cos.md) | Calculate the cosine of a value.
[math.cosh(x)](functions/cosh.md) | Calculate the hyperbolic cosine of a value, defined as `cosh(x) = 1/2 * (exp(x) + exp(-x))`.
[math.cot(x)](functions/cot.md) | Calculate the cotangent of a value.
[math.coth(x)](functions/coth.md) | Calculate the hyperbolic cotangent of a value, defined as `coth(x) = 1 / tanh(x)`.
[math.csc(x)](functions/csc.md) | Calculate the cosecant of a value, defined as `csc(x) = 1/sin(x)`.
[math.csch(x)](functions/csch.md) | Calculate the hyperbolic cosecant of a value, defined as `csch(x) = 1 / sinh(x)`.
[math.sec(x)](functions/sec.md) | Calculate the secant of a value, defined as `sec(x) = 1/cos(x)`.
[math.sech(x)](functions/sech.md) | Calculate the hyperbolic secant of a value, defined as `sech(x) = 1 / cosh(x)`.
[math.sin(x)](functions/sin.md) | Calculate the sine of a value.
[math.sinh(x)](functions/sinh.md) | Calculate the hyperbolic sine of a value, defined as `sinh(x) = 1/2 * (exp(x) - exp(-x))`.
[math.tan(x)](functions/tan.md) | Calculate the tangent of a value.
[math.tanh(x)](functions/tanh.md) | Calculate the hyperbolic tangent of a value, defined as `tanh(x) = (exp(2 * x) - 1) / (exp(2 * x) + 1)`.

## Unit functions

Function | Description
---- | -----------
[math.to(x,&nbsp;unit)](functions/to.md) | Change the unit of a value.

## Utils functions

Function | Description
---- | -----------
[math.clone(x)](functions/clone.md) | Clone an object.
[math.isInteger(x)](functions/isInteger.md) | Test whether a value is an integer number.
[math.isNaN(x)](functions/isNaN.md) | Test whether a value is NaN (not a number).
[math.isNegative(x)](functions/isNegative.md) | Test whether a value is negative: smaller than zero.
[math.isNumeric(x)](functions/isNumeric.md) | Test whether a value is an numeric value.
[math.isPositive(x)](functions/isPositive.md) | Test whether a value is positive: larger than zero.
[math.isPrime(x)](functions/isPrime.md) | Test whether a value is prime: has no divisors other than itself and one.
[math.isZero(x)](functions/isZero.md) | Test whether a value is zero.
[math.typeof(x)](functions/typeof.md) | Determine the type of a variable.



<!-- Note: This file is automatically generated from source code comments. Changes made in this file will be overridden. -->
