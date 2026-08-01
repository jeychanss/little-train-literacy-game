export type ThemeId = "train" | "rescue";

export type View = "home" | "map" | "learn" | "play" | "complete" | "parent";

export interface WordCard {
  char: string;
  word: string;
  sentence: string;
  hint: string;
  emoji: string;
  category: string;
}

export interface Level {
  id: string;
  number: number;
  station: string;
  title: string;
  words: WordCard[];
  color: string;
}

export interface LevelResult {
  stars: number;
  mistakes: number;
  completedAt: string;
}

export interface SaveData {
  version: 1;
  selectedLevelId: string;
  unlockedLevelIds: string[];
  results: Record<string, LevelResult>;
  totalWords: number;
  levelOverrides?: Record<string, string[]>;
}
