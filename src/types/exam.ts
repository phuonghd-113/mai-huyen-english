// Exam papers imported from Word/PDF files (src/data/exams/*.json) and the progress kept on them.

export type QuestionType =
  | 'pronunciation' // chọn từ có phần gạch chân phát âm khác
  | 'stress' // chọn từ có trọng âm khác
  | 'mcq' // trắc nghiệm từ vựng / ngữ pháp
  | 'error-id' // tìm lỗi sai (A/B/C/D), có thể kèm sửa
  | 'word-form' // cho dạng đúng của từ
  | 'verb-form' // chia động từ
  | 'preposition' // điền giới từ / tiểu từ
  | 'cloze-mcq' // đọc đoạn văn, chọn từ điền
  | 'cloze-open' // đọc đoạn văn, tự điền một từ
  | 'reading' // đọc hiểu: trắc nghiệm, True/False hoặc trả lời câu hỏi
  | 'transform' // viết lại câu không đổi nghĩa
  | 'writing' // viết đoạn văn / bài luận: không chấm tự động
  | 'other'; // dạng chưa nhận diện được: hiển thị nguyên văn

export const QUESTION_TYPES: QuestionType[] = [
  'pronunciation',
  'stress',
  'mcq',
  'error-id',
  'word-form',
  'verb-form',
  'preposition',
  'cloze-mcq',
  'cloze-open',
  'reading',
  'transform',
  'writing',
  'other',
];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  pronunciation: 'Phát âm',
  stress: 'Trọng âm',
  mcq: 'Trắc nghiệm',
  'error-id': 'Tìm lỗi sai',
  'word-form': 'Cấu tạo từ',
  'verb-form': 'Chia động từ',
  preposition: 'Giới từ',
  'cloze-mcq': 'Điền từ (chọn)',
  'cloze-open': 'Điền từ (tự do)',
  reading: 'Đọc hiểu',
  transform: 'Viết lại câu',
  writing: 'Viết đoạn văn',
  other: 'Dạng khác',
};

export type ExamLevel = 'truong' | 'huyen' | 'tinh';

export interface Question {
  /** `${examId}-${sectionId}-${n}`, fixed once imported so saved progress stays attached */
  id: string;
  /** defaults to the section's type */
  type?: QuestionType;
  /** question text; underlined parts are written as <u>…</u> */
  prompt: string;
  /** choice questions: the option texts, in order A, B, C, D… */
  options?: string[];
  /**
   * Accepted answers. Choice questions: the option letter ("B").
   * Typed questions: every accepted text; inside one answer "(…)" is optional and "a/ b" are alternatives.
   * Empty when the paper had no key: the question is shown but not scored.
   */
  answers: string[];
  /** error-id: accepted corrections of the wrong part (scored separately, optional) */
  fix?: string[];
  /** transform: the given beginning of the new sentence ("The book …") */
  lead?: string;
  /** writing: a model answer to compare with */
  sample?: string;
  explanation?: string;
  tags?: string[];
}

export interface Section {
  /** short id, unique inside the exam: "s1", "s2"… */
  id: string;
  /** the paper's instruction, verbatim */
  instruction: string;
  type: QuestionType;
  /** points for the whole section */
  points: number;
  /** cloze / reading passage */
  passage?: string;
  questions: Question[];
}

export interface Exam {
  /** lowercase, digits and "-": "hsg8-2023-huyen-x"; also the JSON file name */
  id: string;
  title: string;
  year?: number;
  level?: ExamLevel;
  minutes: number;
  maxScore: number;
  /** original file name */
  source: string;
  /** true for the hand-made sample paper (hidden from the list once real papers exist) */
  sample?: boolean;
  sections: Section[];
}

/** One question as practised outside its paper (practice by type, mistakes notebook). */
export interface BankQuestion extends Question {
  type: QuestionType;
  examId: string;
  sectionId: string;
  instruction: string;
  passage?: string;
}

// ---- progress

export interface SrsInfo {
  /** next review, ms since epoch */
  due: number;
  /** index into SRS_DAYS */
  step: number;
}

export interface QuestionProgress {
  right?: number;
  wrong?: number;
  /** the last answer was wrong: the question is in the mistakes notebook */
  missed?: boolean;
  srs?: SrsInfo;
  /** last change: newest wins when devices merge */
  t?: number;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  startedAt: number;
  submittedAt?: number;
  /** question id → the answer given (option letter or typed text) */
  answers: Record<string, string>;
  /** questions marked "xem lại sau" */
  flagged?: string[];
  /** section id → points the student gave themselves (writing) */
  selfScores?: Record<string, number>;
  /** auto-graded score at submit time, on the paper's scale */
  score?: number;
  /** milliseconds left on the timer when last saved (resume after closing the app) */
  remainingMs?: number;
  /** left unfinished and replaced by a fresh start: hidden, not scored */
  abandoned?: boolean;
  t: number;
}
