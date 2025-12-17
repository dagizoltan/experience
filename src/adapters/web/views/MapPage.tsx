/** @jsxImportSource preact */
import { h } from 'preact';

export const MapPage = ({ initialPlaces, initialView, mapApiKey }) => {
  const jsonState = JSON.stringify({ places: initialPlaces, view: initialView, mapApiKey });

  return (
    <html lang="en">
      <head>
        <title>Jules Discovery - Explore Places</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="description" content="Discover amazing places near you" />

        {/* Preconnect to external resources */}
        <link rel="preconnect" href="https://unpkg.com" />
        <link rel="preconnect" href="https://api.maptiler.com" />

        {/* Stylesheets */}
        <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet" />

        <style dangerouslySetInnerHTML={{ __html: `
          /* CSS Variables for theming */
          :root {
            --color-primary: #007bff;
            --color-danger: #dc3545;
            --color-success: #28a745;
            --color-text: #333;
            --color-text-muted: #777;
            --color-border: #ddd;
            --color-bg: #fff;
            --color-bg-hover: #f5f5f5;
            --sidebar-width: 350px;
            --header-height: 60px;
            --transition-speed: 0.3s;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            overflow: hidden;
            color: var(--color-text);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          /* Layout */
          #app-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            display: flex;
          }

          #map {
            flex: 1;
            width: 100%;
            height: 100%;
          }

          /* Loading Indicator */
          #loading-indicator {
            position: absolute;
            top: 20px;
            right: 20px;
            z-index: 15;
            background: white;
            padding: 10px 15px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            display: none;
            align-items: center;
            gap: 8px;
          }

          .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid var(--color-border);
            border-top-color: var(--color-primary);
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          /* Error Toast */
          .error-toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: var(--color-danger);
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            z-index: 1000;
            opacity: 0;
            transition: all var(--transition-speed) ease;
            max-width: 90%;
          }

          .error-toast.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }

          /* Sidebar */
          .sidebar {
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: var(--sidebar-width);
            background: var(--color-bg);
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
            z-index: 20;
            transform: translateX(0);
            transition: transform var(--transition-speed) ease;
            display: flex;
            flex-direction: column;
          }

          .sidebar.closed {
            transform: translateX(-100%);
          }

          .sidebar-header {
            padding: 16px;
            border-bottom: 1px solid var(--color-border);
            display: flex;
            gap: 10px;
            align-items: center;
            background: #f9f9f9;
            min-height: var(--header-height);
          }

          .search-input {
            flex: 1;
            padding: 10px 12px;
            border: 1px solid var(--color-border);
            border-radius: 4px;
            font-size: 14px;
            transition: border-color 0.2s;
          }

          .search-input:focus {
            outline: none;
            border-color: var(--color-primary);
          }

          .search-input:disabled {
            background: #f5f5f5;
            cursor: not-allowed;
          }

          .toggle-btn {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.2rem;
            color: #555;
            padding: 8px;
            transition: color 0.2s;
          }

          .toggle-btn:hover {
            color: var(--color-primary);
          }

          .sidebar-content {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
          }

          /* Custom scrollbar */
          .sidebar-content::-webkit-scrollbar {
            width: 8px;
          }

          .sidebar-content::-webkit-scrollbar-track {
            background: #f1f1f1;
          }

          .sidebar-content::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
          }

          .sidebar-content::-webkit-scrollbar-thumb:hover {
            background: #555;
          }

          #list-view, #detail-view {
            padding: 16px;
          }

          /* List Items */
          .place-item {
            padding: 12px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background 0.2s;
          }

          .place-item:hover {
            background: var(--color-bg-hover);
          }

          .place-item:last-child {
            border-bottom: none;
          }

          .place-item h3 {
            margin: 0 0 5px 0;
            font-size: 1rem;
            color: var(--color-text);
            font-weight: 600;
          }

          .place-item .meta {
            display: flex;
            justify-content: space-between;
            font-size: 0.8rem;
            color: var(--color-text-muted);
          }

          .category-tag {
            text-transform: capitalize;
            font-weight: 600;
          }

          /* Detail View */
          #detail-view h2 {
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 1.5rem;
          }

          .back-btn {
            margin-bottom: 16px;
            background: none;
            border: none;
            color: var(--color-primary);
            cursor: pointer;
            padding: 8px 0;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: opacity 0.2s;
          }

          .back-btn:hover {
            opacity: 0.8;
          }

          .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 12px;
          }

          .tag {
            background: #eee;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.8rem;
            color: #555;
          }

          #detail-view ul {
            list-style: none;
            padding: 0;
            margin: 10px 0;
          }

          #detail-view li {
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
          }

          #detail-view li:last-child {
            border-bottom: none;
          }

          #detail-view a {
            color: var(--color-primary);
            text-decoration: none;
          }

          #detail-view a:hover {
            text-decoration: underline;
          }

          /* Open Sidebar Button */
          .open-sidebar-btn {
            position: absolute;
            top: 20px;
            left: 20px;
            z-index: 10;
            background: white;
            padding: 12px 16px;
            border-radius: 4px;
            border: none;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            cursor: pointer;
            font-weight: 600;
            display: none;
            transition: background 0.2s;
          }

          .open-sidebar-btn.visible {
            display: block;
          }

          .open-sidebar-btn:hover {
            background: var(--color-bg-hover);
          }

          /* Mobile Responsiveness */
          @media (max-width: 768px) {
            :root {
              --sidebar-width: 100vw;
            }

            .sidebar {
              width: 100vw;
              max-width: 400px;
            }
          }

          @media (max-width: 480px) {
            .sidebar {
              max-width: none;
            }

            .search-input {
              font-size: 16px; /* Prevents zoom on iOS */
            }
          }

          /* Print styles */
          @media print {
            .sidebar,
            .open-sidebar-btn,
            #loading-indicator,
            .maplibregl-ctrl {
              display: none !important;
            }

            #map {
              width: 100%;
              height: 100vh;
            }
          }

          /* Accessibility */
          .visually-hidden {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0,0,0,0);
            white-space: nowrap;
            border: 0;
          }

          /* Focus styles for keyboard navigation */
          *:focus-visible {
            outline: 2px solid var(--color-primary);
            outline-offset: 2px;
          }
        `}} />
      </head>
      <body>
        <div id="app-container">
          {/* Sidebar */}
          <aside id="sidebar" class="sidebar" role="complementary" aria-label="Places list">
            <div class="sidebar-header">
              <input
                id="search-input"
                class="search-input"
                type="search"
                placeholder="Search experiences... (Press / to focus)"
                aria-label="Search places"
                autocomplete="off"
              />
              <button
                id="close-sidebar-btn"
                class="toggle-btn"
                title="Close Sidebar"
                aria-label="Close sidebar"
              >
                <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
              </button>
            </div>
            <div id="sidebar-content" class="sidebar-content">
              <div id="list-view" role="list">
                <p style="padding:10px; color:#888;">Loading places...</p>
              </div>
              <div id="detail-view" style="display:none;" role="article"></div>
            </div>
          </aside>

          {/* Open Sidebar Button */}
          <button
            id="open-sidebar-btn"
            class="open-sidebar-btn"
            aria-label="Open sidebar"
          >
            <i class="fa-solid fa-bars" aria-hidden="true"></i> Menu
          </button>

          {/* Loading Indicator */}
          <div id="loading-indicator" aria-live="polite" aria-atomic="true">
            <div class="spinner" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <span>Loading places...</span>
          </div>

          {/* Map */}
          <main id="map" role="main" aria-label="Interactive map"></main>
        </div>

        {/* Initial State */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__INITIAL_STATE__ = ${jsonState};
        `}} />

        {/* External Scripts */}
        <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
        <script src="https://unpkg.com/@turf/turf@6.5.0/turf.min.js"></script>

        {/* Main Application Script */}
        <script src="/static/map-client.js"></script>
      </body>
    </html>
  );
};