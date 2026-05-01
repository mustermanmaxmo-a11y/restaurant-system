"""
Color contrast checker for restaurant-system app.
Checks all major pages in light mode, dark mode, and V2 theme.
Flags elements where text and background colors are too similar (contrast ratio < 2.0).
"""

import json
import math
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"

PAGES = [
    ("/", "Home"),
    ("/login", "Login"),
    ("/owner-login", "Owner Login"),
    ("/register", "Register"),
    ("/admin", "Admin Dashboard"),
    ("/admin/orders", "Admin Orders"),
    ("/admin/menu", "Admin Menu"),
    ("/admin/settings", "Admin Settings"),
    ("/admin/branding", "Admin Branding"),
    ("/platform", "Platform Dashboard"),
    ("/platform/restaurants", "Platform Restaurants"),
    ("/agb", "AGB"),
    ("/datenschutz", "Datenschutz"),
    ("/impressum", "Impressum"),
]

THEMES = [
    ("light", "V1 Light", "document.documentElement.classList.remove('dark'); document.documentElement.classList.remove('theme-v2'); document.documentElement.classList.add('theme-v1');"),
    ("dark", "V1 Dark", "document.documentElement.classList.add('dark'); document.documentElement.classList.remove('theme-v2'); document.documentElement.classList.add('theme-v1');"),
    ("v2", "V2 Premium", "document.documentElement.classList.remove('dark'); document.documentElement.classList.add('theme-v2'); document.documentElement.classList.remove('theme-v1');"),
]

CONTRAST_JS = """
() => {
    function luminance(r, g, b) {
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function parseColor(color) {
        const m = color.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
        if (!m) return null;
        return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
    }

    function getEffectiveBg(el) {
        // Walk up DOM to find first non-transparent background
        let current = el;
        while (current && current !== document.documentElement) {
            const bg = window.getComputedStyle(current).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                return bg;
            }
            current = current.parentElement;
        }
        // Fall back to body/html background
        return window.getComputedStyle(document.documentElement).backgroundColor || 'rgb(255, 255, 255)';
    }

    function contrastRatio(c1, c2) {
        const l1 = luminance(...c1);
        const l2 = luminance(...c2);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    const issues = [];
    const seen = new Set();

    // Check all text-bearing elements
    const selectors = 'p, h1, h2, h3, h4, h5, h6, span, a, button, label, li, td, th, div, input, textarea, select';
    const elements = document.querySelectorAll(selectors);

    elements.forEach(el => {
        // Only elements with actual text content (not containers)
        const text = el.childNodes;
        let hasDirectText = false;
        text.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                hasDirectText = true;
            }
        });
        if (!hasDirectText) return;

        // Skip hidden elements
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

        const textColor = style.color;
        const bgColor = getEffectiveBg(el);

        if (!textColor || !bgColor) return;

        const textRGB = parseColor(textColor);
        const bgRGB = parseColor(bgColor);

        if (!textRGB || !bgRGB) return;

        const ratio = contrastRatio(textRGB, bgRGB);

        // Flag very low contrast (< 2.5) and also critically low (< 1.5)
        if (ratio < 2.5) {
            const rect = el.getBoundingClientRect();
            // Skip off-screen elements
            if (rect.width === 0 || rect.height === 0) return;

            const key = `${textColor}|${bgColor}|${el.tagName}`;
            if (seen.has(key)) return;
            seen.add(key);

            const textContent = el.textContent.trim().substring(0, 80);
            issues.push({
                tag: el.tagName,
                text: textContent,
                textColor,
                bgColor,
                ratio: Math.round(ratio * 100) / 100,
                selector: el.className ? el.className.substring(0, 100) : '',
                critical: ratio < 1.5
            });
        }
    });

    return issues;
}
"""

def run_checks():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        for theme_id, theme_name, theme_js in THEMES:
            print(f"\n{'='*60}")
            print(f"Theme: {theme_name}")
            print(f"{'='*60}")
            results[theme_id] = {}

            for path, page_name in PAGES:
                url = BASE_URL + path
                try:
                    page.goto(url, wait_until="networkidle", timeout=15000)
                except Exception:
                    try:
                        page.goto(url, timeout=10000)
                        page.wait_for_timeout(2000)
                    except Exception as e:
                        print(f"  SKIP {page_name}: {e}")
                        continue

                # Apply theme
                page.evaluate(theme_js)
                page.wait_for_timeout(300)

                try:
                    issues = page.evaluate(CONTRAST_JS)
                except Exception as e:
                    print(f"  ERROR {page_name}: {e}")
                    continue

                results[theme_id][path] = {
                    "name": page_name,
                    "issues": issues
                }

                critical = [i for i in issues if i["critical"]]
                warning = [i for i in issues if not i["critical"]]

                if not issues:
                    print(f"  OK {page_name} -- no issues")
                else:
                    if critical:
                        print(f"  FAIL {page_name} -- {len(critical)} CRITICAL + {len(warning)} warnings")
                        for issue in critical[:5]:
                            print(f"      CRITICAL <{issue['tag']}> ratio={issue['ratio']} text='{issue['text'][:40]}'")
                            print(f"        color={issue['textColor']} bg={issue['bgColor']}")
                    else:
                        print(f"  WARN {page_name} -- {len(warning)} low-contrast warnings")
                        for issue in warning[:3]:
                            print(f"      <{issue['tag']}> ratio={issue['ratio']} text='{issue['text'][:40]}'")
                            print(f"        color={issue['textColor']} bg={issue['bgColor']}")

        browser.close()

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")

    all_critical = []
    for theme_id, theme_name, _ in THEMES:
        for path, data in results.get(theme_id, {}).items():
            for issue in data.get("issues", []):
                if issue["critical"]:
                    all_critical.append({
                        "theme": theme_name,
                        "page": data["name"],
                        "path": path,
                        **issue
                    })

    if all_critical:
        print(f"\n!! {len(all_critical)} CRITICAL contrast issues (ratio < 1.5 = invisible text):")
        for item in all_critical:
            print(f"\n  [{item['theme']}] {item['page']} ({item['path']})")
            print(f"    <{item['tag']}> ratio={item['ratio']}")
            print(f"    Text: '{item['text'][:60]}'")
            print(f"    text-color: {item['textColor']}")
            print(f"    bg-color:   {item['bgColor']}")
            print(f"    classes: {item['selector'][:80]}")
    else:
        print("\nOK No critical contrast issues found (ratio < 1.5)")

    # Also summarize all warnings
    all_warnings = []
    for theme_id, theme_name, _ in THEMES:
        for path, data in results.get(theme_id, {}).items():
            for issue in data.get("issues", []):
                if not issue["critical"]:
                    all_warnings.append({
                        "theme": theme_name,
                        "page": data["name"],
                        "path": path,
                        **issue
                    })

    if all_warnings:
        print(f"\nWARN {len(all_warnings)} low-contrast warnings (ratio 1.5-2.5):")
        for item in all_warnings[:20]:
            print(f"  [{item['theme']}] {item['page']}: <{item['tag']}> ratio={item['ratio']} '{item['text'][:50]}'")
            print(f"    color={item['textColor']} bg={item['bgColor']}")

if __name__ == "__main__":
    run_checks()
