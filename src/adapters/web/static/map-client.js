
/**
 * Production-Grade Map Client
 * Handles all client-side map interactions, data fetching, and UI updates
 */

class MapClient {
  constructor(initialState) {
    this.state = {
      places: new Map(), // Feature store: id -> feature
      visiblePlaces: [],
      selectedPlace: null,
      isSidebarOpen: true,
      isLoading: false,
      currentView: initialState.view,
      searchQuery: '',
    };

    this.config = {
      mapApiKey: initialState.mapApiKey,
      debounceDelay: 300,
      searchDebounceDelay: 500,
      maxVisiblePlaces: 100,
      maxPlacesInStore: 5000, // Prevent unbounded growth
      clusterConfig: {
        maxZoom: 14,
        radius: 50,
      },
      categoryColors: {
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
        default: '#333',
      },
    };

    this.timers = {
      mapMove: null,
      search: null,
    };

    this.abortController = null;

    this.dom = {
      sidebar: null,
      listView: null,
      detailView: null,
      searchInput: null,
      openBtn: null,
      loadingIndicator: null,
    };

    this.map = null;
    this.selectedMarker = null;

    this.init(initialState);
  }

  init(initialState) {
    // Initialize feature store
    if (initialState.places?.features) {
      initialState.places.features.forEach(f => {
        this.state.places.set(f.id, f);
      });
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.cacheDOMElements();
    this.initMap();
    this.bindEvents();
  }

  cacheDOMElements() {
    this.dom = {
      sidebar: document.getElementById('sidebar'),
      listView: document.getElementById('list-view'),
      detailView: document.getElementById('detail-view'),
      searchInput: document.getElementById('search-input'),
      openBtn: document.getElementById('open-sidebar-btn'),
      closeBtn: document.getElementById('close-sidebar-btn'),
      loadingIndicator: document.getElementById('loading-indicator'),
    };
  }

  initMap() {
    const { lon, lat, zoom } = this.state.currentView;

    this.map = new maplibregl.Map({
      container: 'map',
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${this.config.mapApiKey}`,
      center: [lon, lat],
      zoom: zoom,
      attributionControl: false,
    });

    // Add attribution (required by MapTiler TOS)
    this.map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      })
    );

    // Add navigation controls
    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Add geolocation control
    this.map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
      'top-right'
    );

    this.map.on('load', () => this.onMapLoad());
    this.map.on('moveend', () => this.onMapMoveEnd());
    this.map.on('error', (e) => this.onMapError(e));
  }

  onMapLoad() {
    this.addMapLayers();
    this.bindMapInteractions();
    this.fetchPlaces();
  }

  addMapLayers() {
    // Add source with clustering
    this.map.addSource('places', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: Array.from(this.state.places.values()),
      },
      cluster: true,
      clusterMaxZoom: this.config.clusterConfig.maxZoom,
      clusterRadius: this.config.clusterConfig.radius,
    });

    // Cluster circles
    this.map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'places',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6',
          20,
          '#f1f075',
          50,
          '#f28cb1',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          20,
          30,
          50,
          40,
        ],
      },
    });

    // Cluster count
    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'places',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
    });

    // Unclustered points
    this.map.addLayer({
      id: 'unclustered-point',
      type: 'circle',
      source: 'places',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          10,
          6,
        ],
        'circle-color': [
          'match',
          ['get', 'category'],
          'gastronomy',
          this.config.categoryColors.gastronomy,
          'culture',
          this.config.categoryColors.culture,
          'nature',
          this.config.categoryColors.nature,
          'nightlife',
          this.config.categoryColors.nightlife,
          'shopping',
          this.config.categoryColors.shopping,
          'wellness',
          this.config.categoryColors.wellness,
          'education',
          this.config.categoryColors.education,
          'hidden_gems',
          this.config.categoryColors.hidden_gems,
          'family',
          this.config.categoryColors.family,
          'sports',
          this.config.categoryColors.sports,
          this.config.categoryColors.default,
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          3,
          1,
        ],
        'circle-stroke-color': '#fff',
      },
    });

    // Polygons
    this.map.addLayer({
      id: 'places-fill',
      type: 'fill',
      source: 'places',
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': [
          'match',
          ['get', 'category'],
          'nature',
          '#2ecc71',
          'culture',
          '#3498db',
          'sports',
          '#d35400',
          '#888',
        ],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.6, 0.4],
      },
    });

    // Lines
    this.map.addLayer({
      id: 'places-line',
      type: 'line',
      source: 'places',
      filter: ['==', '$type', 'LineString'],
      paint: {
        'line-color': ['match', ['get', 'category'], 'nature', '#2ecc71', '#888'],
        'line-width': 3,
      },
    });
  }

  bindMapInteractions() {
    const interactiveLayers = ['clusters', 'unclustered-point', 'places-fill', 'places-line'];

    // Click on cluster: zoom in
    this.map.on('click', 'clusters', (e) => {
      const features = this.map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      const clusterId = features[0].properties.cluster_id;
      const source = this.map.getSource('places');

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        this.map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom,
        });
      });
    });

    // Click on feature: select
    this.map.on('click', ['unclustered-point', 'places-fill', 'places-line'], (e) => {
      if (e.features.length > 0) {
        const feature = e.features[0];
        this.selectPlaceById(feature.id || feature.properties.osm_id);
      }
    });

    // Cursor changes
    interactiveLayers.forEach((layer) => {
      this.map.on('mouseenter', layer, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', layer, () => {
        this.map.getCanvas().style.cursor = '';
      });
    });

    // Hover effects for polygons
    let hoveredPolygonId = null;
    this.map.on('mousemove', 'places-fill', (e) => {
      if (e.features.length > 0) {
        if (hoveredPolygonId !== null) {
          this.map.setFeatureState(
            { source: 'places', id: hoveredPolygonId },
            { hover: false }
          );
        }
        hoveredPolygonId = e.features[0].id;
        this.map.setFeatureState({ source: 'places', id: hoveredPolygonId }, { hover: true });
      }
    });

    this.map.on('mouseleave', 'places-fill', () => {
      if (hoveredPolygonId !== null) {
        this.map.setFeatureState(
          { source: 'places', id: hoveredPolygonId },
          { hover: false }
        );
      }
      hoveredPolygonId = null;
    });
  }

  bindEvents() {
    // Sidebar toggle
    this.dom.closeBtn?.addEventListener('click', () => this.toggleSidebar());
    this.dom.openBtn?.addEventListener('click', () => this.toggleSidebar());

    // Search input
    this.dom.searchInput?.addEventListener('input', (e) => {
      this.onSearchInput(e.target.value);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.selectedPlace) {
        this.deselectPlace();
      }
      if (e.key === '/' && document.activeElement !== this.dom.searchInput) {
        e.preventDefault();
        this.dom.searchInput?.focus();
      }
    });
  }

  onMapMoveEnd() {
    clearTimeout(this.timers.mapMove);
    this.timers.mapMove = setTimeout(() => {
      this.fetchPlaces();
    }, this.config.debounceDelay);
  }

  async fetchPlaces() {
    // Cancel previous request
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    const bounds = this.map.getBounds();
    const query = new URLSearchParams({
      minLat: bounds.getSouth(),
      minLon: bounds.getWest(),
      maxLat: bounds.getNorth(),
      maxLon: bounds.getEast(),
    });

    this.setLoading(true);

    try {
      const res = await fetch(`/api/places?${query}`, {
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      if (data.features) {
        let newCount = 0;
        data.features.forEach((f) => {
          if (!this.state.places.has(f.id)) {
            this.state.places.set(f.id, f);
            newCount++;
          }
        });

        // Prevent unbounded growth
        if (this.state.places.size > this.config.maxPlacesInStore) {
          this.pruneFeatureStore();
        }

        if (newCount > 0) {
          this.updateMapData();
        }

        this.updateVisiblePlaces();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to fetch places:', err);
        this.showError('Failed to load places. Please try again.');
      }
    } finally {
      this.setLoading(false);
    }
  }

  pruneFeatureStore() {
    // Keep only features within current bounds + buffer
    const bounds = this.map.getBounds();
    const buffer = 0.5; // degrees

    const minLat = bounds.getSouth() - buffer;
    const maxLat = bounds.getNorth() + buffer;
    const minLon = bounds.getWest() - buffer;
    const maxLon = bounds.getEast() + buffer;

    for (const [id, feature] of this.state.places) {
      const coords = this.getFeatureCoords(feature);
      if (coords) {
        const [lon, lat] = coords;
        if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) {
          this.state.places.delete(id);
        }
      }
    }
  }

  getFeatureCoords(feature) {
    if (feature.geometry.type === 'Point') {
      return feature.geometry.coordinates;
    } else {
      // Use turf to get center
      const center = turf.center(feature);
      return center.geometry.coordinates;
    }
  }

  updateMapData() {
    const source = this.map.getSource('places');
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: Array.from(this.state.places.values()),
      });
    }
  }

  updateVisiblePlaces() {
    const features = this.map.queryRenderedFeatures({
      layers: ['unclustered-point', 'places-fill', 'places-line'],
    });

    const seen = new Set();
    this.state.visiblePlaces = [];

    for (const f of features) {
      const id = f.id || f.properties.osm_id;
      if (!seen.has(id)) {
        seen.add(id);

        // Normalize tags
        let tags = f.properties.tags;
        if (typeof tags === 'string') {
          try {
            tags = JSON.parse(tags);
          } catch (e) {
            tags = [];
          }
        }
        if (!Array.isArray(tags)) tags = [];

        this.state.visiblePlaces.push({
          ...f,
          properties: { ...f.properties, tags },
        });
      }
    }

    // Limit for performance
    if (this.state.visiblePlaces.length > this.config.maxVisiblePlaces) {
      this.state.visiblePlaces.length = this.config.maxVisiblePlaces;
    }

    if (!this.state.selectedPlace) {
      this.renderList();
    }
  }

  onSearchInput(value) {
    this.state.searchQuery = value;

    clearTimeout(this.timers.search);

    if (value.length < 3) {
      this.updateVisiblePlaces();
      return;
    }

    this.timers.search = setTimeout(() => {
      this.performSearch(value);
    }, this.config.searchDebounceDelay);
  }

  async performSearch(query) {
    this.setLoading(true);

    try {
      const res = await fetch(`/api/search?${new URLSearchParams({ q: query })}`);

      if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`);
      }

      const data = await res.json();

      if (data.features) {
        this.state.visiblePlaces = data.features.map(f => ({
          ...f,
          properties: {
            ...f.properties,
            tags: Array.isArray(f.properties.tags) ? f.properties.tags : [],
          },
        }));
        this.renderList();
      }
    } catch (err) {
      console.error('Search error:', err);
      this.showError('Search failed. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  selectPlaceById(id) {
    const place = this.state.places.get(id);
    if (place) {
      this.selectPlace(place);
    }
  }

  selectPlace(place) {
    // Deselect previous
    if (this.state.selectedPlace) {
      const prevId = this.state.selectedPlace.id || this.state.selectedPlace.properties.osm_id;
      this.map.setFeatureState({ source: 'places', id: prevId }, { selected: false });
    }

    this.state.selectedPlace = place;
    const placeId = place.id || place.properties.osm_id;

    // Highlight on map
    this.map.setFeatureState({ source: 'places', id: placeId }, { selected: true });

    // Render detail
    this.renderDetail(place);

    // Open sidebar if closed
    if (!this.state.isSidebarOpen) {
      this.toggleSidebar();
    }

    // Fly to place
    const center = turf.center(place).geometry.coordinates;
    this.map.flyTo({
      center: center,
      zoom: Math.max(this.map.getZoom(), 14),
      essential: true,
    });
  }

  deselectPlace() {
    if (this.state.selectedPlace) {
      const id = this.state.selectedPlace.id || this.state.selectedPlace.properties.osm_id;
      this.map.setFeatureState({ source: 'places', id: id }, { selected: false });
    }

    this.state.selectedPlace = null;
    this.renderList();
  }

  renderList() {
    this.dom.detailView.style.display = 'none';
    this.dom.listView.style.display = 'block';

    if (this.state.visiblePlaces.length === 0) {
      this.dom.listView.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #888;">
          <i class="fa-solid fa-map-location-dot" style="font-size: 3rem; margin-bottom: 10px;"></i>
          <p>No places visible</p>
          <p style="font-size: 0.9rem;">Try zooming in or searching</p>
        </div>
      `;
      return;
    }

    const html = this.state.visiblePlaces
      .map((p) => {
        const name = this.escapeHtml(p.properties.name);
        const category = p.properties.category || '';
        const color = this.config.categoryColors[category] || this.config.categoryColors.default;
        const id = p.id || p.properties.osm_id;

        return `
          <div class="place-item" data-id="${this.escapeHtml(id)}">
            <h3>${name}</h3>
            <div class="meta">
              <span class="category-tag" style="color:${color}">
                ${this.escapeHtml(category.replace('_', ' '))}
              </span>
            </div>
          </div>
        `;
      })
      .join('');

    this.dom.listView.innerHTML = html;

    // Bind click events
    this.dom.listView.querySelectorAll('.place-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        this.selectPlaceById(id);
      });
    });
  }

  renderDetail(place) {
    this.dom.listView.style.display = 'none';
    this.dom.detailView.style.display = 'block';

    const name = this.escapeHtml(place.properties.name);
    const category = place.properties.category || '';
    const color = this.config.categoryColors[category] || this.config.categoryColors.default;
    const tags = place.properties.tags || [];
    const tagsHtml = tags.map((t) => `<span class="tag">#${this.escapeHtml(t)}</span>`).join('');

    const osmId = place.properties.osm_id || 'N/A';
    const geomType = place.geometry.type;

    // Additional properties
    const props = [];
    if (place.properties.cuisine) props.push(`Cuisine: ${this.escapeHtml(place.properties.cuisine)}`);
    if (place.properties.opening_hours) props.push(`Hours: ${this.escapeHtml(place.properties.opening_hours)}`);
    if (place.properties.phone) props.push(`Phone: ${this.escapeHtml(place.properties.phone)}`);
    if (place.properties.website) {
      props.push(`<a href="${this.escapeHtml(place.properties.website)}" target="_blank" rel="noopener">Website</a>`);
    }

    const propsHtml = props.length > 0 ? `<ul style="margin-top: 10px;">${props.map(p => `<li>${p}</li>`).join('')}</ul>` : '';

    this.dom.detailView.innerHTML = `
      <button id="back-to-list" class="back-btn">
        <i class="fa-solid fa-arrow-left"></i> Back to list
      </button>
      <h2 style="color:${color}">${name}</h2>
      <p><strong>Category:</strong> ${this.escapeHtml(category.replace('_', ' '))}</p>
      ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
      ${propsHtml}
      <div style="margin-top:20px; padding:15px; background:#f0f0f0; border-radius:8px; font-size: 0.85rem;">
        <p style="margin:0;"><strong>Type:</strong> ${geomType}</p>
        <p style="margin:5px 0 0 0;"><strong>OSM ID:</strong> ${this.escapeHtml(osmId)}</p>
      </div>
    `;

    document.getElementById('back-to-list').addEventListener('click', () => {
      this.deselectPlace();
    });
  }

  toggleSidebar() {
    this.state.isSidebarOpen = !this.state.isSidebarOpen;

    if (this.state.isSidebarOpen) {
      this.dom.sidebar.classList.remove('closed');
      this.dom.openBtn.classList.remove('visible');
    } else {
      this.dom.sidebar.classList.add('closed');
      this.dom.openBtn.classList.add('visible');
    }

    this.map.resize();
  }

  setLoading(isLoading) {
    this.state.isLoading = isLoading;

    if (this.dom.loadingIndicator) {
      this.dom.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    // Also update search input state
    if (this.dom.searchInput) {
      this.dom.searchInput.disabled = isLoading;
    }
  }

  showError(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  onMapError(e) {
    console.error('Map error:', e);
    this.showError('Map error occurred. Please refresh the page.');
  }
}

// Initialize when page loads
const initialState = window.__INITIAL_STATE__;
window.mapClient = new MapClient(initialState);
