// Listen for messages from content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "analyzeText") {
        console.log("Received text from content.js:", message.content);

        fetch("http://localhost:3000/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: message.content })
        })
        .then(res => res.json())
        .then(data => {
            console.log("Backend responded:", data);

            // Forward AI response back to content
            chrome.tabs.sendMessage(sender.tab.id, {
                action: "highlightSuspicious",
                suspiciousPhrases: data.suspiciousPhrases || []
            });
        })
        .catch(err => {
            console.error("Error contacting backend:", err);
        });
    }
});
