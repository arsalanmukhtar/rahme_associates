// static/js/map_layers.js
// Boilerplate for defining reusable Mapbox GL JS vector source and layer definitions for MVT tiles only

/**
 * Returns a Mapbox vector source definition for MVT tiles.
 * @param {string} id - The source id.
 * @param {string[]} tiles - Array of tile URL templates.
 * @param {number} [maxzoom=22] - Max zoom level.
 */
export function vectorSource(id, tiles, maxzoom = 22) {
    return {
        type: 'vector',
        tiles,
        maxzoom
    };
}

/**
 * Returns a Mapbox circle (point) layer for vector tiles.
 * @param {string} id - Layer id.
 * @param {string} source - Source id.
 * @param {string} sourceLayer - Source-layer name in the vector tileset.
 * @param {object} [paint] - Paint overrides.
 * @param {object} [filter] - Optional filter array.
 */
export function vectorCircleLayer(id, source, sourceLayer, paint = {}, filter = null) {
    const layer = {
        id,
        type: 'circle',
        source,
        'source-layer': sourceLayer,
        paint: Object.assign({
            'circle-radius': 6,
            'circle-color': '#007cbf',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
        }, paint)
    };
    if (filter) layer.filter = filter;
    return layer;
}

/**
 * Returns a Mapbox symbol (icon/text) layer for vector tiles (Point geometry).
 * @param {string} id - Layer id.
 * @param {string} source - Source id.
 * @param {string} sourceLayer - Source-layer name in the vector tileset.
 * @param {object} [layout] - Layout overrides.
 * @param {object} [paint] - Paint overrides.
 * @param {object} [filter] - Optional filter array.
 * @param {number} [minzoom] - Optional minzoom.
 */
export function vectorSymbolLayer(id, source, sourceLayer, layout = {}, paint = {}, filter = null, minzoom = null) {
    const layer = {
        id,
        type: 'symbol',
        source,
        'source-layer': sourceLayer,
        layout: Object.assign({
            'icon-image': 'marker-15',
            'icon-size': 1.2,
            'text-field': ['get', 'name'],
            'text-font': ['Open Sans Bold'],
            'text-size': 14,
            'text-anchor': 'top',
            'symbol-placement': 'point'
        }, layout),
        paint: Object.assign({
            'text-color': '#2c2c2c',
            'text-halo-color': '#ffffff',
            'text-halo-width': 0.5
        }, paint)
    };
    if (filter) layer.filter = filter;
    if (minzoom !== null) layer.minzoom = minzoom;
    return layer;
}

/**
 * Returns a Mapbox heatmap layer for vector tiles (Point geometry).
 * @param {string} id - Layer id.
 * @param {string} source - Source id.
 * @param {string} sourceLayer - Source-layer name in the vector tileset.
 * @param {object} [paint] - Paint overrides.
 * @param {object} [filter] - Optional filter array.
 */
export function vectorHeatmapLayer(id, source, sourceLayer, paint = {}, filter = null) {
    const layer = {
        id,
        type: 'heatmap',
        source,
        'source-layer': sourceLayer,
        paint: Object.assign({
            'heatmap-radius': 15,
            'heatmap-intensity': 1,
            'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(33,102,172,0)',
                0.2, 'rgb(103,169,207)',
                0.4, 'rgb(209,229,240)',
                0.6, 'rgb(253,219,199)',
                0.8, 'rgb(239,138,98)',
                1, 'rgb(178,24,43)'
            ]
        }, paint)
    };
    if (filter) layer.filter = filter;
    return layer;
}

/**
 * Returns a Mapbox line layer for vector tiles (Line geometry).
 * @param {string} id - Layer id.
 * @param {string} source - Source id.
 * @param {string} sourceLayer - Source-layer name in the vector tileset.
 * @param {object} [paint] - Paint overrides.
 * @param {object} [layout] - Layout overrides.
 * @param {object} [filter] - Optional filter array.
 */
export function vectorLineLayer(id, source, sourceLayer, paint = {}, layout = {}, filter = null) {
    const layer = {
        id,
        type: 'line',
        source,
        'source-layer': sourceLayer,
        paint: Object.assign({
            'line-width': 0.3,
            'line-color': '#d2dae2',
            'line-opacity': 0.7
        }, paint),
        layout: Object.assign({}, layout)
    };
    if (filter) layer.filter = filter;
    return layer;
}

/**
 * Returns a Mapbox fill (polygon) layer for vector tiles (Polygon geometry).
 * @param {string} id - Layer id.
 * @param {string} source - Source id.
 * @param {string} sourceLayer - Source-layer name in the vector tileset.
 * @param {object} [paint] - Paint overrides.
 * @param {object} [filter] - Optional filter array.
 */
export function vectorFillLayer(id, source, sourceLayer, paint = {}, filter = null) {
    const layer = {
        id,
        type: 'fill',
        source,
        'source-layer': sourceLayer,
        paint: Object.assign({
            'fill-opacity': 0.2,
            'fill-color': '#ffffff'
        }, paint)
    };
    if (filter) layer.filter = filter;
    return layer;
}

// Geometry type to allowed layer types mapping
export const GEOMETRY_LAYER_TYPES = {
    Point: ['circle', 'symbol', 'heatmap'],
    LineString: ['line'],
    Polygon: ['fill']
};

// Example usage (in your map_dashboard.js):
// import { vectorSource, vectorCircleLayer, vectorSymbolLayer, vectorHeatmapLayer, vectorLineLayer, vectorFillLayer, GEOMETRY_LAYER_TYPES } from './map_layers.js';
// map.addSource('my-vector-source', vectorSource('my-vector-source', ['https://my.tileserver.com/tiles/{z}/{x}/{y}.mvt']));
// map.addLayer(vectorCircleLayer('my-point-layer', 'my-vector-source', 'my-source-layer'));
