function factory (construction, config, load, typed) {
  var docs = {};


  // construction functions
  docs.bignumber = require('./construction/bignumber');
  docs['boolean'] = require('./construction/boolean');
  docs.complex = require('./construction/complex');
  docs.createUnit = require('./construction/createUnit');
  docs.fraction = require('./construction/fraction');
  docs.index = require('./construction/index');
  docs.matrix = require('./construction/matrix');
  docs.number = require('./construction/number');
  docs.sparse = require('./construction/sparse');
  docs.splitUnit = require('./construction/splitUnit');
  docs.string = require('./construction/string');
  docs.unit = require('./construction/unit');

  // constants
  docs.e = require('./constants/e');
  docs.E = require('./constants/e');
  docs['false'] = require('./constants/false');
  docs.i = require('./constants/i');
  docs['Infinity'] = require('./constants/Infinity');
  docs.LN2 = require('./constants/LN2');
  docs.LN10 = require('./constants/LN10');
  docs.LOG2E = require('./constants/LOG2E');
  docs.LOG10E = require('./constants/LOG10E');
  docs.NaN = require('./constants/NaN');
  docs['null'] = require('./constants/null');
  docs.pi = require('./constants/pi');
  docs.PI = require('./constants/pi');
  docs.phi = require('./constants/phi');
  docs.SQRT1_2 = require('./constants/SQRT1_2');
  docs.SQRT2 = require('./constants/SQRT2');
  docs.tau = require('./constants/tau');
  docs['true'] = require('./constants/true');
  docs.version = require('./constants/version');

  // physical constants
  // TODO: more detailed docs for physical constants
  docs.speedOfLight = {description: 'Speed of light in vacuum', examples: ['speedOfLight']};
  docs.gravitationConstant = {description: 'Newtonian constant of gravitation', examples: ['gravitationConstant']};
  docs.planckConstant = {description: 'Planck constant', examples: ['planckConstant']};
  docs.reducedPlanckConstant = {description: 'Reduced Planck constant', examples: ['reducedPlanckConstant']};

  docs.magneticConstant = {description: 'Magnetic constant (vacuum permeability)', examples: ['magneticConstant']};
  docs.electricConstant = {description: 'Electric constant (vacuum permeability)', examples: ['electricConstant']};
  docs.vacuumImpedance = {description: 'Characteristic impedance of vacuum', examples: ['vacuumImpedance']};
  docs.coulomb = {description: 'Coulomb\'s constant', examples: ['coulomb']};
  docs.elementaryCharge = {description: 'Elementary charge', examples: ['elementaryCharge']};
  docs.bohrMagneton = {description: 'Borh magneton', examples: ['bohrMagneton']};
  docs.conductanceQuantum = {description: 'Conductance quantum', examples: ['conductanceQuantum']};
  docs.inverseConductanceQuantum = {description: 'Inverse conductance quantum', examples: ['inverseConductanceQuantum']};
  //docs.josephson = {description: 'Josephson constant', examples: ['josephson']};
  docs.magneticFluxQuantum = {description: 'Magnetic flux quantum', examples: ['magneticFluxQuantum']};
  docs.nuclearMagneton = {description: 'Nuclear magneton', examples: ['nuclearMagneton']};
  docs.klitzing = {description: 'Von Klitzing constant', examples: ['klitzing']};

  docs.bohrRadius = {description: 'Borh radius', examples: ['bohrRadius']};
  docs.classicalElectronRadius = {description: 'Classical electron radius', examples: ['classicalElectronRadius']};
  docs.electronMass = {description: 'Electron mass', examples: ['electronMass']};
  docs.fermiCoupling = {description: 'Fermi coupling constant', examples: ['fermiCoupling']};
  docs.fineStructure = {description: 'Fine-structure constant', examples: ['fineStructure']};
  docs.hartreeEnergy = {description: 'Hartree energy', examples: ['hartreeEnergy']};
  docs.protonMass = {description: 'Proton mass', examples: ['protonMass']};
  docs.deuteronMass = {description: 'Deuteron Mass', examples: ['deuteronMass']};
  docs.neutronMass = {description: 'Neutron mass', examples: ['neutronMass']};
  docs.quantumOfCirculation = {description: 'Quantum of circulation', examples: ['quantumOfCirculation']};
  docs.rydberg = {description: 'Rydberg constant', examples: ['rydberg']};
  docs.thomsonCrossSection = {description: 'Thomson cross section', examples: ['thomsonCrossSection']};
  docs.weakMixingAngle = {description: 'Weak mixing angle', examples: ['weakMixingAngle']};
  docs.efimovFactor = {description: 'Efimov factor', examples: ['efimovFactor']};

  docs.atomicMass = {description: 'Atomic mass constant', examples: ['atomicMass']};
  docs.avogadro = {description: 'Avogadro\'s number', examples: ['avogadro']};
  docs.boltzmann = {description: 'Boltzmann constant', examples: ['boltzmann']};
  docs.faraday = {description: 'Faraday constant', examples: ['faraday']};
  docs.firstRadiation = {description: 'First radiation constant', examples: ['firstRadiation']};
  docs.loschmidt = {description: 'Loschmidt constant at T=273.15 K and p=101.325 kPa', examples: ['loschmidt']};
  docs.gasConstant = {description: 'Gas constant', examples: ['gasConstant']};
  docs.molarPlanckConstant = {description: 'Molar Planck constant', examples: ['molarPlanckConstant']};
  docs.molarVolume = {description: 'Molar volume of an ideal gas at T=273.15 K and p=101.325 kPa', examples: ['molarVolume']};
  docs.sackurTetrode = {description: 'Sackur-Tetrode constant at T=1 K and p=101.325 kPa', examples: ['sackurTetrode']};
  docs.secondRadiation = {description: 'Second radiation constant', examples: ['secondRadiation']};
  docs.stefanBoltzmann = {description: 'Stefan-Boltzmann constant', examples: ['stefanBoltzmann']};
  docs.wienDisplacement = {description: 'Wien displacement law constant', examples: ['wienDisplacement']};
  //docs.spectralRadiance = {description: 'First radiation constant for spectral radiance', examples: ['spectralRadiance']};

  docs.molarMass = {description: 'Molar mass constant', examples: ['molarMass']};
  docs.molarMassC12 = {description: 'Molar mass constant of carbon-12', examples: ['molarMassC12']};
  docs.gravity = {description: 'Standard acceleration of gravity (standard acceleration of free-fall on Earth)', examples: ['gravity']};

  docs.planckLength = {description: 'Planck length', examples: ['planckLength']};
  docs.planckMass = {description: 'Planck mass', examples: ['planckMass']};
  docs.planckTime = {description: 'Planck time', examples: ['planckTime']};
  docs.planckCharge = {description: 'Planck charge', examples: ['planckCharge']};
  docs.planckTemperature = {description: 'Planck temperature', examples: ['planckTemperature']};

  // functions - algebra
  docs.derivative = require('./function/algebra/derivative');
  docs.lsolve = require('./function/algebra/lsolve');
  docs.lup = require('./function/algebra/lup');
  docs.lusolve = require('./function/algebra/lusolve');
  docs.simplify = require('./function/algebra/simplify');
  docs.rationalize = require('./function/algebra/rationalize');
  docs.slu = require('./function/algebra/slu');
  docs.usolve = require('./function/algebra/usolve');
  docs.qr = require('./function/algebra/qr');

  // functions - arithmetic
  docs.abs = require('./function/arithmetic/abs');
  docs.add = require('./function/arithmetic/add');
  docs.cbrt = require('./function/arithmetic/cbrt');
  docs.ceil = require('./function/arithmetic/ceil');
  docs.cube = require('./function/arithmetic/cube');
  docs.divide = require('./function/arithmetic/divide');
  docs.dotDivide = require('./function/arithmetic/dotDivide');
  docs.dotMultiply = require('./function/arithmetic/dotMultiply');
  docs.dotPow = require('./function/arithmetic/dotPow');
  docs.exp = require('./function/arithmetic/exp');
  docs.fix = require('./function/arithmetic/fix');
  docs.floor = require('./function/arithmetic/floor');
  docs.gcd = require('./function/arithmetic/gcd');
  docs.hypot = require('./function/arithmetic/hypot');
  docs.lcm = require('./function/arithmetic/lcm');
  docs.log = require('./function/arithmetic/log');
  docs.log10 = require('./function/arithmetic/log10');
  docs.mod = require('./function/arithmetic/mod');
  docs.multiply = require('./function/arithmetic/multiply');
  docs.norm = require('./function/arithmetic/norm');
  docs.nthRoot = require('./function/arithmetic/nthRoot');
  docs.pow = require('./function/arithmetic/pow');
  docs.round = require('./function/arithmetic/round');
  docs.sign = require('./function/arithmetic/sign');
  docs.sqrt = require('./function/arithmetic/sqrt');
  docs.square = require('./function/arithmetic/square');
  docs.subtract = require('./function/arithmetic/subtract');
  docs.unaryMinus = require('./function/arithmetic/unaryMinus');
  docs.unaryPlus = require('./function/arithmetic/unaryPlus');
  docs.xgcd = require('./function/arithmetic/xgcd');

  // functions - bitwise
  docs.bitAnd = require('./function/bitwise/bitAnd');
  docs.bitNot = require('./function/bitwise/bitNot');
  docs.bitOr = require('./function/bitwise/bitOr');
  docs.bitXor = require('./function/bitwise/bitXor');
  docs.leftShift = require('./function/bitwise/leftShift');
  docs.rightArithShift = require('./function/bitwise/rightArithShift');
  docs.rightLogShift = require('./function/bitwise/rightLogShift');

  // functions - combinatorics
  docs.bellNumbers = require('./function/combinatorics/bellNumbers');
  docs.catalan = require('./function/combinatorics/catalan');
  docs.composition = require('./function/combinatorics/composition');
  docs.stirlingS2 = require('./function/combinatorics/stirlingS2');

  // functions - core
  docs['config'] =  require('./core/config');
  docs['import'] =  require('./core/import');
  docs['typed'] =  require('./core/typed');

  // functions - complex
  docs.arg = require('./function/complex/arg');
  docs.conj = require('./function/complex/conj');
  docs.re = require('./function/complex/re');
  docs.im = require('./function/complex/im');

  // functions - expression
  docs['eval'] =  require('./function/expression/eval');
  docs.help =  require('./function/expression/help');

  // functions - geometry
  docs.distance = require('./function/geometry/distance');
  docs.intersect = require('./function/geometry/intersect');

  // functions - logical
  docs['and'] = require('./function/logical/and');
  docs['not'] = require('./function/logical/not');
  docs['or'] = require('./function/logical/or');
  docs['xor'] = require('./function/logical/xor');

  // functions - matrix
  docs['concat'] = require('./function/matrix/concat');
  docs.cross = require('./function/matrix/cross');
  docs.det = require('./function/matrix/det');
  docs.diag = require('./function/matrix/diag');
  docs.dot = require('./function/matrix/dot');
  docs.eye = require('./function/matrix/eye');
  docs.filter =  require('./function/matrix/filter');
  docs.flatten = require('./function/matrix/flatten');
  docs.forEach =  require('./function/matrix/forEach');
  docs.inv = require('./function/matrix/inv');
  docs.kron = require('./function/matrix/kron');
  docs.map =  require('./function/matrix/map');
  docs.ones = require('./function/matrix/ones');
  docs.partitionSelect =  require('./function/matrix/partitionSelect');
  docs.range = require('./function/matrix/range');
  docs.resize = require('./function/matrix/resize');
  docs.reshape = require('./function/matrix/reshape');
  docs.size = require('./function/matrix/size');
  docs.sort =  require('./function/matrix/sort');
  docs.squeeze = require('./function/matrix/squeeze');
  docs.subset = require('./function/matrix/subset');
  docs.trace = require('./function/matrix/trace');
  docs.transpose = require('./function/matrix/transpose');
  docs.zeros = require('./function/matrix/zeros');

  // functions - probability
  docs.combinations = require('./function/probability/combinations');
  //docs.distribution = require('./function/probability/distribution');
  docs.factorial = require('./function/probability/factorial');
  docs.gamma = require('./function/probability/gamma');
  docs.kldivergence = require('./function/probability/kldivergence');
  docs.multinomial = require('./function/probability/multinomial');
  docs.permutations = require('./function/probability/permutations');
  docs.pickRandom = require('./function/probability/pickRandom');
  docs.random = require('./function/probability/random');
  docs.randomInt = require('./function/probability/randomInt');

  // functions - relational
  docs.compare = require('./function/relational/compare');
  docs.compareNatural = require('./function/relational/compareNatural');
  docs.deepEqual = require('./function/relational/deepEqual');
  docs['equal'] = require('./function/relational/equal');
  docs.larger = require('./function/relational/larger');
  docs.largerEq = require('./function/relational/largerEq');
  docs.smaller = require('./function/relational/smaller');
  docs.smallerEq = require('./function/relational/smallerEq');
  docs.unequal = require('./function/relational/unequal');

  // functions - set
  docs.setCartesian = require('./function/set/setCartesian');
  docs.setDifference = require('./function/set/setDifference');
  docs.setDistinct = require('./function/set/setDistinct');
  docs.setIntersect = require('./function/set/setIntersect');
  docs.setIsSubset = require('./function/set/setIsSubset');
  docs.setMultiplicity = require('./function/set/setMultiplicity');
  docs.setPowerset = require('./function/set/setPowerset');
  docs.setSize = require('./function/set/setSize');
  docs.setSymDifference = require('./function/set/setSymDifference');
  docs.setUnion = require('./function/set/setUnion');

  // functions - special
  docs.erf = require('./function/special/erf');

  // functions - statistics
  docs.mad = require('./function/statistics/mad');
  docs.max = require('./function/statistics/max');
  docs.mean = require('./function/statistics/mean');
  docs.median = require('./function/statistics/median');
  docs.min = require('./function/statistics/min');
  docs.mode = require('./function/statistics/mode');
  docs.prod = require('./function/statistics/prod');
  docs.quantileSeq = require('./function/statistics/quantileSeq');
  docs.std = require('./function/statistics/std');
  docs.sum = require('./function/statistics/sum');
  docs['var'] = require('./function/statistics/var');

  // functions - trigonometry
  docs.acos = require('./function/trigonometry/acos');
  docs.acosh = require('./function/trigonometry/acosh');
  docs.acot = require('./function/trigonometry/acot');
  docs.acoth = require('./function/trigonometry/acoth');
  docs.acsc = require('./function/trigonometry/acsc');
  docs.acsch = require('./function/trigonometry/acsch');
  docs.asec = require('./function/trigonometry/asec');
  docs.asech = require('./function/trigonometry/asech');
  docs.asin = require('./function/trigonometry/asin');
  docs.asinh = require('./function/trigonometry/asinh');
  docs.atan = require('./function/trigonometry/atan');
  docs.atanh = require('./function/trigonometry/atanh');
  docs.atan2 = require('./function/trigonometry/atan2');
  docs.cos = require('./function/trigonometry/cos');
  docs.cosh = require('./function/trigonometry/cosh');
  docs.cot = require('./function/trigonometry/cot');
  docs.coth = require('./function/trigonometry/coth');
  docs.csc = require('./function/trigonometry/csc');
  docs.csch = require('./function/trigonometry/csch');
  docs.sec = require('./function/trigonometry/sec');
  docs.sech = require('./function/trigonometry/sech');
  docs.sin = require('./function/trigonometry/sin');
  docs.sinh = require('./function/trigonometry/sinh');
  docs.tan = require('./function/trigonometry/tan');
  docs.tanh = require('./function/trigonometry/tanh');

  // functions - units
  docs.to = require('./function/units/to');

  // functions - utils
  docs.clone = require('./function/utils/clone');
  docs.format = require('./function/utils/format');
  docs.isNaN = require('./function/utils/isNaN');
  docs.isInteger = require('./function/utils/isInteger');
  docs.isNegative = require('./function/utils/isNegative');
  docs.isNumeric = require('./function/utils/isNumeric');
  docs.isPositive = require('./function/utils/isPositive');
  docs.isPrime = require('./function/utils/isPrime');
  docs.isZero = require('./function/utils/isZero');
  // docs.print = require('./function/utils/print'); // TODO: add documentation for print as soon as the parser supports objects.
  docs['typeof'] =  require('./function/utils/typeof');

  return docs;
}

exports.name = 'docs';
exports.path = 'expression';
exports.factory = factory;
