import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { determineNextAction } from "../helpers/dom-agent/determineNextAction";
import { determineNavigateAction } from "../helpers/vision-agent/determineNavigateAction";
import { truthyFilter } from "../helpers/utils";
import { operateTool } from "../helpers/index";
import type { Action } from "../helpers/vision-agent/parseResponse";
import type OpenAI from "openai";
import { getSimplifiedDom } from "../helpers/simplifyDom";
import { waitTillHTMLRendered } from "../helpers/rpc/utils";
import {
  disableIncompatibleExtensions,
  reenableExtensions,
} from "../helpers/disableExtensions";

export type TaskHistoryEntry = {
  prompt: string;
  rawResponse: string;
  action: Action;
  usage?: OpenAI.CompletionUsage;
};

export type CoreTaskState = {
  status: "idle" | "running" | "success" | "error" | "interrupted";
  tabId: number;
  history: TaskHistoryEntry[];
};

export type CoreTaskActions = {
  runTask: (
    instructions: string,
    onError?: (error: string) => void,
  ) => Promise<void>;
  interrupt: () => void;
  attachDebugger: (tabId?: number) => Promise<void>;
  detachDebugger: () => Promise<void>;
};

type StoreState = CoreTaskState & { actions: CoreTaskActions };

export const createCoreTaskStore = () => {
  const store = createStore<StoreState>()(
    immer((set, get) => ({
      status: "idle",
      tabId: -1,
      history: [],
      actions: {
        runTask: async (instructions, onError) => {
          if (!instructions || get().status === "running") return;

          set((state) => {
            state.history = [];
            state.status = "running";
          });

          try {
            await disableIncompatibleExtensions();
            const wasStopped = () => get().status !== "running";

            // Attach debugger if needed
            if (get().tabId === -1) {
              const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (!tab?.id) {
                throw new Error("No active tab found");
              }
              await get().actions.attachDebugger(tab.id);
            }

            // Main task execution loop
            while (!wasStopped()) {
              // Get previous actions for context
              const previousActions = get()
                .history.map((entry) => entry.action)
                .filter(truthyFilter);

              // Get current tab info
              const [activeTab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (!activeTab?.url) {
                throw new Error("No active tab URL found");
              }

              // Handle chrome:// pages
              if (activeTab.url.startsWith("chrome")) {
                const query = await determineNavigateAction(instructions);
                if (!query) break;

                set((state) => {
                  state.history.push({
                    prompt: query.prompt,
                    rawResponse: query.rawResponse,
                    action: query.action,
                    usage: query.usage,
                  });
                });

                if (wasStopped()) break;

                if (query.action?.operation) {
                  await operateTool(get().tabId, query.action.operation);
                  continue;
                }
                break;
              }

              await waitTillHTMLRendered(get().tabId);

              // Get simplified DOM for non-chrome pages
              const pageDOM = await getSimplifiedDom();
              if (!pageDOM) {
                set((state) => {
                  state.status = "error";
                });
                break;
              }

              if (wasStopped()) break;

              // Determine next action
              const query = await determineNextAction(
                instructions,
                previousActions,
                pageDOM.outerHTML,
                3,
                onError,
              );

              if (!query) break;

              // Add to history
              set((state) => {
                state.history.push({
                  prompt: query.prompt,
                  rawResponse: query.rawResponse,
                  action: query.action,
                  usage: query.usage,
                });
              });

              if (wasStopped()) break;

              // Execute the determined action
              if (query.action?.operation) {
                await operateTool(get().tabId, query.action.operation);
              }

              // Break if we've hit the action limit
              if (get().history.length >= 50) {
                break;
              }
            }

            // Set success status if not interrupted
            if (get().status === "running") {
              set((state) => {
                state.status = "success";
              });
            }
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            onError?.(errorMessage);
            set((state) => {
              state.status = "error";
            });
          } finally {
            await chrome.debugger.detach({ tabId: get().tabId });
            await reenableExtensions();
          }
        },

        interrupt: () => {
          set((state) => {
            state.status = "interrupted";
          });
        },

        attachDebugger: async (tabId?: number) => {
          if (!tabId) {
            const [tab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (!tab?.id) throw new Error("No active tab found");
            tabId = tab.id;
          }

          try {
            await chrome.debugger.attach({ tabId }, "1.3");
            set((state) => {
              state.tabId = tabId!;
            });
          } catch (e) {
            if (e instanceof Error && e.message.includes("Already attached")) {
              await chrome.debugger.detach({ tabId });
              await chrome.debugger.attach({ tabId }, "1.3");
              set((state) => {
                state.tabId = tabId!;
              });
            } else {
              throw e;
            }
          }
        },

        detachDebugger: async () => {
          const tabId = get().tabId;
          if (tabId !== -1) {
            await chrome.debugger.detach({ tabId });
            set((state) => {
              state.tabId = -1;
            });
          }
        },
      },
    })),
  );

  return store;
};

export const coreTaskStore = createCoreTaskStore();
