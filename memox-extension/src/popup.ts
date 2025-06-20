"use strict";

import "./popup.css";

import {
  ChatCompletionMessageParam,
  CreateExtensionServiceWorkerMLCEngine,
  MLCEngineInterface,
  InitProgressReport,
} from "@mlc-ai/web-llm";

import { Line } from "progressbar.js";
console.log("[popup.ts] Popup script started and loaded.");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let summarizePageButton: HTMLButtonElement | null;
let answerElement: HTMLParagraphElement | null;
let answerWrapper: HTMLDivElement | null;

// Renamed/added for clarity and integration with sleek loader
let loadingContainer: HTMLDivElement | null;
let progressBarWrapper: HTMLDivElement | null;
let loadingPercentageElement: HTMLSpanElement | null;

let copyAnswerButton: HTMLButtonElement | null;
let timestampElement: HTMLSpanElement | null;

let isLoadingParams = false;
let engine: MLCEngineInterface | null = null;
const chatHistory: ChatCompletionMessageParam[] = [];

let progressBar: InstanceType<typeof Line> | null = null;
function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}
const MAX_CHAR_LENGTH = 4000;
const initProgressCallback = (report: InitProgressReport) => {
  if (progressBar) {
    progressBar.animate(report.progress, {
      duration: 50,
    });
  }
  if (loadingPercentageElement) {
    loadingPercentageElement.textContent = `${(report.progress * 100).toFixed(0)}%`;
  }
  if (report.progress === 1.0) {
    enableInputs();
  }
};

async function initializeMLCEngine() {
  isLoadingParams = true;

  if (summarizePageButton) summarizePageButton.disabled = true;

  if (loadingContainer) loadingContainer.classList.remove("hidden"); // Show the sleek loader

  if (progressBarWrapper) {
    progressBar = new Line(progressBarWrapper, {
      strokeWidth: 4,
      easing: "easeInOut",
      duration: 1400,
      color: "#ffd166",
      trailColor: "#eee",
      trailWidth: 1,
      svgStyle: { width: "100%", height: "100%" },
    });
  } else {
    console.warn("Progress bar wrapper not found. Progress bar will not display.");
  }

  try {
    engine = await CreateExtensionServiceWorkerMLCEngine(
      "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC",
      { initProgressCallback: initProgressCallback },
    );
    console.log("MLC Engine created successfully!");
  } catch (error) {
    console.error("Failed to create MLC Engine:", error);
    if (answerElement) answerElement.innerHTML = "Error loading AI model. Please check console.";
    if (answerWrapper) answerWrapper.classList.remove("hidden");
    if (loadingContainer) loadingContainer.classList.add("hidden"); // Hide loader on error
    enableInputs();
  } finally {
    isLoadingParams = false;
  }
}

function enableInputs() {
  if (summarizePageButton) summarizePageButton.disabled = false;
  if (loadingContainer) {
    loadingContainer.classList.add("hidden"); // Hide the sleek loader
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  summarizePageButton = getElement<HTMLButtonElement>("summarize-page-button");
  answerElement = getElement<HTMLParagraphElement>("answer");
  answerWrapper = getElement<HTMLDivElement>("answerWrapper");
  loadingContainer = getElement<HTMLDivElement>("loadingContainer"); // Assign this
  progressBarWrapper = getElement<HTMLDivElement>("progressBarWrapper"); // Assign this
  loadingPercentageElement = getElement<HTMLSpanElement>("loadingPercentage"); // Assign this
  copyAnswerButton = getElement<HTMLButtonElement>("copyAnswer");
  timestampElement = getElement<HTMLSpanElement>("timestamp");

  if (answerWrapper) answerWrapper.classList.add("hidden");
  // loadingContainer starts hidden, initializeMLCEngine will show it

  if (summarizePageButton) {
    summarizePageButton.addEventListener("click", async () => {
      console.log("Summarize Page button clicked.");

      // --- START MODIFIED SECTION FOR CLEARING AND LOADER DISPLAY ---
      // 1. Show the loading container immediately
      if (loadingContainer) loadingContainer.classList.remove("hidden");
      
      // 2. Clear the previous answer and display "Summarizing..."
      //    This will also make answerWrapper visible via updateAnswer()
      updateAnswer("Summarizing..."); // This function will also make answerWrapper visible
      chatHistory.length = 0;
      console.log("[popup.ts] chatHistory cleared for new request. Current chatHistory length:", chatHistory.length);

      // 3. Disable button while processing
      if (summarizePageButton) summarizePageButton.disabled = true;
      // --- END MODIFIED SECTION ---

      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]?.id) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ["content.js"],
            });
            console.log("Content script injected. Waiting for content...");
          } catch (e) {
            console.error("Failed to inject content script:", e);
            // If injection fails, clear summary area and show error
            updateAnswer("Error: Could not retrieve page content for summarization. Check console for details.");
            if (summarizePageButton) summarizePageButton.disabled = false;
            if (loadingContainer) loadingContainer.classList.add("hidden"); // Hide loader on error
          }
        } else {
          updateAnswer("Error: No active tab found to summarize.");
          if (summarizePageButton) summarizePageButton.disabled = false;
          if (loadingContainer) loadingContainer.classList.add("hidden"); // Hide loader on error
        }
      });
    });
  }

  if (copyAnswerButton) {
    copyAnswerButton.addEventListener("click", () => {
        if (answerElement) {
            copyToClipboard(answerElement.innerText);
        }
    });
  }

  await initializeMLCEngine();
});

let currentCopyButtonListener: ((this: HTMLElement, ev: MouseEvent) => any) | null = null;

// In src/popup.ts

async function generateResponse() {
  console.log("[popup.ts] generateResponse: Function entered."); // <-- NEW LOG
  if (!engine) {
      console.error("MLC Engine is not initialized.");
      updateAnswer("Error: AI model not ready. Please try again later.");
      return;
  }
  
  let curMessage = "";
  try {
    console.log("[popup.ts] generateResponse: Calling engine.chat.completions.create..."); // <-- NEW LOG
    const completion = await engine.chat.completions.create({
      stream: true,
      messages: chatHistory, // chatHistory is already pushed in the onMessage listener
      temperature: 0.7,
      max_tokens: 500, 
    });
    
    console.log("[popup.ts] generateResponse: engine.chat.completions.create returned. Starting to process stream..."); // <-- NEW LOG
    let receivedAnyChunk = false;
    for await (const chunk of completion) {
      receivedAnyChunk = true;
      const curDelta = chunk.choices[0].delta.content;
      if (curDelta) {
        curMessage += curDelta;
      }
      updateAnswer(curMessage);
    }
    if (!receivedAnyChunk) {
        console.warn("[popup.ts] generateResponse: Completion stream ended without yielding any content."); // <-- ENHANCED LOG
        updateAnswer("Error: Model response was empty or failed internally.");
    }
    chatHistory.push({ role: "assistant", content: await engine.getMessage() });
    console.log("[popup.ts] generateResponse: Streaming finished and assistant message pushed."); // <-- NEW LOG

  } catch (error) {
    console.error("[popup.ts] generateResponse: ERROR caught during AI response generation:", error); // <-- ENHANCED ERROR LOG
    updateAnswer("Error: Could not generate response. Please try again. (See console for details)");
    // Be careful with pop() here if the push() didn't happen successfully.
    // Maybe better to only pop if the error is due to a later problem with response.
    // For now, let's keep it as is, but note it.
    // chatHistory.pop(); 
  } finally {
    if (summarizePageButton) summarizePageButton.disabled = false;
    if (loadingContainer) loadingContainer.classList.add("hidden"); // Hide loader after generation
    console.log("[popup.ts] generateResponse: Function completed (finally block)."); // <-- NEW LOG
  }
}

chrome.runtime.onMessage.addListener(async (request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  console.log("[popup.ts] !!! MESSAGE LISTENER ENTERED !!! Request Type:", request.type); 
  console.log("[popup.ts] >>> Message listener activated. Request object:", request); 

  if (request.type === "PAGE_CONTENT") {
    let pageContent = request.content; // Use 'let' because we might reassign it

    // Check if content is long and truncate it using MAX_CHAR_LENGTH
    if (pageContent.length > MAX_CHAR_LENGTH) {
      console.warn(`[popup.ts] Page content too long (${pageContent.length} chars). Truncating to ${MAX_CHAR_LENGTH} chars for summarization.`);
      pageContent = pageContent.substring(0, MAX_CHAR_LENGTH); // <<< Truncate pageContent directly
    } else {
      console.log(`[popup.ts] Page content length: ${pageContent.length} characters (no truncation needed).`);
    }

    if (pageContent && pageContent.length > 50) { // Check if content is meaningful after truncation
      // Use the (potentially truncated) 'pageContent' in the prompt
      const summaryPrompt = `Summarize the following article in approximately 200-250 words. Focus on the main ideas and key findings, rephrasing the content concisely. Do not copy-paste directly from the source text. Keep it brief and to the point, aimed at a general audience:\n\n${pageContent}`;

      console.log("[popup.ts] Prepared summary prompt. Length:", summaryPrompt.length);
      console.log("[popup.ts] Prompt starts with:", summaryPrompt.substring(0, Math.min(summaryPrompt.length, 200)));

      chatHistory.push({ role: "user", content: summaryPrompt });
      await generateResponse();
    } else {
      updateAnswer("No meaningful content found on this page to summarize, or content was too short after truncation.");
      if (summarizePageButton) summarizePageButton.disabled = false;
      if (loadingContainer) loadingContainer.classList.add("hidden"); // Hide loader if no content
    }
  }
});


function updateAnswer(answer: string) {
  if (answerWrapper) answerWrapper.classList.remove("hidden"); // Ensure answerWrapper is visible
  if (answerElement) {
    const answerWithBreaks = answer.replace(/\n/g, "<br>");
    answerElement.innerHTML = answerWithBreaks;
  }

  // --- START: Copy button listener management ---
  // Remove existing listener to prevent multiple bindings
  if (copyAnswerButton && currentCopyButtonListener) {
    copyAnswerButton.removeEventListener("click", currentCopyButtonListener);
  }

  // Define new listener
  const newListener = (e: MouseEvent) => {
    copyToClipboard(answer);
  };

  // Add new listener and store it
  if (copyAnswerButton) {
    copyAnswerButton.addEventListener("click", newListener);
    currentCopyButtonListener = newListener;
  }
  // --- END: Copy button listener management ---

  if (timestampElement) {
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };
    const time = new Date().toLocaleString("en-US", options);
    timestampElement.innerText = time;
  }
  // This line should remain as it hides the loader *when the answer is being displayed*.
  // For subsequent updates during streaming, it doesn't re-hide as loader is already hidden.
  // It's the final hide after the first chunk.
  if (loadingContainer) loadingContainer.classList.add("hidden"); 
}

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => console.log("Answer text copied to clipboard"))
    .catch((err) => console.error("Could not copy text: ", err));
}