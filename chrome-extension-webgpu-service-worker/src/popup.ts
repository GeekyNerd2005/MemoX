
"use strict";

import "./popup.css";

import {
  ChatCompletionMessageParam,
  CreateExtensionServiceWorkerMLCEngine,
  MLCEngineInterface,
  InitProgressReport,
} from "@mlc-ai/web-llm";

import { Line } from "progressbar.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let queryInput: HTMLTextAreaElement | null;
let submitButton: HTMLButtonElement | null;
let summarizePageButton: HTMLButtonElement | null;
let answerElement: HTMLParagraphElement | null;
let answerWrapper: HTMLDivElement | null;
let loadingIndicator: HTMLDivElement | null;
let copyAnswerButton: HTMLButtonElement | null;
let timestampElement: HTMLSpanElement | null;
let loadingBarContainer: HTMLDivElement | null;

let isLoadingParams = false;
let engine: MLCEngineInterface | null = null;
const chatHistory: ChatCompletionMessageParam[] = [];

let progressBar: InstanceType<typeof Line> | null = null; 
function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

const initProgressCallback = (report: InitProgressReport) => {
  if (progressBar) {
    progressBar.animate(report.progress, {
      duration: 50,
    });
  }
  if (report.progress === 1.0) {
    enableInputs();
  }
};

async function initializeMLCEngine() {
  isLoadingParams = true;

  if (submitButton) submitButton.disabled = true;
  if (summarizePageButton) summarizePageButton.disabled = true;

  if (loadingBarContainer) {
    progressBar = new Line(loadingBarContainer, {
      strokeWidth: 4,
      easing: "easeInOut",
      duration: 1400,
      color: "#ffd166",
      trailColor: "#eee",
      trailWidth: 1,
      svgStyle: { width: "100%", height: "100%" },
    });
  } else {
    console.warn("Loading container not found. Progress bar will not display.");
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
    if (loadingIndicator) loadingIndicator.classList.add("hidden");
    enableInputs();
  } finally {
    isLoadingParams = false;
  }
}

function enableInputs() {
  if (submitButton) submitButton.disabled = false;
  if (summarizePageButton) summarizePageButton.disabled = false;
  if (loadingBarContainer) {
    loadingBarContainer.classList.add("hidden");
  }
  if (queryInput) queryInput.focus();
}

document.addEventListener('DOMContentLoaded', async () => {
  queryInput = getElement<HTMLTextAreaElement>("query-input");
  submitButton = getElement<HTMLButtonElement>("submit-button");
  summarizePageButton = getElement<HTMLButtonElement>("summarize-page-button");
  answerElement = getElement<HTMLParagraphElement>("answer");
  answerWrapper = getElement<HTMLDivElement>("answerWrapper");
  loadingIndicator = getElement<HTMLDivElement>("loading-indicator");
  copyAnswerButton = getElement<HTMLButtonElement>("copyAnswer");
  timestampElement = getElement<HTMLSpanElement>("timestamp");
  loadingBarContainer = getElement<HTMLDivElement>("loadingContainer");

  if (answerWrapper) answerWrapper.classList.add("hidden");
  if (loadingIndicator) loadingIndicator.classList.add("hidden");

  if (queryInput) {
    queryInput.addEventListener("keyup", () => {
      if (queryInput && submitButton) {
        submitButton.disabled = queryInput.value.trim() === "";
      }
    });

    queryInput.addEventListener("keyup", (event) => {
      if (event.code === "Enter" && !event.shiftKey && submitButton) {
        event.preventDefault();
        submitButton.click();
      }
    });
  }

  if (submitButton) {
    submitButton.addEventListener("click", async () => {
      if (queryInput && submitButton && engine) {
        const message = queryInput.value.trim();
        if (message) {
          console.log("User query:", message);
          chatHistory.push({ role: "user", content: message });
          queryInput.value = "";
          submitButton.disabled = true;
          if (summarizePageButton) summarizePageButton.disabled = true;
          await generateResponse();
        }
      } else {
         console.error("Submit button or query input or engine not ready.");
      }
    });
  }

  if (summarizePageButton) {
    summarizePageButton.addEventListener("click", async () => {
      console.log("Summarize Page button clicked.");
      if (answerElement) answerElement.innerHTML = "";
      if (answerWrapper) answerWrapper.classList.add("hidden");
      if (loadingIndicator) loadingIndicator.classList.remove("hidden");
      if (submitButton) submitButton.disabled = true;
      if (summarizePageButton) summarizePageButton.disabled = true;

      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs[0]?.id) {
          try {
            const contentScriptUrl = chrome.runtime.getURL("content.js");
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              files: ["content.js"],
            });
            console.log("Content script injected. Waiting for content...");
          } catch (e) {
            console.error("Failed to inject content script:", e);
            if (answerElement) updateAnswer("Error: Could not retrieve page content for summarization. Check console for details.");
            if (submitButton) submitButton.disabled = queryInput?.value.trim() === "";
            if (summarizePageButton) summarizePageButton.disabled = false;
          }
        } else {
          if (answerElement) updateAnswer("Error: No active tab found to summarize.");
          if (submitButton) submitButton.disabled = queryInput?.value.trim() === "";
          if (summarizePageButton) summarizePageButton.disabled = false;
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

async function generateResponse() {
  if (!engine) {
      console.error("MLC Engine is not initialized.");
      updateAnswer("Error: AI model not ready. Please try again later.");
      return;
  }
  if (answerElement) answerElement.innerHTML = "";
  if (answerWrapper) answerWrapper.classList.add("hidden");
  if (loadingIndicator) loadingIndicator.classList.remove("hidden");

  if (submitButton) submitButton.disabled = true;
  if (summarizePageButton) summarizePageButton.disabled = true;

  let curMessage = "";
  try {
    const completion = await engine.chat.completions.create({
      stream: true,
      messages: chatHistory,
      temperature: 0.7,
      max_tokens: 512,
    });

    for await (const chunk of completion) {
      const curDelta = chunk.choices[0].delta.content;
      if (curDelta) {
        curMessage += curDelta;
      }
      updateAnswer(curMessage);
    }
    chatHistory.push({ role: "assistant", content: await engine.getMessage() });
  } catch (error) {
    console.error("Error generating response:", error);
    updateAnswer("Error: Could not generate response. Please try again.");
    chatHistory.pop();
  } finally {
    if (submitButton && queryInput) submitButton.disabled = queryInput.value.trim() === "";
    if (summarizePageButton) summarizePageButton.disabled = false;
    if (loadingIndicator) loadingIndicator.classList.add("hidden");
  }
}

chrome.runtime.onMessage.addListener(async (request: any) => {
  if (request.type === "PAGE_CONTENT") {
    const pageContent = request.content;
    if (pageContent && pageContent.length > 50) {
      console.log("Received page content (first 200 chars):", pageContent.substring(0, 200) + "...");
      const summaryPrompt = `Please summarize the following content concisely and accurately, highlighting key points. Focus on the main ideas:\n\n${pageContent}`;
      chatHistory.push({ role: "user", content: summaryPrompt });
      await generateResponse();
    } else {
      updateAnswer("No meaningful content found on this page to summarize, or content was too short.");
      if (submitButton && queryInput) submitButton.disabled = queryInput.value.trim() === "";
      if (summarizePageButton) summarizePageButton.disabled = false;
    }
  }
});


function updateAnswer(answer: string) {
  if (answerWrapper) answerWrapper.classList.remove("hidden");
  if (answerElement) {
    const answerWithBreaks = answer.replace(/\n/g, "<br>");
    answerElement.innerHTML = answerWithBreaks;
  }

  if (copyAnswerButton && currentCopyButtonListener) {
    copyAnswerButton.removeEventListener("click", currentCopyButtonListener);
  }

  const newListener = (e: MouseEvent) => {
    copyToClipboard(answer);
  };

  if (copyAnswerButton) {
    copyAnswerButton.addEventListener("click", newListener);
    currentCopyButtonListener = newListener;
  }

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
  if (loadingIndicator) loadingIndicator.classList.add("hidden");
}

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => console.log("Answer text copied to clipboard"))
    .catch((err) => console.error("Could not copy text: ", err));
}
