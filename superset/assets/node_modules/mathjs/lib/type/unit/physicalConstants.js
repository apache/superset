var lazy = require('../../utils/object').lazy;


function factory (type, config, load, typed, math) {

  // helper function to create a unit with a fixed prefix
  function fixedUnit(str) {
    var unit = type.Unit.parse(str);
    unit.fixPrefix = true;
    return unit;
  }

  // Source: http://www.wikiwand.com/en/Physical_constant

  // Universal constants
  setLazyConstant(math, 'speedOfLight',         function () {return fixedUnit('299792458 m s^-1')});
  setLazyConstant(math, 'gravitationConstant',  function () {return fixedUnit('6.6738480e-11 m^3 kg^-1 s^-2')});
  setLazyConstant(math, 'planckConstant',       function () {return fixedUnit('6.626069311e-34 J s')});
  setLazyConstant(math, 'reducedPlanckConstant',function () {return fixedUnit('1.05457172647e-34 J s')});

  // Electromagnetic constants
  setLazyConstant(math, 'magneticConstant',          function () {return fixedUnit('1.2566370614e-6 N A^-2')});
  setLazyConstant(math, 'electricConstant',          function () {return fixedUnit('8.854187817e-12 F m^-1')});
  setLazyConstant(math, 'vacuumImpedance',           function () {return fixedUnit('376.730313461 ohm')});
  setLazyConstant(math, 'coulomb',                   function () {return fixedUnit('8.9875517873681764e9 N m^2 C^-2')});
  setLazyConstant(math, 'elementaryCharge',          function () {return fixedUnit('1.60217656535e-19 C')});
  setLazyConstant(math, 'bohrMagneton',              function () {return fixedUnit('9.2740096820e-24 J T^-1')});
  setLazyConstant(math, 'conductanceQuantum',        function () {return fixedUnit('7.748091734625e-5 S')});
  setLazyConstant(math, 'inverseConductanceQuantum', function () {return fixedUnit('12906.403721742 ohm')});
  setLazyConstant(math, 'magneticFluxQuantum',       function () {return fixedUnit('2.06783375846e-15 Wb')});
  setLazyConstant(math, 'nuclearMagneton',           function () {return fixedUnit('5.0507835311e-27 J T^-1')});
  setLazyConstant(math, 'klitzing',                  function () {return fixedUnit('25812.807443484 ohm')});
  //setLazyConstant(math, 'josephson',                 function () {return fixedUnit('4.8359787011e-14 Hz V^-1')});  // TODO: support for Hz needed

  // Atomic and nuclear constants
  setLazyConstant(math, 'bohrRadius',              function () {return fixedUnit('5.291772109217e-11 m')});
  setLazyConstant(math, 'classicalElectronRadius', function () {return fixedUnit('2.817940326727e-15 m')});
  setLazyConstant(math, 'electronMass',            function () {return fixedUnit('9.1093829140e-31 kg')});
  setLazyConstant(math, 'fermiCoupling',           function () {return fixedUnit('1.1663645e-5 GeV^-2')});
  setLazyConstant(math, 'fineStructure',           function () {return 7.297352569824e-3});
  setLazyConstant(math, 'hartreeEnergy',           function () {return fixedUnit('4.3597443419e-18 J')});
  setLazyConstant(math, 'protonMass',              function () {return fixedUnit('1.67262177774e-27 kg')});
  setLazyConstant(math, 'deuteronMass',            function () {return fixedUnit('3.3435830926e-27 kg')});
  setLazyConstant(math, 'neutronMass',             function () {return fixedUnit('1.6749271613e-27 kg')});
  setLazyConstant(math, 'quantumOfCirculation',    function () {return fixedUnit('3.636947552024e-4 m^2 s^-1')});
  setLazyConstant(math, 'rydberg',                 function () {return fixedUnit('10973731.56853955 m^-1')});
  setLazyConstant(math, 'thomsonCrossSection',     function () {return fixedUnit('6.65245873413e-29 m^2')});
  setLazyConstant(math, 'weakMixingAngle',         function () {return 0.222321});
  setLazyConstant(math, 'efimovFactor',            function () {return 22.7});

  // Physico-chemical constants
  setLazyConstant(math, 'atomicMass',          function () {return fixedUnit('1.66053892173e-27 kg')});
  setLazyConstant(math, 'avogadro',            function () {return fixedUnit('6.0221412927e23 mol^-1')});
  setLazyConstant(math, 'boltzmann',           function () {return fixedUnit('1.380648813e-23 J K^-1')});
  setLazyConstant(math, 'faraday',             function () {return fixedUnit('96485.336521 C mol^-1')});
  setLazyConstant(math, 'firstRadiation',      function () {return fixedUnit('3.7417715317e-16 W m^2')});
  // setLazyConstant(math, 'spectralRadiance',   function () {return fixedUnit('1.19104286953e-16 W m^2 sr^-1')}); // TODO spectralRadiance
  setLazyConstant(math, 'loschmidt',           function () {return fixedUnit('2.686780524e25 m^-3')});
  setLazyConstant(math, 'gasConstant',         function () {return fixedUnit('8.314462175 J K^-1 mol^-1')});
  setLazyConstant(math, 'molarPlanckConstant', function () {return fixedUnit('3.990312717628e-10 J s mol^-1')});
  setLazyConstant(math, 'molarVolume',         function () {return fixedUnit('2.241396820e-10 m^3 mol^-1')});
  setLazyConstant(math, 'sackurTetrode',       function () {return -1.164870823});
  setLazyConstant(math, 'secondRadiation',     function () {return fixedUnit('1.438777013e-2 m K')});
  setLazyConstant(math, 'stefanBoltzmann',     function () {return fixedUnit('5.67037321e-8 W m^-2 K^-4')});
  setLazyConstant(math, 'wienDisplacement',    function () {return fixedUnit('2.897772126e-3 m K')});

  // Adopted values
  setLazyConstant(math, 'molarMass',         function () {return fixedUnit('1e-3 kg mol^-1')});
  setLazyConstant(math, 'molarMassC12',      function () {return fixedUnit('1.2e-2 kg mol^-1')});
  setLazyConstant(math, 'gravity',           function () {return fixedUnit('9.80665 m s^-2')});
  // atm is defined in Unit.js

  // Natural units
  setLazyConstant(math, 'planckLength',      function () {return fixedUnit('1.61619997e-35 m')});
  setLazyConstant(math, 'planckMass',        function () {return fixedUnit('2.1765113e-8 kg')});
  setLazyConstant(math, 'planckTime',        function () {return fixedUnit('5.3910632e-44 s')});
  setLazyConstant(math, 'planckCharge',      function () {return fixedUnit('1.87554595641e-18 C')});
  setLazyConstant(math, 'planckTemperature', function () {return fixedUnit('1.41683385e+32 K')});

}

// create a lazy constant in both math and mathWithTransform
function setLazyConstant (math, name, resolver) {
  lazy(math, name,  resolver);
  lazy(math.expression.mathWithTransform, name,  resolver);
}

exports.factory = factory;
exports.lazy = false;  // no lazy loading of constants, the constants themselves are lazy when needed
exports.math = true;   // request access to the math namespace
