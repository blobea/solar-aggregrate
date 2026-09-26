// @ts-check
/**
 * Leaflet roof-drawing map: tap corners to draw a polygon; area is computed automatically.
 * Leaflet is loaded lazily so it only ships with the configurator.
 */

/**
 * Planar area (m²) of a small lat/lng polygon using a local equirectangular projection.
 * Accurate to well under 1% for roof-sized shapes.
 * @param {{lat:number, lng:number}[]} pts
 */
export function polygonAreaSqm(pts) {
  if (pts.length < 3) return 0;
  const R = 6371008.8;
  const lat0 = (pts.reduce((s, p) => s + p.lat, 0) / pts.length) * (Math.PI / 180);
  const xy = pts.map((p) => [R * (p.lng * Math.PI / 180) * Math.cos(lat0), R * (p.lat * Math.PI / 180)]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/**
 * @param {HTMLElement} el
 * @param {{lat:number, lng:number}} center
 * @param {(areaSqm:number, points:{lat:number,lng:number}[]) => void} onChange
 */
export async function createRoofMap(el, center, onChange) {
  const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  const map = L.map(el, { zoomControl: true, attributionControl: true, tap: true }).setView([center.lat, center.lng], 19);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  /** @type {{lat:number,lng:number}[]} */
  let points = [];
  const layer = L.layerGroup().addTo(map);

  const redraw = () => {
    layer.clearLayers();
    if (points.length >= 2) {
      const shape = points.length >= 3 ? L.polygon(points, { color: '#0a6b4f', weight: 2, fillColor: '#f2a516', fillOpacity: 0.35 })
        : L.polyline(points, { color: '#0a6b4f', weight: 2 });
      shape.addTo(layer);
    }
    points.forEach((p) => L.circleMarker(p, { radius: 6, color: '#fff', weight: 2, fillColor: '#0a6b4f', fillOpacity: 1 }).addTo(layer));
    onChange(Math.round(polygonAreaSqm(points)), points);
  };

  map.on('click', (/** @type {any} */ e) => {
    points.push({ lat: e.latlng.lat, lng: e.latlng.lng });
    redraw();
  });

  return {
    undo() { points.pop(); redraw(); },
    clear() { points = []; redraw(); },
    /** @param {{lat:number,lng:number}} c */
    recenter(c) { map.setView([c.lat, c.lng], 19); },
    /** @param {{lat:number,lng:number}[]} pts */
    setPoints(pts) { points = pts.slice(); redraw(); },
    invalidate() { map.invalidateSize(); },
    destroy() { map.remove(); },
  };
}
