/**
 * Search DuckDuckGo for a query and return top result URLs.
 * @param {string} query - The text to search for.
 * @param {number} maxResults - Maximum number of URLs to return.
 * @returns {Promise<string[]>} - Array of URLs.
 */
export async function searchDuckDuckGo(query, maxResults = 5) {
    try {
        const params = new URLSearchParams({
            q: query,
            t: "h_",      // user agent token (optional)
            ia: "web"
        });

        const response = await fetch(`https://html.duckduckgo.com/html/?${params.toString()}`, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "text/html"
            }
        });

        const html = await response.text();

        // Parse the HTML and extract result links
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const links = [];
        const anchors = doc.querySelectorAll(".result__a"); // DuckDuckGo HTML search links
        for (let i = 0; i < anchors.length && links.length < maxResults; i++) {
            const href = anchors[i].href;
            if (href) links.push(href);
        }

        return links;

    } catch (err) {
        console.error("DuckDuckGo search error:", err);
        return [];
    }
}
