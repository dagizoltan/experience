
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
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }

          /* Layout */
          #app-container { position: relative; width: 100vw; height: 100vh; }
          #map { width: 100%; height: 100%; }

          /* Sidebar */
          .sidebar {
            position: absolute; top: 0; left: 0; bottom: 0;
            width: 350px;
            background: white;
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
            z-index: 20;
            transform: translateX(0);
            transition: transform 0.3s ease;
            display: flex; flex-direction: column;
          }
          .sidebar.closed { transform: translateX(-100%); }

          .sidebar-header {
            padding: 16px;
            border-bottom: 1px solid #eee;
            display: flex; gap: 10px; align-items: center;
            background: #f9f9f9;
          }

          .search-input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
          .toggle-btn { background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #555; }

          .sidebar-content { flex: 1; overflow-y: auto; padding: 16px; }

          /* List Items */
          .place-item {
            padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;
            transition: background 0.2s;
          }
          .place-item:hover { background: #f5f5f5; }
          .place-item h3 { margin: 0 0 5px 0; font-size: 1rem; color: #333; }
          .place-item .meta { display: flex; justify-content: space-between; font-size: 0.8rem; color: #777; }
          .category-tag { text-transform: capitalize; font-weight: bold; }

          /* Detail View */
          .detail-view h2 { margin-top: 0; }
          .back-btn { margin-bottom: 16px; background: none; border: none; color: #007bff; cursor: pointer; padding: 0; font-size: 0.9rem; }
          .back-btn:hover { text-decoration: underline; }
          .tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
          .tag { background: #eee; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; }

          /* Open Button */
          .open-sidebar-btn {
            position: absolute; top: 20px; left: 20px;
            z-index: 10;
            background: white; padding: 10px 15px;
            border-radius: 4px; border: none;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            cursor: pointer; font-weight: bold;
            display: none;
          }
          .open-sidebar-btn.visible { display: block; }
        `}} />
      </head>
      <body>
        <div id="app-container">
          <div id="sidebar" class="sidebar">
            <div class="sidebar-header">
              <input id="search-input" class="search-input" type="text" placeholder="Search experiences..." />
              <button id="close-sidebar-btn" class="toggle-btn" title="Close Sidebar"><i class="fa-solid fa-chevron-left"></i></button>
            </div>
            <div id="sidebar-content" class="sidebar-content">
              <div id="list-view">
                <p class="text-muted">Loading...</p>
              </div>
              <div id="detail-view" style="display:none;"></div>
            </div>
          </div>

          <button id="open-sidebar-btn" class="open-sidebar-btn">Menu</button>

          <div id="map"></div>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `
          window.__INITIAL_STATE__ = ${jsonState};
        `}} />

        <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
        <script src="https://unpkg.com/@turf/turf@6.5.0/turf.min.js"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          const { places: initialPlacesData, view, mapApiKey } = window.__INITIAL_STATE__;

          // State
          let visiblePlaces = [];
          let selectedPlace = null;
          let isSidebarOpen = true;
          let debounceTimer = null;

          // DOM Elements
          const sidebar = document.getElementById('sidebar');
          const openBtn = document.getElementById('open-sidebar-btn');
          const listView = document.getElementById('list-view');
          const detailView = document.getElementById('detail-view');
          const searchInput = document.getElementById('search-input');

          // --- Colors ---
          const CATEGORY_COLORS = {
               gastronomy: '#e74c3c',
               culture: '#3498db',
               nature: '#2ecc71',
               nightlife: '#9b59b6',
               shopping: '#f39c12',
               wellness: '#1abc9c',
               education: '#8e44ad',
               hidden_gems: '#7f8c8d',
               family: '#e91e63',
               sports: '#d35400',
               default: '#333'
          };
          const getCategoryColor = (cat) => CATEGORY_COLORS[cat] || CATEGORY_COLORS.default;

          // --- Map Initialization ---
          const map = new maplibregl.Map({
            container: 'map',
            style: \`https://api.maptiler.com/maps/streets-v2/style.json?key=\${mapApiKey}\`,
            center: [view.lon, view.lat],
            zoom: view.zoom
          });

          // --- Layers Setup ---
          map.on('load', () => {
            // Add Source
            map.addSource('places', {
              type: 'geojson',
              data: initialPlacesData
            });

            // 1. Polygons (Fill)
            map.addLayer({
              'id': 'places-fill',
              'type': 'fill',
              'source': 'places',
              'filter': ['==', '$type', 'Polygon'],
              'paint': {
                'fill-color': ['match', ['get', 'category'],
                  'nature', '#2ecc71',
                  'culture', '#3498db',
                  'sports', '#d35400',
                  '#888'
                ],
                'fill-opacity': 0.4
              }
            });

            // 2. Lines (LineString)
            map.addLayer({
              'id': 'places-line',
              'type': 'line',
              'source': 'places',
              'filter': ['==', '$type', 'LineString'],
              'paint': {
                'line-color': ['match', ['get', 'category'],
                  'nature', '#2ecc71',
                  '#888'
                ],
                'line-width': 3
              }
            });

            // 3. Points (Circle)
            // Use circle for performance instead of markers
            map.addLayer({
              'id': 'places-circle',
              'type': 'circle',
              'source': 'places',
              'filter': ['==', '$type', 'Point'],
              'paint': {
                'circle-radius': 6,
                'circle-color': ['match', ['get', 'category'],
                   'gastronomy', CATEGORY_COLORS.gastronomy,
                   'culture', CATEGORY_COLORS.culture,
                   'nature', CATEGORY_COLORS.nature,
                   'nightlife', CATEGORY_COLORS.nightlife,
                   'shopping', CATEGORY_COLORS.shopping,
                   'wellness', CATEGORY_COLORS.wellness,
                   'education', CATEGORY_COLORS.education,
                   'hidden_gems', CATEGORY_COLORS.hidden_gems,
                   'family', CATEGORY_COLORS.family,
                   'sports', CATEGORY_COLORS.sports,
                   CATEGORY_COLORS.default
                ],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff'
              }
            });

            // Initial calculation
            updateVisiblePlaces();
          });

          // --- Interaction ---
          const layers = ['places-fill', 'places-line', 'places-circle'];

          map.on('click', layers, (e) => {
             const feature = e.features[0];
             // Ensure properties are parsed if needed (usually MapLibre gives flat props)
             // We construct a cleaner object
             const place = {
               geometry: feature.geometry,
               properties: feature.properties
             };

             // Parse tags if stringified
             if (typeof place.properties.tags === 'string') {
                try { place.properties.tags = JSON.parse(place.properties.tags); } catch(e){}
             }
             if (!Array.isArray(place.properties.tags)) place.properties.tags = [];

             selectPlace(place);
          });

          map.on('mouseenter', layers, () => map.getCanvas().style.cursor = 'pointer');
          map.on('mouseleave', layers, () => map.getCanvas().style.cursor = '');

          map.on('moveend', () => {
             // Debounce network requests
             if (debounceTimer) clearTimeout(debounceTimer);
             debounceTimer = setTimeout(() => {
                fetchPlaces();
             }, 300);
          });

          // --- Logic ---
          async function fetchPlaces() {
             const bounds = map.getBounds();
             const query = \`minLat=\${bounds.getSouth()}&minLon=\${bounds.getWest()}&maxLat=\${bounds.getNorth()}&maxLon=\${bounds.getEast()}\`;

             try {
                const res = await fetch(\`/api/places?\${query}\`);
                if (res.ok) {
                   const data = await res.json();
                   // Update Map Source
                   if (map.getSource('places')) {
                       map.getSource('places').setData(data);
                   }
                   // Update UI
                   updateVisiblePlaces();
                }
             } catch (e) {
                console.error("Failed to fetch places", e);
             }
          }

          function updateVisiblePlaces() {
             // For client-side large datasets, querying rendered features is efficient
             const features = map.queryRenderedFeatures({ layers: layers });

             // Deduplicate by ID
             const seen = new Set();
             visiblePlaces = [];

             for (const f of features) {
               const id = f.properties.osm_id || f.properties.name;
               if (!seen.has(id)) {
                 seen.add(id);
                 // Normalize
                 let tags = f.properties.tags;
                 if (typeof tags === 'string') {
                     try { tags = JSON.parse(tags); } catch(e){ tags = []; }
                 }

                 visiblePlaces.push({
                   ...f,
                   properties: { ...f.properties, tags }
                 });
               }
             }

             // Cap list size for performance
             if (visiblePlaces.length > 100) visiblePlaces.length = 100;

             if (!selectedPlace) {
                renderList();
             }
          }

          function selectPlace(place) {
             selectedPlace = place;
             renderDetail(place);
             if (!isSidebarOpen) toggleSidebar();

             // Fly to centroid
             const center = turf.center(place).geometry.coordinates;

             map.flyTo({
                center: center,
                zoom: Math.max(map.getZoom(), 14),
                essential: true
             });
          }

          function renderList() {
            detailView.style.display = 'none';
            listView.style.display = 'block';

            if (visiblePlaces.length === 0) {
              listView.innerHTML = '<p style="padding:10px; color:#888;">No places visible. Zoom in or pan.</p>';
              return;
            }

            listView.innerHTML = visiblePlaces.map(p => \`
              <div class="place-item" onclick="selectPlaceByName('\${p.properties.name.replace(/'/g, "\\\\'")}')">
                 <h3>\${p.properties.name}</h3>
                 <div class="meta">
                    <span class="category-tag" style="color:\${getCategoryColor(p.properties.category)}">\${(p.properties.category||'').replace('_', ' ')}</span>
                 </div>
              </div>
            \`).join('');
          }

          // Hack to make onclick work with object passing from HTML string
          window.selectPlaceByName = (name) => {
             const p = visiblePlaces.find(x => x.properties.name === name);
             if (p) selectPlace(p);
          };

          function renderDetail(place) {
             listView.style.display = 'none';
             detailView.style.display = 'block';

             const tagsHtml = (place.properties.tags || []).map(t => \`<span class="tag">#\${t}</span>\`).join('');

             detailView.innerHTML = \`
               <button id="back-to-list" class="back-btn">&larr; Back to list</button>
               <h2 style="color:\${getCategoryColor(place.properties.category)}">\${place.properties.name}</h2>
               <p><strong>Category:</strong> \${(place.properties.category||'').replace('_', ' ')}</p>
               <div class="tags">\${tagsHtml}</div>
               <div style="margin-top:20px; padding:15px; background:#f0f0f0; border-radius:8px;">
                  <p style="margin:0; font-style:italic;">
                    \${place.geometry.type} Geometry <br/>
                    OSM ID: \${place.properties.osm_id || 'N/A'}
                  </p>
               </div>
             \`;

             document.getElementById('back-to-list').onclick = () => {
                selectedPlace = null;
                renderList();
             };
          }

          function toggleSidebar() {
             isSidebarOpen = !isSidebarOpen;
             if (isSidebarOpen) {
                sidebar.classList.remove('closed');
                openBtn.classList.remove('visible');
             } else {
                sidebar.classList.add('closed');
                openBtn.classList.add('visible');
             }
             map.resize();
          }

          document.getElementById('close-sidebar-btn').onclick = toggleSidebar;
          document.getElementById('open-sidebar-btn').onclick = toggleSidebar;

        `}} />
      </body>
    </html>
  );
};
