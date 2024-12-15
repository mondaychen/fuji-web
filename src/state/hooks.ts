import { create } from "zustand";
import { coreTaskStore } from "./taskCore";
import type { CoreTaskState, CoreTaskActions } from "./taskCore";

// Create a React hook for the core task store
export const useCoreTaskStore = create<
  CoreTaskState & { actions: CoreTaskActions }
>(() => ({
  ...coreTaskStore.getState(),
}));

// Subscribe to changes
coreTaskStore.subscribe((state) => {
  useCoreTaskStore.setState(state);
});
