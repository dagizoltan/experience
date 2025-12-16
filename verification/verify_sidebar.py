
from playwright.sync_api import sync_playwright
import time

def verify_sidebar():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1200, 'height': 800})

        print("Navigating to http://localhost:8000...")
        page.goto("http://localhost:8000")

        # 1. Check Sidebar Exists
        print("Checking Sidebar...")
        sidebar = page.locator("#sidebar")
        if not sidebar.is_visible():
            print("❌ Sidebar not visible!")
            exit(1)
        print("✅ Sidebar found.")

        # 2. Check for List Items (wait for map load/moveend logic)
        print("Waiting for places to load...")
        page.wait_for_timeout(3000)

        items = page.locator(".place-item")
        count = items.count()
        print(f"Found {count} places in the list.")

        if count == 0:
            print("❌ No places in list! Map might be empty or zoom level wrong.")
            # Take screenshot to debug
            page.screenshot(path="verification/debug_no_places.png")
            exit(1)

        # 3. Check for new categories
        print("Checking for categories...")
        content = page.content()
        new_cats = ["shopping", "wellness", "education", "family"]
        found = []
        for cat in new_cats:
            if cat in content.lower():
                found.append(cat)

        print(f"Found new categories in DOM: {found}")
        if not found:
            print("⚠️ Warning: No new category names found in text. Check seed data.")

        # 4. Interaction: Click an item
        print("Clicking first item...")
        first_item = items.first
        place_name = first_item.locator("h3").inner_text()
        print(f"Selecting: {place_name}")
        first_item.click()

        # 5. Check Detail View
        print("Checking Detail View...")
        detail_view = page.locator("#detail-view")
        if not detail_view.is_visible():
             print("❌ Detail view not visible after click!")
             exit(1)

        detail_header = detail_view.locator("h2").inner_text()
        if detail_header != place_name:
             print(f"❌ Detail header mismatch. Expected {place_name}, got {detail_header}")
             exit(1)

        print("✅ Detail view verified.")

        browser.close()

if __name__ == "__main__":
    verify_sidebar()
