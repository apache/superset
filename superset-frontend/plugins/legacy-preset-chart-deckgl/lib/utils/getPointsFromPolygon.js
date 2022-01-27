export default function getPointsFromPolygon(feature) {
    return 'geometry' in feature.polygon
        ? feature.polygon.geometry.coordinates[0]
        : feature.polygon;
}
//# sourceMappingURL=getPointsFromPolygon.js.map