# Units

Math.js supports units. Units can be used to do calculations and to perform
conversions.

## Usage

Units can be created using the function `math.unit`. This function accepts
either a single string argument containing a value and unit, or two arguments,
the first being a numeric value and the second a string containing a unit.
Most units support prefixes like `k` or `kilo`, and many units have both a
full name and an abbreviation. The returned object is a `Unit`.

Syntax:

```js
math.unit(value: number, name: string) : Unit
math.unit(unit: string) : Unit
math.unit(unit: Unit) : Unit
```

Example usage:

```js
var a = math.unit(45, 'cm');            // Unit 450 mm
var b = math.unit('0.1 kilogram');      // Unit 100 gram
var c = math.unit('2 inch');            // Unit 2 inch
var d = math.unit('90 km/h');           // Unit 90 km/h
var e = math.unit('101325 kg/(m s^2)'); // Unit 101325 kg / (m s^2)
```

```js
var a = math.unit(55, 'cm');        // Unit 550 mm
var b = math.unit('0.1 kilogram');  // Unit 100 gram
var c = math.unit('2 inch');        // Unit 100 millimeter

var d = c.to('cm');                 // Unit 5.08 cm
b.toNumber('gram');                 // Number 100
math.number(b, 'gram');             // Number 100

c.equals(a);                        // false
c.equals(d);                        // true
c.equalBase(a);                     // true
c.equalBase(b);                     // false

d.toString();                       // String "5.08 cm"
```

Use care when creating a unit with multiple terms in the denominator. Implicit multiplication has the same operator precedence as explicit multiplication and division, which means these three expressions are identical:

```js
// These three are identical
var correct1 = math.unit('8.314 m^3 Pa / mol / K');         // Unit 8.314 (m^3 Pa) / (mol K)
var correct2 = math.unit('8.314 (m^3 Pa) / (mol K)');       // Unit 8.314 (m^3 Pa) / (mol K)
var correct3 = math.unit('8.314 (m^3 * Pa) / (mol * K)');   // Unit 8.314 (m^3 Pa) / (mol K)
```
But this expression, which omits the second `/` between `mol` and `K`, results in the wrong value:

```js
// Missing the second '/' between 'mol' and 'K'
var incorrect = math.unit('8.314 m^3 Pa / mol K');          // Unit 8.314 (m^3 Pa K) / mol
```

## Calculations

The operations that support units are `add`, `subtract`, `multiply`, `divide`, `pow`, `abs`, `sqrt`, `square`, `cube`, and `sign`.
Trigonometric functions like `cos` are also supported when the argument is an angle.

```js
var a = math.unit(45, 'cm');        // Unit 450 mm
var b = math.unit('0.1m');          // Unit 100 mm
math.add(a, b);                     // Unit 0.65 m
math.multiply(b, 2);                // Unit 200 mm

var c = math.unit(45, 'deg');       // Unit 45 deg
math.cos(c);                        // Number 0.7071067811865476

// Kinetic energy of average sedan on highway
var d = math.unit('80 mi/h')        // Unit 80 mi/h
var e = math.unit('2 tonne')        // Unit 2 tonne
var f = math.multiply(0.5, math.multipy(math.pow(d, 2), e));
                                    // 1.2790064742399996 MJ
```

Operations with arrays are supported too:

```js
// Force on a charged particle moving through a magnetic field
var B = math.eval('[1, 0, 0] T');            // [1 T, 0 T, 0 T]
var v = math.eval('[0, 1, 0] m/s');          // [0 m / s, 1 m / s, 0 m / s]
var q = math.eval('1 C');                    // 1 C

var F = math.multiply(q, math.cross(v, B));  // [0 N, 0 N, -1 N]
```

All arithmetic operators act on the value of the unit as it is represented in SI units.
This may lead to surprising behavior when working with temperature scales like `celsius` (or `degC`) and `fahrenheit` (or `degF`).
In general you should avoid calculations using `celsius` and `fahrenheit`. Rather, use `kelvin` (or `K`) and `rankine` (or `R`) instead.
This example highlights some problems when using `celsius` and `fahrenheit` in calculations:

```js
var T_14F = math.unit('14 degF');          // Unit 14 degF (263.15 K)
var T_28F = math.multiply(T1, 2);          // Unit 487.67 degF (526.3 K), not 28 degF

var Tnegative = math.unit(-13, 'degF');    // Unit -13 degF (248.15 K)
var Tpositive = math.abs(T1);              // Unit -13 degF (248.15 K), not 13 degF

var Trate1 = math.eval('5 (degC/hour)');   // Unit 5 degC/hour
var Trate2 = math.eval('(5 degC)/hour');   // Unit 278.15 degC/hour
```

The expression parser supports units too. This is described in the section about
units on the page [Syntax](../expressions/syntax.md#units).

## User-Defined Units

You can add your own units to Math.js using the `math.createUnit` function. The following example defines a new unit `furlong`, then uses the user-defined unit in a calculation:

```js
math.createUnit('furlong', '220 yards');
math.eval('1 mile to furlong');            // 8 furlong
```

If you cannot express the new unit in terms of any existing unit, then the second argument can be omitted. In this case, a new base unit is created:

```js
// A 'foo' cannot be expressed in terms of any other unit.
math.createUnit('foo');
math.eval('8 foo * 4 feet');               // 32 foo feet
```

The second argument to `createUnit` can also be a configuration object consisting of the following properties:

* **definition** A `string` or `Unit` which defines the user-defined unit in terms of existing built-in or user-defined units. If omitted, a new base unit is created.
* **prefixes** A `string` indicating which prefixes math.js should use with the new unit. Possible values are `'none'`, `'short'`, `'long'`, `'binary_short'`, or `'binary_long'`. Default is `'none'`.
* **offset** A value applied when converting to the unit. This is very helpful for temperature scales that do not share a zero with the absolute temperature scale. For example, if we were defining fahrenheit for the first time, we would use: `math.createUnit('fahrenheit', {definition: '0.555556 kelvin', offset: 459.67})`
* **aliases** An array of strings to alias the new unit. Example: `math.createUnit('knot', {definition: '0.514444 m/s', aliases: ['knots', 'kt', 'kts']})`

An optional `options` object can also be supplied as the last argument to `createUnits`. Currently only the `override` option is supported:

```js
// Redefine the mile (would not be the first time in history)
math.createUnit('mile', '1609.347218694', {override: true}});
```
Base units created without specifying a definition cannot be overridden.

Multiple units can defined using a single call to `createUnit` by passing an object map as the first argument, where each key in the object is the name of a new unit and the value is either a string defining the unit, or an object with the configuration properties listed above. If the value is an empty string or an object lacking a definition property, a new base unit is created.

For example:

```js
math.createUnit( {
  foo: {
    prefixes: 'long'
  },
  bar: '40 foo',
  baz: {
    definition: '1 bar/hour',
    prefixes: 'long'
  }
},
{
  override: true
});
math.eval('50000 kilofoo/s');   // 4.5 gigabaz
```

### Return Value
`createUnit` returns the created unit, or, when multiple units are created, the last unit created. Since `createUnit` is also compatible with the expression parser, this allows you to do things like this:

```js
math.eval('45 mile/hour to createUnit("knot", "0.514444m/s")')
// 39.103964668651976 knot
```

## API
A `Unit` object contains the following functions:

### unit.clone()
Clone the unit, returns a new unit with the same parameters.

### unit.equalBase(unit)
Test whether a unit has the same base as an other unit:
length, mass, etc.

### unit.equals(unit)
Test whether a unit equals an other unit. Units are equal
when they have the same base and same value when normalized to SI units.

### unit.format([options])
Get a string representation of the unit. The function
will determine the best fitting prefix for the unit. See the [Format](../functions/format.md)
page for available options.

### unit.fromJSON(json)
Revive a unit from a JSON object. Accepts
An object `{mathjs: 'Unit', value: number, unit: string, fixPrefix: boolean}`,
where the property `mathjs` and `fixPrefix` are optional.
Used when deserializing a unit, see [Serialization](../core/serialization.md).

### unit.splitUnit(parts)
Split a unit into the specified parts. For example:

```js
var u = math.unit(1, 'm');
u.splitUnit(['ft', 'in']);    // 3 feet,3.3700787401574765 inch
```

### unit.to(unitName)
Convert the unit to a specific unit name. Returns a clone of
the unit with a fixed prefix and unit.

### unit.toJSON()
Returns a JSON representation of the unit, with signature
`{mathjs: 'Unit', value: number, unit: string, fixPrefix: boolean}`.
Used when serializing a unit, see [Serialization](../core/serialization.md).

### unit.toNumber(unitName)
Get the value of a unit when converted to the
specified unit (a unit with optional prefix but without value).
The type of the returned value is always `number`.

### unit.toNumeric(unitName)
Get the value of a unit when converted to the
specified unit (a unit with optional prefix but without value).
The type of the returned value depends on how the unit was created and 
can be `number`, `Fraction`, or `BigNumber`.

### unit.toSI()
Returns a clone of a unit represented in SI units. Works with units with or without a value.

### unit.toString()
Get a string representation of the unit. The function will
determine the best fitting prefix for the unit.

## Unit reference

This section lists all available units, prefixes, and physical constants. These can be used via the Unit object, or via `math.eval()`.

## Reference

Math.js comes with the following built-in units.

Base                | Unit
------------------- | ---
Length              | meter (m), inch (in), foot (ft), yard (yd), mile (mi), link (li), rod (rd), chain (ch), angstrom, mil
Surface area        | m2, sqin, sqft, sqyd, sqmi, sqrd, sqch, sqmil, acre, hectare
Volume              | m3, litre (l, L, lt, liter), cc, cuin, cuft, cuyd, teaspoon, tablespoon
Liquid volume       | minim (min), fluiddram (fldr), fluidounce (floz), gill (gi), cup (cp), pint (pt), quart (qt), gallon (gal), beerbarrel (bbl), oilbarrel (obl), hogshead, drop (gtt)
Angles              | rad (radian), deg (degree), grad (gradian), cycle, arcsec (arcsecond), arcmin (arcminute) 
Time                | second (s, secs, seconds), minute (mins, minutes), hour (h, hr, hrs, hours), day (days), week (weeks), month (months), year (years), decade (decades), century (centuries), millennium (millennia)
Frequency           | hertz (Hz)
Mass                | gram(g), tonne, ton, grain (gr), dram (dr), ounce (oz), poundmass (lbm, lb, lbs), hundredweight (cwt), stick, stone
Electric current    | ampere (A)
Temperature         | kelvin (K), celsius (degC), fahrenheit (degF), rankine (degR)
Amount of substance | mole (mol)
Luminous intensity  | candela (cd)
Force               | newton (N), dyne (dyn), poundforce (lbf), kip
Energy              | joule (J), erg, Wh, BTU, electronvolt (eV)
Power               | watt (W), hp
Pressure            | Pa, psi, atm, torr, bar, mmHg, mmH2O, cmH2O
Electricity and magnetism | ampere (A), coulomb (C), watt (W), volt (V), ohm, farad (F), weber (Wb), tesla (T), henry (H), siemens (S), electronvolt (eV)
Binary              | bit (b), byte (B)

Note: all time units are based on the Julian year, with one month being 1/12th of a Julian year, a year being one Julian year, a decade being 10 Julian years, a century being 100, and a millennium being 1000.

Note that all relevant units can also be written in plural form, for example `5 meters` instead of `5 meter` or `10 seconds` instead of `10 second`. 

Surface and volume units can alternatively be expressed in terms of length units raised to a power, for example `100 in^2` instead of `100 sqin`.

### Prefixes

The following decimal prefixes are available.

Name    | Abbreviation  | Value
------- | ------------- | -----
deca    | da            | 1e1
hecto   | h             | 1e2
kilo    | k             | 1e3
mega    | M             | 1e6
giga    | G             | 1e9
tera    | T             | 1e12
peta    | P             | 1e15
exa     | E             | 1e18
zetta   | Z             | 1e21
yotta   | Y             | 1e24

Name    | Abbreviation  | Value
------  | ------------- | -----
deci    | d             | 1e-1
centi   | c             | 1e-2
milli   | m             | 1e-3
micro   | u             | 1e-6
nano    | n             | 1e-9
pico    | p             | 1e-12
femto   | f             | 1e-15
atto    | a             | 1e-18
zepto   | z             | 1e-21
yocto   | y             | 1e-24

The following binary prefixes are available.
They can be used with units `bit` (`b`) and `byte` (`B`).

Name | Abbreviation | Value
---- | ------------ | -----
kibi | Ki           | 1024
mebi | Mi           | 1024^2
gibi | Gi           | 1024^3
tebi | Ti           | 1024^4
pebi | Pi           | 1024^5
exi  | Ei           | 1024^6
zebi | Zi           | 1024^7
yobi | Yi           | 1024^8

Name  | Abbreviation | Value
----- | ------------ | -----
kilo  | k            | 1e3
mega  | M            | 1e6
giga  | G            | 1e9
tera  | T            | 1e12
peta  | P            | 1e15
exa   | E            | 1e18
zetta | Z            | 1e21
yotta | Y            | 1e24


### Physical Constants

Math.js includes the following physical constants. See [Wikipedia](http://en.wikipedia.org/wiki/Physical_constants) for more information.


#### Universal constants

Name                  | Symbol                                                 | Value             | Unit
----------------------|--------------------------------------------------------|-------------------|-------------------------------------------------------
speedOfLight          | <i>c</i>                                               | 299792458         | m &#183; s<sup>-1</sup>
gravitationConstant   | <i>G</i>                                               | 6.6738480e-11     | m<sup>3</sup> &#183; kg<sup>-1</sup> &#183; s<sup>-2</sup>
planckConstant        | <i>h</i>                                               | 6.626069311e-34   | J &#183; s
reducedPlanckConstant | <i><span style="text-decoration:overline">h</span></i> | 1.05457172647e-34 | J &#183; s 


#### Electromagnetic constants

Name                      | Symbol                                           | Value                 | Unit
--------------------------|--------------------------------------------------|-----------------------|----------------------------------------
magneticConstant          | <i>&mu;<sub>0</sub></i>                          | 1.2566370614e-6       | N &#183; A<sup>-2</sup>
electricConstant          | <i>&epsilon;<sub>0</sub></i>                     | 8.854187817e-12       | F &#183; m<sup>-1</sup>
vacuumImpedance           | <i>Z<sub>0</sub></i>                             | 376.730313461         | &ohm;
coulomb                   | <i>&kappa;</i>                                   | 8.9875517873681764e9  | N &#183; m<sup>2</sup> &#183; C<sup>-2</sup>
elementaryCharge          | <i>e</i>                                         | 1.60217656535e-19     | C
bohrMagneton              | <i>&mu;<sub>B</sub></i>                          | 9.2740096820e-24      | J &#183; T<sup>-1</sup>
conductanceQuantum        | <i>G<sub>0</sub></i>                             | 7.748091734625e-5     | S
inverseConductanceQuantum | <i>G<sub>0</sub><sup>-1</sup></i>                | 12906.403721742       | &ohm;
magneticFluxQuantum       | <i><font face="Symbol">f</font><sub>0</sub></i>  | 2.06783375846e-15     | Wb
nuclearMagneton           | <i>&mu;<sub>N</sub></i>                          | 5.0507835311e-27      | J &#183; T<sup>-1</sup>
klitzing                  | <i>R<sub>K</sub></i>                             | 25812.807443484       | &ohm;

<!-- TODO: implement josephson
josephson                 | <i>K<sub>J</sub></i>                             | 4.8359787011e-14    | Hz &#183; V<sup>-1</sup> 
-->


#### Atomic and nuclear constants

Name                    | Symbol                | Value                 | Unit
------------------------|------------------------------|-----------------------|----------------------------------
bohrRadius              | <i>a<sub>0</sub></i>         | 5.291772109217e-11    | m
classicalElectronRadius | <i>r<sub>e</sub></i>         | 2.817940326727e-15    | m
electronMass            | <i>m<sub>e</sub></i>         | 9.1093829140e-31      | kg
fermiCoupling           | <i>G<sub>F</sub></i>         | 1.1663645e-5          | GeV<sup>-2</sup>
fineStructure           | <i>&alpha;</i>               | 7.297352569824e-3     | -
hartreeEnergy           | <i>E<abbr>h</abbr> </i>      | 4.3597443419e-18      | J
protonMass              | <i>m<sub>p</sub></i>         | 1.67262177774e-27     | kg
deuteronMass            | <i>m<sub>d</sub></i>         | 3.3435830926e-27      | kg
neutronMass             | <i>m<sub>n</sub></i>         | 1.6749271613e-27      | kg
quantumOfCirculation    | <i>h / (2m<sub>e</sub>)</i>  | 3.636947552024e-4     | m<sup>2</sup> &#183; s<sup>-1</sup>
rydberg                 | <i>R<sub>&infin;</sub></i>   | 10973731.56853955     | m<sup>-1</sup>
thomsonCrossSection     |                              | 6.65245873413e-29     | m<sup>2</sup>
weakMixingAngle         |                              | 0.222321              | -
efimovFactor            |                              | 22.7                  | -


#### Physico-chemical constants

Name                | Symbol                       | Value               | Unit
--------------------|------------------------------|---------------------|--------------------------------------------
atomicMass          | <i>m<sub>u</sub></i>         | 1.66053892173e-27   | kg
avogadro            | <i>N<sub>A</sub></i>         | 6.0221412927e23     | mol<sup>-1</sup>
boltzmann           | <i>k</i>                     | 1.380648813e-23     | J &#183; K<sup>-1</sup>
faraday             | <i>F</i>                     | 96485.336521        | C &#183; mol<sup>-1</sup>
firstRadiation      | <i>c<sub>1</sub></i>         | 3.7417715317e-16    | W &#183; m<sup>2</sup>
loschmidt           | <i>n<sub>0</sub></i>         | 2.686780524e25      | m<sup>-3</sup>
gasConstant         | <i>R</i>                     | 8.314462175         | J &#183; K<sup>-1</sup> &#183; mol<sup>-1</sup>
molarPlanckConstant | <i>N<sub>A</sub> &#183; h</i>| 3.990312717628e-10| J &#183; s &#183; mol<sup>-1</sup>
molarVolume         | <i>V<sub>m</sub></i>         | 2.241396820e-10     | m<sup>3</sup> &#183; mol<sup>-1</sup>
sackurTetrode       |                              | -1.164870823        | -
secondRadiation     | <i>c<sub>2</sub></i>         | 1.438777013e-2      | m &#183; K
stefanBoltzmann     | <i>&sigma;</i>               | 5.67037321e-8       | W &#183; m<sup>-2</sup> &#183; K<sup>-4</sup>
wienDisplacement    | <i>b</i>                     | 2.897772126e-3      | m &#183; K

<!-- TODO: implement spectralRadiance 
spectralRadiance    | <i>c<sub>1L</sub></i>        | 1.19104286953e-16  | W &#183; m<sup>2</sup> &#183; sr<sup>-1</sup>
-->

Note that the values of `loschmidt` and `molarVolume` are at `T = 273.15 K` and `p = 101.325 kPa`. 
The value of `sackurTetrode` is at `T = 1 K` and `p = 101.325 kPa`.


#### Adopted values

Name          | Symbol                       | Value   | Unit
--------------|------------------------------|---------|-------------------------
molarMass     | <i>M<sub>u</sub></i>         | 1e-3    | kg &#183; mol<sup>-1</sup>
molarMassC12  | <i>M(<sub>12</sub>C)</i>     | 1.2e-2  | kg &#183; mol<sup>-1</sup>
gravity       | <i>g<sub>n</sub></i>         | 9.80665 | m &#183; s<sup>-2</sup>
atm           | <i>atm</i>                   | 101325  | Pa


#### Natural units

Name              | Symbol                | Value              | Unit
------------------|-----------------------|--------------------|-----
planckLength      | <i>l<sub>P</sub></i>  | 1.61619997e-35     | m
planckMass        | <i>m<sub>P</sub></i>  | 2.1765113e-8       | kg 
planckTime        | <i>t<sub>P</sub></i>  | 5.3910632e-44      | s
planckCharge      | <i>q<sub>P</sub></i>  | 1.87554595641e-18  | C
planckTemperature | <i>T<sub>P</sub></i>  | 1.41683385e+32     | K 
