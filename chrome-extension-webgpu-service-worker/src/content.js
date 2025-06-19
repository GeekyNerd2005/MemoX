// content.js

(async () => {
  let pageContent = "";

  // Check if it's a YouTube video page
  if (window.location.hostname === "www.youtube.com" && window.location.pathname.includes("/watch")) {
    console.log("Attempting to get YouTube transcript...");
    // Attempt to find the transcript button and click it
    // This part can be brittle if YouTube changes its UI.
    // A more robust solution might involve observing DOM changes or using YouTube's API if available to extensions.
    const transcriptButton = document.querySelector("#segmented-like-button + #top-level-buttons-computed > ytd-toggle-button-renderer:nth-child(2) > yt-button-shape > button > yt-touch-feedback-shape > div > div.yt-spec-touch-feedback-shape__fill");

    if (transcriptButton) {
      transcriptButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for transcript to load

      const transcriptContainer = document.querySelector("ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-transcript'] #segments-container");

      if (transcriptContainer) {
        const transcriptSegments = transcriptContainer.querySelectorAll(".segment-text.style-scope.ytd-transcript-segment-renderer");
        pageContent = Array.from(transcriptSegments).map(segment => segment.textContent?.trim()).join(" ");
        console.log("YouTube transcript extracted.");
      } else {
        console.log("Transcript container not found, falling back to general content.");
      }
    } else {
      console.log("YouTube transcript button not found, falling back to general content.");
    }
  }

  // If no YouTube transcript or not a YouTube page, try to get article content
  if (!pageContent) {
    console.log("Attempting to get general page content...");
    // Prioritize common article elements
    const article = document.querySelector("article") ||
                    document.querySelector("main") ||
                    document.querySelector(".post-content") ||
                    document.querySelector(".entry-content") ||
                    document.body; // Fallback to body

    if (article) {
      // Clean up script and style tags for cleaner text
      const clonedArticle = article.cloneNode(true);
      clonedArticle.querySelectorAll("script, style, noscript").forEach(el => el.remove());
      pageContent = clonedArticle.textContent?.trim() || "";

      // Basic cleanup: remove excessive whitespace and newlines
      pageContent = pageContent.replace(/\s+/g, ' ').trim();
      console.log("General page content extracted.");
    } else {
      console.log("No article-like content found.");
    }
  }

  // Send the extracted content back to the extension popup
  chrome.runtime.sendMessage({ type: "PAGE_CONTENT", content: pageContent });
})();