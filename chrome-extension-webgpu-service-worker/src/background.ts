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
});
