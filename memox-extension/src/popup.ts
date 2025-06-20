"use strict";

import "./popup.css";
import {
  ChatCompletionMessageParam,
  CreateExtensionServiceWorkerMLCEngine,
  MLCEngineInterface,
  InitProgressReport,
} from "@mlc-ai/web-llm";
import { Line } from "progressbar.js";

const MAX_CHAR_LENGTH = 4000;
const MAX_TOKENS = 120;

let summarizePageButton: HTMLButtonElement | null;
let answerElement: HTMLParagraphElement | null;
let answerWrapper: HTMLDivElement | null;
let loadingContainer: HTMLDivElement | null;
let progressBarWrapper: HTMLDivElement | null;
let loadingPercentageElement: HTMLSpanElement | null;
let copyAnswerButton: HTMLButtonElement | null;
let timestampElement: HTMLSpanElement | null;

let engine: MLCEngineInterface | null = null;
const chatHistory: ChatCompletionMessageParam[] = [];
let curMessage = "";
let progressBar: InstanceType<typeof Line> | null = null;

function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

const initProgressCallback = (report: InitProgressReport) => {
  if (progressBar) progressBar.animate(report.progress, { duration: 50 });
  if (loadingPercentageElement)
    loadingPercentageElement.textContent = `${(report.progress * 100).toFixed(0)}%`;
  if (report.progress === 1.0) enableInputs();
};

async function initializeMLCEngine() {
  summarizePageButton?.setAttribute("disabled", "true");
  loadingContainer?.classList.remove("hidden");
  if (progressBarWrapper) {
    progressBar = new Line(progressBarWrapper, {
      strokeWidth: 4,
      color: "#ffd166",
      trailColor: "#eee",
      trailWidth: 1,
      svgStyle: { width: "100%", height: "100%" },
    });
  }
  try {
    engine = await CreateExtensionServiceWorkerMLCEngine(
      "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC",
      { initProgressCallback }
    );
    console.log(" MLC Engine loaded");
  } catch (e) {
    updateAnswer(" Error loading AI model.");
    console.error("Engine init failed:", e);
  } finally {
    enableInputs();
  }
}

function enableInputs() {
  summarizePageButton?.removeAttribute("disabled");
  loadingContainer?.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", async () => {
  summarizePageButton = getElement("summarize-page-button");
  answerElement = getElement("answer");
  answerWrapper = getElement("answerWrapper");
  loadingContainer = getElement("loadingContainer");
  progressBarWrapper = getElement("progressBarWrapper");
  loadingPercentageElement = getElement("loadingPercentage");
  copyAnswerButton = getElement("copyAnswer");
  timestampElement = getElement("timestamp");

  summarizePageButton?.addEventListener("click", async () => {
    answerWrapper?.classList.remove("hidden");
    updateAnswer("Summarizing...");
    summarizePageButton?.setAttribute("disabled", "true");
    loadingContainer?.classList.remove("hidden");

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]?.id) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ["content.js"],
          });
        } catch (e) {
          updateAnswer(" Script injection failed.");
          console.error(e);
          enableInputs();
        }
      }
    });
  });

  copyAnswerButton?.addEventListener("click", () => {
    if (answerElement) navigator.clipboard.writeText(answerElement.innerText);
  });

  await initializeMLCEngine();
});

chrome.runtime.onMessage.addListener(async (request) => {
  if (request.type !== "PAGE_CONTENT") return;

  let pageContent = request.content;
  if (pageContent.length > MAX_CHAR_LENGTH) {
    pageContent = pageContent.slice(0, MAX_CHAR_LENGTH);
  }

  if (pageContent.length < 50) {
    updateAnswer("Too little content to summarize.");
    enableInputs();
    return;
  }

  const summaryPrompt = `Summarize the following content in 5-6 clear bullet points. End with "✅ Summarization completed." \n\n${pageContent}`;
  chatHistory.push({ role: "user", content: summaryPrompt });

  curMessage = "";
  try {
    const completion = await engine!.chat.completions.create({
      stream: true,
      messages: chatHistory,
      temperature: 0.7,
      max_tokens: MAX_TOKENS,
    });

    for await (const chunk of completion) {
      const delta = chunk.choices[0].delta.content;
      if (delta) {
        curMessage += delta;
        updateAnswer(curMessage);
      }
    }

    chatHistory.push({ role: "assistant", content: curMessage });
    chrome.storage.local.get(["token"], (result) => {
      const token = result.token;
      if (!token) return;

      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        if (!tab?.url || !tab?.title) return;

        const payload = {
          token,
          url: tab.url,
          title: tab.title,
          body: pageContent,
          summary: curMessage,
        };

        try {
          const res = await fetch("http://127.0.0.1:5001/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          console.log(" Synced to backend:", await res.json());
        } catch (err) {
          console.error("Backend sync failed:", err);
        }
      });
    });
  } catch (err) {
    updateAnswer(" Summarization failed.");
    console.error(err);
  } finally {
    enableInputs();
  }
});

function updateAnswer(text: string) {
  if (answerElement) answerElement.innerHTML = text.replace(/\n/g, "<br>");
  if (timestampElement) {
    const now = new Date();
    timestampElement.innerText = now.toLocaleString("en-US", {
      month: "short", day: "2-digit", hour: "2-digit",
      minute: "2-digit", second: "2-digit",
    });
  }
  loadingContainer?.classList.add("hidden");
}
