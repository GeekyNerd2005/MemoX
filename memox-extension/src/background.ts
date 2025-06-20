import { ExtensionServiceWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

interface Handler {
  setPort(port: chrome.runtime.Port): void;
  onmessage(message: any, port: chrome.runtime.Port): void;
}

let handler: Handler | undefined;

chrome.runtime.onConnect.addListener(function (port) {
  console.assert(port.name === "web_llm_service_worker");
  if (handler === undefined) {
    handler = new ExtensionServiceWorkerMLCEngineHandler(port);
  } else {
    handler.setPort(port);
  }
  port.onMessage.addListener(handler.onmessage.bind(handler));
  console.log("[background.ts] WebLLM service worker port connected.");
});
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  console.log("[background.ts] Message received:", request);

  if (request.type === "PAGE_CONTENT") {
    // Forward the PAGE_CONTENT message to all active popup/extension views
    // This makes sure the popup (if open) gets the message
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError) {
        // This error could happen if no popup is open to receive the message
        console.warn("[background.ts] Error forwarding message to popup/other views:", chrome.runtime.lastError.message);
      } else {
        console.log("[background.ts] Message forwarded to popup/other views successfully.");
      }
    });

    // Send an immediate response back to the content script.
    // This ensures content.js's message port doesn't close with an error,
    // as it confirms the background script received the message.
    sendResponse({ status: "received by background" });
    return true; // Indicate that sendResponse will be called asynchronously
  }
  // Add other message types here if your background script needs to handle them
});

console.log("[background.ts] Background script loaded."); // Keep this to know when it's initialized