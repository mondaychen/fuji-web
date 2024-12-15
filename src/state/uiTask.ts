import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { coreTaskStore } from "./taskCore";
import type { Knowledge } from "../helpers/knowledge";
import { getSimplifiedDom } from "../helpers/simplifyDom";
import buildAnnotatedScreenshots from "../helpers/buildAnnotatedScreenshots";
import { waitTillHTMLRendered } from "../helpers/rpc/utils";
import { fetchKnowledge } from "../helpers/knowledge";
import { findActiveTab } from "../helpers/browserUtils";
import { callRPCWithTab } from "../helpers/rpc/pageRPC";
import { sleep } from "../helpers/utils";
import { useAppState } from "./store";
import type { LabelData } from "../pages/content/drawLabels";

export type UITaskState = {
  actionStatus:
    | "idle"
    | "attaching-debugger"
    | "pulling-dom"
    | "annotating-page"
    | "fetching-knoweldge"
    | "generating-action"
    | "performing-action"
    | "waiting";
  isListening: boolean;
  knowledgeInUse: Knowledge | null;
  labelData?: LabelData[];
  imgData?: string;
};

export type UITaskActions = {
  setActionStatus: (status: UITaskState["actionStatus"]) => void;
  startListening: () => void;
  stopListening: () => void;
  setKnowledge: (knowledge: Knowledge | null) => void;
  prepareLabels: () => Promise<void>;
  showImagePrompt: () => Promise<void>;
  setLabelData: (data: LabelData[]) => void;
  setImgData: (data: string) => void;
};

export const useUITask = create<UITaskState & { actions: UITaskActions }>()(
  immer((set) => ({
    actionStatus: "idle",
    isListening: false,
    knowledgeInUse: null,
    labelData: undefined,
    imgData: undefined,
    actions: {
      setActionStatus: (status) =>
        set((state) => {
          state.actionStatus = status;
        }),
      startListening: () =>
        set((state) => {
          state.isListening = true;
        }),
      stopListening: () =>
        set((state) => {
          state.isListening = false;
        }),
      setKnowledge: (knowledge) =>
        set((state) => {
          state.knowledgeInUse = knowledge;
        }),
      setLabelData: (data) =>
        set((state) => {
          state.labelData = data;
        }),
      setImgData: (data) =>
        set((state) => {
          state.imgData = data;
        }),
      prepareLabels: async () => {
        set((state) => {
          state.actionStatus = "annotating-page";
        });
        try {
          const activeTab = await findActiveTab();
          const tabId = activeTab?.id || -1;
          if (!activeTab || !tabId) {
            throw new Error("No active tab found");
          }
          await waitTillHTMLRendered(tabId);
          const dom = await getSimplifiedDom();
          if (!dom) {
            throw new Error("Could not get DOM");
          }
          const customKnowledgeBase =
            useAppState.getState().settings.customKnowledgeBase;
          const knowledge = await fetchKnowledge(
            new URL(activeTab.url ?? ""),
            customKnowledgeBase,
          );
          await callRPCWithTab(tabId, "drawLabels", [knowledge]);
          await sleep(800);
          await callRPCWithTab(tabId, "removeLabels", []);
        } finally {
          set((state) => {
            state.actionStatus = "idle";
          });
        }
      },
      showImagePrompt: async () => {
        set((state) => {
          state.actionStatus = "pulling-dom";
        });
        try {
          const activeTab = await findActiveTab();
          const tabId = activeTab?.id || -1;
          if (!activeTab || !tabId) {
            throw new Error("No active tab found");
          }
          await waitTillHTMLRendered(tabId);
          const dom = await getSimplifiedDom();
          if (!dom) {
            throw new Error("Could not get DOM");
          }
          const customKnowledgeBase =
            useAppState.getState().settings.customKnowledgeBase;
          const knowledge = await fetchKnowledge(
            new URL(activeTab.url ?? ""),
            customKnowledgeBase,
          );
          const [imgData, labelData] = await buildAnnotatedScreenshots(
            tabId,
            knowledge,
          );
          set((state) => {
            state.imgData = imgData;
            state.labelData = labelData;
          });
          const dataUrl = `data:image/webp;base64,${imgData}`;
          window.open(dataUrl, "_blank");
        } finally {
          set((state) => {
            state.actionStatus = "idle";
          });
        }
      },
    },
  })),
);

// Subscribe to core store changes to update UI state
coreTaskStore.subscribe((state) => {
  if (state.status === "idle") {
    useUITask.setState((state) => {
      state.actionStatus = "idle";
      state.knowledgeInUse = null;
      state.labelData = undefined;
      state.imgData = undefined;
    });
  }
});
