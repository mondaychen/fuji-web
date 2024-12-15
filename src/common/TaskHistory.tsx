import { useState } from "react";
import {
  Alert,
  AlertIcon,
  AlertDescription,
  VStack,
  HStack,
  Box,
  Accordion,
  AccordionItem,
  Heading,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Icon,
  Spacer,
  ColorProps,
  BackgroundProps,
} from "@chakra-ui/react";
import { BsSortNumericDown, BsSortNumericUp } from "react-icons/bs";
import { useCoreTaskStore } from "../state/hooks";
import { useUITask } from "../state/uiTask";
import CopyButton from "./CopyButton";
import Notes from "./CustomKnowledgeBase/Notes";
import type { TaskHistoryEntry } from "../state/taskCore";

function MatchedNotes() {
  const { knowledgeInUse } = useUITask();
  const notes = knowledgeInUse?.notes;
  if (!notes || notes.length === 0) {
    return null;
  }

  return (
    <AccordionItem>
      <Heading as="h3" size="sm">
        <AccordionButton>
          <Box mr="4" fontWeight="bold">
            0.
          </Box>
          <Box as="span" textAlign="left" flex="1">
            Found {notes.length} instructions.
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </Heading>
      <AccordionPanel backgroundColor="gray.100" p="2">
        <Accordion allowMultiple w="full" defaultIndex={1}>
          <Box pl={2}>
            <Notes notes={notes} />
          </Box>
          <Alert status="info" borderRadius="sm" mt="1">
            <AlertIcon />
            <AlertDescription fontSize="0.8rem" lineHeight="4">
              You can customize instructions in the settings menu.
            </AlertDescription>
          </Alert>
        </Accordion>
      </AccordionPanel>
    </AccordionItem>
  );
}

type TaskHistoryItemProps = {
  index: number;
  entry: TaskHistoryEntry;
};

const CollapsibleComponent = (props: {
  title: string;
  subtitle?: string;
  text: string;
}) => (
  <AccordionItem backgroundColor="white">
    <Heading as="h4" size="xs">
      <AccordionButton>
        <HStack flex="1">
          <Box>{props.title}</Box>
          <CopyButton text={props.text} /> <Spacer />
          {props.subtitle && (
            <Box as="span" fontSize="xs" color="gray.500" mr={4}>
              {props.subtitle}
            </Box>
          )}
        </HStack>
        <AccordionIcon />
      </AccordionButton>
    </Heading>
    <AccordionPanel>
      {props.text.split("\n").map((line, index) => (
        <Box key={index} fontSize="xs">
          {line}
          <br />
        </Box>
      ))}
    </AccordionPanel>
  </AccordionItem>
);

const TaskHistoryItem = ({ index, entry }: TaskHistoryItemProps) => {
  const itemTitle = entry.action.thought;

  const colors: {
    text: ColorProps["textColor"];
    bg: BackgroundProps["bgColor"];
  } = {
    text: undefined,
    bg: undefined,
  };
  if (entry.action.operation.name === "fail") {
    colors.text = "red.800";
    colors.bg = "red.100";
  } else if (entry.action.operation.name === "finish") {
    colors.text = "green.800";
    colors.bg = "green.100";
  }

  return (
    <AccordionItem>
      <Heading as="h3" size="sm" textColor={colors.text} bgColor={colors.bg}>
        <AccordionButton>
          <Box mr="4" fontWeight="bold">
            {index + 1}.
          </Box>
          <Box as="span" textAlign="left" flex="1">
            {itemTitle}
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </Heading>
      <AccordionPanel backgroundColor="gray.100" p="2">
        <Accordion allowMultiple w="full" defaultIndex={1}>
          {entry.usage != null && (
            <>
              <CollapsibleComponent
                title="Prompt"
                subtitle={`${entry.usage.prompt_tokens} tokens`}
                text={entry.prompt}
              />
              <CollapsibleComponent
                title="Response"
                subtitle={`${entry.usage.completion_tokens} tokens`}
                text={entry.response}
              />
              <CollapsibleComponent
                title="Action"
                text={JSON.stringify(entry.action, null, 2)}
              />
            </>
          )}
        </Accordion>
      </AccordionPanel>
    </AccordionItem>
  );
};

interface TaskHistoryProps {
  history: TaskHistoryEntry[];
}

export default function TaskHistory({ history }: TaskHistoryProps) {
  const { status: taskStatus } = useCoreTaskStore();
  const [sortNumericDown, setSortNumericDown] = useState(false);
  const toggleSort = () => {
    setSortNumericDown(!sortNumericDown);
  };

  if (history.length === 0 && taskStatus !== "running") return null;
  const historyItems = history.map((entry: TaskHistoryEntry, index: number) => (
    <TaskHistoryItem key={index} index={index} entry={entry} />
  ));
  historyItems.unshift(<MatchedNotes key="matched-notes" />);
  if (!sortNumericDown) {
    historyItems.reverse();
  }

  return (
    <VStack mt={8}>
      <HStack w="full">
        <Heading as="h3" size="md">
          Action History
        </Heading>
        <Spacer />
        <Icon
          as={sortNumericDown ? BsSortNumericDown : BsSortNumericUp}
          cursor="pointer"
          color="gray.500"
          _hover={{ color: "gray.700" }}
          onClick={toggleSort}
        />
        <CopyButton text={JSON.stringify(history, null, 2)} />
      </HStack>
      <Accordion allowMultiple w="full" pb="4">
        {historyItems}
      </Accordion>
    </VStack>
  );
}
