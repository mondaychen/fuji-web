import { StateCreator } from "zustand";
import { coreTaskStore } from "./taskCore";
import { useUITask } from "./uiTask";
import type { StoreType } from "./store";
import type { Knowledge } from "../helpers/knowledge";
import type { Action } from "../helpers/vision-agent/parseResponse";
import type OpenAI from "openai";
import { voiceControl } from "../helpers/voiceControl";
import { isValidModelSettings } from "../helpers/aiSdkUtils";
import { findActiveTab } from "../helpers/browserUtils";
import { fetchKnowledge } from "../helpers/knowledge";
import buildAnnotatedScreenshots from "../helpers/buildAnnotatedScreenshots";
import { callRPCWithTab } from "../helpers/rpc/pageRPC";
import { sleep } from "../helpers/utils";
import { parseResponse } from "../helpers/vision-agent/parseResponse";
import { operateTool } from "../helpers/rpc/performAction";

export interface TaskHistoryEntry {
  prompt: string;
  rawResponse: string;
  action: Action;
  usage?: OpenAI.CompletionUsage;
}

export interface CurrentTaskSlice {
  currentTask: {
    tabId: number;
    isListening: boolean;
    history: TaskHistoryEntry[];
    status: "idle" | "running" | "success" | "error" | "interrupted";
    actionStatus:
      | "idle"
      | "attaching-debugger"
      | "pulling-dom"
      | "annotating-page"
      | "fetching-knoweldge"
      | "generating-action"
      | "performing-action"
      | "waiting";
    knowledgeInUse: Knowledge | null;
    actions: {
      runTask: (onError?: (error: string) => void) => Promise<void>;
      interrupt: () => void;
      attachDebugger: (tabId?: number) => Promise<void>;
      detachDebugger: () => Promise<void>;
      showImagePrompt: () => Promise<void>;
      prepareLabels: () => Promise<void>;
      performActionString: (actionString: string) => Promise<void>;
      startListening: () => void;
      stopListening: () => void;
      setKnowledge: (knowledge: Knowledge | null) => void;
    };
  };
}

export const createCurrentTaskSlice: StateCreator<
  StoreType,
  [],
  [],
  CurrentTaskSlice
> = (set, get) => {
  // Subscribe to core store changes
  coreTaskStore.subscribe((coreState) => {
    set((state: StoreType) => ({
      currentTask: {
        ...state.currentTask,
        status: coreState.status,
        history: coreState.history,
        tabId: coreState.tabId,
      },
    }));
  });

  // Subscribe to UI store changes
  useUITask.subscribe((uiState) => {
    set((state: StoreType) => ({
      currentTask: {
        ...state.currentTask,
        actionStatus: uiState.actionStatus,
        isListening: uiState.isListening,
        knowledgeInUse: uiState.knowledgeInUse,
      },
    }));
  });

  return {
    currentTask: {
      tabId: coreTaskStore.getState().tabId,
      isListening: false,
      history: [],
      status: "idle",
      actionStatus: "idle",
      knowledgeInUse: null,
      actions: {
        runTask: async (onError) => {
          const voiceMode = get().settings.voiceMode;
          const instructions = get().ui.instructions;

          if (!instructions) return;

          // Validate model settings
          if (
            !isValidModelSettings(
              get().settings.selectedModel,
              get().settings.agentMode,
              get().settings.openAIKey,
              get().settings.anthropicKey,
              get().settings.geminiKey,
            )
          ) {
            const error =
              "The current model settings are not valid. Please verify your API keys, and note that some models are not compatible with certain agent modes.";
            onError?.(error);
            return;
          }

          // Handle voice mode
          if (voiceMode && instructions) {
            voiceControl.speak(
              "The current task is to " + instructions,
              onError || console.error,
            );
          }

          // Run the task using core store
          await coreTaskStore.getState().actions.runTask(instructions, onError);
        },
        interrupt: () => {
          coreTaskStore.getState().actions.interrupt();
        },
        attachDebugger: async (tabId) => {
          await coreTaskStore.getState().actions.attachDebugger(tabId);
        },
        detachDebugger: async () => {
          await coreTaskStore.getState().actions.detachDebugger();
        },
        showImagePrompt: async () => {
          const activeTab = await findActiveTab();
          const tabId = activeTab?.id || -1;
          if (!activeTab || !tabId) {
            throw new Error("No active tab found");
          }
          const customKnowledgeBase = get().settings.customKnowledgeBase;
          const knowledge = await fetchKnowledge(
            new URL(activeTab.url ?? ""),
            customKnowledgeBase,
          );
          const [imgData, labelData] = await buildAnnotatedScreenshots(
            tabId,
            knowledge,
          );
          console.log(labelData);
          openBase64InNewTab(imgData, "image/webp");
        },
        prepareLabels: async () => {
          const activeTab = await findActiveTab();
          const tabId = activeTab?.id || -1;
          if (!activeTab || !tabId) {
            throw new Error("No active tab found");
          }
          const customKnowledgeBase = get().settings.customKnowledgeBase;
          const knowledge = await fetchKnowledge(
            new URL(activeTab.url ?? ""),
            customKnowledgeBase,
          );
          await callRPCWithTab(tabId, "drawLabels", [knowledge]);
          await sleep(800);
          await callRPCWithTab(tabId, "removeLabels", []);
        },
        performActionString: async (actionString: string) => {
          const parsedResponse = parseResponse(actionString);
          if (
            parsedResponse.operation.name === "finish" ||
            parsedResponse.operation.name === "fail"
          ) {
            return;
          }
          await operateTool(
            get().currentTask.currentTask.tabId,
            parsedResponse.operation,
          );
        },
        startListening: () => {
          useUITask.getState().actions.startListening();
          voiceControl.startListening();
        },
        stopListening: () => {
          useUITask.getState().actions.stopListening();
          voiceControl.stopListening();
        },
        setKnowledge: (knowledge) => {
          useUITask.getState().actions.setKnowledge(knowledge);
        },
      },
    },
  };
};

function openBase64InNewTab(base64Data: string, contentType: string) {
  // Remove the prefix (e.g., "data:image/png;base64,") from the base64 data
  const base64 = base64Data.split(";base64,").pop();
  if (!base64) {
    console.error("Invalid base64 data");
    return;
  }

  // Convert base64 to a Blob
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: contentType });

  // Create a URL for the Blob and open it in a new tab
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");
}
