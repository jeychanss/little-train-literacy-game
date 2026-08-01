import activeTheme from "./active-theme.json";
import type { ThemeId } from "../types";

export interface ThemePack {
  id: ThemeId;
  name: string;
  shortName: string;
  icon: string;
  heroTitle: string;
  heroSubtitle: string;
  startLabel: string;
  mapTitle: string;
  vehicleLabel: string;
  helperName: string;
  css: Record<string, string>;
}

export const themes: Record<ThemeId, ThemePack> = {
  train: {
    id: "train",
    name: "暖暖绘本小火车",
    shortName: "小火车",
    icon: "🚂",
    heroTitle: "小火车识字探险",
    heroSubtitle: "装上新汉字，开往下一站！",
    startLabel: "坐上小火车",
    mapTitle: "今天开往哪一站？",
    vehicleLabel: "识字小火车",
    helperName: "车长多多",
    css: {
      "--sky": "#DCEEF1",
      "--sky-deep": "#B9DCE1",
      "--ground": "#DBD39D",
      "--paper": "#FFF9E9",
      "--paper-strong": "#FFFFFF",
      "--ink": "#3E4A40",
      "--ink-soft": "#718074",
      "--primary": "#D85C45",
      "--primary-dark": "#B74735",
      "--secondary": "#2E7771",
      "--secondary-dark": "#225D59",
      "--sun": "#F4C85B",
      "--track": "#75695D",
      "--success": "#5A9961",
      "--danger": "#C55346",
      "--outline": "#524B42",
      "--shadow": "rgba(89, 70, 48, 0.18)",
    },
  },
  rescue: {
    id: "rescue",
    name: "勇气救援小狗队",
    shortName: "救援队",
    icon: "🐾",
    heroTitle: "识字救援队出动",
    heroSubtitle: "找到新汉字，完成今天的救援！",
    startLabel: "加入救援队",
    mapTitle: "今天去哪里执行任务？",
    vehicleLabel: "勇气救援车",
    helperName: "队长阿勇",
    css: {
      "--sky": "#DCEAF7",
      "--sky-deep": "#B7D5ED",
      "--ground": "#C8D8A6",
      "--paper": "#FFF8E1",
      "--paper-strong": "#FFFFFF",
      "--ink": "#263D55",
      "--ink-soft": "#60758B",
      "--primary": "#E05A47",
      "--primary-dark": "#BA3E32",
      "--secondary": "#2879B8",
      "--secondary-dark": "#1B5D90",
      "--sun": "#F5CB4B",
      "--track": "#667786",
      "--success": "#4F9A63",
      "--danger": "#C44D43",
      "--outline": "#30475E",
      "--shadow": "rgba(35, 72, 110, 0.18)",
    },
  },
};

export const scriptedDefaultTheme =
  activeTheme.theme in themes ? (activeTheme.theme as ThemeId) : "train";
