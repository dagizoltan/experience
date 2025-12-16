
// src/adapters/web/views/MapPage.tsx
/** @jsxImportSource preact */
import { h } from 'preact';

export const MapPage = ({ initialPlaces, initialView, mapApiKey }) => {
  const jsonState = JSON.stringify({ places: initialPlaces, view: initialView, mapApiKey });

  return (
    <html>
      <head>
        <title>Map Discovery</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          body { margin: 0; padding: 0; }
          #map { width: 100vw; height: 100vh; }
          .search-box {
            position: absolute; top: 20px; left: 20px; z-index: 10;
            background: white; padding: 10px; border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            display: flex; gap: 8px;
          }
          input { padding: 8px; border: 1px solid #ccc; width: 200px; }
          button { padding: 8px 16px; background: #333; color: white; border: none; cursor: pointer; }
          .marker {
             cursor: pointer;
          }
        `}} />
      </head>
      <body>
        <div class="search-box">
          <input id="search-input" type="text" placeholder="Search (e.g. 'tapas')" />
          <button id="search-btn">Search</button>
        </div>
        <div id="map"></div>

        {/* Inject Initial Data for hydration */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__INITIAL_STATE__ = ${jsonState};
        `}} />

        {/* Client Logic embedded for simplicity in this MVP
            In a real app, this would be a separate bundle.
        */}
        <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          const { places, view, mapApiKey } = window.__INITIAL_STATE__;

          const map = new maplibregl.Map({
            container: 'map',
            style: \`https://api.maptiler.com/maps/streets-v2/style.json?key=\${mapApiKey}\`,
            center: [view.lon, view.lat],
            zoom: view.zoom
          });

          // Add markers
          const markers = [];

          const addMarkers = (features) => {
            // Clear existing
            markers.forEach(m => m.remove());
            markers.length = 0;

            features.forEach(p => {
              const el = document.createElement('div');
              el.className = 'marker';
              el.style.width = '20px';
              el.style.height = '20px';
              el.style.backgroundColor = getCategoryColor(p.properties.category);
              el.style.borderRadius = '50%';
              el.style.border = '2px solid white';

              const popup = new maplibregl.Popup({ offset: 25 })
                .setHTML(\`
                   <h3>\${p.properties.name}</h3>
                   <p>\${p.properties.category}</p>
                   <small>\${p.properties.tags.join(', ')}</small>
                \`);

              const marker = new maplibregl.Marker({ element: el })
                .setLngLat(p.geometry.coordinates)
                .setPopup(popup)
                .addTo(map);

              markers.push(marker);
            });
          }

          const getCategoryColor = (cat) => {
             const colors = {
               gastronomy: '#e74c3c',
               culture: '#3498db',
               nature: '#2ecc71',
               nightlife: '#9b59b6'
             };
             return colors[cat] || '#333';
          };

          map.on('load', () => {
            addMarkers(places.features);
          });

          // Search Logic
          document.getElementById('search-btn').onclick = async () => {
             const q = document.getElementById('search-input').value;
             const res = await fetch(\`/api/search?q=\${encodeURIComponent(q)}\`);
             const data = await res.json();
             addMarkers(data.features);

             if (data.features.length > 0) {
                // Fit bounds
                const bounds = new maplibregl.LngLatBounds();
                data.features.forEach(f => bounds.extend(f.geometry.coordinates));
                map.fitBounds(bounds, { padding: 50 });
             }
          };

          // Pan Logic (Reload on move? Optional for MVP)
          map.on('moveend', async () => {
             // In a full app, we'd fetch new points here
             // const bounds = map.getBounds();
             // fetch ...
          });

        `}} />
      </body>
    </html>
  );
};
