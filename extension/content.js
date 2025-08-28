// --- State tracking ---
const seenText = new Set();
const seenLinks = new Set();

// --- Scrape visible text ---
function scrapePageText() {
    return document.body.innerText;
}

// --- Scrape all links ---
function scrapeLinks() {
    return Array.from(document.querySelectorAll("a[href]"))
        .map(a => a.href.trim())
        .filter(href => href.length > 0);
}

// --- Get new content (avoiding duplicates) ---
function getNewContent() {
    const allText = scrapePageText();
    const textLines = allText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const newLines = textLines.filter(line => !seenText.has(line));
    newLines.forEach(line => seenText.add(line));

    const allLinks = scrapeLinks();
    const newLinks = allLinks.filter(link => !seenLinks.has(link));
    newLinks.forEach(link => seenLinks.add(link));

    return { text: newLines.join("\n"), links: newLinks };
}

// --- Tooltip creation (new UI version) ---
function createTooltip(mark, highlightedText, aiVerdict = null, credibility = null, sources = []) {
    let tooltip = document.querySelector(".suspicious-tooltip");

    // Reuse tooltip if same phrase
    if (tooltip && tooltip.dataset.phrase === highlightedText) {
        const rect = mark.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 8;
        let left = Math.min(rect.left + window.scrollX, window.innerWidth - tooltip.offsetWidth - 10);

        if (top + tooltip.offsetHeight > window.scrollY + window.innerHeight) {
            top = rect.top + window.scrollY - tooltip.offsetHeight - 8;
        }

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        return;
    }

    // remove old one if different phrase
    if (tooltip) tooltip.remove();

    if (!sources || sources.length === 0) sources = ["https://example.com"];

    tooltip = document.createElement("div");
    tooltip.className = "suspicious-tooltip";
    tooltip.dataset.phrase = highlightedText;
    tooltip.style.cssText = `
        position:absolute;
        z-index:10000;
        width:350px;
        max-width:95%;
        background:#fff;
        border-radius:12px;
        box-shadow:0 6px 20px rgba(0,0,0,0.15);
        font-family:'Inter',sans-serif;
        color:#333;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        opacity:0;
        transform:scale(0.9);
        transition:opacity 0.3s ease, transform 0.25s ease;
    `;

    tooltip.innerHTML = `
        <div style="
            background:#FF9D23;
            height:48px;
            display:flex;
            align-items:center;
            justify-content:center;
            font-family:'Inter',sans-serif;
            font-weight:bold;
            color:white;
            font-size:1em;
            border-radius:12px 12px 0 0;
        ">
            Suspicious Text Detected!
        </div>

        <div style="padding:12px 16px; font-size:0.9em; line-height:1.4em; flex:1;">
            <div style="margin-bottom:8px; font-weight:bold;">Highlighted Text:</div>
            <div style="margin-bottom:12px; color:#d6336c; word-wrap:break-word;">${highlightedText}</div>
            <div style="margin-bottom:6px; font-weight:bold;">Related Sources:</div>
            <ol class="tooltip-sources" style="margin:0 0 12px 16px; padding:0; list-style:decimal;">
                ${sources.map(url => {
                    const shortUrl = url.length > 35 ? url.slice(0, 32) + "..." : url;
                    return `<li><a href="${url}" target="_blank" style="color:#1a73e8; text-decoration:underline; word-break:break-all;">${shortUrl}</a></li>`;
                }).join('')}
            </ol>
        </div>

        <div class="tooltip-buttons" style="
            padding:12px 16px; 
            border-top:1px solid #eee; 
            display:flex; 
            gap:12px; 
            justify-content:center; 
        ">
            <button class="tooltip-true" style="
                flex:1; padding: 10px 0; border:none; border-radius:8px; background:#21BF73; color:white; font-weight:bold; cursor:pointer;
                transition:all 0.2s; font-size:0.95em;
            ">TRUE</button>
            <button class="tooltip-false" style="
                flex:1; padding:10px 0; border:none; border-radius:8px; background:#E43636; color:white; font-weight:bold; cursor:pointer;
                transition:all 0.2s; font-size:0.95em;
            ">FALSE</button>
        </div>

        <div class="tooltip-result" style="padding:10px 16px; font-style:italic; color:#555; min-height:24px;"></div>
    `;

    document.body.appendChild(tooltip);

    // Position near highlighted text
    const rect = mark.getBoundingClientRect();
    let top = rect.bottom + window.scrollY + 8;
    let left = Math.min(rect.left + window.scrollX, window.innerWidth - tooltip.offsetWidth - 10);

    if (top + tooltip.offsetHeight > window.scrollY + window.innerHeight) {
        top = rect.top + window.scrollY - tooltip.offsetHeight - 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    // Fade in
    requestAnimationFrame(() => {
        tooltip.style.opacity = 1;
        tooltip.style.transform = "scale(1)";
    });

    // Buttons
    const resultDiv = tooltip.querySelector(".tooltip-result");
    const trueBtn = tooltip.querySelector(".tooltip-true");
    const falseBtn = tooltip.querySelector(".tooltip-false");

    trueBtn.addEventListener("click", () => {
        resultDiv.innerHTML = `Your Verdict: ✅ TRUE<br>AI Verdict: ${aiVerdict ? "✅ True" : "❌ False"} (${credibility}/10)`;
        trueBtn.disabled = true;
        falseBtn.disabled = true;
        trueBtn.style.opacity = 0.7;
        falseBtn.style.opacity = 0.7;
    });

    falseBtn.addEventListener("click", () => {
        resultDiv.innerHTML = `Your Verdict: ❌ FALSE<br>AI Verdict: ${aiVerdict ? "✅ True" : "❌ False"} (${credibility}/10)`;
        trueBtn.disabled = true;
        falseBtn.disabled = true;
        trueBtn.style.opacity = 0.7;
        falseBtn.style.opacity = 0.7;
    });

    // Auto-hide with fade-out
    let hideTimeout;

    function scheduleHide() {
        hideTimeout = setTimeout(() => {
            tooltip.style.opacity = 0;
            tooltip.style.transform = "scale(0.95)";
            setTimeout(() => {
                if (tooltip && tooltip.parentNode) tooltip.remove();
            }, 300);
        }, 100);
    }

    mark.addEventListener("mouseleave", scheduleHide);
    tooltip.addEventListener("mouseleave", scheduleHide);

    mark.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
    tooltip.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
}


// --- Highlight suspicious phrases ---
function highlightSuspiciousText(suspiciousPhrases) {
    if (!suspiciousPhrases || suspiciousPhrases.length === 0) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;

        // Skip if this text is inside the tooltip
        if (node.parentNode.closest(".suspicious-tooltip")) continue;

        textNodes.push(node);
    }

    for (const node of textNodes) {
        const parent = node.parentNode;
        if (!parent) continue;

        let text = node.nodeValue;
        if (!text || text.trim() === "") continue;

        for (const item of suspiciousPhrases) {
            const phrase = (item.phrase || item).trim();
            if (!phrase) continue;

            const aiVerdict = item.aiVerdict ?? true;
            const credibility = item.credibility ?? 5;
            const sources = item.sources ?? [];

            const safePhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(safePhrase, "gi");
            if (!regex.test(text)) continue;

            const frag = document.createDocumentFragment();
            let lastIndex = 0;

            text.replace(regex, (match, offset) => {
                if (offset > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, offset)));

                const mark = document.createElement("mark");
                mark.style.background = "#ffff99";
                mark.style.color = "#d6336c";
                mark.textContent = match;

                mark.addEventListener("mouseenter", () => createTooltip(mark, match, aiVerdict, credibility, sources));

                frag.appendChild(mark);
                lastIndex = offset + match.length;
            });

            if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
            parent.replaceChild(frag, node);
            text = frag.textContent;
        }
    }
}

// --- Send content to backend ---
async function sendContentToBackend() {
    const { text, links } = getNewContent();
    if (!text && links.length === 0) return;

    console.log("Sending new content to backend:", { text, links });

    try {
        const response = await fetch("http://localhost:3000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text, links: links })
        });

        if (!response.ok) {
            console.error("HTTP error:", response.status, response.statusText);
            return;
        }

        const result = await response.json();
        console.log("Backend responded:", result);

        if (result.suspiciousPhrases && result.suspiciousPhrases.length > 0) {
            highlightSuspiciousText(result.suspiciousPhrases);
        }
    } catch (err) {
        console.error("Error sending content to backend:", err);
    }
}

// --- Rate-limited sending ---
let lastSent = 0;
function rateLimitedSend() {
    const now = Date.now();
    if (now - lastSent >= 3000) {
        sendContentToBackend();
        lastSent = now;
    }
}

// --- Initial load ---
document.addEventListener("DOMContentLoaded", () => rateLimitedSend());

// --- Observe dynamic content ---
const observer = new MutationObserver(() => rateLimitedSend());
observer.observe(document.body, { childList: true, subtree: true });
