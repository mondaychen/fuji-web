import { coreTaskStore } from "./taskCore";
import type { TaskHistoryEntry } from "./currentTask";

/**
 * Task API for programmatic task execution without UI dependencies
 */
export const taskApi = {
  /**
   * Run a task with the given instructions
   * @param instructions The task instructions to execute
   * @param onError Optional error callback
   */
  runTask: async (instructions: string, onError?: (error: string) => void) => {
    return coreTaskStore.getState().actions.runTask(instructions, onError);
  },

  /**
   * Get the current task status
   */
  getTaskStatus: () => {
    return coreTaskStore.getState().status;
  },

  /**
   * Get the current task history
   */
  getTaskHistory: () => {
    return coreTaskStore.getState().history;
  },

  /**
   * Interrupt the current task
   */
  interrupt: () => {
    return coreTaskStore.getState().actions.interrupt();
  },

  /**
   * Attach the debugger to a specific tab
   * @param tabId Optional tab ID to attach to
   */
  attachDebugger: async (tabId?: number) => {
    return coreTaskStore.getState().actions.attachDebugger(tabId);
  },

  /**
   * Detach the debugger
   */
  detachDebugger: async () => {
    return coreTaskStore.getState().actions.detachDebugger();
  },

  /**
   * Subscribe to task status changes
   * @param callback Callback function receiving the new status
   * @returns Unsubscribe function
   */
  subscribeToStatus: (callback: (status: string) => void) => {
    return coreTaskStore.subscribe((state) => callback(state.status));
  },

  /**
   * Subscribe to task history changes
   * @param callback Callback function receiving the new history
   * @returns Unsubscribe function
   */
  subscribeToHistory: (callback: (history: TaskHistoryEntry[]) => void) => {
    return coreTaskStore.subscribe((state) => callback(state.history));
  },

  /**
   * Get the current tab ID
   */
  getTabId: () => {
    return coreTaskStore.getState().tabId;
  },
};
