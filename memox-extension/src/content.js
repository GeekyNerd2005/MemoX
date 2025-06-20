(async () => {
  let pageContent = "";
  let extractedTexts = new Set();

  const cookieToken = document.cookie
    .split('; ')
    .find(row => row.startsWith('user_token='))
    ?.split('=')[1];

  if (cookieToken) {
    chrome.storage.local.set({ token: cookieToken }, () => {
      console.log("[content.js] Token saved from cookie:", cookieToken);
    });
  } else {
    console.warn("[content.js] No token found in cookie.");
  }

  function isVisible(elem) {
    if (!elem || elem.nodeType !== Node.ELEMENT_NODE) return false;
    const style = window.getComputedStyle(elem);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      parseFloat(style.opacity) > 0 &&
      elem.offsetWidth > 0 &&
      elem.offsetHeight > 0
    );
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  const selectors = ['article', 'main', 'div.main-content', 'div.article-content', 'body'];
  for (const sel of selectors) {
    const elems = document.querySelectorAll(sel);
    for (const elem of elems) {
      if (!isVisible(elem)) continue;
      const textNodes = elem.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
      textNodes.forEach(node => {
        const text = node.textContent?.trim();
        if (text && text.length > 20 && !extractedTexts.has(text)) {
          extractedTexts.add(text);
        }
      });
    }
  }

  pageContent = Array.from(extractedTexts).join("\n\n").trim();

  if (!pageContent || pageContent.length < 100) {
    pageContent = document.body.innerText.trim();
  }

  const MAX_LENGTH = 3000;
  if (pageContent.length > MAX_LENGTH) {
    pageContent = pageContent.slice(0, MAX_LENGTH);
    console.log(`[content.js] Trimmed page content to ${MAX_LENGTH} characters.`);
  }

  console.log("[content.js] Final extracted content length:", pageContent.length);

  chrome.runtime.sendMessage({
    type: "PAGE_CONTENT",
    content: pageContent
  });

  console.log("[content.js] Sent PAGE_CONTENT to popup");
})();
