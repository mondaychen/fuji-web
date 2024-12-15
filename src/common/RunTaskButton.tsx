import { Button, HStack, Icon } from "@chakra-ui/react";
import React from "react";
import { BsPlayFill, BsStopFill } from "react-icons/bs";
import { useCoreTaskStore } from "../state/hooks";
import { useAppState } from "../state/store";

export default function RunTaskButton(props: { runTask: () => void }) {
  const { status: taskState } = useCoreTaskStore();
  const { instructions } = useAppState((state) => ({
    instructions: state.ui.instructions,
  }));

  let button = (
    <Button
      rightIcon={<Icon as={BsPlayFill} boxSize={6} />}
      onClick={props.runTask}
      colorScheme="green"
      disabled={taskState === "running" || !instructions}
    >
      Start Task
    </Button>
  );

  if (taskState === "running") {
    button = (
      <Button
        rightIcon={<Icon as={BsStopFill} boxSize={6} />}
        onClick={() => useCoreTaskStore.getState().actions.interrupt()}
        colorScheme="red"
      >
        Stop
      </Button>
    );
  }

  return <HStack alignItems="center">{button}</HStack>;
}
