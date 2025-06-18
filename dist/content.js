// content.js

(async () => {
  const url = window.location.href;
  const title = document.title;
  let articleText = null;
  let videoDescription = null;

  // --- Attempt to extract YouTube video description ---
  if (url.includes("youtube.com/watch")) {
    console.log("Attempting to extract YouTube video data...");
    const descriptionElement = document.querySelector('#description .yt-formatted-string');
    if (descriptionElement) {
      videoDescription = descriptionElement.innerText;
      console.log("YouTube description found.");
    } else {
      console.log("YouTube description element not found.");
    }
  }

  // --- Attempt to extract article text using Readability.js ---
  // You'll need to package Readability.js within your extension.
  // For now, let's include a dummy Readability implementation or a very basic text extraction.
  // We'll add a proper Readability.js setup in a later step.
  if (!videoDescription) { // Only try article if not a YouTube video
    console.log("Attempting to extract article text...");
    try {
      // Dummy Readability.js for now. Replace with actual library.
      // In a real scenario, you'd load Readability.js here or bundle it.
      // For simplicity, let's just grab visible text for MVP
      const mainContentElement = document.querySelector('body'); // Too broad, but a start
      if (mainContentElement) {
        articleText = mainContentElement.innerText.substring(0, 5000); // Limit length for LLM
        console.log("Basic article text extracted (first 5000 chars).");
        if (articleText.length < 200) { // Simple heuristic to avoid very short pages
            articleText = null;
        }
      }
    } catch (e) {
      console.error("Error extracting article text:", e);
    }
  }

  // Send extracted content back to the background script
  if (articleText || videoDescription) {
    chrome.runtime.sendMessage({
      type: 'CONTENT_EXTRACTED',
      data: {
        url: url,
        title: title,
        articleText: articleText,
        videoDescription: videoDescription
      }
    });
  } else {
    console.log("No significant content (article or video description) found on this page.");
    chrome.runtime.sendMessage({
        type: 'CONTENT_EXTRACTED',
        data: {
          url: url,
          title: title,
          articleText: null,
          videoDescription: null // Explicitly send null if no content
        }
      });
  }
})();
