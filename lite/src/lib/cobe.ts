import type { Criterion as RubricCriterion, Exam, Section } from "./types";
import { uid } from "./id";

/**
 * COBE structure defaults.
 *
 * Based on publicly available Ministry of Education material (COBE guidelines and the
 * 2025–2026 Table of Specifications as summarised in public sources). The official
 * תשפ"ז documents could not be fetched from this build environment, so every value
 * here is an editable default — never a hard-coded rule. See docs/RESEARCH.md.
 *
 * All prompt texts below are original sample content written for this app.
 */

export const COBE_DEFAULTS = {
  totalTimeLimitSec: 30 * 60,
  partA: { points: 25, prepTimeSec: 30, maxRecordSec: 150 },
  partB: { points: 25, prepTimeSec: 30, maxRecordSec: 150 },
  partC: { points: 25, prepTimeSec: 30, maxRecordSec: 120 },
};

export interface TemplateQuestion {
  title: string;
  prompt: string;
  subQuestions: string[];
  instructions?: string;
  prepTimeSec: number;
  maxRecordSec: number;
  points: number;
  allowReRecord: boolean;
  maxRecordings: number | null;
}
export interface TemplateSection {
  title: string;
  instructions: string;
  kind: "PERSONAL_RESPONSE" | "PROJECT" | "AUDIO_VISUAL" | "GENERAL";
  choiceMode: "ALL" | "CHOOSE_ONE";
  questions: TemplateQuestion[];
}

export function cobeSimulationTemplate(): TemplateSection[] {
  const rr = { allowReRecord: true, maxRecordings: 3 };
  return [
    {
      title: "Part A – Personal Response",
      kind: "PERSONAL_RESPONSE",
      choiceMode: "CHOOSE_ONE",
      instructions:
        "Choose ONE of the two topics. Listen to the questions and answer all of them in one continuous recording. Give reasons and examples.",
      questions: [
        {
          title: "Topic 1",
          prompt: "Let's talk about the way you spend your free time.",
          subQuestions: [
            "What do you usually like to do in your free time? Why?",
            "Describe a time when a hobby or activity helped you deal with a difficult situation.",
            "Do you think teenagers today have enough free time? Explain your opinion.",
          ],
          ...COBE_DEFAULTS.partA,
          ...rr,
        },
        {
          title: "Topic 2",
          prompt: "Let's talk about learning outside the classroom.",
          subQuestions: [
            "What is something important you have learned outside of school?",
            "Who or what helped you learn it? Describe the experience.",
            "Should schools give students more opportunities to learn outside the classroom? Why or why not?",
          ],
          ...COBE_DEFAULTS.partA,
          ...rr,
        },
      ],
    },
    {
      title: "Part B – Project",
      kind: "PROJECT",
      choiceMode: "ALL",
      instructions:
        "Answer the questions about the project you prepared this year in one continuous recording. Be specific about what you did and what you learned.",
      questions: [
        {
          title: "Project questions",
          prompt: "Tell us about your project.",
          subQuestions: [
            "What was the topic of your project and why did you choose it?",
            "Describe one challenge you faced while working on the project and how you dealt with it.",
            "What is the most important thing you learned from doing the project?",
          ],
          ...COBE_DEFAULTS.partB,
          ...rr,
        },
      ],
    },
    {
      title: "Part C – Audio-Visual Prompt",
      kind: "AUDIO_VISUAL",
      choiceMode: "ALL",
      instructions:
        "Watch the clip. You may watch it again if time allows. Then answer each question set in a separate recording. Each question set is answered in one continuous recording.",
      questions: [
        {
          title: "Question set 1",
          prompt: "Answer the following questions about the clip.",
          subQuestions: [
            "What is the main idea of the clip?",
            "Which detail from the clip did you find most surprising? Why?",
          ],
          ...COBE_DEFAULTS.partC,
          ...rr,
        },
        {
          title: "Question set 2",
          prompt: "Now relate the clip to your own life and opinions.",
          subQuestions: [
            "Do you agree with the message of the clip? Explain.",
            "How could the ideas in the clip be relevant to people your age?",
          ],
          ...COBE_DEFAULTS.partC,
          ...rr,
        },
      ],
    },
  ];
}

/**
 * Default analytic rubric. Criteria names follow the categories used in the public COBE
 * rubrics (topic development, delivery, vocabulary, language); the weights are editable
 * defaults that MUST be checked against the current official rubric before use for grading.
 * Descriptors are original paraphrases, not official text.
 */
export function defaultCobeRubric(): RubricCriterion[] {
  const bands = (top: string, good: string, partial: string, weak: string) => [
    { label: "מצוין", min: 76, max: 100, descriptor: top },
    { label: "טוב", min: 51, max: 75, descriptor: good },
    { label: "חלקי", min: 26, max: 50, descriptor: partial },
    { label: "חלש", min: 0, max: 25, descriptor: weak },
  ];
  return [
    {
      key: "topic",
      label: "Topic Development",
      weight: 50,
      description: "Relevance to the questions, depth, organisation, supporting reasons and examples.",
      bands: bands(
        "Answers all questions fully and in depth; ideas are well organised and supported with relevant details and examples.",
        "Answers the questions with some development; some ideas lack detail or support.",
        "Partial answers; limited development; some content is off-topic or repetitive.",
        "Little relevant content; questions largely unanswered.",
      ),
    },
    {
      key: "delivery",
      label: "Delivery",
      weight: 15,
      description: "Fluency, pronunciation and intonation; hesitation does not impede communication.",
      bands: bands(
        "Speaks fluently and clearly; pronunciation is easy to understand.",
        "Generally fluent with some hesitation; occasional pronunciation problems.",
        "Frequent hesitation or pronunciation problems that sometimes impede understanding.",
        "Very hesitant; difficult to understand.",
      ),
    },
    {
      key: "vocabulary",
      label: "Vocabulary",
      weight: 20,
      description: "Range and appropriacy of vocabulary.",
      bands: bands(
        "Wide, varied and precise vocabulary appropriate to the topic.",
        "Adequate vocabulary with some repetition or imprecision.",
        "Limited vocabulary; frequent repetition.",
        "Very limited vocabulary that prevents communication.",
      ),
    },
    {
      key: "language",
      label: "Language Accuracy",
      weight: 15,
      description: "Grammatical accuracy and range of structures.",
      bands: bands(
        "Uses a range of structures with few errors.",
        "Some errors that do not impede communication.",
        "Frequent errors; limited range of structures.",
        "Errors severely impede communication.",
      ),
    },
  ];
}

export const SIMULATION_DISCLAIMER =
  "זוהי סימולציה עצמאית לתרגול בלבד. היא אינה מערכת הבחינה הרשמית של משרד החינוך, אינה iTest ואינה מעניקה ציון בגרות.";

export function newQuestion(simulation: boolean, base?: Partial<TemplateQuestion>) {
  return {
    id: uid(),
    title: base?.title ?? "",
    prompt: base?.prompt ?? "",
    subQuestions: base?.subQuestions ?? [],
    instructions: base?.instructions ?? "",
    videoUrl: "",
    tts: true,
    maxPlays: null,
    prepTimeSec: simulation ? (base?.prepTimeSec ?? 30) : 0,
    maxRecordSec: base?.maxRecordSec ?? 120,
    allowReRecord: true,
    maxRecordings: simulation ? (base?.maxRecordings ?? 3) : null,
    points: base?.points ?? 25,
  };
}

export function newExam(title: string, mode: Exam["mode"], level: Exam["level"], start: "cobe" | "blank"): Exam {
  const simulation = mode === "SIMULATION";
  const sections: Section[] =
    start === "cobe"
      ? cobeSimulationTemplate().map((s) => ({
          id: uid(),
          title: s.title,
          instructions: s.instructions,
          kind: s.kind,
          choiceMode: s.choiceMode,
          videoUrl: "",
          questions: s.questions.map((q) => newQuestion(simulation, q)),
        }))
      : [{ id: uid(), title: "Part 1", instructions: "", kind: "GENERAL", choiceMode: "ALL", videoUrl: "", questions: [newQuestion(simulation)] }];
  return {
    id: uid(),
    title,
    description: "",
    mode,
    level,
    settings: { totalTimeLimitSec: simulation ? COBE_DEFAULTS.totalTimeLimitSec : null, allowBackNavigation: !simulation, allowReviewOwnRecording: true },
    sections,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
