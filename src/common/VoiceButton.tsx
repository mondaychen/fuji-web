import { useEffect, useCallback } from "react";
import { Button, HStack, Icon } from "@chakra-ui/react";
import { BsPlayFill, BsStopFill } from "react-icons/bs";
import { useUITask } from "../state/uiTask";

export default function VoiceButton({
  taskInProgress,
  onStopSpeaking,
}: {
  taskInProgress: boolean;
  onStopSpeaking: () => void;
}) {
  const { isListening, actions } = useUITask();
  const { startListening, stopListening } = actions;

  const toggleVoiceControl = useCallback(() => {
    if (!taskInProgress) {
      if (!isListening) {
        startListening();
      } else {
        stopListening();
        onStopSpeaking();
      }
    }
  }, [
    isListening,
    startListening,
    stopListening,
    taskInProgress,
    onStopSpeaking,
  ]);

  useEffect(() => {
    if (!taskInProgress) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.code === "Space") {
          event.preventDefault();
          toggleVoiceControl();
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [taskInProgress, toggleVoiceControl]);

  const button = (
    <Button
      rightIcon={
        <Icon as={isListening ? BsStopFill : BsPlayFill} boxSize={6} />
      }
      onClick={toggleVoiceControl}
      colorScheme={isListening ? "red" : "blue"}
      isDisabled={taskInProgress}
    >
      {isListening ? "Stop" : "Start"} Speaking
    </Button>
  );

  return <HStack alignItems="center">{button}</HStack>;
}
