from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the local server
        page.goto("http://localhost:8000?minLat=42.50&minLon=1.52&maxLat=42.52&maxLon=1.53")

        # Wait for the map to load and data to appear
        # We look for the sidebar list item which appears when data is loaded
        page.wait_for_selector("#list-view .place-item", timeout=10000)

        # Check if we have items
        items = page.locator("#list-view .place-item")
        count = items.count()
        print(f"Found {count} places in list view")

        # Take screenshot of the initial view
        page.screenshot(path="verification/map_initial.png")

        # Click on the first item to see details
        if count > 0:
            items.first.click()
            page.wait_for_selector("#detail-view", state="visible")
            page.screenshot(path="verification/map_detail.png")
            print("Clicked item and took detail screenshot")

        browser.close()

if __name__ == "__main__":
    run()
