(async () => {
  let pageContent = "";
  let extractedTexts = new Set(); // To store unique text segments

  // Helper function to check if an element is visually visible
  function isVisible(elem) {
    if (!elem || elem.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(elem);
    return (
      style.width !== '0px' &&
      style.height !== '0px' &&
      style.opacity !== '0' &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      elem.offsetWidth > 0 && // Check rendered width
      elem.offsetHeight > 0 // Check rendered height
    );
  }

  // --- YouTube Transcript Extraction ---
  // Corrected hostname for YouTube. Note: This part is highly dependent on YouTube's UI and can break easily.
  if (window.location.hostname === "www.youtube.com" && window.location.pathname.includes("/watch")) {
    console.log("Attempting to get YouTube transcript...");
    
    // Using a more robust (but still brittle) approach to open transcript if not open
    try {
      const moreActionsButton = document.querySelector('ytd-menu-renderer.ytd-video-primary-info-renderer button#button[aria-label="More actions"]');
      if (moreActionsButton && isVisible(moreActionsButton)) {
        moreActionsButton.click();
        await new Promise(resolve => setTimeout(resolve, 500)); // Small wait for menu to open

        // Look for the transcript item using XPath, as text content is more stable than specific classes
        const transcriptMenuItem = document.evaluate("//tp-yt-paper-item[contains(@aria-label, 'Show transcript') or contains(., 'Show transcript')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (transcriptMenuItem && isVisible(transcriptMenuItem)) {
          transcriptMenuItem.click();
          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for transcript panel to load
        } else {
          console.log("Could not find 'Show transcript' menu item in actions menu.");
        }
      } else {
        console.log("More actions button not found or not visible on YouTube.");
      }

      const transcriptContainer = document.querySelector("ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-transcript'] #segments-container");

      if (transcriptContainer && isVisible(transcriptContainer)) {
        const transcriptSegments = transcriptContainer.querySelectorAll(".segment-text.style-scope.ytd-transcript-segment-renderer");
        pageContent = Array.from(transcriptSegments)
            .map(segment => segment.textContent?.trim())
            .filter(text => text && text.length > 0)
            .join(" "); 
        console.log("YouTube transcript extracted. Length:", pageContent.length);
      } else {
        console.log("Transcript container not found or not visible, falling back to general content.");
      }
    } catch (e) {
      console.error("Error during YouTube transcript extraction:", e);
      console.log("Falling back to general content extraction for YouTube page.");
    }
  }
  await sleep(500);
  // --- General Page Content Extraction (if no YouTube transcript or if it failed) ---
  if (!pageContent || pageContent.length < 50) { // If YouTube extraction failed or produced too little content
    console.log("Attempting to get general page content with deduplication and filtering...");
    let mainContent = '';

    const contentSelectors = [
      'article',              // HTML5 semantic element for self-contained content
      'main',                 // HTML5 semantic element for main content
      'div.main-content',     // Common class names
      'div.article-content',
      'div.post-content',
      'div.entry-content',    // Common from your previous code
      'div#content',          // Common ID names
      'div#main',
      'body'                  // Fallback: entire body (less precise)
    ];

    let foundSignificantContent = false;

    // Iterate through potential main content containers
    for (const selector of contentSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const elem of elements) {
        if (isVisible(elem) && elem.tagName !== 'HEADER' && elem.tagName !== 'FOOTER' && elem.tagName !== 'NAV' && elem.tagName !== 'ASIDE') {
          // Get text from common block-level elements within the chosen container
          const textNodes = elem.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, dd');
          textNodes.forEach(node => {
            if (isVisible(node)) { 
              const text = node.textContent.trim();
              if (text.length > 5 || node.tagName.startsWith('H')) { // Filter out very short text unless it's a heading
                if (!extractedTexts.has(text)) { // Deduplicate using the Set
                  extractedTexts.add(text);
                  mainContent += text + '\n\n'; // Add spacing for readability
                  foundSignificantContent = true;
                }
              }
            }
          });

          // If we found substantial content in a primary semantic element, we can prioritize and potentially stop
          if (foundSignificantContent && (selector === 'article' || selector === 'main')) {
            break; 
          }
        }
      }
      if (foundSignificantContent && (selector === 'article' || selector === 'main')) {
        break; 
      }
    }

    // Fallback if no significant structured content was found or extracted text is too short
    if (!foundSignificantContent || mainContent.trim().length < 200) { 
      console.warn("Could not find sufficient structured main content. Attempting broader text extraction.");
      mainContent = ''; // Reset mainContent for fresh extraction
      extractedTexts.clear(); // Clear Set for fresh deduplication

      const allVisibleBlockElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, div');
      allVisibleBlockElements.forEach(elem => {
          // Further filter out elements commonly outside main article content
          if (isVisible(elem) &&
              !elem.closest('header, footer, nav, aside, .sidebar, #comments, #related-articles, #ads, [role="navigation"]')) {
              const text = elem.textContent.trim();
              if (text.length > 20) { // Consider longer blocks in this broader fallback
                  if (!extractedTexts.has(text)) {
                      extractedTexts.add(text);
                      mainContent += text + '\n\n';
                  }
              }
          }
      });
    }

    pageContent = mainContent.trim();

    // Final fallback to body innerText if all structured and filtered methods fail
    if (pageContent.length === 0) {
      console.warn("No specific content found. Falling back to entire visible body text.");
      pageContent = document.body.innerText.trim();
    }

    // Basic cleanup: remove excessive whitespace and newlines from final string
    pageContent = pageContent.replace(/\s+/g, ' ').trim();
    console.log("General page content extracted. Length:", pageContent.length);
  }
  console.log(`Final extracted content length: ${pageContent.length} characters.`);
  if (pageContent.length === 0) {
      console.warn("[content.js] Warning: Sending empty pageContent to popup. This might cause no summary.");
  }
  console.log("[content.js] Attempting to send message to background script."); // Updated log
  // Change the message destination to background script
  chrome.runtime.sendMessage({ type: "PAGE_CONTENT", content: pageContent }, (response) => {
      if (chrome.runtime.lastError) {
          // This error might still occur if background script is somehow unresponsive, but less likely
          console.error("[content.js] Error sending message to background script:", chrome.runtime.lastError.message);
      } else {
          console.log("[content.js] Message sent successfully to background script. Response (if any):", response);
      }
  });

  // Small helper for asynchronous operations
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();