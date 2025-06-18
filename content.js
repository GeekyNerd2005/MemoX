(async () => {
  const url = window.location.href;
  const title = document.title;
  let articleText = null;
  let videoDescription = null;

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

  if (!videoDescription) { 
    console.log("Attempting to extract article text...");
    try {
      const mainContentElement = document.querySelector('body'); 
      if (mainContentElement) {
        articleText = mainContentElement.innerText.substring(0, 5000);
        console.log("Basic article text extracted (first 5000 chars).");
        if (articleText.length < 200) { 
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