// background.js

async function setupOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['LOCAL_STORAGE'],
    justification: 'Running large language model inference.',
  });
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (sender.url && sender.url.endsWith('offscreen.html')) {
    if (message.type === 'LLM_PROGRESS') {
      console.log('LLM Progress from offscreen:', message.data);
    } else if (message.type === 'LLM_STATUS') {
      console.log('LLM Status from offscreen:', message.data);
    }
  }
  if (message.type === 'INIT_LLM_RESPONSE' || message.type === 'SUMMARIZE_TEXT_RESPONSE') {
      console.log("[Background] Received response from offscreen:", message);
  }
});

async function initializeLLM() {
  await setupOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ type: 'INIT_LLM' });
  if (response.status === 'success') {
      console.log("LLM initialized in offscreen document.");
  } else {
      console.error("Failed to initialize LLM in offscreen document:", response.message);
  }
}

async function getSummary(text) {
  await setupOffscreenDocument();
  const response = await chrome.runtime.sendMessage({ type: 'SUMMARIZE_TEXT', text: text });
  if (response.status === 'success') {
      console.log("Summary received:", response.summary);
      return response.summary;
  } else {
      console.error("Failed to get summary:", response.message);
      throw new Error("Summarization failed: " + response.message);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  initializeLLM();
});

chrome.webNavigation.onCompleted.addListener(async (details) => {
    if (details.frameId === 0) {
        try {
            const pageContent = { text: "This is some example text for the LLM to summarize. It should be long enough for a basic summary test." };

            if (pageContent && pageContent.text) {
                console.log("Attempting to summarize captured text...");
                const summary = await getSummary(pageContent.text);
                console.log("Page Summary:", summary);
            }
        } catch (error) {
            console.error("Error processing page content or summarizing:", error);
        }
    }
});

chrome.runtime.onSuspend.addListener(async () => {
    console.log("Extension suspending, attempting to terminate LLM.");
    await chrome.runtime.sendMessage({ type: 'TERMINATE_LLM' });
    console.log("LLM termination message sent.");
});
