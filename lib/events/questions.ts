/**
 * Custom questions an event asks on its registration form, and the answers people give.
 * Shared by the wizard's editor, the public form and the server, so all three agree.
 */

export type QuestionType = "short" | "long" | "choice" | "checkbox";

export type RegistrationQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  /** For "choice": the options to pick from. */
  options: string[];
  required: boolean;
};

/** Question id -> the answer: text, the chosen option, or true/false for a checkbox. */
export type RegistrationAnswers = Record<string, string | boolean>;

export const QUESTION_TYPES: [QuestionType, string][] = [
  ["short", "Short answer"],
  ["long", "Paragraph"],
  ["choice", "Multiple choice"],
  ["checkbox", "Checkbox (yes / no)"],
];

export const MAX_QUESTIONS = 15;
const MAX_ANSWER = 2000;

const isType = (v: unknown): v is QuestionType => QUESTION_TYPES.some(([t]) => t === v);

/** Reads stored questions defensively: anything malformed is dropped rather than breaking the form. */
export function parseQuestions(value: unknown): RegistrationQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
    .map((q) => ({
      id: typeof q.id === "string" ? q.id : "",
      label: typeof q.label === "string" ? q.label : "",
      type: isType(q.type) ? q.type : "short",
      options: Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === "string") : [],
      required: q.required === true,
    }))
    .filter((q) => q.id && q.label);
}

/** Cleans the questions an organizer saves; returns an error for the first problem. */
export function cleanQuestions(questions: RegistrationQuestion[]): { questions: RegistrationQuestion[] } | { error: string } {
  if (questions.length > MAX_QUESTIONS) return { error: `Ask up to ${MAX_QUESTIONS} questions.` };
  const ids = new Set<string>();
  const out: RegistrationQuestion[] = [];
  for (const [i, q] of questions.entries()) {
    const label = q.label.trim().slice(0, 300);
    if (!label) return { error: `Question ${i + 1} needs some wording.` };
    if (!isType(q.type)) return { error: `Choose a type for "${label}".` };
    const id = /^[a-z0-9-]{1,40}$/i.test(q.id) && !ids.has(q.id) ? q.id : `q${i + 1}-${Math.random().toString(36).slice(2, 8)}`;
    ids.add(id);
    const options = q.type === "choice" ? [...new Set(q.options.map((o) => o.trim().slice(0, 200)).filter(Boolean))] : [];
    if (q.type === "choice" && options.length < 2) return { error: `"${label}" needs at least two options to choose from.` };
    out.push({ id, label, type: q.type, options, required: q.required });
  }
  return { questions: out };
}

/** Checks a registrant's answers against the questions; keeps only answers to real questions. */
export function cleanAnswers(questions: RegistrationQuestion[], answers: RegistrationAnswers): { answers: RegistrationAnswers } | { error: string } {
  const out: RegistrationAnswers = {};
  for (const q of questions) {
    const raw = answers[q.id];
    if (q.type === "checkbox") {
      const yes = raw === true;
      if (q.required && !yes) return { error: `Please tick "${q.label}".` };
      out[q.id] = yes;
      continue;
    }
    const text = typeof raw === "string" ? raw.trim().slice(0, MAX_ANSWER) : "";
    if (!text) {
      if (q.required) return { error: `Please answer "${q.label}".` };
      continue;
    }
    if (q.type === "choice" && !q.options.includes(text)) return { error: `Choose one of the options for "${q.label}".` };
    out[q.id] = text;
  }
  return { answers: out };
}

/** An answer as text, for tables and exports. */
export function answerText(q: RegistrationQuestion, value: string | boolean | undefined): string {
  if (q.type === "checkbox") return value === true ? "Yes" : value === false ? "No" : "";
  return typeof value === "string" ? value : "";
}
