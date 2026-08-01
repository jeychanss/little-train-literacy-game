import type { Level } from "../types";
import { getWordCard, wordByCharacter } from "./wordBank";

const levelSpecs = [
  { id: "home", number: 1, station: "暖暖家园站", title: "我的家", color: "#F2A65A", chars: ["人", "口", "手", "大"] },
  { id: "nature", number: 2, station: "青草坡站", title: "大自然", color: "#7FAF72", chars: ["山", "水", "木", "火"] },
  { id: "sky", number: 3, station: "云朵山站", title: "抬头看", color: "#6FA9C7", chars: ["日", "月", "天", "云"] },
  { id: "animals", number: 4, station: "动物朋友站", title: "好朋友", color: "#D9897E", chars: ["鸟", "鱼", "马", "牛"] },
  { id: "numbers", number: 5, station: "数数桥站", title: "一起来数", color: "#BE8CBF", chars: ["一", "二", "三", "十"] },
  { id: "directions", number: 6, station: "方向谷站", title: "去哪里", color: "#D7A148", chars: ["上", "下", "左", "右"] },
  { id: "school", number: 7, station: "彩笔学校站", title: "学习用品", color: "#5FA7A0", chars: ["书", "笔", "纸", "字"] },
  { id: "feelings", number: 8, station: "星光终点站", title: "快乐一天", color: "#E17C66", chars: ["笑", "爱", "好", "乐"] },
] as const;

export const defaultLevelCharacters: Record<string, string[]> = Object.fromEntries(
  levelSpecs.map((level) => [level.id, [...level.chars]]),
);

export function buildLevels(overrides: Record<string, string[]> = {}): Level[] {
  return levelSpecs.map((spec) => {
    const custom = overrides[spec.id];
    const validCustom =
      custom &&
      custom.length >= 3 &&
      custom.length <= 5 &&
      new Set(custom).size === custom.length &&
      custom.every((char) => wordByCharacter.has(char));
    const chars = validCustom ? custom : [...spec.chars];
    return { ...spec, words: chars.map(getWordCard) };
  });
}

export const levels = buildLevels();
