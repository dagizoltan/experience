
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

          /* Map Markers */
          .marker { cursor: pointer; transition: transform 0.2s; }
          .marker:hover { transform: scale(1.2); z-index: 100; }

          /* Open Button (when sidebar closed) */
          .open-sidebar-btn {
            position: absolute; top: 20px; left: 20px;
            z-index: 10;
            background: white; padding: 10px 15px;
            border-radius: 4px; border: none;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            cursor: pointer; font-weight: bold;
            display: none; /* Toggled by JS */
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
              {/* Content injected by JS */}
              <div id="list-view">
                <p class="text-muted">Explore the map to see experiences here.</p>
              </div>
              <div id="detail-view" style="display:none;"></div>
            </div>
          </div>

          <button id="open-sidebar-btn" class="open-sidebar-btn">Menu</button>

          <div id="map"></div>
        </div>

        {/* Inject Initial Data */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__INITIAL_STATE__ = ${jsonState};
        `}} />

        <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          const { places: initialPlacesData, view, mapApiKey } = window.__INITIAL_STATE__;

          // State
          let allPlaces = initialPlacesData.features || [];
          let visiblePlaces = [];
          let selectedPlace = null;
          let isSidebarOpen = true;

          // DOM Elements
          const sidebar = document.getElementById('sidebar');
          const openBtn = document.getElementById('open-sidebar-btn');
          const listView = document.getElementById('list-view');
          const detailView = document.getElementById('detail-view');
          const searchInput = document.getElementById('search-input');

          // --- Map Initialization ---
          const map = new maplibregl.Map({
            container: 'map',
            style: \`https://api.maptiler.com/maps/streets-v2/style.json?key=\${mapApiKey}\`,
            center: [view.lon, view.lat],
            zoom: view.zoom
          });

          // Adjust map padding when sidebar is open so center is correct visually
          // But for this MVP, we might skip complex padding logic to avoid jumpiness.

          // --- Helpers ---
          const getCategoryColor = (cat) => {
             const colors = {
               gastronomy: '#e74c3c', // Red
               culture: '#3498db',    // Blue
               nature: '#2ecc71',     // Green
               nightlife: '#9b59b6',  // Purple
               shopping: '#f39c12',   // Orange
               wellness: '#1abc9c',   // Teal
               education: '#8e44ad',  // Dark Purple
               hidden_gems: '#7f8c8d',// Gray
               family: '#e91e63'      // Pink
             };
             return colors[cat] || '#333';
          };

          const markers = [];

          const renderMarkers = (features) => {
            markers.forEach(m => m.remove());
            markers.length = 0;

            features.forEach(p => {
              const el = document.createElement('div');
              el.className = 'marker';
              el.style.width = '16px';
              el.style.height = '16px';
              el.style.backgroundColor = getCategoryColor(p.properties.category);
              el.style.borderRadius = '50%';
              el.style.border = '2px solid white';
              el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';

              const marker = new maplibregl.Marker({ element: el })
                .setLngLat(p.geometry.coordinates)
                .addTo(map);

              // Click handling
              el.addEventListener('click', (e) => {
                 e.stopPropagation(); // Prevent map click
                 selectPlace(p);
              });

              markers.push(marker);
            });
          };

          const selectPlace = (place) => {
            selectedPlace = place;
            renderDetail(place);
            if (!isSidebarOpen) toggleSidebar();

            // Fly to place
            map.flyTo({
              center: place.geometry.coordinates,
              zoom: 14,
              essential: true
            });

            // Show Popup
            new maplibregl.Popup({ offset: 25 })
               .setLngLat(place.geometry.coordinates)
               .setHTML(\`<b>\${place.properties.name}</b><br>\${place.properties.category}\`)
               .addTo(map);
          };

          const clearSelection = () => {
             selectedPlace = null;
             renderList(); // Switch back to list
          };

          // --- Sidebar Rendering ---
          const renderList = () => {
            detailView.style.display = 'none';
            listView.style.display = 'block';

            if (visiblePlaces.length === 0) {
              listView.innerHTML = '<p style="padding:10px; color:#888;">No places visible in this area. Try zooming out or panning.</p>';
              return;
            }

            listView.innerHTML = visiblePlaces.map(p => \`
              <div class="place-item" data-id="\${p.properties.name}">
                 <h3>\${p.properties.name}</h3>
                 <div class="meta">
                    <span class="category-tag" style="color:\${getCategoryColor(p.properties.category)}">\${p.properties.category.replace('_', ' ')}</span>
                 </div>
              </div>
            \`).join('');

            // Add listeners
            listView.querySelectorAll('.place-item').forEach((el, index) => {
               el.onclick = () => selectPlace(visiblePlaces[index]);
            });
          };

          const renderDetail = (place) => {
             listView.style.display = 'none';
             detailView.style.display = 'block';

             const tagsHtml = (place.properties.tags || []).map(t => \`<span class="tag">#\${t}</span>\`).join('');

             detailView.innerHTML = \`
               <button id="back-to-list" class="back-btn">&larr; Back to list</button>
               <h2 style="color:\${getCategoryColor(place.properties.category)}">\${place.properties.name}</h2>
               <p><strong>Category:</strong> \${place.properties.category.replace('_', ' ')}</p>
               <div class="tags">\${tagsHtml}</div>
               <div style="margin-top:20px; padding:15px; background:#f0f0f0; border-radius:8px;">
                  <p style="margin:0; font-style:italic;">Real experience details would go here...</p>
               </div>
             \`;

             document.getElementById('back-to-list').onclick = clearSelection;
          };

          const toggleSidebar = () => {
             isSidebarOpen = !isSidebarOpen;
             if (isSidebarOpen) {
                sidebar.classList.remove('closed');
                openBtn.classList.remove('visible');
             } else {
                sidebar.classList.add('closed');
                openBtn.classList.add('visible');
             }
             map.resize(); // Resize map to fit new space if we were changing container size, but here we overlay.
          };

          // --- Logic ---
          const updateVisiblePlaces = () => {
             const bounds = map.getBounds();

             // Simple client-side bounding box check
             // In a real app with millions of points, we'd fetch from server.
             // Here we have ~120 points loaded, so filtering is fast.
             visiblePlaces = allPlaces.filter(p => {
                const [lon, lat] = p.geometry.coordinates;
                return bounds.contains([lon, lat]);
             });

             // If we are in list view, re-render
             if (!selectedPlace) {
                renderList();
             }
          };

          // --- Listeners ---
          map.on('load', () => {
             renderMarkers(allPlaces);
             updateVisiblePlaces();
          });

          map.on('moveend', () => {
             updateVisiblePlaces();
          });

          document.getElementById('close-sidebar-btn').onclick = toggleSidebar;
          document.getElementById('open-sidebar-btn').onclick = toggleSidebar;

          // Search Logic
          searchInput.onkeyup = async (e) => {
             if (e.key === 'Enter') {
               const q = searchInput.value;
               const res = await fetch(\`/api/search?q=\${encodeURIComponent(q)}\`);
               const data = await res.json();

               if (data.features && data.features.length > 0) {
                  // Fit bounds to search results
                  const bounds = new maplibregl.LngLatBounds();
                  data.features.forEach(f => bounds.extend(f.geometry.coordinates));
                  map.fitBounds(bounds, { padding: 50 });

                  // Update will trigger on moveend
               } else {
                  alert('No places found');
               }
             }
          };

        `}} />
      </body>
    </html>
  );
};
