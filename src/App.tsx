import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { levels } from "./data/levels";
import { scriptedDefaultTheme, themes } from "./themes";
import type { Level, SaveData, ThemeId, View, WordCard } from "./types";

const SAVE_KEY = "little-train-literacy-save-v1";
const THEME_KEY = "little-train-literacy-theme";

const initialSave: SaveData = {
  version: 1,
  selectedLevelId: levels[0].id,
  unlockedLevelIds: [levels[0].id],
  results: {},
  totalWords: 0,
};

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return initialSave;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1 || !Array.isArray(data.unlockedLevelIds)) return initialSave;
    return { ...initialSave, ...data };
  } catch {
    return initialSave;
  }
}

function loadTheme(): ThemeId {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "train" || saved === "rescue" ? saved : scriptedDefaultTheme;
}

function serializeSave(save: SaveData) {
  const lines = [
    "小火车识字游戏学习记录",
    "格式版本=1",
    `当前关卡=${save.selectedLevelId}`,
    `已解锁=${save.unlockedLevelIds.join(",")}`,
    `累计识字=${save.totalWords}`,
    "完成记录:",
  ];

  Object.entries(save.results).forEach(([id, result]) => {
    lines.push(`${id}|${result.stars}|${result.mistakes}|${result.completedAt}`);
  });
  return lines.join("\n");
}

function parseSave(text: string): SaveData {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines[0] !== "小火车识字游戏学习记录") {
    throw new Error("这不是小火车识字游戏的学习记录");
  }

  const getValue = (key: string) =>
    lines.find((line) => line.startsWith(`${key}=`))?.slice(key.length + 1);
  const selectedLevelId = getValue("当前关卡") ?? levels[0].id;
  const unlockedLevelIds = (getValue("已解锁") ?? levels[0].id)
    .split(",")
    .filter((id) => levels.some((level) => level.id === id));
  const totalWords = Number(getValue("累计识字") ?? 0);
  const results: SaveData["results"] = {};

  lines
    .filter((line) => line.includes("|") && !line.includes("="))
    .forEach((line) => {
      const [id, starsText, mistakesText, completedAt] = line.split("|");
      if (!levels.some((level) => level.id === id)) return;
      const stars = Number(starsText);
      const mistakes = Number(mistakesText);
      if (![1, 2, 3].includes(stars) || !Number.isFinite(mistakes)) return;
      results[id] = { stars, mistakes, completedAt: completedAt || new Date().toISOString() };
    });

  if (!levels.some((level) => level.id === selectedLevelId)) {
    throw new Error("记录中的当前关卡不存在");
  }

  return {
    version: 1,
    selectedLevelId,
    unlockedLevelIds: unlockedLevelIds.length ? unlockedLevelIds : [levels[0].id],
    results,
    totalWords: Number.isFinite(totalWords) ? Math.max(0, totalWords) : 0,
  };
}

function speak(text: string, rate = 0.72) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = rate;
  utterance.pitch = 1.05;
  window.speechSynthesis.speak(utterance);
}

function playTone(kind: "good" | "try") {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = kind === "good" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(kind === "good" ? 523 : 210, context.currentTime);
    if (kind === "good") {
      oscillator.frequency.linearRampToValueAtTime(784, context.currentTime + 0.16);
    }
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.25);
  } catch {
    // Audio is a reward enhancement; the game remains fully usable without it.
  }
}

function App() {
  const [view, setView] = useState<View>("home");
  const [themeId, setThemeId] = useState<ThemeId>(loadTheme);
  const [save, setSave] = useState<SaveData>(loadSave);
  const [learnIndex, setLearnIndex] = useState(0);
  const [quizIndex, setQuizIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [loadedChars, setLoadedChars] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"idle" | "good" | "try">("idle");

  const theme = themes[themeId];
  const selectedLevel =
    levels.find((level) => level.id === save.selectedLevelId) ?? levels[0];

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, themeId);
    document.documentElement.style.colorScheme = "light";
  }, [themeId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  function navigate(next: View) {
    setView(next);
    setFeedback("idle");
  }

  function selectLevel(level: Level, parentOverride = false) {
    if (!parentOverride && !save.unlockedLevelIds.includes(level.id)) return;
    setSave((current) => ({ ...current, selectedLevelId: level.id }));
    setLearnIndex(0);
    setQuizIndex(0);
    setMistakes(0);
    setLoadedChars([]);
    navigate("learn");
  }

  function startQuiz() {
    setQuizIndex(0);
    setMistakes(0);
    setLoadedChars([]);
    setFeedback("idle");
    navigate("play");
    window.setTimeout(() => speak(selectedLevel.words[0].char), 220);
  }

  function finishLevel(finalMistakes: number) {
    const stars = finalMistakes === 0 ? 3 : finalMistakes <= 2 ? 2 : 1;
    const nextLevel = levels[selectedLevel.number];
    setSave((current) => {
      const previous = current.results[selectedLevel.id];
      const bestResult =
        previous && previous.stars > stars
          ? previous
          : { stars, mistakes: finalMistakes, completedAt: new Date().toISOString() };
      const unlocked = new Set(current.unlockedLevelIds);
      if (nextLevel) unlocked.add(nextLevel.id);
      return {
        ...current,
        unlockedLevelIds: [...unlocked],
        results: { ...current.results, [selectedLevel.id]: bestResult },
        totalWords: current.totalWords + selectedLevel.words.length,
      };
    });
    playTone("good");
    navigate("complete");
  }

  function chooseCharacter(card: WordCard) {
    if (feedback !== "idle") return;
    const answer = selectedLevel.words[quizIndex];
    if (card.char !== answer.char) {
      setMistakes((count) => count + 1);
      setFeedback("try");
      playTone("try");
      window.setTimeout(() => setFeedback("idle"), 650);
      return;
    }

    setLoadedChars((chars) => [...chars, card.char]);
    setFeedback("good");
    playTone("good");
    const isLast = quizIndex === selectedLevel.words.length - 1;
    window.setTimeout(() => {
      if (isLast) {
        finishLevel(mistakes);
      } else {
        const nextIndex = quizIndex + 1;
        setQuizIndex(nextIndex);
        setFeedback("idle");
        speak(selectedLevel.words[nextIndex].char);
      }
    }, 700);
  }

  function changeTheme(id: ThemeId) {
    setThemeId(id);
  }

  const shellStyle = theme.css as CSSProperties;

  return (
    <div className={`app theme-${theme.id}`} style={shellStyle}>
      <Header
        themeIcon={theme.icon}
        view={view}
        onHome={() => navigate("home")}
        onMap={() => navigate("map")}
        onParent={() => navigate("parent")}
      />

      <main>
        {view === "home" && (
          <HomeView
            theme={theme}
            save={save}
            onStart={() => navigate("map")}
            onContinue={() => selectLevel(selectedLevel, true)}
          />
        )}
        {view === "map" && (
          <MapView
            title={theme.mapTitle}
            save={save}
            onSelect={selectLevel}
            onParent={() => navigate("parent")}
          />
        )}
        {view === "learn" && (
          <LearnView
            level={selectedLevel}
            wordIndex={learnIndex}
            helperName={theme.helperName}
            onBack={() => navigate("map")}
            onPrevious={() => setLearnIndex((index) => Math.max(0, index - 1))}
            onNext={() => {
              if (learnIndex === selectedLevel.words.length - 1) startQuiz();
              else setLearnIndex((index) => index + 1);
            }}
          />
        )}
        {view === "play" && (
          <PlayView
            level={selectedLevel}
            questionIndex={quizIndex}
            loadedChars={loadedChars}
            feedback={feedback}
            vehicleLabel={theme.vehicleLabel}
            onChoose={chooseCharacter}
            onReplay={() => speak(selectedLevel.words[quizIndex].char)}
            onExit={() => navigate("map")}
          />
        )}
        {view === "complete" && (
          <CompleteView
            level={selectedLevel}
            stars={save.results[selectedLevel.id]?.stars ?? 1}
            themeIcon={theme.icon}
            onReplay={() => selectLevel(selectedLevel, true)}
            onMap={() => navigate("map")}
          />
        )}
        {view === "parent" && (
          <ParentView
            save={save}
            themeId={themeId}
            onThemeChange={changeTheme}
            onChooseLevel={(level) => selectLevel(level, true)}
            onImport={setSave}
            onBack={() => navigate("home")}
          />
        )}
      </main>

      <footer>
        <span>学习记录只保存在这台设备上</span>
        <span aria-hidden="true">·</span>
        <button className="text-button" onClick={() => navigate("parent")}>家长中心</button>
      </footer>
    </div>
  );
}

function Header({
  themeIcon,
  view,
  onHome,
  onMap,
  onParent,
}: {
  themeIcon: string;
  view: View;
  onHome: () => void;
  onMap: () => void;
  onParent: () => void;
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="回到首页">
        <span className="brand-icon" aria-hidden="true">{themeIcon}</span>
        <span>识字探险</span>
      </button>
      <nav aria-label="主要导航">
        {view !== "home" && (
          <button className="nav-pill" onClick={onMap}>路线图</button>
        )}
        <button className="icon-button" onClick={onParent} aria-label="打开家长中心">
          <span aria-hidden="true">⚙</span>
        </button>
      </nav>
    </header>
  );
}

function HomeView({
  theme,
  save,
  onStart,
  onContinue,
}: {
  theme: (typeof themes)[ThemeId];
  save: SaveData;
  onStart: () => void;
  onContinue: () => void;
}) {
  const hasProgress = Object.keys(save.results).length > 0;
  return (
    <section className="home-screen screen">
      <div className="hero-copy">
        <p className="eyebrow">每天 5 分钟 · 每关 3–5 个字</p>
        <h1>{theme.heroTitle}</h1>
        <p className="hero-subtitle">{theme.heroSubtitle}</p>
        <div className="hero-actions">
          <button className="primary-button jumbo" onClick={onStart}>
            <span aria-hidden="true">▶</span> {theme.startLabel}
          </button>
          {hasProgress && (
            <button className="paper-button" onClick={onContinue}>继续上次学习</button>
          )}
        </div>
        <div className="trust-row" aria-label="游戏特点">
          <span>🌱 循序渐进</span>
          <span>🔒 无广告</span>
          <span>🏠 本地保存</span>
        </div>
      </div>
      <PictureBookScene themeId={theme.id} />
    </section>
  );
}

function PictureBookScene({ themeId }: { themeId: ThemeId }) {
  return (
    <div className="storybook-scene" aria-label={themeId === "train" ? "小火车行驶在田野里" : "救援小狗队开车出发"}>
      <span className="sun" aria-hidden="true" />
      <span className="cloud cloud-one" aria-hidden="true" />
      <span className="cloud cloud-two" aria-hidden="true" />
      <span className="hill hill-back" aria-hidden="true" />
      <span className="hill hill-front" aria-hidden="true" />
      <span className="tree tree-one" aria-hidden="true">♣</span>
      <span className="tree tree-two" aria-hidden="true">♣</span>
      <div className={`hero-vehicle ${themeId}`} aria-hidden="true">
        {themeId === "train" ? (
          <>
            <span className="smoke smoke-one" />
            <span className="smoke smoke-two" />
            <div className="engine"><b>字</b></div>
            <div className="carriage"><b>学</b></div>
            <i className="wheel wheel-one" /><i className="wheel wheel-two" /><i className="wheel wheel-three" />
          </>
        ) : (
          <>
            <div className="rescue-light" />
            <div className="rescue-car"><b>🐾</b><span>字</span></div>
            <i className="wheel wheel-one" /><i className="wheel wheel-two" />
          </>
        )}
      </div>
      <div className="scene-track" aria-hidden="true" />
    </div>
  );
}

function MapView({
  title,
  save,
  onSelect,
  onParent,
}: {
  title: string;
  save: SaveData;
  onSelect: (level: Level) => void;
  onParent: () => void;
}) {
  const completed = Object.keys(save.results).length;
  return (
    <section className="screen map-screen">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">识字路线图</p>
          <h1>{title}</h1>
        </div>
        <div className="progress-badge"><b>{completed}</b><span>/ {levels.length} 站完成</span></div>
      </div>
      <div className="route" aria-label="关卡列表">
        {levels.map((level, index) => {
          const unlocked = save.unlockedLevelIds.includes(level.id);
          const result = save.results[level.id];
          return (
            <div className={`route-stop ${index % 2 ? "right" : "left"}`} key={level.id}>
              {index < levels.length - 1 && <span className="route-line" aria-hidden="true" />}
              <button
                className={`station-card ${unlocked ? "unlocked" : "locked"}`}
                onClick={() => onSelect(level)}
                disabled={!unlocked}
                style={{ "--station-color": level.color } as CSSProperties}
                aria-label={`${level.station}${unlocked ? "" : "，尚未解锁"}`}
              >
                <span className="station-number">{result ? "✓" : unlocked ? level.number : "🔒"}</span>
                <span className="station-copy">
                  <small>第 {level.number} 站</small>
                  <strong>{level.station}</strong>
                  <span>{level.words.map((word) => word.char).join(" · ")}</span>
                </span>
                <Stars count={result?.stars ?? 0} muted={!result} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="parent-hint">
        <span aria-hidden="true">👨‍👩‍👧</span>
        <p>想从其他关卡开始？家长可以手动选择任意一站。</p>
        <button className="paper-button compact" onClick={onParent}>家长选关</button>
      </div>
    </section>
  );
}

function LearnView({
  level,
  wordIndex,
  helperName,
  onBack,
  onPrevious,
  onNext,
}: {
  level: Level;
  wordIndex: number;
  helperName: string;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const word = level.words[wordIndex];
  const last = wordIndex === level.words.length - 1;
  return (
    <section className="screen lesson-screen">
      <LessonProgress current={wordIndex + 1} total={level.words.length} title={level.station} onExit={onBack} />
      <div className="lesson-stage">
        <div className="guide-bubble">
          <span className="guide-avatar" aria-hidden="true">🧑‍✈️</span>
          <p><b>{helperName}</b><br />看看这个新朋友，点一点击听它的名字。</p>
        </div>
        <article className="character-card">
          <span className="card-emoji" aria-hidden="true">{word.emoji}</span>
          <button className="character" onClick={() => speak(`${word.char}，${word.phrase}`)} aria-label={`朗读汉字${word.char}`}>
            {word.char}
          </button>
          <p className="phrase">{word.phrase}</p>
          <p className="hint">{word.hint}</p>
          <button className="listen-button" onClick={() => speak(`${word.char}，${word.phrase}`)}>
            <span aria-hidden="true">🔊</span> 听一听
          </button>
        </article>
      </div>
      <div className="lesson-actions">
        <button className="round-button" onClick={onPrevious} disabled={wordIndex === 0} aria-label="上一个汉字">←</button>
        <div className="dot-progress" aria-label={`第 ${wordIndex + 1} 个，共 ${level.words.length} 个`}>
          {level.words.map((item, index) => <span className={index === wordIndex ? "active" : ""} key={item.char} />)}
        </div>
        <button className="primary-button" onClick={onNext}>{last ? "开始装车" : "下一个"} <span aria-hidden="true">→</span></button>
      </div>
    </section>
  );
}

function PlayView({
  level,
  questionIndex,
  loadedChars,
  feedback,
  vehicleLabel,
  onChoose,
  onReplay,
  onExit,
}: {
  level: Level;
  questionIndex: number;
  loadedChars: string[];
  feedback: "idle" | "good" | "try";
  vehicleLabel: string;
  onChoose: (word: WordCard) => void;
  onReplay: () => void;
  onExit: () => void;
}) {
  const answer = level.words[questionIndex];
  const choices = useMemo(() => {
    const shift = questionIndex % level.words.length;
    return [...level.words.slice(shift), ...level.words.slice(0, shift)];
  }, [level, questionIndex]);

  return (
    <section className="screen play-screen">
      <LessonProgress current={questionIndex + 1} total={level.words.length} title="装字上车" onExit={onExit} />
      <div className="quiz-panel">
        <div className="listen-prompt">
          <p>听一听，哪个字要上车？</p>
          <button className="sound-orb" onClick={onReplay} aria-label={`再听一次${answer.char}`}>
            <span aria-hidden="true">🔊</span><small>再听一次</small>
          </button>
        </div>
        <div className={`choice-grid feedback-${feedback}`} aria-live="polite">
          {choices.map((word) => (
            <button className="choice-card" onClick={() => onChoose(word)} key={word.char}>
              <span>{word.char}</span><small>{word.emoji}</small>
            </button>
          ))}
        </div>
        <div className={`feedback-message ${feedback}`} role="status">
          {feedback === "good" && "答对啦！汉字上车喽！"}
          {feedback === "try" && "再听一次，你一定能找到。"}
          {feedback === "idle" && "点选你听到的汉字"}
        </div>
      </div>
      <WordTrain label={vehicleLabel} words={level.words} loadedChars={loadedChars} />
    </section>
  );
}

function WordTrain({ label, words, loadedChars }: { label: string; words: WordCard[]; loadedChars: string[] }) {
  return (
    <div className="word-train" aria-label={`${label}，已装载${loadedChars.length}个汉字`}>
      <div className="mini-engine"><span>🚂</span><small>{label}</small></div>
      {words.map((word, index) => (
        <div className={`mini-carriage ${loadedChars[index] ? "loaded" : ""}`} key={word.char}>
          {loadedChars[index] || "?"}
        </div>
      ))}
      <div className="track-dashes" aria-hidden="true" />
    </div>
  );
}

function CompleteView({
  level,
  stars,
  themeIcon,
  onReplay,
  onMap,
}: {
  level: Level;
  stars: number;
  themeIcon: string;
  onReplay: () => void;
  onMap: () => void;
}) {
  return (
    <section className="screen complete-screen">
      <div className="celebration" aria-hidden="true">
        <span>✦</span><span>●</span><span>★</span><span>✦</span><span>●</span>
      </div>
      <div className="reward-medal"><span>{themeIcon}</span></div>
      <p className="eyebrow">成功到站</p>
      <h1>{level.station}完成啦！</h1>
      <p className="hero-subtitle">今天认识了 {level.words.length} 个新朋友</p>
      <Stars count={stars} large />
      <div className="learned-strip">
        {level.words.map((word) => <span key={word.char}>{word.char}</span>)}
      </div>
      <p className="reward-copy">每个汉字都已经安全装进记忆车厢。</p>
      <div className="complete-actions">
        <button className="paper-button" onClick={onReplay}>再玩一次</button>
        <button className="primary-button jumbo" onClick={onMap}>前往下一站 <span aria-hidden="true">→</span></button>
      </div>
    </section>
  );
}

function ParentView({
  save,
  themeId,
  onThemeChange,
  onChooseLevel,
  onImport,
  onBack,
}: {
  save: SaveData;
  themeId: ThemeId;
  onThemeChange: (id: ThemeId) => void;
  onChooseLevel: (level: Level) => void;
  onImport: (save: SaveData) => void;
  onBack: () => void;
}) {
  const [recordText, setRecordText] = useState(() => serializeSave(save));
  const [message, setMessage] = useState("");
  const completed = Object.keys(save.results).length;
  const stars = Object.values(save.results).reduce((sum, result) => sum + result.stars, 0);

  useEffect(() => setRecordText(serializeSave(save)), [save]);

  async function copyRecord() {
    await navigator.clipboard.writeText(serializeSave(save));
    setMessage("学习记录已复制");
  }

  function downloadRecord() {
    const blob = new Blob([serializeSave(save)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `识字学习记录-${new Date().toISOString().slice(0, 10)}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("纯文本记录已下载");
  }

  function importRecord() {
    try {
      const parsed = parseSave(recordText);
      onImport(parsed);
      setMessage("导入成功，学习进度已经恢复");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败，请检查文本");
    }
  }

  return (
    <section className="screen parent-screen">
      <div className="screen-heading">
        <div>
          <p className="eyebrow">仅供家长操作</p>
          <h1>家长中心</h1>
          <p className="section-description">选择学习内容、切换主题，并备份孩子的学习记录。</p>
        </div>
        <button className="paper-button compact" onClick={onBack}>返回游戏</button>
      </div>

      <div className="summary-grid">
        <SummaryCard icon="🏁" value={`${completed}/${levels.length}`} label="完成关卡" />
        <SummaryCard icon="⭐" value={String(stars)} label="获得星星" />
        <SummaryCard icon="字" value={String(save.totalWords)} label="累计练习" />
      </div>

      <section className="parent-panel">
        <div className="panel-heading">
          <div><h2>手动选择关卡</h2><p>可以跳过路线锁定，从任意内容开始学习。</p></div>
        </div>
        <div className="level-picker">
          {levels.map((level) => (
            <button className="level-pick" onClick={() => onChooseLevel(level)} key={level.id}>
              <span style={{ background: level.color }}>{level.number}</span>
              <b>{level.title}</b>
              <small>{level.words.map((word) => word.char).join(" ")}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="parent-panel">
        <div className="panel-heading">
          <div><h2>故事主题</h2><p>主题只改变画面和文案，不会改变关卡与学习记录。</p></div>
        </div>
        <div className="theme-picker">
          {(Object.values(themes) as (typeof themes)[ThemeId][]).map((theme) => (
            <button
              className={`theme-card ${themeId === theme.id ? "selected" : ""}`}
              onClick={() => onThemeChange(theme.id)}
              key={theme.id}
            >
              <span className={`theme-preview preview-${theme.id}`} aria-hidden="true">{theme.icon}</span>
              <span><b>{theme.name}</b><small>{theme.heroSubtitle}</small></span>
              <i>{themeId === theme.id ? "使用中" : "切换"}</i>
            </button>
          ))}
        </div>
        <p className="script-note">构建默认主题也可以用脚本切换：<code>npm run theme -- train</code> 或 <code>npm run theme -- rescue</code></p>
      </section>

      <section className="parent-panel record-panel">
        <div className="panel-heading">
          <div><h2>纯文本学习记录</h2><p>复制到备忘录，换设备时再粘贴回来即可。</p></div>
          <div className="button-row">
            <button className="paper-button compact" onClick={copyRecord}>复制记录</button>
            <button className="paper-button compact" onClick={downloadRecord}>下载 .txt</button>
          </div>
        </div>
        <label htmlFor="record-text">学习记录文本</label>
        <textarea id="record-text" value={recordText} onChange={(event) => setRecordText(event.target.value)} spellCheck={false} />
        <div className="record-actions">
          <p className="status-message" role="status">{message || "导入只会替换学习记录，不影响当前主题。"}</p>
          <button className="primary-button" onClick={importRecord}>从文本导入</button>
        </div>
      </section>
    </section>
  );
}

function LessonProgress({ current, total, title, onExit }: { current: number; total: number; title: string; onExit: () => void }) {
  return (
    <div className="lesson-progress">
      <button className="round-button small" onClick={onExit} aria-label="退出本关">×</button>
      <div><b>{title}</b><span><i style={{ width: `${(current / total) * 100}%` }} /></span></div>
      <strong>{current}/{total}</strong>
    </div>
  );
}

function Stars({ count, large = false, muted = false }: { count: number; large?: boolean; muted?: boolean }) {
  return (
    <span className={`stars ${large ? "large" : ""} ${muted ? "muted" : ""}`} aria-label={`${count}颗星`}>
      {[1, 2, 3].map((star) => <span key={star}>{star <= count ? "★" : "☆"}</span>)}
    </span>
  );
}

function SummaryCard({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return <article className="summary-card"><span>{icon}</span><strong>{value}</strong><small>{label}</small></article>;
}

export default App;
