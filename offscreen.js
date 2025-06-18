
import { CreateMLCEngine } from '@mlc-ai/web-llm';

class LLMWorker {
  constructor() {
    this.engine = null;
    this.modelId = "gemma-2b-it-q4f16_1-MLC";

    console.log("[Offscreen LLMWorker] Constructor - modelId:", this.modelId);
  }

  async init() {
    if (this.engine) {
      console.log("[Offscreen LLMWorker] LLM engine already initialized.");
      return;
    }

    try {
      console.log(`[Offscreen LLMWorker] Attempting to load LLM model: ${this.modelId}...`);

      const engineOptions = {
          initProgressCallback: (report) => {
              console.log("[Offscreen LLMWorker] LLM Loading Progress:", report.text);
              chrome.runtime.sendMessage({ type: 'LLM_PROGRESS', data: report.text });
          },
          model_list: [
              {
                  "model_url": "https://huggingface.co/mlc-ai/gemma-2b-it-q4f16_1-MLC/resolve/main/",
                  "model_path": "gemma-2b-it-q4f16_1-MLC",
                  "model_id": this.modelId,
                  "model_lib_url": "https://huggingface.co/mlc-ai/gemma-2b-it-q4f16_1-MLC/resolve/main/gemma-2b-it-q4f16_1-MLC.wasm",
                  "vram_required_mb": 500
              }
          ],
          "mean_gen_len": 128,
          "max_gen_len": 256,
          "debug": true,
          "mode": "auto",
          "tokenizer_files": ["tokenizer.json", "tokenizer.model"]
      };

      this.engine = await CreateMLCEngine(this.modelId, engineOptions);

      console.log("[Offscreen LLMWorker] LLM model loaded successfully!");
      chrome.runtime.sendMessage({ type: 'LLM_STATUS', data: 'loaded' });

    } catch (error) {
      console.error("[Offscreen LLMWorker] Failed to load LLM model:", error);
      this.engine = null;
      chrome.runtime.sendMessage({ type: 'LLM_STATUS', data: 'failed', error: error.message });
      throw new Error("LLM initialization failed: " + error.message);
    }
  }

  async summarize(text) {
    if (!this.engine) {
      throw new Error("LLM engine not initialized. Call init() first.");
    }

    const prompt = `Summarize the following text concisely, focusing on the main points. Keep the summary to a maximum of 3-5 sentences.

    Text: """
    ${text}
    """

    Summary:`;

    const messages = [
        { role: "user", content: prompt }
    ];

    try {
      const completion = await this.engine.chat.completions.create({
        messages: messages,
        max_gen_len: 256,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      });
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error("[Offscreen LLMWorker] LLM summarization error:", error);
      throw new Error("LLM failed to generate summary: " + error.message);
    }
  }

  async terminate() {
    if (this.engine) {
      await this.engine.terminate();
      this.engine = null;
      console.log("[Offscreen LLMWorker] LLM engine terminated.");
    }
  }
}

const llmWorker = new LLMWorker();
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'INIT_LLM') {
    try {
      await llmWorker.init();
      sendResponse({ status: 'success' });
    } catch (error) {
      sendResponse({ status: 'error', message: error.message });
    }
    return true;
  } else if (message.type === 'SUMMARIZE_TEXT') {
    try {
      const summary = await llmWorker.summarize(message.text);
      sendResponse({ status: 'success', summary });
    } catch (error) {
      sendResponse({ status: 'error', message: error.message });
    }
    return true;
  } else if (message.type === 'TERMINATE_LLM') {
    try {
      await llmWorker.terminate();
      sendResponse({ status: 'success' });
    } catch (error) {
      sendResponse({ status: 'error', message: error.message });
    }
    return true;
  }
});