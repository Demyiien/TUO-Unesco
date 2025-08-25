// --- Load tooltip CSS dynamically ---
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = chrome.runtime.getURL("UI/tooltip.css");
document.head.appendChild(link);

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

// --- Tooltip creation ---
function createTooltip(mark, phrase, aiVerdict = null, credibility = null, sources = []) {
    const old = document.querySelector(".suspicious-tooltip");
    if (old) old.remove();

    if (!sources || sources.length === 0) sources = ["https://example.com"];

    const tooltip = document.createElement("div");
    tooltip.className = "suspicious-tooltip";
    tooltip.style.cssText = `
        background:#fffdfa;
        border:1px solid #e0c3fc;
        border-radius:8px;
        padding:8px 12px;
        box-shadow:0 4px 12px rgba(0,0,0,0.15);
        font-size:0.9em;
        color:#333;
        max-width:300px;
        line-height:1.3em;
        z-index:10000;
        position:absolute;
    `;

    tooltip.innerHTML = `
        <div style="font-weight:bold; margin-bottom:4px;">${phrase}</div>
        <div style="margin-bottom:4px;">References:</div>
        <ul style="margin:0 0 6px 16px; padding:0; list-style:disc;">
            ${sources.map(url => `<li><a href="${url}" target="_blank" style="color:#5e17eb;">${url}</a></li>`).join('')}
        </ul>
        <div style="display:flex; gap:6px; justify-content:flex-start; margin-bottom:2px;">
            <button class="tooltip-true" style="flex:1; padding:4px 6px; border-radius:4px; border:1px solid #5e17eb; background:#f8f8f8; cursor:pointer;">✅ True</button>
            <button class="tooltip-false" style="flex:1; padding:4px 6px; border-radius:4px; border:1px solid #5e17eb; background:#f8f8f8; cursor:pointer;">❌ False</button>
        </div>
        <div class="tooltip-result" style="margin-top:4px; font-style:italic; color:#555;"></div>
    `;

    document.body.appendChild(tooltip);

    const rect = mark.getBoundingClientRect();
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 8}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;

    // Animation
    tooltip.style.opacity = 0;
    tooltip.style.transform = "scale(0.85) rotate(-2deg)";
    setTimeout(() => {
        tooltip.style.transition = "all 0.25s ease";
        tooltip.style.opacity = 1;
        tooltip.style.transform = "scale(1) rotate(0deg)";
    }, 50);

    const resultDiv = tooltip.querySelector(".tooltip-result");

    // --- Button hover shadow effect ---
    const trueBtn = tooltip.querySelector(".tooltip-true");
    const falseBtn = tooltip.querySelector(".tooltip-false");

    [trueBtn, falseBtn].forEach(btn => {
        btn.addEventListener("mouseenter", () => btn.style.boxShadow = "0 0 6px rgba(94,23,235,0.7)");
        btn.addEventListener("mouseleave", () => btn.style.boxShadow = "none");
    });

    trueBtn.addEventListener("click", () => {
        resultDiv.innerHTML = `
            Your guess: ✅ True<br>
            AI Verdict: ${aiVerdict ? "✅ True" : "❌ False"} (${credibility}/10)<br>
        `;
        trueBtn.disabled = true;
        falseBtn.disabled = true;
        tooltip.style.transform = "scale(1.05)";
        setTimeout(() => tooltip.style.transform = "scale(1)", 300);
    });

    falseBtn.addEventListener("click", () => {
        resultDiv.innerHTML = `
            Your guess: ❌ False<br>
            AI Verdict: ${aiVerdict ? "✅ True" : "❌ False"} (${credibility}/10)<br>
        `;
        trueBtn.disabled = true;
        falseBtn.disabled = true;
        tooltip.style.transform = "scale(1.05)";
        setTimeout(() => tooltip.style.transform = "scale(1)", 300);
    });

    // Hover persistence
    let hideTimeout;
    mark.addEventListener("mouseleave", () => hideTimeout = setTimeout(() => tooltip.remove(), 400));
    tooltip.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
    tooltip.addEventListener("mouseleave", () => tooltip.remove());
}

// --- Highlight suspicious phrases ---
function highlightSuspiciousText(suspiciousPhrases) {
    if (!suspiciousPhrases || suspiciousPhrases.length === 0) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

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
