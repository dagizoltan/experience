from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Load Initial View (Should be empty initially, then fetch)
        page.goto("http://localhost:8000")

        # Wait for map load
        page.wait_for_selector("#map", timeout=10000)

        # Wait for data fetch (incremental load)
        # We check if list items appear
        page.wait_for_selector(".place-item", timeout=15000)

        print("Initial data loaded via incremental fetch.")
        page.screenshot(path="verification/clustering_step1_initial.png")

        # 2. Check for Cluster Layer presence (difficult to check visual pixels, but we can check if console errors)
        # We zoom out to trigger clusters if any
        page.evaluate("map.flyTo({ center: [1.52, 42.50], zoom: 10 })")
        page.wait_for_timeout(3000)
        page.screenshot(path="verification/clustering_step2_zoomed_out.png")

        browser.close()

if __name__ == "__main__":
    run()
