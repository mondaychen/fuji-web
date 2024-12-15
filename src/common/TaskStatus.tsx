import React from "react";
import { Box } from "@chakra-ui/react";
import { useCoreTaskStore } from "../state/hooks";
import { useUITask } from "../state/uiTask";

export default function TaskStatus() {
  const { status: taskStatus } = useCoreTaskStore();
  const { actionStatus } = useUITask();

  if (taskStatus !== "running") {
    return null;
  }

  const displayedStatus: Record<typeof actionStatus, string> = {
    idle: "💤 Idle",
    "attaching-debugger": "🔗 Attaching Debugger",
    "pulling-dom": "🌐 Understanding Website",
    "annotating-page": "🌐 Understanding Website",
    "fetching-knoweldge": "🧠 Getting Instructions",
    "generating-action": "🤔 Thinking and planning",
    "performing-action": "🚀 Performing Action",
    waiting: "⏳ Waiting",
  };

  return (
    <Box textColor="gray.500" textAlign="center" mt={4} mb={-4} fontSize="sm">
      {displayedStatus[actionStatus]}
    </Box>
  );
}
