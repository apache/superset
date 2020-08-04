# d3-geo-projection

Extended geographic projections for [d3-geo](https://github.com/d3/d3-geo). See [Command-Line Cartography](https://medium.com/@mbostock/command-line-cartography-part-1-897aa8f8ca2c) for an introduction.

## Installing

If you use NPM, `npm install d3-geo-projection`. Otherwise, download the [latest release](https://github.com/d3/d3-geo-projection/releases/latest). You can also load directly from [d3js.org](https://d3js.org) as a [standalone library](https://d3js.org/d3-geo-projection.v2.min.js). AMD, CommonJS, and vanilla environments are supported. In vanilla, a `d3` global is exported:

```html
<script src="https://d3js.org/d3-array.v1.min.js"></script>
<script src="https://d3js.org/d3-geo.v1.min.js"></script>
<script src="https://d3js.org/d3-geo-projection.v2.min.js"></script>
<script>

var aitoff = d3.geoAitoff();

</script>
```

## API Reference

* [Projections](#projections)
* [Interrupted Projections](#interrupted-projections)
* [Polyhedral Projections](#polyhedral-projections)
* [Quincuncial Projections](#quincuncial-projections)
* [Transformations](#transformations)

### Projections

Note: projections tagged \[d3-geo\] are exported by [d3-geo](https://github.com/d3/d3-geo), not d3-geo-projection. These commonly-used projections are also included in the [d3](https://github.com/d3/d3) default bundle.

<a href="#geoAiry" name="geoAiry">#</a> d3.<b>geoAiry</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/airy.js), [Examples](https://observablehq.com/@d3/airys-minimum-error)
<br><a href="#geoAiryRaw" name="geoAiryRaw">#</a> d3.<b>geoAiryRaw</b>(<i>beta</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/airy.png" width="480" height="250">](https://observablehq.com/@d3/airys-minimum-error)

Airy’s minimum-error azimuthal projection.

<a href="airy_radius" name="airy_raidus">#</a> <i>airy</i>.<b>radius</b>([<i>radius</i>])

Defaults to 90°.

<a href="#geoAitoff" name="geoAitoff">#</a> d3.<b>geoAitoff</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/aitoff.js), [Examples](https://observablehq.com/@d3/aitoff)
<br><a href="#geoAitoffRaw" name="geoAitoffRaw">#</a> d3.<b>geoAitoffRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/aitoff.png" width="480" height="250">](https://observablehq.com/@d3/aitoff)

The Aitoff projection.

<a href="#geoAlbers" name="geoAlbers">#</a> d3.<b>geoAlbers</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/albers.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoAlbers)

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/albers.png" width="480" height="250">](https://observablehq.com/@d3/conic-equal-area)

Albers’ [equal-area conic projection](#geoConicEqualArea).

<a href="#geoArmadillo" name="geoArmadillo">#</a> d3.<b>geoArmadillo</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/armadillo.js), [Examples](https://observablehq.com/@d3/armadillo)
<br><a href="#geoArmadilloRaw" name="geoArmadilloRaw">#</a> d3.<b>geoArmadilloRaw</b>(<i>phi0</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/armadillo.png" width="480" height="250">](https://observablehq.com/@d3/armadillo)

The armadillo projection. The default center assumes the default [parallel](#armadillo_parallel) of 20° and should be changed if a different parallel is used. Note: requires clipping to the sphere.

<a href="#armadillo_parallel" name="armadillo_parallel">#</a> <i>armadillo</i>.<b>parallel</b>([<i>parallel</i>])

Defaults to 20°.

<a href="#geoAugust" name="geoAugust">#</a> d3.<b>geoAugust</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/august.js), [Examples](https://observablehq.com/@d3/august)
<br><a href="#geoAugustRaw" name="geoAugustRaw">#</a> d3.<b>geoAugustRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/august.png" width="480" height="250">](https://observablehq.com/@d3/august)

August’s epicycloidal conformal projection.

<a href="#geoAzimuthalEqualArea" name="geoAzimuthalEqualArea">#</a> d3.<b>geoAzimuthalEqualArea</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/azimuthalEqualArea.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoAzimuthalEqualArea), [Examples](https://observablehq.com/@d3/azimuthal-equal-area)
<br><a href="#geoAzimuthalEqualAreaRaw" name="geoAzimuthalEqualAreaRaw">#</a> d3.<b>geoAzimuthalEqualAreaRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/azimuthalEqualArea.png" width="480" height="250">](https://observablehq.com/@d3/azimuthal-equal-area)

The Lambert azimuthal equal-area projection.

<a href="#geoAzimuthalEquidistant" name="geoAzimuthalEquidistant">#</a> d3.<b>geoAzimuthalEquidistant</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/azimuthalEquidistant.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoAzimuthalEquidistant), [Examples](https://observablehq.com/@d3/azimuthal-equidistant)
<br><a href="#geoAzimuthalEquidistantRaw" name="geoAzimuthalEquidistantRaw">#</a> d3.<b>geoAzimuthalEquidistantRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/azimuthalEquidistant.png" width="480" height="250">](https://observablehq.com/@d3/azimuthal-equidistant)

The azimuthal equidistant projection.

<a href="#geoBaker" name="geoBaker">#</a> d3.<b>geoBaker</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/baker.js), [Examples](https://observablehq.com/@d3/baker-dinomic)
<br><a href="#geoBakerRaw" name="geoBakerRaw">#</a> d3.<b>geoBakerRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/baker.png" width="480" height="250">](https://observablehq.com/@d3/baker-dinomic)

The Baker Dinomic projection.

<a href="#geoBerghaus" name="geoBerghaus">#</a> d3.<b>geoBerghaus</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/berghaus.js), [Examples](https://observablehq.com/@d3/berghaus-star)
<br><a href="#geoBerghausRaw" name="geoBerghausRaw">#</a> d3.<b>geoBerghausRaw</b>(<i>lobes</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/berghaus.png" width="480" height="250">](https://observablehq.com/@d3/berghaus-star)

Berghaus’ star projection. The default center assumes the default [lobe number](#berghaus_lobes) of 5 and should be changed if a different number of lobes is used. Note: requires clipping to the sphere.

<a href="#berghaus_lobes" name="berghaus_lobes">#</a> <i>berghaus</i>.<b>lobes</b>([<i>lobes</i>]) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/berghaus.js)

If *lobes* is specified, sets the number of lobes in the resulting star, and returns this projection. If *lobes* is not specified, returns the current lobe number, which defaults to 5.

<a href="#geoBertin1953" name="geoBertin1953">#</a> d3.<b>geoBertin1953</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/bertin.js)
<br><a href="#geoBertin1953Raw" name="geoBertin1953Raw">#</a> d3.<b>geoBertin1953Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/bertin1953.png" width="480" height="250">](https://visionscarto.net/bertin-projection-1953)

Jacques Bertin’s 1953 projection.

<a href="#geoBoggs" name="geoBoggs">#</a> d3.<b>geoBoggs</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/boggs.js), [Examples](https://observablehq.com/@d3/boggs-eumorphic)
<br><a href="#geoBoggsRaw" name="geoBoggsRaw">#</a> d3.<b>geoBoggsRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/boggs.png" width="480" height="250">](https://observablehq.com/@d3/boggs-eumorphic)

The Boggs eumorphic projection. More commonly used in [interrupted form](#geoInterruptedBoggs).

<a href="#geoBonne" name="geoBonne">#</a> d3.<b>geoBonne</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/bonne.js), [Examples](https://observablehq.com/@d3/bonne)
<br><a href="#geoBonneRaw" name="geoBonneRaw">#</a> d3.<b>geoBonneRaw</b>(<i>phi0</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/bonne.png" width="480" height="250">](https://observablehq.com/@d3/bonne)

The Bonne pseudoconical equal-area projection. The [Werner projection](https://observablehq.com/@d3/werner) is a limiting form of the Bonne projection with a standard parallel at ±90°. The default center assumes the default [parallel](#bonne_parallel) of 45° and should be changed if a different parallel is used.

<a href="#bonne_parallel" name="bonne_parallel">#</a> <i>bonne</i>.<b>parallel</b>([<i>parallel</i>])

Defaults to 45°.

<a href="#geoBottomley" name="geoBottomley">#</a> d3.<b>geoBottomley</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/bottomley.js), [Examples](https://observablehq.com/@d3/bottomley)
<br><a href="#geoBottomleyRaw" name="geoBottomleyRaw">#</a> d3.<b>geoBottomleyRaw</b>(<i>sinPsi</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/bottomley.png" width="480" height="250">](https://observablehq.com/@d3/bottomley)

The [Bottomley projection](https://cybergeo.revues.org/3977) “draws lines of latitude as concentric circular arcs, with arc lengths equal to their lengths on the globe, and placed symmetrically and equally spaced across the vertical central meridian.”

<a href="#bottomley_fraction" name="bottomley_fraction">#</a> <i>bottomley</i>.<b>fraction</b>([<i>fraction</i>])

Defaults to 0.5, corresponding to a sin(ψ) where ψ = π/6.

<a href="#geoBromley" name="geoBromley">#</a> d3.<b>geoBromley</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/bromley.js), [Examples](https://observablehq.com/@d3/bromley)
<br><a href="#geoBromleyRaw" name="geoBromleyRaw">#</a> d3.<b>geoBromleyRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/bromley.png" width="480" height="250">](https://observablehq.com/@d3/bromley)

The Bromley projection is a rescaled [Mollweide projection](#geoMollweide).

<a href="#geoChamberlin" name="geoChamberlin">#</a> d3.<b>geoChamberlin</b>(<i>point0</i>, <i>point1</i>, <i>point2</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/chamberlin.js)
<br><a href="#geoChamberlinRaw" name="geoChamberlinRaw">#</a> d3.<b>geoChamberlinRaw</b>(<i>p0</i>, <i>p1</i>, <i>p2</i>)

The Chamberlin trimetric projection. This method does not support [*projection*.rotate](https://github.com/d3/d3-geo/blob/master/README.md#projection_rotate): the three reference points implicitly determine a fixed rotation.

<a href="#geoChamberlinAfrica" name="geoChamberlinAfrica">#</a> d3.<b>geoChamberlinAfrica</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/chamberlin.js)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/chamberlinAfrica.png" width="480" height="250">](https://bl.ocks.org/mbostock/5625053)

The Chamberlin projection for Africa using points [0°, 22°], [45°, 22°], [22.5°, -22°].

<a href="#geoCollignon" name="geoCollignon">#</a> d3.<b>geoCollignon</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/collignon.js), [Examples](https://observablehq.com/@d3/collignon)
<br><a href="#geoCollignonRaw" name="geoCollignonRaw">#</a> d3.<b>geoCollignonRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/collignon.png" width="480" height="250">](https://observablehq.com/@d3/collignon)

The Collignon equal-area pseudocylindrical projection. This projection is used in the polar areas of the [HEALPix projection](#geoHealpix).

<a href="#geoConicConformal" name="geoConicConformal">#</a> d3.<b>geoConicConformal</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/conicConformal.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoConicConformal), [Examples](https://observablehq.com/@d3/conic-conformal)
<br><a href="#geoConicConformalRaw" name="geoConicConformalRaw">#</a> d3.<b>geoConicConformalRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/conicConformal.png" width="480" height="250">](https://observablehq.com/@d3/conic-conformal)

The Lambert conformal conic projection.

<a href="#geoConicEqualArea" name="geoConicEqualArea">#</a> d3.<b>geoConicEqualArea</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/conicEqualArea.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoConicEqualArea), [Examples](https://observablehq.com/@d3/conic-equal-area)
<br><a href="#geoConicEqualAreaRaw" name="geoConicEqualAreaRaw">#</a> d3.<b>geoConicEqualAreaRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/conicEqualArea.png" width="480" height="250">](https://observablehq.com/@d3/conic-equal-area)

Albers’ conic equal-area projection.

<a href="#geoConicEquidistant" name="geoConicEquidistant">#</a> d3.<b>geoConicEquidistant</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/conicEquidistant.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoConicEquidistant), [Examples](https://observablehq.com/@d3/conic-equidistant)
<br><a href="#geoConicEquidistantRaw" name="geoConicEquidistantRaw">#</a> d3.<b>geoConicEquidistantRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/conicEquidistant.png" width="480" height="250">](https://observablehq.com/@d3/conic-equidistant)

The conic equidistant projection.

<a href="#geoCraig" name="geoCraig">#</a> d3.<b>geoCraig</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/craig.js), [Examples](https://observablehq.com/@d3/craig)
<br><a href="#geoCraigRaw" name="geoCraigRaw">#</a> d3.<b>geoCraigRaw</b>(<i>phi</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/craig.png" width="480" height="250">](https://observablehq.com/@d3/craig)

The Craig retroazimuthal projection. Note: this projection tends to [fold over itself](https://bl.ocks.org/mbostock/4459716) if the [standard parallel](#craig_parallel) is non-zero; we have not yet implemented the necessary advanced clipping to avoid overlap.

<a href="#craig_parallel" name="craig_parallel">#</a> <i>craig</i>.<b>parallel</b>([<i>parallel</i>])

Defaults to 0°.

<a href="#geoCraster" name="geoCraster">#</a> d3.<b>geoCraster</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/craster.js), [Examples](https://observablehq.com/@d3/craster)
<br><a href="#geoCrasterRaw" name="geoCrasterRaw">#</a> d3.<b>geoCrasterRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/craster.png" width="480" height="250">](https://observablehq.com/@d3/craster)

The Craster parabolic projection; also known as Putniņš P4.

<a href="#geoCylindricalEqualArea" name="geoCylindricalEqualArea">#</a> d3.<b>geoCylindricalEqualArea</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/cylindricalEqualArea.js), [Examples](https://observablehq.com/@mbostock/cylindrical-equal-area-projections)
<br><a href="#geoCylindricalEqualAreaRaw" name="geoCylindricalEqualAreaRaw">#</a> d3.<b>geoCylindricalEqualAreaRaw</b>(<i>phi0</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/cylindricalEqualArea.png" width="480" height="250">](https://observablehq.com/@mbostock/cylindrical-equal-area-projections)

The cylindrical equal-area projection. Depending on the chosen [parallel](#cylindricalEqualArea_parallel), this projection is also known as the Lambert cylindrical equal-area (0°), Behrmann (30°), Hobo–Dyer (37.5°), Gall–Peters (45°), Balthasart (50°) and Tobler world-in-a-square (~55.654°).

<a href="#cylindricalEqualArea_parallel" name="cylindricalEqualArea_parallel">#</a> <i>cylindricalEqualArea</i>.<b>parallel</b>([<i>parallel</i>])

Defaults to approximately 38.58°, fitting the world in a 960×500 rectangle.

<a href="#geoCylindricalStereographic" name="geoCylindricalStereographic">#</a> d3.<b>geoCylindricalStereographic</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/cylindricalStereographic.js), [Examples](https://observablehq.com/@d3/cylindrical-stereographic)
<br><a href="#geoCylindricalStereographicRaw" name="geoCylindricalStereographicRaw">#</a> d3.<b>geoCylindricalStereographicRaw</b>(<i>phi0</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/cylindricalStereographic.png" width="480" height="250">](https://observablehq.com/@d3/cylindrical-stereographic)

The cylindrical stereographic projection. Depending on the chosen [parallel](#cylindricalStereographic_parallel), this projection is also known as Braun’s stereographic (0°) and Gall’s stereographic (45°).

<a href="#cylindricalStereographic_parallel" name="cylindricalStereographic_parallel">#</a> <i>cylindricalStereographic</i>.<b>parallel</b>([<i>parallel</i>])

Defaults to 0°.

<a href="#geoEckert1" name="geoEckert1">#</a> d3.<b>geoEckert1</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/eckert1.js), [Examples](https://observablehq.com/@d3/eckert-i)
<br><a href="#geoEckert1Raw" name="geoEckert1Raw">#</a> d3.<b>geoEckert1Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/eckert1.png" width="480" height="250">](https://observablehq.com/@d3/eckert-i)

The Eckert I projection.

<a href="#geoEckert2" name="geoEckert2">#</a> d3.<b>geoEckert2</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/eckert2.js), [Examples](https://observablehq.com/@d3/eckert-ii)
<br><a href="#geoEckert2Raw" name="geoEckert2Raw">#</a> d3.<b>geoEckert2Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/eckert2.png" width="480" height="250">](https://observablehq.com/@d3/eckert-ii)

The Eckert II projection.

<a href="#geoEckert3" name="geoEckert3">#</a> d3.<b>geoEckert3</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/eckert3.js), [Examples](https://observablehq.com/@d3/eckert-iii)
<br><a href="#geoEckert3Raw" name="geoEckert3Raw">#</a> d3.<b>geoEckert3Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/eckert3.png" width="480" height="250">](https://observablehq.com/@d3/eckert-iii)

The Eckert III projection.

<a href="#geoEckert4" name="geoEckert4">#</a> d3.<b>geoEckert4</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/eckert4.js), [Examples](https://observablehq.com/@d3/eckert-iv)
<br><a href="#geoEckert4Raw" name="geoEckert4Raw">#</a> d3.<b>geoEckert4Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/eckert4.png" width="480" height="250">](https://observablehq.com/@d3/eckert-iv)

The Eckert IV projection.

<a href="#geoEckert5" name="geoEckert5">#</a> d3.<b>geoEckert5</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/eckert5.js), [Examples](https://observablehq.com/@d3/eckert-v)
<br><a href="#geoEckert5Raw" name="geoEckert5Raw">#</a> d3.<b>geoEckert5Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/eckert5.png" width="480" height="250">](https://observablehq.com/@d3/eckert-v)

The Eckert V projection.

<a href="#geoEckert6" name="geoEckert6">#</a> d3.<b>geoEckert6</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/eckert6.js), [Examples](https://observablehq.com/@d3/eckert-vi)
<br><a href="#geoEckert6Raw" name="geoEckert6Raw">#</a> d3.<b>geoEckert6Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/eckert6.png" width="480" height="250">](https://observablehq.com/@d3/eckert-vi)

The Eckert VI projection.

<a href="#geoEisenlohr" name="geoEisenlohr">#</a> d3.<b>geoEisenlohr</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/eisenlohr.js), [Examples](https://observablehq.com/@d3/eisenlohr)
<br><a href="#geoEisenlohrRaw" name="geoEisenlohrRaw">#</a> d3.<b>geoEisenlohrRaw</b>(<i>lambda</i>, <i>phi</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/eisenlohr.png" width="480" height="250">](https://observablehq.com/@d3/eisenlohr)

The Eisenlohr conformal projection.

<a href="#geoEquirectangular" name="geoEquirectangular">#</a> d3.<b>geoEquirectangular</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/equirectangular.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoEquirectangular), [Examples](https://observablehq.com/@d3/equirectangular)
<br><a href="#geoEquirectangularRaw" name="geoEquirectangularRaw">#</a> d3.<b>geoEquirectangularRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/equirectangular.png" width="480" height="250">](https://observablehq.com/@d3/equirectangular)

The equirectangular (plate carrée) projection. The [Cassini projection](https://observablehq.com/@d3/cassini) is the transverse aspect of the equirectangular projection.

<a href="#geoFahey" name="geoFahey">#</a> d3.<b>geoFahey</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/fahey.js), [Examples](https://observablehq.com/@d3/fahey)
<br><a href="#geoFaheyRaw" name="geoFaheyRaw">#</a> d3.<b>geoFaheyRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/fahey.png" width="480" height="250">](https://observablehq.com/@d3/fahey)

The Fahey pseudocylindrical projection.

<a href="#geoFoucaut" name="geoFoucaut">#</a> d3.<b>geoFoucaut</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/foucaut.js), [Examples](https://observablehq.com/@d3/foucaut)
<br><a href="#geoFoucautRaw" name="geoFoucautRaw">#</a> d3.<b>geoFoucautRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/foucaut.png" width="480" height="250">](https://www.jasondavies.com/maps/foucaut/)

Foucaut’s stereographic equivalent projection.

<a href="#geoFoucautSinusoidal" name="geoFoucautSinusoidal">#</a> d3.<b>geoFoucautSinusoidal</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/foucautSinusoidal.js), [Examples](https://observablehq.com/@d3/foucaut-sinusoidal)
<br><a href="#geoFoucautSinusoidalRaw" name="geoFoucautSinusoidalRaw">#</a> d3.<b>geoFoucautSinusoidalRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/foucautSinusoidal.png" width="480" height="250">](https://observablehq.com/@d3/foucaut-sinusoidal)

Foucaut’s sinusoidal projection, an equal-area average of the sinusoidal and Lambert’s cylindrical projections.

<a href="#foucautSinusoidal_alpha" name="foucautSinusoidal_alpha">#</a> <i>foucautSinusoidal</i>.<b>alpha</b>([<i>alpha</i>])

Relative weight of the cylindrical projection. Defaults to 0.5.

<a href="#geoGilbert" name="geoGilbert">#</a> d3.<b>geoGilbert</b>([<i>type</i>]) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/gilbert.js), [Examples](https://observablehq.com/@d3/gilbert)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/gilbert.png" width="480" height="250">](https://observablehq.com/@d3/gilbert)

Gilbert’s two-world perspective projection. Wraps an instance of the specified projection *type*; if not specified, defaults to [d3.geoOrthographic](https://github.com/d3/d3-geo/blob/master/README.md#geoOrthographic).

<a href="#geoGingery" name="geoGingery">#</a> d3.<b>geoGingery</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/gingery.js), [Examples](https://observablehq.com/@d3/gingery)
<br><a href="#geoGingeryRaw" name="geoGingeryRaw">#</a> d3.<b>geoGingeryRaw</b>(<i>rho</i>, <i>lobes</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/gingery.png" width="480" height="250">](https://observablehq.com/@d3/gingery)

The U.S.-centric Gingery world projection, as inspired by Cram’s Air Age. Note: requires clipping to the sphere.

<a href="#gingery_radius" name="gingery_radius">#</a> <i>gingery</i>.<b>radius</b>([<i>radius</i>]) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/gingery.js)

Defaults to 30°.

<a href="#gingery_lobes" name="gingery_lobes">#</a> <i>gingery</i>.<b>lobes</b>([<i>lobes</i>]) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/gingery.js)

Defaults to 6.

<a href="#geoGinzburg4" name="geoGinzburg4">#</a> d3.<b>geoGinzburg4</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/ginzburg4.js), [Examples](https://observablehq.com/@d3/ginzburg-iv)
<br><a href="#geoGinzburg4Raw" name="geoGinzburg4Raw">#</a> d3.<b>geoGinzburg4Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/ginzburg4.png" width="480" height="250">](https://observablehq.com/@d3/ginzburg-iv)

The Ginzburg IV projection.

<a href="#geoGinzburg5" name="geoGinzburg5">#</a> d3.<b>geoGinzburg5</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/ginzburg5.js), [Examples](https://observablehq.com/@d3/ginzburg-v)
<br><a href="#geoGinzburg5Raw" name="geoGinzburg5Raw">#</a> d3.<b>geoGinzburg5Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/ginzburg5.png" width="480" height="250">](https://observablehq.com/@d3/ginzburg-v)

The Ginzburg V projection.

<a href="#geoGinzburg6" name="geoGinzburg6">#</a> d3.<b>geoGinzburg6</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/ginzburg6.js), [Examples](https://observablehq.com/@d3/ginzburg-vi)
<br><a href="#geoGinzburg6Raw" name="geoGinzburg6Raw">#</a> d3.<b>geoGinzburg6Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/ginzburg6.png" width="480" height="250">](https://observablehq.com/@d3/ginzburg-vi)

The Ginzburg VI projection.

<a href="#geoGinzburg8" name="geoGinzburg8">#</a> d3.<b>geoGinzburg8</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/ginzburg8.js), [Examples](https://observablehq.com/@d3/ginzburg-viii)
<br><a href="#geoGinzburg8Raw" name="geoGinzburg8Raw">#</a> d3.<b>geoGinzburg8Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/ginzburg8.png" width="480" height="250">](https://observablehq.com/@d3/ginzburg-viii)

The Ginzburg VIII projection.

<a href="#geoGinzburg9" name="geoGinzburg9">#</a> d3.<b>geoGinzburg9</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/ginzburg9.js), [Examples](https://observablehq.com/@d3/ginzburg-ix)
<br><a href="#geoGinzburg9Raw" name="geoGinzburg9Raw">#</a> d3.<b>geoGinzburg9Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/ginzburg9.png" width="480" height="250">](https://observablehq.com/@d3/ginzburg-ix)

The Ginzburg IX projection.

<a href="#geoGnomonic" name="geoGnomonic">#</a> d3.<b>geoGnomonic</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/gnomonic.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoGnomonic), [Examples](https://observablehq.com/@d3/gnomonic)
<br><a href="#geoGnomonicRaw" name="geoGnomonicRaw">#</a> d3.<b>geoGnomonicRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/gnomonic.png" width="480" height="250">](https://observablehq.com/@d3/gnomonic)

The gnomonic projection.

<a href="#geoGringorten" name="geoGringorten">#</a> d3.<b>geoGringorten</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/gringorten.js), [Examples](https://observablehq.com/@d3/gringorten)
<br><a href="#geoGringortenRaw" name="geoGringortenRaw">#</a> d3.<b>geoGringortenRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/gringorten.png" width="480" height="250">](https://observablehq.com/@d3/gringorten)

The Gringorten square equal-area projection, rearranged to give each hemisphere an entire square.

<a href="#geoGuyou" name="geoGuyou">#</a> d3.<b>geoGuyou</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/guyou.js), [Examples](https://observablehq.com/@d3/guyou)
<br><a href="#geoGuyouRaw" name="geoGuyouRaw">#</a> d3.<b>geoGuyouRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/guyou.png" width="480" height="250">](https://observablehq.com/@d3/guyou)

The Guyou hemisphere-in-a-square projection. Peirce is credited with its [quincuncial form](#geoPeirceQuincuncial).

<a href="#geoHammer" name="geoHammer">#</a> d3.<b>geoHammer</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/hammer.js), [Examples](https://observablehq.com/@d3/hammer)
<br><a href="#geoHammerRaw" name="geoHammerRaw">#</a> d3.<b>geoHammerRaw</b>(<i>A</i>, <i>B</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/hammer.png" width="480" height="250">](https://observablehq.com/@d3/hammer)

The Hammer projection. Depending the chosen coefficient and aspect, also known as [Eckert–Greifendorff](https://observablehq.com/@d3/hammer?b=4), [quartic authalic](https://observablehq.com/@d3/hammer?b=Infinity), and [Briesemeister](https://observablehq.com/@d3/briesemeister-projection).

<a href="#hammer_coefficient" name="hammer_coefficient">#</a> <i>hammer</i>.<b>coefficient</b>([<i>coefficient</i>]) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/hammer.js)

Defaults to 2.

<a href="#geoHammerRetroazimuthal" name="geoHammerRetroazimuthal">#</a> d3.<b>geoHammerRetroazimuthal</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/hammerRetroazimuthal.js), [Examples](https://observablehq.com/@d3/hammer-retroazimuthal)
<br><a href="#geoHammerRetroazimuthalRaw" name="geoHammerRetroazimuthalRaw">#</a> d3.<b>geoHammerRetroazimuthalRaw</b>(<i>phi0</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/hammerRetroazimuthal.png" width="480" height="250">](https://observablehq.com/@d3/hammer-retroazimuthal)

The Hammer retroazimuthal projection. Note: requires clipping to the sphere.

<a href="#hammerRetroazimuthal_parallel" name="hammerRetroazimuthal_parallel">#</a> <i>hammerRetroazimuthal</i>.<b>parallel</b>([<i>parallel</i>])

Defaults to 45°.

<a href="#geoHealpix" name="geoHealpix">#</a> d3.<b>geoHealpix</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/healpix.js), [Examples](https://observablehq.com/@d3/healpix)
<br><a href="#geoHealpixRaw" name="geoHealpixRaw">#</a> d3.<b>geoHealpixRaw</b>(<i>lobes</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/healpix.png" width="480" height="250">](https://observablehq.com/@d3/healpix)

The HEALPix projection: a <b>H</b>ierarchical <b>E</b>qual <b>A</b>rea iso<b>L</b>atitude <b>Pix</b>elisation of a 2-sphere. In this implementation, the parameter *K* is fixed at 3. Note: requires clipping to the sphere.

<a href="#healpix_lobes" name="healpix_lobes">#</a> <i>healpix</i>.<b>lobes</b>([<i>lobes</i>])

If *lobes* is specified, sets the number of lobes (the parameter *H* in the literature) and returns this projection. If *lobes* is not specified, returns the current lobe number, which defaults to 4.

<a href="#geoHill" name="geoHill">#</a> d3.<b>geoHill</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/hill.js), [Examples](https://observablehq.com/@d3/hill-eucyclic)
<br><a href="#geoHillRaw" name="geoHillRaw">#</a> d3.<b>geoHillRaw</b>(<i>K</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/hill.png" width="480" height="250">](https://observablehq.com/@d3/hill-eucyclic)

Hill eucyclic projection is pseudoconic and equal-area.

<a href="hill_ratio" name="hill_ratio">#</a> <i>hill</i>.<b>ratio</b>([<i>ratio</i>])

Defaults to 1. With a ratio of 0, this projection becomes the [Maurer No. 73](https://observablehq.com/@d3/hill-eucyclic?b=0). As it approaches ∞, the projection converges to the [Eckert IV](#geoEckert4).

<a href="#geoHomolosine" name="geoHomolosine">#</a> d3.<b>geoHomolosine</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/homolosine.js), [Examples](https://observablehq.com/@d3/goode-homolosine)
<br><a href="#geoHomolosineRaw" name="geoHomolosineRaw">#</a> d3.<b>geoHomolosineRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/homolosine.png" width="480" height="250">](https://observablehq.com/@d3/goode-homolosine)

The pseudocylindrical, equal-area Goode homolosine projection is normally presented in [interrupted form](#geoInterruptedHomolosine).

<a href="#geoHufnagel" name="geoHufnagel">#</a> d3.<b>geoHufnagel</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/hufnagel.js), [Examples](https://observablehq.com/@fil/hufnagel-projection)
<br><a href="#geoHufnagelRaw" name="geoHufnagelRaw">#</a> d3.<b>geoHufnagelRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/hufnagel.png" width="480" height="250">](https://observablehq.com/@fil/hufnagel-projection)

A customizable family of pseudocylindrical equal-area projections by Herbert Hufnagel.

<a href="#hufnagel_a" name="hufnagel_a">#</a> <i>hufnagel</i>.<b>a</b>([<i>a</i>])

<a href="#hufnagel_b" name="hufnagel_b">#</a> <i>hufnagel</i>.<b>b</b>([<i>b</i>])

<a href="#hufnagel_psiMax" name="hufnagel_psiMax">#</a> <i>hufnagel</i>.<b>psiMax</b>([<i>psiMax</i>])

<a href="#hufnagel_ratio" name="hufnagel_ratio">#</a> <i>hufnagel</i>.<b>ratio</b>([<i>ratio</i>])

<a href="#geoHyperelliptical" name="geoHyperelliptical">#</a> d3.<b>geoHyperelliptical</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/hyperelliptical.js), [Examples](https://observablehq.com/@fil/toblers-hyperelliptical-projection)
<br><a href="#geoHyperellipticalRaw" name="geoHyperellipticalRaw">#</a> d3.<b>geoHyperellipticalRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/hyperelliptical.png" width="480" height="250">](https://observablehq.com/@fil/toblers-hyperelliptical-projection)

Waldo R. Tobler’s hyperelliptical is a family of equal-area pseudocylindrical projections. Parameters include _k_, the exponent of the superellipse (or Lamé curve) that defines the shape of the meridians (default _k_ = 2.5); _alpha_, which governs the weight of the cylindrical projection that is averaged with the superellipse (default _alpha_ = 0); and _gamma_, that shapes the aspect ratio (default: _gamma_ = 1.183136).

<a href="#geoKavrayskiy7" name="geoKavrayskiy7">#</a> d3.<b>geoKavrayskiy7</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/kavrayskiy7.js), [Examples](https://observablehq.com/@d3/kavrayskiy-vii)
<br><a href="#geoKavrayskiy7Raw" name="geoKavrayskiy7Raw">#</a> d3.<b>geoKavrayskiy7Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/kavrayskiy7.png" width="480" height="250">](https://observablehq.com/@d3/kavrayskiy-vii)

The Kavrayskiy VII pseudocylindrical projection.

<a href="#geoLagrange" name="geoLagrange">#</a> d3.<b>geoLagrange</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/lagrange.js), [Examples](https://observablehq.com/@d3/lagrange)
<br><a href="#geoLagrangeRaw" name="geoLagrangeRaw">#</a> d3.<b>geoLagrangeRaw</b>(<i>n</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/lagrange.png" width="480" height="250">](https://observablehq.com/@d3/lagrange)

The Lagrange conformal projection.

<a href="#lagrange_spacing" name="lagrange_spacing">#</a> <i>lagrange</i>.<b>spacing</b>([<i>spacing</i>])

Defaults to 0.5.

<a href="#geoLarrivee" name="geoLarrivee">#</a> d3.<b>geoLarrivee</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/larrivee.js), [Examples](https://observablehq.com/@d3/larrivee)
<br><a href="#geoLarriveeRaw" name="geoLarriveeRaw">#</a> d3.<b>geoLarriveeRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/larrivee.png" width="480" height="250">](https://observablehq.com/@d3/larrivee)

The Larrivée projection.

<a href="#geoLaskowski" name="geoLaskowski">#</a> d3.<b>geoLaskowski</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/laskowski.js), [Examples](https://observablehq.com/@d3/laskowski-tri-optimal)
<br><a href="#geoLaskowskiRaw" name="geoLaskowskiRaw">#</a> d3.<b>geoLaskowskiRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/laskowski.png" width="480" height="250">](https://observablehq.com/@d3/laskowski-tri-optimal)

The Laskowski tri-optimal projection simultaneously minimizes distance, angular, and areal distortion.

<a href="#geoLittrow" name="geoLittrow">#</a> d3.<b>geoLittrow</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/littrow.js), [Examples](https://observablehq.com/@d3/littrow)
<br><a href="#geoLittrowRaw" name="geoLittrowRaw">#</a> d3.<b>geoLittrowRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/littrow.png" width="480" height="250">](https://observablehq.com/@d3/littrow)

The Littrow projection is the only conformal retroazimuthal map projection. Typically clipped to the geographic extent [[-90°, -60°], [90°, 60°]].

<a href="#geoLoximuthal" name="geoLoximuthal">#</a> d3.<b>geoLoximuthal</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/loximuthal.js), [Examples](https://observablehq.com/@d3/loximuthal)
<br><a href="#geoLoximuthalRaw" name="geoLoximuthalRaw">#</a> d3.<b>geoLoximuthalRaw</b>(<i>phi0</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/loximuthal.png" width="480" height="250">](https://observablehq.com/@d3/loximuthal)

The [loximuthal projection](https://en.wikipedia.org/wiki/Loximuthal_projection) is “characterized by the fact that loxodromes (rhumb lines) from one chosen central point (the intersection of the central meridian and central latitude) are shown as straight lines, correct in azimuth from the center, and are ‘true to scale’… It is neither an equal-area projection nor conformal.”

<a href="#loximuthal_parallel" name="loximuthal_parallel">#</a> <i>loximuthal</i>.<b>parallel</b>([<i>parallel</i>])

Defaults to 40°.

<a href="#geoMercator" name="geoMercator">#</a> d3.<b>geoMercator</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/mercator.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoMercator), [Examples](https://observablehq.com/@d3/mercator)
<br><a href="#geoMercatorRaw" name="geoMercatorRaw">#</a> d3.<b>geoMercatorRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/mercator.png" width="480" height="250">](https://observablehq.com/@d3/mercator)

The spherical Mercator projection.

<a href="#geoMiller" name="geoMiller">#</a> d3.<b>geoMiller</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/miller.js), [Examples](https://observablehq.com/@d3/miller)
<br><a href="#geoMillerRaw" name="geoMillerRaw">#</a> d3.<b>geoMillerRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/miller.png" width="480" height="250">](https://observablehq.com/@d3/miller)

The Miller cylindrical projection is a modified [Mercator](#geoMercator) projection.

<a href="#geoModifiedStereographic" name="geoModifiedStereographic">#</a> d3.<b>geoModifiedStereographic</b>(<i>coefficients</i>, <i>rotate</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/modifiedStereographic.js)
<br><a href="#geoModifiedStereographicRaw" name="geoModifiedStereographicRaw">#</a> d3.<b>geoModifiedStereographicRaw</b>(<i>coefficients</i>)

The family of [modified stereographic projections](https://www.jasondavies.com/maps/modified-stereographic/). The default [clip angle](https://github.com/d3/d3-geo/blob/master/README.md#projection_clipAngle) for these projections is 90°. These projections do not support [*projection*.rotate](https://github.com/d3/d3-geo/blob/master/README.md#projection_rotate): a fixed rotation is applied that is specific to the given *coefficients*.

<a href="#geoModifiedStereographicAlaska" name="geoModifiedStereographicAlaska">#</a> d3.<b>geoModifiedStereographicAlaska</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/modifiedStereographic.js)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/modifiedStereographicAlaska.png" width="480" height="250">](https://www.jasondavies.com/maps/modified-stereographic/alaska/)

A [modified stereographic](#geoModifiedStereographic) projection for Alaska.

<a href="#geoModifiedStereographicGs48" name="geoModifiedStereographicGs48">#</a> d3.<b>geoModifiedStereographicGs48</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/modifiedStereographic.js)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/modifiedStereographicGs48.png" width="480" height="250">](https://www.jasondavies.com/maps/modified-stereographic/gs48/)

A [modified stereographic](#geoModifiedStereographic) projection for the conterminous United States.

<a href="#geoModifiedStereographicGs50" name="geoModifiedStereographicGs50">#</a> d3.<b>geoModifiedStereographicGs50</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/modifiedStereographic.js)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/modifiedStereographicGs50.png" width="480" height="250">](https://www.jasondavies.com/maps/modified-stereographic/gs50/)

A [modified stereographic](#geoModifiedStereographic) projection for the United States including Alaska and Hawaii. Typically clipped to the geographic extent [[-180°, 15°], [-50°, 75°]].

<a href="#geoModifiedStereographicMiller" name="geoModifiedStereographicMiller">#</a> d3.<b>geoModifiedStereographicMiller</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/modifiedStereographic.js), [Examples](https://observablehq.com/@d3/miller-oblated-stereographic)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/modifiedStereographicMiller.png" width="480" height="250">](https://www.jasondavies.com/maps/modified-stereographic/miller/)

A [modified stereographic](#geoModifiedStereographic) projection for Europe and Africa. Typically clipped to the geographic extent [[-40°, -40°], [80°, 80°]].

<a href="#geoModifiedStereographicLee" name="geoModifiedStereographicLee">#</a> d3.<b>geoModifiedStereographicLee</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/modifiedStereographic.js), [Examples](https://observablehq.com/@d3/lee-oblated-stereographic)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/modifiedStereographicLee.png" width="480" height="250">](https://www.jasondavies.com/maps/modified-stereographic/lee/)

A [modified stereographic](#geoModifiedStereographic) projection for the Pacific ocean.

<a href="#geoMollweide" name="geoMollweide">#</a> d3.<b>geoMollweide</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/mollweide.js), [Examples](https://observablehq.com/@d3/mollweide)
<br><a href="#geoMollweideRaw" name="geoMollweideRaw">#</a> d3.<b>geoMollweideRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/mollweide.png" width="480" height="250">](https://observablehq.com/@d3/mollweide)

The equal-area, pseudocylindrical Mollweide projection. The oblique aspect is known as the [Atlantis projection](https://observablehq.com/@d3/atlantis). [Goode’s interrupted Mollweide](#interruptedMollweide) is also widely known.

<a href="#geoMtFlatPolarParabolic" name="geoMtFlatPolarParabolic">#</a> d3.<b>geoMtFlatPolarParabolic</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/mtFlatPolarParabolic.js), [Examples](https://observablehq.com/@d3/flat-polar-parabolic)
<br><a href="#geoMtFlatPolarParabolicRaw" name="geoMtFlatPolarParabolicRaw">#</a> d3.<b>geoMtFlatPolarParabolicRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/mtFlatPolarParabolic.png" width="480" height="250">](https://observablehq.com/@d3/flat-polar-parabolic)

The McBryde–Thomas flat-polar parabolic pseudocylindrical equal-area projection.

<a href="#geoMtFlatPolarQuartic" name="geoMtFlatPolarQuartic">#</a> d3.<b>geoMtFlatPolarQuartic</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/mtFlatPolarQuartic.js), [Examples](https://observablehq.com/@d3/flat-polar-quartic)
<br><a href="#geoMtFlatPolarQuarticRaw" name="geoMtFlatPolarQuarticRaw">#</a> d3.<b>geoMtFlatPolarQuarticRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/mtFlatPolarQuartic.png" width="480" height="250">](https://observablehq.com/@d3/flat-polar-quartic)

The McBryde–Thomas flat-polar quartic pseudocylindrical equal-area projection.

<a href="#geoMtFlatPolarSinusoidal" name="geoMtFlatPolarSinusoidal">#</a> d3.<b>geoMtFlatPolarSinusoidal</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/mtFlatPolarSinusoidal.js), [Examples](https://observablehq.com/@d3/flat-polar-sinusoidal)
<br><a href="#geoMtFlatPolarSinusoidalRaw" name="geoMtFlatPolarSinusoidalRaw">#</a> d3.<b>geoMtFlatPolarSinusoidalRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/mtFlatPolarSinusoidal.png" width="480" height="250">](https://observablehq.com/@d3/flat-polar-sinusoidal)

The McBryde–Thomas flat-polar sinusoidal equal-area projection.

<a href="#geoNaturalEarth1" name="geoNaturalEarth1">#</a> d3.<b>geoNaturalEarth1</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/naturalEarth1.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoNaturalEarth1), [Examples](https://observablehq.com/@d3/natural-earth)
<br><a href="#geoNaturalEarth1Raw" name="geoNaturalEarth1Raw">#</a> d3.<b>geoNaturalEarth1Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/naturalEarth1.png" width="480" height="250">](https://observablehq.com/@d3/natural-earth)

The Natural Earth projection.

<a href="#geoNaturalEarth2" name="geoNaturalEarth2">#</a> d3.<b>geoNaturalEarth2</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/naturalEarth2.js), [Examples](https://observablehq.com/@d3/natural-earth-ii)
<br><a href="#geoNaturalEarth2Raw" name="geoNaturalEarth2Raw">#</a> d3.<b>geoNaturalEarth2Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/naturalEarth2.png" width="480" height="250">](https://observablehq.com/@d3/natural-earth-ii)

The [Natural Earth II](http://www.shadedrelief.com/NE2_proj/) projection. Compared to [Natural Earth](#geoNaturalEarth), it is slightly taller and rounder.

<a href="#geoNellHammer" name="geoNellHammer">#</a> d3.<b>geoNellHammer</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/nellHammer.js), [Examples](https://observablehq.com/@d3/nell-hammer)
<br><a href="#geoNellHammerRaw" name="geoNellHammerRaw">#</a> d3.<b>geoNellHammerRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/nellHammer.png" width="480" height="250">](https://observablehq.com/@d3/nell-hammer)

The Nell–Hammer projection.

<a href="#geoNicolosi" name="geoNicolosi">#</a> d3.<b>geoNicolosi</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/nicolosi.js), [Examples](https://observablehq.com/@toja/nicolosi-globular-projection)
<br><a href="#geoNicolosiRaw" name="geoNicolosiRaw">#</a> d3.<b>geoNicolosiRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/nicolosi.png" width="480" height="250">](https://observablehq.com/@toja/nicolosi-globular-projection)

The Nicolosi globular projection.

<a href="#geoOrthographic" name="geoOrthographic">#</a> d3.<b>geoOrthographic</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/orthographic.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoOrthographic), [Examples](https://observablehq.com/@d3/orthographic)
<br><a href="#geoOrthographicRaw" name="geoOrthographicRaw">#</a> d3.<b>geoOrthographicRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/orthographic.png" width="480" height="250">](https://observablehq.com/@d3/orthographic)

The orthographic projection.

<a href="#geoPatterson" name="geoPatterson">#</a> d3.<b>geoPatterson</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/patterson.js), [Examples](https://observablehq.com/@d3/patterson-cylindrical)
<br><a href="#geoPattersonRaw" name="geoPattersonRaw">#</a> d3.<b>geoPattersonRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/patterson.png" width="480" height="250">](https://observablehq.com/@d3/patterson-cylindrical)

The Patterson cylindrical projection.

<a href="#geoPolyconic" name="geoPolyconic">#</a> d3.<b>geoPolyconic</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/polyconic.js), [Examples](https://observablehq.com/@d3/polyconic)
<br><a href="#geoPolyconicRaw" name="geoPolyconicRaw">#</a> d3.<b>geoPolyconicRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/polyconic.png" width="480" height="250">](https://observablehq.com/@d3/polyconic)

The American polyconic projection.

<a href="#geoRectangularPolyconic" name="geoRectangularPolyconic">#</a> d3.<b>geoRectangularPolyconic</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/rectangularPolyconic.js), [Examples](https://observablehq.com/@d3/rectangular-polyconic)
<br><a href="#geoRectangularPolyconicRaw" name="geoRectangularPolyconicRaw">#</a> d3.<b>geoRectangularPolyconicRaw</b>(<i>phi0</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/rectangularPolyconic.png" width="480" height="250">](https://observablehq.com/@d3/rectangular-polyconic)

The rectangular (War Office) polyconic projection.

<a href="#rectangularPolyconic_parallel" name="rectangularPolyconic_parallel">#</a> <i>rectangularPolyconic</i>.<b>parallel</b>([<i>parallel</i>])

Defaults to 0°.

<a href="#geoRobinson" name="geoRobinson">#</a> d3.<b>geoRobinson</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/robinson.js), [Examples](https://observablehq.com/@d3/robinson)
<br><a href="#geoRobinsonRaw" name="geoRobinsonRaw">#</a> d3.<b>geoRobinsonRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/robinson.png" width="480" height="250">](https://observablehq.com/@d3/robinson)

The Robinson projection.

<a href="#geoSatellite" name="geoSatellite">#</a> d3.<b>geoSatellite</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/satellite.js), [Examples](https://observablehq.com/@d3/satellite)
<br><a href="#geoSatelliteRaw" name="geoSatelliteRaw">#</a> d3.<b>geoSatelliteRaw</b>(<i>P</i>, <i>omega</i>)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/satellite.png" width="480" height="250">](https://observablehq.com/@d3/satellite)

The satellite (tilted perspective) projection.

<a href="#satellite_tilt" name="satellite_tilt">#</a> <i>satellite</i>.<b>tilt</b>([<i>tilt</i>])

Defaults to 0°.

<a href="#satellite_distance" name="satellite_distance">#</a> <i>satellite</i>.<b>distance</b>([<i>distance</i>])

Distance from the center of the sphere to the point of view, as a proportion of the sphere’s radius; defaults to 2.0. The recommended maximum [clip angle](https://github.com/d3/d3-geo/blob/master/README.md#projection_clipAngle) for a given *distance* is acos(1 / *distance*) converted to degrees. If [tilt](#satellite_tilt) is also applied, then more conservative clipping may be necessary. For exact clipping, the in-development geographic projection pipeline is needed; see the [satellite explorer](https://observablehq.com/@d3/satellite-explorer).

<a href="#geoSinusoidal" name="geoSinusoidal">#</a> d3.<b>geoSinusoidal</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/sinusoidal.js), [Examples](https://observablehq.com/@d3/sinusoidal)
<br><a href="#geoSinusoidalRaw" name="geoSinusoidalRaw">#</a> d3.<b>geoSinusoidalRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/sinusoidal.png" width="480" height="250">](https://observablehq.com/@d3/sinusoidal)

The sinusoidal projection.

<a href="#geoSinuMollweide" name="geoSinuMollweide">#</a> d3.<b>geoSinuMollweide</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/sinuMollweide.js), [Examples](https://observablehq.com/@d3/sinu-mollweide)
<br><a href="#geoSinuMollweideRaw" name="geoSinuMollweideRaw">#</a> d3.<b>geoSinuMollweideRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/sinuMollweide.png" width="480" height="250">](https://observablehq.com/@d3/sinu-mollweide)

Allen K. Philbrick’s Sinu-Mollweide projection. See also the [interrupted form](#interruptedSinuMollweide).

<a href="#geoStereographic" name="geoStereographic">#</a> d3.<b>geoStereographic</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/stereographic.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoStereographic), [Examples](https://observablehq.com/@d3/stereographic)
<br><a href="#geoStereographicRaw" name="geoStereographicRaw">#</a> d3.<b>geoStereographicRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/stereographic.png" width="480" height="250">](https://observablehq.com/@d3/stereographic)

The stereographic projection.

<a href="#geoTimes" name="geoTimes">#</a> d3.<b>geoTimes</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/times.js), [Examples](https://observablehq.com/@d3/times)
<br><a href="#geoTimesRaw" name="geoTimesRaw">#</a> d3.<b>geoTimesRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/times.png" width="480" height="250">](https://observablehq.com/@d3/times)

John Muir’s Times projection.

<a href="#geoTransverseMercator" name="geoTransverseMercator">#</a> d3.<b>geoTransverseMercator</b>() · [Source](https://github.com/d3/d3-geo/blob/master/src/projection/transverseMercator.js) [\[d3-geo\]](https://github.com/d3/d3-geo/blob/master/README.md#geoTransverseMercator), [Examples](https://observablehq.com/@d3/transverse-mercator)
<br><a href="#geoTransverseMercatorRaw" name="geoTransverseMercatorRaw">#</a> d3.<b>geoTransverseMercatorRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo/master/img/transverseMercator.png" width="480" height="250">](https://observablehq.com/@d3/transverse-mercator)

The transverse spherical Mercator projection.

<a href="#geoTwoPointAzimuthal" name="geoTwoPointAzimuthal">#</a> d3.<b>geoTwoPointAzimuthal</b>(<i>point0</i>, <i>point1</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/twoPointAzimuthal.js)
<br><a href="#geoTwoPointAzimuthalRaw" name="geoTwoPointAzimuthalRaw">#</a> d3.<b>geoTwoPointAzimuthalRaw</b>(<i>d</i>)

The two-point azimuthal projection “shows correct azimuths (but not distances) from either of two points to any other point. [It can] be used to locate a ship at sea, given the exact location of two radio transmitters and the direction of the ship to the transmitters.” This projection does not support [*projection*.rotate](https://github.com/d3/d3-geo/blob/master/README.md#projection_rotate), as the rotation is fixed by the two given points.

<a href="#geoTwoPointAzimuthalUsa" name="geoTwoPointAzimuthalUsa">#</a> d3.<b>geoTwoPointAzimuthalUsa</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/twoPointAzimuthal.js)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/twoPointAzimuthalUsa.png" width="480" height="250">](https://www.jasondavies.com/maps/two-point-azimuthal/)

The two-point azimuthal projection with points [-158°, 21.5°] and [-77°, 39°], approximately representing Honolulu, HI and Washington, D.C.

<a href="#geoTwoPointEquidistant" name="geoTwoPointEquidistant">#</a> d3.<b>geoTwoPointEquidistant</b>(<i>point0</i>, <i>point1</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/twoPointEquidistant.js)
<br><a href="#geoTwoPointEquidistantRaw" name="geoTwoPointEquidistantRaw">#</a> d3.<b>geoTwoPointEquidistantRaw</b>(<i>z0</i>)

The two-point equidistant projection. This projection does not support [*projection*.rotate](https://github.com/d3/d3-geo/blob/master/README.md#projection_rotate), as the rotation is fixed by the two given points. Note: to show the whole Earth, this projection requires clipping to spherical polygons, which is not yet supported in D3. However, you can typically show most of the Earth by using D3’s great-circle clipping.

<a href="#geoTwoPointEquidistantUsa" name="geoTwoPointEquidistantUsa">#</a> d3.<b>geoTwoPointEquidistantUsa</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/twoPointEquidistant.js)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/twoPointEquidistantUsa.png" width="480" height="250">](https://www.jasondavies.com/maps/two-point-equidistant/)

The two-point equidistant projection with points [-158°, 21.5°] and [-77°, 39°], approximately representing Honolulu, HI and Washington, D.C.

<a href="#geoVanDerGrinten" name="geoVanDerGrinten">#</a> d3.<b>geoVanDerGrinten</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/vanDerGrinten.js), [Examples](https://observablehq.com/@d3/van-der-grinten-i)
<br><a href="#geoVanDerGrintenRaw" name="geoVanDerGrintenRaw">#</a> d3.<b>geoVanDerGrintenRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/vanDerGrinten.png" width="480" height="250">](https://observablehq.com/@d3/van-der-grinten-i)

The Van der Grinten projection.

<a href="#geoVanDerGrinten2" name="geoVanDerGrinten2">#</a> d3.<b>geoVanDerGrinten2</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/vanDerGrinten2.js), [Examples](https://observablehq.com/@d3/van-der-grinten-ii)
<br><a href="#geoVanDerGrinten2Raw" name="geoVanDerGrinten2Raw">#</a> d3.<b>geoVanDerGrinten2Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/vanDerGrinten2.png" width="480" height="250">](https://observablehq.com/@d3/van-der-grinten-ii)

The Van der Grinten II projection.

<a href="#geoVanDerGrinten3" name="geoVanDerGrinten3">#</a> d3.<b>geoVanDerGrinten3</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/vanDerGrinten3.js), [Examples](https://observablehq.com/@d3/van-der-grinten-iii)
<br><a href="#geoVanDerGrinten3Raw" name="geoVanDerGrinten3Raw">#</a> d3.<b>geoVanDerGrinten3Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/vanDerGrinten3.png" width="480" height="250">](https://observablehq.com/@d3/van-der-grinten-iii)

The Van der Grinten III projection.

<a href="#geoVanDerGrinten4" name="geoVanDerGrinten4">#</a> d3.<b>geoVanDerGrinten4</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/vanDerGrinten4.js), [Examples](https://observablehq.com/@d3/van-der-grinten-iv)
<br><a href="#geoVanDerGrinten4Raw" name="geoVanDerGrinten4Raw">#</a> d3.<b>geoVanDerGrinten4Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/vanDerGrinten4.png" width="480" height="250">](https://observablehq.com/@d3/van-der-grinten-iv)

The Van der Grinten IV projection.

<a href="#geoWagner" name="geoWagner">#</a> d3.<b>geoWagner</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/wagner.js), [Examples](https://observablehq.com/@fil/wagner-customizable-projection)
<br><a href="#geoWagnerRaw" name="geoWagnerRaw">#</a> d3.<b>geoWagnerRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/wagner.png" width="480" height="250">](https://map-projections.net/d3-customizable-wagner/)

The Wagner projection is customizable: default values produce the Wagner VIII projection.

<a href="#wagner_poleline" name="wagner_poleline">#</a> <i>wagner</i>.<b>poleline</b>([<i>poleline</i>])

Defaults to 65°.

<a href="#wagner_parallels" name="wagner_parallels">#</a> <i>wagner</i>.<b>parallels</b>([<i>parallels</i>])

Defaults to 60°.

<a href="#wagner_inflation" name="wagner_inflation">#</a> <i>wagner</i>.<b>inflation</b>([<i>inflation</i>])

Defaults to 20.

<a href="#wagner_ratio" name="wagner_ratio">#</a> <i>wagner</i>.<b>ratio</b>([<i>ratio</i>])

Defaults to 200.

<a href="#geoWagner4" name="geoWagner4">#</a> d3.<b>geoWagner4</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/wagner4.js), [Examples](https://observablehq.com/@d3/wagner-iv)
<br><a href="#geoWagner4Raw" name="geoWagner4Raw">#</a> d3.<b>geoWagner4Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/wagner4.png" width="480" height="250">](https://observablehq.com/@d3/wagner-iv)

The Wagner IV projection, also known as Putniṇš P2´.

<a href="#geoWagner6" name="geoWagner6">#</a> d3.<b>geoWagner6</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/wagner6.js), [Examples](https://observablehq.com/@d3/wagner-vi)
<br><a href="#geoWagner6Raw" name="geoWagner6Raw">#</a> d3.<b>geoWagner6Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/wagner6.png" width="480" height="250">](https://observablehq.com/@d3/wagner-vi)

The Wagner VI projection.

<a href="#geoWagner7" name="geoWagner7">#</a> d3.<b>geoWagner7</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/wagner7.js), [Examples](ttps://observablehq.com/@d3/wagner-vii)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/wagner7.png" width="480" height="250">](https://observablehq.com/@d3/wagner-vii)

The Wagner VII projection.

<a href="#geoWiechel" name="geoWiechel">#</a> d3.<b>geoWiechel</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/wiechel.js), [Examples](https://observablehq.com/@d3/wiechel)
<br><a href="#geoWiechelRaw" name="geoWiechelRaw">#</a> d3.<b>geoWiechelRaw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/wiechel.png" width="480" height="250">](https://observablehq.com/@d3/wiechel)

The Wiechel projection.

<a href="#geoWinkel3" name="geoWinkel3">#</a> d3.<b>geoWinkel3</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/winkel3.js), [Examples](https://observablehq.com/@d3/winkel-tripel)
<br><a href="#geoWinkel3Raw" name="geoWinkel3Raw">#</a> d3.<b>geoWinkel3Raw</b>

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/winkel3.png" width="480" height="250">](https://observablehq.com/@d3/winkel-tripel)

The Winkel tripel projection.

### Interrupted Projections

<a href="#geoInterrupt" name="geoInterrupt">#</a> d3.<b>geoInterrupt</b>(<i>project</i>, <i>lobes</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/interrupted/index.js), [Examples](https://observablehq.com/@d3/interrupted-sinusoidal)

Defines a new interrupted projection for the specified [raw projection](#raw-projections) function *project* and the specified array of *lobes*. The array *lobes* contains two elements representing the hemilobes for the northern hemisphere and the southern hemisphere, respectively. Each hemilobe is an array of triangles, with each triangle represented as three points (in degrees): the start, midpoint, and end. For example, the lobes in [Goode’s interrupted homolosine](#geoInterruptedHomolosine) projection are defined as:

```json
[
  [
    [[-180,   0], [-100,  90], [ -40,   0]],
    [[ -40,   0], [  30,  90], [ 180,   0]]
  ],
  [
    [[-180,   0], [-160, -90], [-100,   0]],
    [[-100,   0], [ -60, -90], [ -20,   0]],
    [[ -20,   0], [  20, -90], [  80,   0]],
    [[  80,   0], [ 140, -90], [ 180,   0]]
  ]
]
```

Note: interrupted projections typically require clipping to the sphere.

<a href="#interrupted_lobes" name="interrupted_lobes">#</a> <i>interrupted</i>.<b>lobes</b>([<i>lobes</i>]) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/interrupted/index.js)

If *lobes* is specified, sets the new array of hemilobes and returns this projection; see [d3.geoInterrupt](#geoInterrupt) for details on the format of the hemilobes array. If *lobes* is not specified, returns the current array of hemilobes.

<a href="#geoInterruptedHomolosine" name="geoInterruptedHomolosine">#</a> d3.<b>geoInterruptedHomolosine</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/interrupted/homolosine.js), [Examples](https://observablehq.com/@d3/interrupted-goode-homolosine)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/interruptedHomolosine.png" width="480" height="250">](https://observablehq.com/@d3/interrupted-goode-homolosine)

Goode’s interrupted [homolosine projection](#geoHomolosine). Its [ocean-centric aspect](https://observablehq.com/@d3/interrupted-homolosine-oceans) is also well-known.

<a href="#geoInterruptedSinusoidal" name="geoInterruptedSinusoidal">#</a> d3.<b>geoInterruptedSinusoidal</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/interrupted/sinusoidal.js), [Examples](https://observablehq.com/@d3/interrupted-sinusoidal)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/interruptedSinusoidal.png" width="480" height="250">](https://observablehq.com/@d3/interrupted-sinusoidal)

An interrupted [sinusoidal projection](#geoSinusoidal) with asymmetrical lobe boundaries that emphasize land masses over oceans, after the Swedish <i>Nordisk Världs Atlas</i> as reproduced by [C.A. Furuti](https://web.archive.org/web/20150928042327/http://www.progonos.com/furuti/MapProj/Normal/ProjInt/projInt.html#InterruptedSansonFlamsteed).

<a href="#geoInterruptedBoggs" name="geoInterruptedBoggs">#</a> d3.<b>geoInterruptedBoggs</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/interrupted/boggs.js), [Examples](https://observablehq.com/@d3/interrupted-boggs-eumorphic)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/interruptedBoggs.png" width="480" height="250">](https://observablehq.com/@d3/interrupted-boggs-eumorphic)

Bogg’s interrupted [eumorphic projection](#geoBoggs).

<a href="#geoInterruptedSinuMollweide" name="geoInterruptedSinuMollweide">#</a> d3.<b>geoInterruptedSinuMollweide</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/interrupted/sinuMollweide.js), [Examples](https://observablehq.com/@d3/interrupted-sinu-mollweide)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/interruptedSinuMollweide.png" width="480" height="250">](https://observablehq.com/@d3/interrupted-sinu-mollweide)

Alan K. Philbrick’s interrupted [sinu-Mollweide projection](#geoSinuMollweide).

<a href="#geoInterruptedMollweide" name="geoInterruptedMollweide">#</a> d3.<b>geoInterruptedMollweide</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/interrupted/mollweide.js), [Examples](https://observablehq.com/@d3/interrupted-mollweide)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/interruptedMollweide.png" width="480" height="250">](https://observablehq.com/@d3/interrupted-mollweide)

Goode’s interrupted [Mollweide projection](#geoMollweide).

<a href="#geoInterruptedMollweideHemispheres" name="geoInterruptedMollweideHemispheres">#</a> d3.<b>geoInterruptedMollweideHemispheres</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/interrupted/mollweideHemispheres.js), [Examples](https://observablehq.com/@d3/mollweide-hemispheres)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/interruptedMollweideHemispheres.png" width="480" height="250">](https://observablehq.com/@d3/mollweide-hemispheres)

The [Mollweide projection](#geoMollweide) interrupted into two (equal-area) hemispheres.

<a href="#geoInterruptedQuarticAuthalic" name="geoInterruptedQuarticAuthalic">#</a> d3.<b>geoInterruptedQuarticAuthalic</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/quarticAuthalic.js), [Examples](https://observablehq.com/@piwodlaiwo/interrupted-quartic-authalic-projection)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/interruptedQuarticAuthalic.png" width="480" height="250">](https://observablehq.com/@piwodlaiwo/interrupted-quartic-authalic-projection)

The [quartic authalic projection](https://observablehq.com/@d3/hammer?b=Infinity) interrupted into two hemispheres.

### Polyhedral Projections

<a href="#geoPolyhedral" name="geoPolyhedral">#</a> d3.<b>geoPolyhedral</b>(<i>root</i>, <i>face</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/polyhedral/index.js)

Defines a new polyhedral projection. The *root* is a spanning tree of polygon face nodes; each *node* is assigned a *node*.transform matrix. The *face* function returns the appropriate *node* for a given *lambda* and *phi* in radians. Use [*projection*.angle](https://github.com/d3/d3-geo/blob/master/README.md#projection_angle) to set the orientation of the map (the default *angle*, -30°, might change in the next major version).

<a href="#geoPolyhedralButterfly" name="geoPolyhedralButterfly">#</a> d3.<b>geoPolyhedralButterfly</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/polyhedral/butterfly.js), [Examples](https://observablehq.com/@d3/polyhedral-gnomonic)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/polyhedralButterfly.png" width="480" height="250">](https://observablehq.com/@d3/polyhedral-gnomonic)

The gnomonic butterfly projection.

<a href="#geoPolyhedralCollignon" name="geoPolyhedralCollignon">#</a> d3.<b>geoPolyhedralCollignon</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/polyhedral/collignon.js), [Examples](https://observablehq.com/@d3/polyhedral-collignon)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/polyhedralCollignon.png" width="480" height="250">](https://www.jasondavies.com/maps/collignon-butterfly/)

The Collignon butterfly projection.

<a href="#geoPolyhedralWaterman" name="geoPolyhedralWaterman">#</a> d3.<b>geoPolyhedralWaterman</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/polyhedral/waterman.js), [Examples](https://observablehq.com/@d3/watermans-butterfly)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/polyhedralWaterman.png" width="480" height="250">](https://www.jasondavies.com/maps/waterman-butterfly/)

Steve Waterman’s butterfly projection.

### Quincuncial Projections

<a href="#geoQuincuncial" name="geoQuincuncial">#</a> d3.<b>geoQuincuncial</b>(<i>project</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/quincuncial/index.js)

Defines a new quincuncial projection for the specified [raw projection](#raw-projections) function *project*. The default rotation is [-90°, -90°, 45°] and the default clip angle is 180° - ε.

<a href="#geoGringortenQuincuncial" name="geoGringortenQuincuncial">#</a> d3.<b>geoGringortenQuincuncial</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/quincuncial/gringorten.js)

<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/gringortenQuincuncial.png" width="480" height="250">

The Gringorten square equal-area projection.

<a href="#geoPeirceQuincuncial" name="geoPeirceQuincuncial">#</a> d3.<b>geoPeirceQuincuncial</b>() · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/quincuncial/peirce.js)

[<img src="https://raw.githubusercontent.com/d3/d3-geo-projection/master/img/peirceQuincuncial.png" width="480" height="250">](https://observablehq.com/@d3/peirce-quincuncial)

The Peirce quincuncial projection is the quincuncial form of the [Guyou projection](#geoGuyou).

### Transformations

<a href="#geoProject" name="geoProject">#</a> d3.<b>geoProject</b>(<i>object</i>, <i>projection</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/project/index.js)

Projects the specified GeoJSON *object* using the specified *projection*, returning a shallow copy of the specified GeoJSON *object* with projected coordinates. Typically, the input coordinates are spherical and the output coordinates are planar, but the *projection* can also be an [arbitrary geometric transformation](https://github.com/d3/d3-geo/blob/master/README.md#transforms).

See also [geoproject](#geoproject).

<a href="#geoStitch" name="geoStitch">#</a> d3.<b>geoStitch</b>(<i>object</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/stitch.js)

Returns a shallow copy of the specified GeoJSON *object*, removing antimeridian and polar cuts, and replacing straight Cartesian line segments with geodesic segments. The input *object* must have coordinates in longitude and latitude in decimal degrees per [RFC 7946](https://tools.ietf.org/html/rfc7946). [Antimeridian cutting](https://bl.ocks.org/mbostock/3788999), if needed, can then be re-applied after rotating to the desired projection aspect.

See also [geostitch](#geostitch).

<a href="#geoQuantize" name="geoQuantize">#</a> d3.<b>geoQuantize</b>(<i>object</i>, <i>digits</i>) · [Source](https://github.com/d3/d3-geo-projection/blob/master/src/quantize.js)

Returns a shallow copy of the specified GeoJSON *object*, rounding *x* and *y* coordinates according to [*number*.toFixed](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toFixed). Typically this is done *after* [projecting](#geoProject).

See also [geoproject --precision](#geoproject_precision) and [geo2svg --precision](#geo2svg_precision).

## Command-Line Reference

### geo2svg

<a href="#geo2svg" name="geo2svg">#</a> <b>geo2svg</b> [<i>options…</i>] [<i>file</i>] · [Source](https://github.com/d3/d3-geo-projection/blob/master/bin/geo2svg)

Converts the specified GeoJSON *file* to SVG. With [--newline-delimited](#geo2svg_newline_delimited), each input feature is rendered as a separate [path element](https://www.w3.org/TR/SVG/paths.html); otherwise, a single path element is generated.

By default, the SVG’s [fill](#geo2svg_fill) is set to none and the [stroke](#geo2svg_stroke) is set to black. The default [point radius](https://github.com/d3/d3-geo/blob/master/README.md#path_pointRadius) is 4.5. To override these values on a per-feature basis, the following [GeoJSON feature](http://geojson.org/geojson-spec.html#feature-objects) properties will be propagated to attributes:

* fill
* fill-rule (or fillRule)
* fill-opacity (or fillOpacity)
* stroke
* stroke-width (or strokeWidth)
* stroke-linecap (or strokeLinecap)
* stroke-linejoin (or strokeLinejoin)
* stroke-miterlimit (or strokeMiterlimit)
* stroke-dasharray (or strokeDasharray)
* stroke-dashoffset (or strokeDashoffset)
* stroke-opacity (or strokeOpacity)
* point-radius (or pointRadius)

If the feature has an id, the path element will have a corresponding id attribute. If the feature has a *title* property, the path element will have a title element with the corresponding value. For an example of per-feature attributes, see this [California population density map](https://bl.ocks.org/mbostock/fb6c1e5ff700f9713a9dc2f0fd392c35).

Note: per-feature attributes are most useful in conjunction with [newline-delimited](#geo2svg_newline_delimited) input, as otherwise the generated SVG only has a single path element. To set these properties dynamically, pass the input through [ndjson-map](https://github.com/mbostock/ndjson-cli/blob/master/README.md#map).

<a name="geo2svg_help" href="#geo2svg_help">#</a> geo2svg <b>-h</b>
<br><a href="#geo2svg_help">#</a> geo2svg <b>--help</b>

Output usage information.

<a name="geo2svg_version" href="#geo2svg_version">#</a> geo2svg <b>-V</b>
<br><a href="#geo2svg_version">#</a> geo2svg <b>--version</b>

Output the version number.

<a name="geo2svg_out" href="#geo2svg_out">#</a> geo2svg <b>-o</b> <i>file</i>
<br><a href="#geo2svg_out">#</a> geo2svg <b>--out</b> <i>file</i>

Specify the output file name. Defaults to “-” for stdout.

<a name="geo2svg_width" href="#geo2svg_width">#</a> geo2svg <b>-w</b> <i>value</i>
<br><a href="#geo2svg_width">#</a> geo2svg <b>--width</b> <i>value</i>

Specify the output width. Defaults to 960.

<a name="geo2svg_height" href="#geo2svg_height">#</a> geo2svg <b>-h</b> <i>value</i>
<br><a href="#geo2svg_height">#</a> geo2svg <b>--height</b> <i>value</i>

Specify the output height. Defaults to 500.

<a name="geo2svg_precision" href="#geo2svg_precision">#</a> geo2svg <b>-p</b> <i>value</i>
<br><a href="#geo2svg_precision">#</a> geo2svg <b>--precision</b> <i>value</i>

Reduce the precision for smaller output files. Defaults to six digits after the decimal point. See also [d3.geoQuantize](#geoQuantize).

<a name="geo2svg_fill" href="#geo2svg_fill">#</a> geo2svg <b>--fill</b> <i>value</i>

Specify the default output fill color. Defaults to none.

<a name="geo2svg_stroke" href="#geo2svg_stroke">#</a> geo2svg <b>--stroke</b> <i>value</i>

Specify the default output stroke color. Defaults to black.

<a name="geo2svg_radius" href="#geo2svg_radius">#</a> geo2svg <b>--r</b> <i>value</i>
<br><a name="geo2svg_radius" href="#geo2svg_radius">#</a> geo2svg <b>--radius</b> <i>value</i>

Specify the default output point radius. Defaults to 4.5.

<a name="geo2svg_newline_delimited" href="#geo2svg_newline_delimited">#</a> geo2svg <b>-n</b>
<br><a href="#geo2svg_newline_delimited">#</a> geo2svg <b>--newline-delimited</b>

Accept [newline-delimited JSON](http://ndjson.org/) as input, with one feature per line.

### geograticule

<a href="#geograticule" name="geograticule">#</a> <b>geograticule</b> [<i>options</i>…] · [Source](https://github.com/d3/d3-geo-projection/blob/master/bin/geograticule)

Generates a GeoJSON graticule. See also [d3.geoGraticule](https://github.com/d3/d3-geo/blob/master/README.md#geoGraticule).

<a name="geograticule_help" href="#geograticule_help">#</a> geograticule <b>-h</b>
<br><a href="#geograticule_help">#</a> geograticule <b>--help</b>

Output usage information.

<a name="geograticule_version" href="#geograticule_version">#</a> geograticule <b>-V</b>
<br><a href="#geograticule_version">#</a> geograticule <b>--version</b>

Output the version number.

<a name="geograticule_out" href="#geograticule_out">#</a> geograticule <b>-o</b> <i>file</i>
<br><a href="#geograticule_out">#</a> geograticule <b>--out</b> <i>file</i>

Specify the output file name. Defaults to “-” for stdout.

<a name="geograticule_extent" href="#geograticule_extent">#</a> geograticule <b>--extent</b> <i>value</i>

Sets the graticule’s [extent](https://github.com/d3/d3-geo/blob/master/README.md#graticule_extent).

<a name="geograticule_extent_minor" href="#geograticule_extent_minor">#</a> geograticule <b>--extent-minor</b> <i>value</i>

Sets the graticule’s [minor extent](https://github.com/d3/d3-geo/blob/master/README.md#graticule_extentMinor).

<a name="geograticule_extent_major" href="#geograticule_extent_major">#</a> geograticule <b>--extent-major</b> <i>value</i>

Sets the graticule’s [major extent](https://github.com/d3/d3-geo/blob/master/README.md#graticule_extentMajor).

<a name="geograticule_step" href="#geograticule_step">#</a> geograticule <b>--step</b> <i>value</i>

Sets the graticule’s [step](https://github.com/d3/d3-geo/blob/master/README.md#graticule_step).

<a name="geograticule_step_minor" href="#geograticule_step_minor">#</a> geograticule <b>--step-minor</b> <i>value</i>

Sets the graticule’s [minor step](https://github.com/d3/d3-geo/blob/master/README.md#graticule_stepMinor).

<a name="geograticule_step_major" href="#geograticule_step_major">#</a> geograticule <b>--step-major</b> <i>value</i>

Sets the graticule’s [major setp](https://github.com/d3/d3-geo/blob/master/README.md#graticule_stepMajor).

<a name="geograticule_precision" href="#geograticule_precision">#</a> geograticule <b>--precision</b> <i>value</i>

Sets the graticule’s [precision](https://github.com/d3/d3-geo/blob/master/README.md#graticule_precision).

### geoproject

<a href="#geoproject" name="geoproject">#</a> <b>geoproject</b> [<i>options</i>…] <i>projection</i> [<i>file</i>] · [Source](https://github.com/d3/d3-geo-projection/blob/master/bin/geoproject)

Projects the GeoJSON object in the specified input *file* using the specified *projection*, outputting a new GeoJSON *object* with projected coordinates. For example, to project standard [WGS 84](https://en.wikipedia.org/wiki/World_Geodetic_System#A_new_World_Geodetic_System:_WGS_84) input using [d3.geoAlbersUsa](https://github.com/d3/d3-geo/blob/master/README.md#geoAlbersUsa):

```bash
geoproject 'd3.geoAlbersUsa()' us.json \
  > us-albers.json
```

For geometry that crosses the antimeridian or surrounds a pole, you will want to pass input through [geostitch](#geostitch) first:

```bash
geostitch world.json \
  | geoproject 'd3.geoMercator()' \
  > world-mercator.json
```

Typically, the input coordinates are spherical and the output coordinates are planar, but the *projection* can also be an [arbitrary geometric transformation](https://github.com/d3/d3-geo/blob/master/README.md#transforms). For example, to invert the *y*-axis of a standard [spatial reference system](https://en.wikipedia.org/wiki/Spatial_reference_system) such as [California Albers (EPSG:3310)](http://spatialreference.org/ref/epsg/nad83-california-albers/) and fit it to a 960×500 viewport:

```bash
shp2json planar.shp \
  | geoproject 'd3.geoIdentity().reflectY(true).fitSize([960, 500], d)' \
  > planar.json
```

See also [d3.geoProject](#geoProject) and [d3.geoIdentity](https://github.com/d3/d3-geo/blob/master/README.md#geoIdentity).

<a name="geoproject_help" href="#geoproject_help">#</a> geoproject <b>-h</b>
<br><a href="#geoproject_help">#</a> geoproject <b>--help</b>

Output usage information.

<a name="geoproject_version" href="#geoproject_version">#</a> geoproject <b>-V</b>
<br><a href="#geoproject_version">#</a> geoproject <b>--version</b>

Output the version number.

<a name="geoproject_out" href="#geoproject_out">#</a> geoproject <b>-o</b> <i>file</i>
<br><a href="#geoproject_out">#</a> geoproject <b>--out</b> <i>file</i>

Specify the output file name. Defaults to “-” for stdout.

<a name="geoproject_precision" href="#geoproject_precision">#</a> geoproject <b>-p</b> <i>value</i>
<br><a href="#geoproject_precision">#</a> geoproject <b>--precision</b> <i>value</i>

Reduce the precision for smaller output files. See also [d3.geoQuantize](#geoQuantize).

<a name="geoproject_newline_delimited" href="#geoproject_newline_delimited">#</a> geoproject <b>-n</b>
<br><a href="#geoproject_newline_delimited">#</a> geoproject <b>--newline-delimited</b>

Accept [newline-delimited JSON](http://ndjson.org/) as input, with one feature per line, and generate newline-delimited JSON as output.

<a name="geoproject_require" href="#geoproject_require">#</a> geoproject <b>-r</b> <i>[name=]value</i>
<br><a href="#geoproject_require">#</a> geoproject <b>--require</b> <i>[name=]value</i>

Requires the specified *module*, making it available for use in any expressions used by this command. The loaded module is available as the symbol *name*. If *name* is not specified, it defaults to *module*. (If *module* is not a valid identifier, you must specify a *name*.) For example, to reproject the world on the [Airocean projection](https://github.com/d3/d3-geo-polygon/blob/master/README.md#geoAirocean):

```bash
geoproject --require d3=d3-geo-polygon 'd3.geoAirocean()' world.geojson
```

The required *module* is resolved relative to the [current working directory](https://nodejs.org/api/process.html#process_process_cwd). If the *module* is not found during normal resolution, the [global npm root](https://docs.npmjs.com/cli/root) is also searched, allowing you to require globally-installed modules from the command line.

Multiple modules can be required by repeating this option.

### geoquantize

<a href="#geoquantize" name="geoquantize">#</a> <b>geoquantize</b> [<i>options</i>…] [<i>file</i>] · [Source](https://github.com/d3/d3-geo-projection/blob/master/bin/geoquantize)

Reads the GeoJSON object from the specified input *file* and outputs a new GeoJSON *object* with coordinates reduced to *precision*. Same options as [geoproject](#geoproject).

```bash
geoquantize us.json --precision 3 \
  > us-quantized.json
```

### geostitch

<a href="#geostitch" name="geostitch">#</a> <b>geostitch</b> [<i>options</i>…] [<i>file</i>] · [Source](https://github.com/d3/d3-geo-projection/blob/master/bin/geostitch)

Stitches the GeoJSON object in the specified input *file*, removing antimeridian and polar cuts, and replacing straight Cartesian line segments with geodesic segments. The input *object* must have coordinates in longitude and latitude in decimal degrees per [RFC 7946](https://tools.ietf.org/html/rfc7946). [Antimeridian cutting](https://bl.ocks.org/mbostock/3788999), if needed, can then be re-applied after rotating to the desired projection aspect.

See [geoproject](#geoproject) for an example. See also [d3.geoStitch](#geoStitch).

<a name="geostitch_help" href="#geostitch_help">#</a> geostitch <b>-h</b>
<br><a href="#geostitch_help">#</a> geostitch <b>--help</b>

Output usage information.

<a name="geostitch_version" href="#geostitch_version">#</a> geostitch <b>-V</b>
<br><a href="#geostitch_version">#</a> geostitch <b>--version</b>

Output the version number.

<a name="geostitch_out" href="#geostitch_out">#</a> geostitch <b>-o</b> <i>file</i>
<br><a href="#geostitch_out">#</a> geostitch <b>--out</b> <i>file</i>

Specify the output file name. Defaults to “-” for stdout.

<a name="geostitch_newline_delimited" href="#geostitch_newline_delimited">#</a> geostitch <b>-n</b>
<br><a href="#geostitch_newline_delimited">#</a> geostitch <b>--newline-delimited</b>

Accept [newline-delimited JSON](http://ndjson.org/) as input, with one feature per line, and generate newline-delimited JSON as output.
