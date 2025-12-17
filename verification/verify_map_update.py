from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load Initial View (Catalonia/Andorra area where we have seed data)
        # Using coords from seed test: 42.5063, 1.5218
        page.goto("http://localhost:8000?minLat=42.50&minLon=1.52&maxLat=42.52&maxLon=1.53")

        # Wait for data load
        page.wait_for_selector("#list-view .place-item", timeout=10000)
        print("Initial data loaded.")
        page.screenshot(path="verification/map_step1_initial.png")

        # 2. Simulate Pan/Zoom to trigger fetch
        # We can execute JS to fly the map to a slightly different location
        # Moving slightly east
        page.evaluate("map.flyTo({ center: [1.54, 42.51], zoom: 14 })")

        # Wait for moveend and network fetch (debounce 300ms + fetch time)
        page.wait_for_timeout(2000)

        # Take another screenshot
        page.screenshot(path="verification/map_step2_panned.png")
        print("Map panned and screenshot taken.")

        browser.close()

if __name__ == "__main__":
    run()
