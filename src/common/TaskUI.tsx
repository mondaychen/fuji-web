import React, { useCallback } from "react";
import {
  Button,
  Box,
  HStack,
  Spacer,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
} from "@chakra-ui/react";
import { debugMode } from "../constants";
import { useAppState } from "../state/store";
import { useUITask } from "../state/uiTask";
import { useCoreTaskStore } from "../state/hooks";
import RunTaskButton from "./RunTaskButton";
import VoiceButton from "./VoiceButton";
import TaskHistory from "./TaskHistory";
import TaskStatus from "./TaskStatus";
import RecommendedTasks from "./RecommendedTasks";
import AutosizeTextarea from "./AutosizeTextarea";

const injectContentScript = async () => {
  const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
  if (!tab || !tab.id) {
    return;
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/pages/contentInjected/index.js"],
    world: "MAIN",
  });
};

function ActionExecutor() {
  const { actions: coreActions } = useCoreTaskStore();
  const { actions: uiActions } = useUITask();

  const handleAttachDebugger = useCallback(async () => {
    await coreActions.attachDebugger();
  }, [coreActions]);

  return (
    <Box mt={4}>
      <HStack
        columnGap="0.5rem"
        rowGap="0.5rem"
        fontSize="md"
        borderTop="1px dashed gray"
        py="3"
        shouldWrapChildren
        wrap="wrap"
      >
        <Button onClick={handleAttachDebugger}>Attach</Button>
        <Button onClick={() => uiActions.prepareLabels()}>Prepare</Button>
        <Button onClick={() => uiActions.showImagePrompt()}>Show Image</Button>
        <Button onClick={injectContentScript}>Inject</Button>
      </HStack>
    </Box>
  );
}

const TaskUI = () => {
  const uiState = useAppState((state) => ({
    instructions: state.ui.instructions,
    setInstructions: state.ui.actions.setInstructions,
    voiceMode: state.settings.voiceMode,
  }));

  const {
    status: taskStatus,
    history: taskHistory,
    actions: taskActions,
  } = useCoreTaskStore();
  const { isListening } = useUITask();

  const taskInProgress = taskStatus === "running";

  const toast = useToast();

  const toastError = useCallback(
    (message: string) => {
      toast({
        title: "Error",
        description: message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    },
    [toast],
  );

  const runTask = useCallback(() => {
    if (uiState.instructions) {
      taskActions.runTask(uiState.instructions, toastError);
    }
  }, [uiState.instructions, taskActions, toastError]);

  const runTaskWithNewInstructions = (newInstructions: string = "") => {
    if (!newInstructions) {
      return;
    }
    uiState.setInstructions(newInstructions);
    taskActions.runTask(newInstructions, toastError);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      runTask();
    }
  };

  return (
    <>
      <AutosizeTextarea
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        placeholder="Try telling Fuji to do a task"
        value={uiState.instructions || ""}
        isDisabled={taskInProgress || isListening}
        onChange={(e) => uiState.setInstructions(e.target.value)}
        mb={2}
        onKeyDown={onKeyDown}
      />
      <HStack mt={2} mb={2}>
        <RunTaskButton runTask={runTask} />
        {uiState.voiceMode && (
          <VoiceButton
            taskInProgress={taskInProgress}
            onStopSpeaking={runTask}
          />
        )}
        <Spacer />
      </HStack>
      {uiState.voiceMode && (
        <Alert status="info" borderRadius="lg">
          <AlertIcon />
          <AlertDescription fontSize="sm" lineHeight="5">
            In Voice Mode, you can press Space to start speaking and Space again
            to stop. Fuji will run the task when you stop speaking. To turn off
            Voice Mode, click the Setting icon in the top right corner.
          </AlertDescription>
        </Alert>
      )}
      {!uiState.voiceMode && !uiState.instructions && (
        <RecommendedTasks runTask={runTaskWithNewInstructions} />
      )}
      {debugMode && <ActionExecutor />}
      <TaskStatus />
      <TaskHistory history={taskHistory} />
    </>
  );
};

export default TaskUI;
