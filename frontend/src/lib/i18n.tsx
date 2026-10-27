import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Lightweight UI translation layer.
 *
 * English is the source language and also the key: `t("Select an exam")`
 * returns the English text unchanged when the language is `en`, and the
 * Chinese entry from MESSAGES when it is `zh`. Missing entries fall back to
 * English, so a new string is never blank while translations are being filled
 * in. User content (exam titles, questions, analyses) is never translated.
 */

export type Language = "en" | "zh";

export const LANGUAGE_STORAGE_KEY = "inteflow.language";

export const LANGUAGES: { id: Language; label: string; native: string }[] = [
  { id: "en", label: "English", native: "English" },
  { id: "zh", label: "Chinese", native: "中文" },
];

export type MessageVars = Record<string, string | number>;

const MESSAGES: Record<string, string> = {
  // --- shell / navigation -------------------------------------------------
  Exams: "考试",
  Sessions: "作答历史",
  Library: "题库",
  Review: "复习",
  Vocabulary: "生词本",
  Settings: "设置",
  "Open menu": "打开菜单",
  Main: "主导航",
  "Close menu": "关闭菜单",
  "Expand sidebar": "展开侧栏",
  "Collapse sidebar": "收起侧栏",
  "Local-first": "本地优先",
  "Everything stays on this machine.": "所有数据都保存在这台电脑上。",
  "InteFlow — local-first practice, review & vocabulary.":
    "InteFlow — 本地优先的练习、复盘与生词本。",
  "No accounts. No cloud. Everything stays on this machine.":
    "无需账号，不上传云端，所有内容都留在这台电脑上。",

  // --- shared actions -----------------------------------------------------
  Save: "保存",
  "Save settings": "保存设置",
  "Saving…": "正在保存…",
  Cancel: "取消",
  Close: "关闭",
  Delete: "删除",
  Edit: "编辑",
  Remove: "移除",
  Add: "添加",
  Back: "返回",
  Next: "下一题",
  Previous: "上一题",
  Search: "搜索",
  "Try again": "重试",
  "Loading…": "加载中…",
  Loading: "加载中",
  Optional: "可选",
  "0 tokens": "0 token",
  "Not available": "不可用",
  "Not now": "暂不",
  "View all": "查看全部",

  // --- language picker ----------------------------------------------------
  Language: "界面语言",
  "Interface language": "界面语言",
  Active: "使用中",
  "Choose the language used by the workspace. Exam content and your own notes are never translated.":
    "选择工作区显示语言。考试原文与你自己写的内容不会被翻译。",

  // --- settings -----------------------------------------------------------
  Workspace: "工作区",
  "Everything on this page is stored on this machine. Changes are saved as you type.":
    "这一页的所有内容都保存在本机，修改后会即时保存。",
  "Settings sections": "设置分区",
  "On this page": "本页目录",
  "Local only. Nothing leaves this machine unless you click Test connection or ask for an explanation.":
    "完全本地。除非你点「测试连接」或主动请求讲解，否则不会有任何内容离开这台电脑。",
  Profile: "个人资料",
  "The name printed on the cover of every exported notebook.":
    "导出笔记本时印在封面上的名字。",
  "Cover page": "封面",
  "Make the workspace feel like yours. Saved locally on this machine.":
    "把工作区调成你喜欢的样子，偏好保存在本机。",
  "The practice screen keeps its own high-contrast look.":
    "考试页面保留自己的高对比度外观。",
  "AI model": "AI 模型",
  "Used only when you ask: explanations, AI sense matching, word-test grading and the optional import fallback. The key is stored locally.":
    "只在你主动使用讲解、AI 义项匹配、单词考试判分或可选的导入兜底时才会调用。密钥保存在本机。",
  "Where the model runs": "模型服务",
  Endpoint: "接口地址",
  "Stored locally": "只存本机",
  "Used on demand": "按需调用",
  Importing: "导入",
  "PDF, DOCX and InteFlow-MD conversion runs offline. The fallback below is the one exception.":
    "PDF、DOCX 与 InteFlow-MD 的转换全部离线完成，只有下面的兜底开关是例外。",
  "Word lists, the built-in Merriam-Webster dictionary and word tests.":
    "生词表、内置韦氏词典与单词考试。",
  Writing: "写作",
  "What a fresh analysis page starts with.": "空白分析页的起始内容。",
  "Housekeeping for the installed app.": "已安装应用的维护操作。",
  "Configure the LLM API used for on-demand explanations and import fallback. Everything is stored locally; the key never leaves this machine except to call the provider you name below.":
    "配置用于按需解析与导入兜底的 LLM API。所有内容都保存在本地；除了调用你指定的服务商，密钥不会离开这台电脑。",
  "Settings saved.": "设置已保存。",
  "Changes save automatically.": "修改会自动保存。",
  "Unsaved changes…": "有未保存的修改…",
  "Could not save — retrying on the next change.": "保存失败——下次修改时会重试。",
  "Version {version}": "版本 {version}",
  "API key removed.": "API 密钥已移除。",
  Desktop: "桌面端",
  "Show built-in library": "显示内置题库",
  "Show the bundled SAT sample bank in Library. It is off by default so a new install starts empty; turning it on lets you add sample units without importing a file.":
    "在题库页显示随包分发的 SAT 示例题库。默认关闭，因此新安装的应用是空的；开启后可以不导入文件就直接添加示例单元。",
  "Reset local data": "清空本地数据",
  "Remove the local database, imported documents, analyses, vocabulary, exports and preferences, then restart InteFlow. Your own dictionary source files in the dictionary folder are kept. This cannot be undone.":
    "删除本地数据库、导入的文档、分析、生词本、导出文件与界面偏好，然后重启 InteFlow。dictionary 文件夹里你自己的词典源文件会保留。此操作不可撤销。",
  "Reset local data…": "清空本地数据…",
  "Resetting…": "正在清空…",
  "Reset cancelled.": "已取消清空。",
  "Reset is only available in the desktop app.": "只有桌面端应用才能清空本地数据。",
  "Your name": "你的名字",
  "Printed on page 1 of every exported notebook":
    "会打印在每次导出笔记本的封面页",
  "Used as the cover-page name when you export an analysis notebook.":
    "导出分析笔记本时，用作封面上的名字。",
  "Analysis template": "分析模板",
  "**Why the correct answer works**\n\n**Why I picked mine**\n\n**Takeaway**\n":
    "**为什么正确答案成立**\n\n**我为什么选了另一个**\n\n**要点总结**\n",
  "Pre-filled into every empty analysis page (wrong answers, starred questions and the review workspace). Markdown is supported. An existing analysis is never overwritten, and the template itself is only saved once you start editing the page.":
    "自动填入每个空白分析页（错题、精选题和复盘工作台）。支持 Markdown。已有分析不会被覆盖；只有当你开始编辑页面后，模板内容才会保存。",
  Provider: "服务商",
  "A provider is the service; this one speaks the Anthropic Messages protocol (x-api-key auth).":
    "服务商指提供模型的服务；当前服务商使用 Anthropic Messages 协议（x-api-key 认证）。",
  "A provider is the service; this one speaks the OpenAI-compatible protocol (chat/completions, Bearer auth).":
    "服务商指提供模型的服务；当前服务商使用 OpenAI 兼容协议（chat/completions，Bearer 认证）。",
  "Loading providers…": "正在加载服务商…",
  "Base URL": "Base URL",
  "OpenAI-compatible proxies work too — point this at any …/v1 endpoint.":
    "也支持 OpenAI 兼容代理——把它指向任意 …/v1 端点即可。",
  "API Key": "API 密钥",
  "Saved keys are shown masked and are never sent back to the browser.":
    "已保存的密钥只显示掩码，绝不会被发送回浏览器。",
  "Stored: {masked} — leave blank to keep": "已保存：{masked} — 留空则保持不变",
  Model: "模型",
  "AI recognition fallback": "AI 识别兜底",
  "When a PDF or DOCX cannot be parsed by the built-in layout rules, let the configured model label the questions instead. It only reads text that was already extracted, never rewrites it, and costs tokens — turn it off to keep imports fully offline. When the source prints no choices, the question is imported as a fill-in-the-blank instead.":
    "当 PDF 或 DOCX 无法被内置版面规则解析时，让配置的模型来标注题目。模型只读取已经提取出的文本，不会改写内容，但会消耗 token——关闭后导入完全离线。若原文没有选项，题目会按填空题导入。",
  "AI sense matching": "AI 义项匹配",
  "When you drag a word into the Vocabulary pane, ask the configured model to choose the Merriam-Webster sense that fits the sentence. Turn this off to use the first sense every time with no token cost.":
    "把单词拖入生词本时，让配置的模型从韦氏词典的真实义项中选出最贴合句子的那个。关闭后每次都使用第一条释义，不消耗 token。",
  "Definition for English Learners": "英语学习者释义",
  "When the local Merriam-Webster entry includes its Definition for English Learners section (usually harder words), use that simpler definition first. Entries without the section fall back to the ordinary definition. This is part of the same dictionary — no extra file and no tokens.":
    "当本地韦氏词条包含「Definition for English Learners」栏目时（通常是较难的词），优先使用更简单的解释。没有该栏目的词条回退普通释义。它属于同一本词典——无需额外文件，也不消耗 token。",
  "Use my dictionary first": "优先查我的词典",
  "Check your own words before Merriam-Webster. If a word is missing, lookup falls back to the local MW dictionary. Import CSV / TSV / JSON / TXT, or add words by hand.":
    "查词时先查你自己的词典；未命中再回退本地韦氏词典。可导入 CSV / TSV / JSON / TXT，也可手动添加。",
  "Manage my dictionary": "管理我的词典",
  "Add a word": "添加单词",
  "Custom dictionary word": "自定义词典单词",
  "Custom dictionary part of speech": "自定义词典词性",
  "Custom dictionary definition": "自定义词典释义",
  "Definition / meaning": "释义 / 含义",
  "POS (optional)": "词性（可选）",
  "Import file": "导入文件",
  "CSV / TSV / JSON / TXT · columns: word, definition, pos":
    "CSV / TSV / JSON / TXT · 列：word、definition、pos",
  "Filter my dictionary…": "筛选我的词典…",
  "Filter my dictionary": "筛选我的词典",
  "No words yet. Import a file above, or add one word at a time.":
    "还没有单词。可在上方导入文件，或逐条添加。",
  "{count} words. Custom entries are checked before Merriam-Webster.":
    "{count} 个单词。自定义词条会优先于韦氏词典查询。",
  "Drag a word (select it in the question first).":
    "请拖动一个单词（先在题目中选中它）。",
  Dismiss: "关闭提示",
  "Delete “{word}” from your dictionary?": "从你的词典中删除「{word}」？",
  "Delete {word}": "删除「{word}」",
  "Imported {added} new, updated {updated}.": "导入完成：新增 {added} 条，更新 {updated} 条。",
  "AI grading for word tests": "单词考试 AI 判分",
  "When you submit a word test, ask the configured model to grade both directions. It receives the word-list meaning and Merriam-Webster references and is instructed to be strict. Turn this off to grade locally with no token cost. A failed or missing model falls back to local grading automatically.":
    "提交单词考试时，让配置的模型判分两种方向。模型会收到词表释义与韦氏词典参考，并被要求严格判定。关闭后使用本地判分，不消耗 token。模型不可用或调用失败时会自动回退本地判分。",
  "Test connection": "测试连接",
  "Testing…": "正在测试…",

  // --- exams home ---------------------------------------------------------
  "Local practice workspace": "本地练习工作区",
  "Select an exam": "选择一套考试",
  "Answers are graded when you submit. The timer starts when you begin — and everything stays on this machine.":
    "提交后才会判分。计时从你开始考试时启动——所有内容都留在本机。",
  Questions: "题目",
  "Needs keys": "待录答案",
  "Answers are graded when you submit": "提交后判分",
  "Couldn't load your exams.": "无法加载考试列表。",
  "Loading exams…": "正在加载考试…",
  "No exams yet.": "还没有考试。",
  "Import a PDF, DOCX or InteFlow-MD file, or add a ready-made set from the built-in library.":
    "导入 PDF、DOCX 或 InteFlow-MD 文件，或从内置题库添加现成套题。",
  "Open library": "打开题库",
  "No exams in this subject.": "该学科下还没有考试。",
  "Show all exams": "显示全部考试",
  "questions": "题",
  "{count} questions": "{count} 道题",
  "Added {date}": "添加于 {date}",
  "Answer key {answered}/{total}": "答案 {answered}/{total}",
  "Enter answers": "录入答案",
  Start: "开始",
  All: "全部",
  Uncategorized: "未分类",
  "Uncategorized ({count})": "未分类（{count}）",
  "{count} exams": "{count} 套",
  "Manage subjects": "管理学科",
  "+ New subject…": "+ 新建学科…",

  // --- sessions -----------------------------------------------------------
  History: "历史",
  "Every attempt you have submitted, newest first.":
    "所有已提交的作答，按时间倒序。",
  "Search exams…": "搜索考试…",
  "Search sessions": "搜索作答记录",
  "Loading sessions…": "正在加载作答记录…",
  "No sessions yet.": "还没有作答记录。",
  "Finish an exam and it will show up here.": "完成一次考试后，记录会出现在这里。",
  "Pick an exam": "选择一套考试",
  "No sessions match “{query}”.": "没有匹配“{query}”的作答记录。",
  "Attempt #{id}": "第 {id} 次作答",
  "unfinished": "未完成",
  "not graded": "未判分",
  "answered": "已答",
  "{count} answered": "已答 {count} 题",
  "Delete this attempt": "删除这次作答",
  "Delete this attempt of “{title}”?": "删除「{title}」的这次作答？",
  "Delete attempt {id}": "删除第 {id} 次作答",

  // --- practice -----------------------------------------------------------
  "Reading & Writing": "阅读与写作",
  Math: "数学",
  General: "综合",
  "Ready to begin": "准备开始",
  "questions · choose how the clock runs": "道题 · 请选择计时方式",
  "{count} questions · choose how the clock runs": "{count} 道题 · 请选择计时方式",
  Timer: "计时",
  "Timer mode": "计时方式",
  "Count up": "正计时",
  "Count down": "倒计时",
  Minutes: "分",
  Seconds: "秒",
  "When the clock reaches 00:00, your answers are submitted automatically.":
    "倒计时到 00:00 时会自动提交答案。",
  "The clock counts up from zero; submit whenever you are ready.":
    "从 0 开始正计时；准备好后随时提交。",
  "Default carried over from this paper's last attempt.":
    "已沿用这套试卷上次使用的计时方式。",
  "No attempt on this paper yet — defaulted to your last timer.":
    "这套试卷还没有作答记录——已沿用你最近一次的计时方式。",
  "Begin — enter fullscreen": "开始 — 进入全屏",
  "Enter answers first (optional)": "先录入答案（可选）",
  "Back to exams": "返回考试列表",
  "Time remaining": "剩余时间",
  "Time elapsed": "已用时间",
  "Time's up — submitting your answers…": "时间到——正在自动提交答案…",
  "Question {current} of {total}": "第 {current} 题 / 共 {total} 题",
  "Question {number}": "第 {number} 题",
  "Select every correct answer.": "请选择所有正确答案。",
  "Star for review": "标为待复习",
  Starred: "已标星",
  "Starred (starred)": "已标星",
  "Question {number} (starred)": "第 {number} 题（已标星）",
  "Question palette": "题目导航",
  Exit: "退出",
  Submit: "提交",
  "Your answer": "你的答案",
  Passage: "文章",
  "Text 1": "文本 1",
  "Text 2": "文本 2",
  "Submit your answers?": "提交答案？",
  "{answered} of {total} answered": "已答 {answered} / {total} 题",
  ", {count} still blank": "，还有 {count} 题未答",
  ". You can review every question afterwards.": "。提交后可以逐题复盘。",
  "Keep working": "继续作答",
  "Grading…": "判分中…",
  "Leave the exam?": "离开考试？",
  "This attempt will be left unfinished — your answers so far are not submitted and will not be graded. You can start a new attempt any time.":
    "本次作答将不会完成——当前答案不会提交，也不会判分。你随时可以重新开始。",
  "Leave exam": "离开考试",

  // --- result / review ----------------------------------------------------
  "Your result": "你的成绩",
  "Answers": "答案",
  "Answer": "答案",
  "Correct": "正确",
  "Incorrect": "错误",
  "Correct answer": "正确答案",
  "Not graded": "未判分",
  "Back to exam": "返回考试",
  "Review this attempt": "复盘这次作答",
  "Practice again": "再练一次",
  "Time": "用时",
  "Score": "得分",
  "Questions answered": "已答题数",
  "questions correct": "题正确",
  "No questions": "没有题目",
  "No answer": "未作答",
  "Not answered": "未作答",
  "Analysis": "分析",
  "Notebook": "笔记本",
  "Analysis notebook": "分析笔记本",
  "Close notebook": "关闭笔记本",
  "{count} questions analysed": "已分析 {count} 道题",
  "1 question analysed": "已分析 1 道题",
  "{count} questions with analysis": "{count} 道题有分析",
  "1 question with analysis": "1 道题有分析",
  "No analysis yet — write an analysis page and it will appear here.":
    "还没有分析——写一页分析后就会显示在这里。",
  "Preview": "预览",
  "Export": "导出",
  "Close export": "关闭导出",
  "Local files, no tokens": "本地文件，不消耗 token",
  "Downloaded.": "已下载。",
  "Downloaded — a copy was saved to {path}": "已下载——副本已保存到 {path}",
  "Exporting…": "正在导出…",
  "Export .{format}": "导出 .{format}",
  "The analysis notebook: the exam title, then every question with an analysis — stem, figures and your notes. Use Notebook in the top bar to preview it first.":
    "分析笔记本包含：试卷标题，以及每道已写分析题目的题干、图表和你的笔记。可先用顶栏的 Notebook 预览。",
  "Vocabulary sheet": "词表",
  "Export vocabulary .xlsx": "导出词表 .xlsx",
  "Export notebook": "导出笔记本",
  "Export as Markdown": "导出为 Markdown",
  "Export as DOCX": "导出为 DOCX",
  "Export as PDF": "导出为 PDF",
  "Saved to": "已保存到",
  "Downloaded": "已下载",
  "AI Tutor": "AI 辅导",
  "Ask about this question…": "就这道题提问…",
  "Ask": "提问",
  "Thinking…": "思考中…",
  "Clear chat": "清空对话",
  "AI explanations cost tokens and are only requested when you ask.":
    "AI 解析会消耗 token，只在你主动提问时调用。",
  "Pick a question to ask the AI tutor.": "选择一道题来询问 AI 辅导。",
  "The tutor sees this question, its correct answer and your choice — not your analysis notes. Explicit call: this may use tokens from your configured model.":
    "AI 辅导只会看到题目、正确答案和你的选择，不会看到你的分析笔记。这是显式调用：会消耗你所配置模型的 token。",
  "No answer key for this question — fill it in on the answer page first.":
    "这道题还没有答案——请先在答案页录入。",
  Regenerate: "重新生成",
  "Explain with AI": "让 AI 讲解",
  "Drag words from the passage or question into the vocabulary list.":
    "从文章或题目中选词拖入生词本。",
  "No analysis yet": "还没有分析",
  "No analysis yet.": "还没有分析。",
  "Pick a question to open its analysis page.": "选择一道题以打开它的分析页。",
  "Correct:": "正确答案：",
  "Yours:": "你的答案：",
  yours: "你的",
  write: "编辑",
  preview: "预览",
  template: "模板",
  "Why is the correct answer right — and why did you pick yours?\n\nMarkdown works here: **bold**, lists, $x^2$ formulas, ![figure](assets/name.png).":
    "为什么正确答案是对的——你当时为什么选了自己的答案？\n\n这里支持 Markdown：**粗体**、列表、$x^2$ 公式、![figure](assets/name.png)。",
  "Start writing…": "开始写…",
  "Saved": "已保存",
  "Saving": "保存中",
  "Unsaved changes": "未保存的修改",
  "Back to questions": "返回题目",
  "All questions": "全部题目",
  "Wrong": "错题",
  "Show all": "显示全部",
  "Question navigation": "题目导航",
  Question: "题目",
  left: "左侧",
  right: "右侧",
  "{tool} pane": "{tool}面板",
  "Switch {side} pane": "切换{side}面板",
  "{tool} is on the other side — click to swap panes":
    "{tool}已在另一侧——点击可交换面板",
  "Hide question list": "收起题目列表",
  "Show question list": "展开题目列表",
  "Close question list": "关闭题目列表",
  "Jump to question": "跳转到题目",
  "Nothing wrong here — nice work.": "没有错题——做得很好。",
  "Nothing to show.": "没有可显示的内容。",
  "no answer key": "没有答案",
  wrong: "错误",
  ungraded: "未判分",
  "Question {number} — {status}": "第 {number} 题 — {status}",
  Star: "标星",
  "Previous question": "上一题",
  "Next question": "下一题",
  "your answer": "你的答案",
  correct: "正确",
  "No answer key for this question — fill it in on the": "这道题还没有答案——请到",
  "answer page": "答案页",
  "No questions to show.": "没有可显示的题目。",
  "Select a word, then drag it onto the Vocabulary pane":
    "选中一个单词，然后拖到生词本面板",
  "Select a word here, then drag it onto the Vocabulary pane — the Merriam-Webster sense that fits the sentence is added.":
    "在这里选中一个单词，拖到生词本面板，系统会添加最贴合句子的韦氏释义。",
  "Open question list": "打开题目列表",
  "{total} questions · {graded} graded": "{total} 道题 · 已判分 {graded}",
  "{count} wrong": "{count} 道错题",
  "Could not load the analysis notebook: {error}": "无法加载分析笔记本：{error}",
  "Could not update the star: {error}": "无法更新星标：{error}",
  "Resize workspace panes": "调整面板宽度",

  // --- library ------------------------------------------------------------
  "Question bank": "题库",
  "Import a document": "导入文档",
  "Import a question bank (PDF, Word .docx, or .ifmd.md), fill in the answers, then practice in an exam-style UI.":
    "导入题库（PDF、Word .docx 或 .ifmd.md），录入答案，然后在考试式界面中练习。",
  "PDFs and Word .docx files are converted locally to InteFlow-MD — no tokens, no cloud. Questions must be numbered (1., 2., …) with two or more labelled options each.":
    "PDF 和 Word .docx 会在本地转换为 InteFlow-MD——不消耗 token、不上传云端。题目必须编号（1.、2.…），且每题至少有两个带字母的选项。",
  "Scanned PDFs are read locally with OCR ({engines}).":
    "扫描版 PDF 会使用本地 OCR 识别（{engines}）。",
  "Scanned (image-only) PDFs need OCR: install tesseract on any OS, or pyobjc-framework-Vision on macOS.":
    "纯图片扫描的 PDF 需要 OCR：可在任意系统安装 tesseract，或在 macOS 安装 pyobjc-framework-Vision。",
  "No subject": "不归入学科",
  inline: "随文答案",
  external: "外部答案",
  none: "无",
  pending: "待录入",
  "Drag a file here, or": "把文件拖到这里，或",
  "choose a file": "选择文件",
  "Converting…": "正在转换…",
  "{count} questions imported from {file} · answers: {status}":
    "已从 {file} 导入 {count} 道题 · 答案：{status}",
  " · {answered}/{total} filled": " · 已填 {answered}/{total}",
  "Start practice": "开始练习",
  "Practice": "练习",
  "no questions": "没有题目",
  "{answered}/{total} answers": "{answered}/{total} 题已录答案",
  "just imported": "刚刚导入",
  "needs answers": "待录答案",
  "Your exams": "我的试卷",
  "Nothing imported yet.": "还没有导入任何内容。",
  "No exams in this subject yet.": "该学科下还没有考试。",
  "Conversion is taking too long — reload the page to check its status.":
    "转换时间过长——请刷新页面查看状态。",
  "Or start from the .ifmd.md template": "或从 .ifmd.md 模板开始",
  "A plain-text format you can write or edit by hand — imported with zero tokens and no cloud. Questions use a :::q block with A–E or more labelled options (no options at all makes it a fill-in-the-blank).":
    "可直接手写或编辑的纯文本格式——零 token、无需云端即可导入。题目使用 :::q 区块，选项从 A–E 起（完全没有选项时按填空题处理）。",
  "Copy template": "复制模板",
  "Copied ✓": "已复制 ✓",
  "Download .ifmd.md": "下载 .ifmd.md",
  "Import": "导入",
  "Import a paper": "导入试卷",
  "Drop a PDF, DOCX or InteFlow-MD file here, or click to choose.":
    "把 PDF、DOCX 或 InteFlow-MD 文件拖到这里，或点击选择。",
  "Choose file": "选择文件",
  "Uploading…": "上传中…",
  "Importing…": "导入中…",
  "Question banks": "题库",
  "Import bank": "导入题库",
  "Import a bank ZIP: manifest.json + one folder per unit, or several .ifmd.md files. Imports stay local (0 tokens).":
    "导入题库 ZIP：可以是 manifest.json + 每个单元一个文件夹，也可以是若干 .ifmd.md 文件。导入只保存在本地（0 token）。",
  "Imported “{title}” · {units} units · {questions} questions.":
    "已导入「{title}」：{units} 套、{questions} 题。",
  imported: "已导入",
  "Remove bank": "移除题库",
  "Remove “{title}” and its bank files? Exams already in the Library stay.":
    "移除「{title}」及其题库文件？已经加入 Library 的试卷会保留。",
  "Built-in library": "内置题库",
  "built-in": "内置",
  "Adding…": "正在添加…",
  "All in library": "已全部在库中",
  "In library": "已在库中",
  "Open in library": "在题库中打开",
  "{count} modules added": "已添加 {count} 个单元",
  "Everything is already in your library": "所有单元都已经在你的题库中",
  "{modules} modules · {questions} questions · answers included · offline (0 tokens)":
    "{modules} 个单元 · {questions} 道题 · 含答案 · 离线（0 token）",
  "{added}/{total} in library": "已加入题库 {added}/{total}",
  "Module {number}": "第 {number} 单元",
  "Added": "已添加",
  "Add all": "全部添加",
  "Add all {count}": "添加全部 {count} 套",
  "Manage": "管理",
  "Papers": "试卷",
  "My papers": "我的试卷",
  "Search papers…": "搜索试卷…",
  "No papers yet.": "还没有试卷。",
  "Subject": "学科",
  "Subject color": "学科颜色",
  "Color {name}": "颜色：{name}",
  "Subject for {title}": "为「{title}」设置学科",
  "New subject name": "新学科名称",
  "e.g. SAT Math": "例如 SAT 数学",
  "Add subject": "添加学科",
  "Subject name must not be empty.": "学科名称不能为空。",
  "Close subjects": "关闭学科管理",
  "Group papers by subject. Renaming updates every paper; deleting moves its papers to Uncategorized.":
    "按学科归类试卷。改名会更新所有试卷；删除学科会把它的试卷移到未分类。",
  "No subjects yet. Add your first one above.": "还没有学科。请在上方添加第一个。",
  "Name for {name}": "重命名「{name}」",
  "Deleting…": "正在删除…",
  " Its {count} papers will become uncategorized.": " 它的 {count} 套试卷将变为未分类。",
  "Delete “{name}”?{extra}": "删除「{name}」？{extra}",
  "{count} papers": "{count} 套试卷",
  Blue: "蓝色",
  Emerald: "翡翠绿",
  Green: "绿色",
  Amber: "琥珀色",
  Rose: "玫瑰红",
  Violet: "紫罗兰",
  Cyan: "青色",
  Lime: "青柠",
  Slate: "石板灰",
  "Subjects": "学科",
  "New subject": "新建学科",
  "Subject name": "学科名称",
  "Color": "颜色",
  "Rename": "重命名",
  "Delete subject": "删除学科",
  "Delete subject “{name}”? Papers stay, but become uncategorized.":
    "删除学科「{name}」？试卷会保留，但变为未分类。",
  "All subjects": "全部学科",
  "Filter by subject": "按学科筛选",
  "Save subject": "保存学科",
  "Document": "文档",
  "View questions": "查看题目",
  "Delete paper": "删除试卷",
  "Delete “{title}” and all its questions, answers and analyses?":
    "删除「{title}」及其所有题目、答案和分析？",
  "This cannot be undone.": "此操作无法撤销。",

  // --- answer key ---------------------------------------------------------
  "Nothing recognized — expected something like 1-A 2-C 3-D, or ACBD…":
    "没有识别到答案——格式示例：1-A 2-C 3-D，或 ACBD…",
  "Parsed {count} answer(s) from the pasted text.": "已从粘贴内容中解析出 {count} 个答案。",
  "Saved {answered}/{total} answers.": "已保存 {answered}/{total} 个答案。",
  "{count} questions · {filled}/{total} filled": "{count} 道题 · 已填 {filled}/{total}",
  " · source had: {status} answers": " · 原文答案来源：{status}",
  "Save & view results": "保存并查看结果",
  "Save answers": "保存答案",
  "You just submitted an attempt — enter the answer key to grade it, then you'll see the results.":
    "你刚刚提交了一次作答——录入答案后即可判分并查看结果。",
  "Bulk entry": "批量录入",
  "Paste 1-A 2-C 3-D, 1. A, ACBDA, or 3-AC for multiple answers.":
    "可粘贴 1-A 2-C 3-D、1. A、ACBDA，多选题可用 3-AC。",
  "Apply to grid": "应用到答题卡",
  multi: "多选",
  "Fill in the blank · list every acceptable answer":
    "填空题 · 列出所有可接受的答案",
  "Another acceptable answer": "另一个可接受答案",
  "Accepted answer {number} for question {question}":
    "第 {question} 题的可接受答案 {number}",
  "Remove answer {number} for question {question}": "移除第 {question} 题的答案 {number}",
  "Add acceptable answer": "添加可接受答案",
  "First question as the practice UI will render it.":
    "第一题在练习界面中的显示效果。",
  "All set — start practice": "全部完成 — 开始练习",
  "Answer key": "答案与解析",
  "Enter the answer key": "录入答案",
  "Answer entry": "答案录入",
  "Answers saved.": "答案已保存。",
  "Question text": "题干",
  "Correct letters": "正确选项",
  "Multiple answers": "多选",
  "Add another accepted answer": "添加另一个可接受答案",
  "Remove answer": "移除答案",
  "Fill in the blank": "填空题",
  "Choice": "选择题",
  "Section": "板块",
  "Image": "图片",
  "Source": "来源",
  "Back to library": "返回题库",
  "No questions in this paper.": "这套试卷里没有题目。",
  "Write the accepted answers, separated by | for alternatives.":
    "填写可接受的答案；多个备选答案用 | 分隔。",

  // --- vocabulary ---------------------------------------------------------
  Reference: "参考",
  "{exams} exams · {words} words": "{exams} 套试卷 · {words} 个单词",
  "Filter exams…": "筛选考试…",
  "Filter exams": "筛选考试",
  "No exam matches that filter.": "没有符合筛选条件的考试。",
  "No words yet — add from the workspace": "还没有单词——可从复盘工作台添加",
  "Saved ✓": "已保存 ✓",
  "Added “{word}”.": "已添加「{word}」。",
  "Updated “{word}”.": "已更新「{word}」。",
  "Added “{word}”{pos} — {definition}": "已添加「{word}」{pos} — {definition}",
  "unsaved changes": "未保存的修改",
  "Export .xlsx": "导出 .xlsx",
  "POS (e.g. adj.)": "词性（如 adj.）",
  "Notes (optional)": "笔记（可选）",
  "Add word": "添加单词",
  "Loading words…": "正在加载单词…",
  "Could not load this word list.": "无法加载这份词表。",
  Dictionary: "词典",
  "Dictionary lookup": "查词",
  "Look up a word…": "查一个单词…",
  "Look up a word": "查词",
  "Merriam-Webster is not installed. Put the Eudic .eudb file in the dictionary/ folder, then reload.":
    "未安装韦氏词典。请把 Eudic .eudb 文件放入 dictionary/ 目录，然后刷新页面。",
  "Merriam-Webster is not installed. Put the Eudic .eudb file in the":
    "未安装韦氏词典。请把 Eudic .eudb 文件放入",
  "folder, then reload.": "目录，然后刷新页面。",
  "The local index is built automatically on first lookup (about 10 seconds). Only English-English definitions are shown.":
    "首次查词时会自动建立本地索引（约 10 秒）。只显示英英释义。",
  "{title} · {count} entries": "{title} · {count} 个词条",
  " · {count} with English-learner definitions": " · {count} 条含英语学习者释义",
  "local, no tokens.": "本地查询，不消耗 token。",
  "My dictionary: {count} words": "我的词典：{count} 个单词",
  " · checked first": " · 优先查询",
  " · off in Settings": " · 已在设置中关闭",
  "No exact entry. Pick a suggestion below.": "没有完全匹配的词条，请从下方建议中选择。",
  "Collegiate definition": "大学词典释义",
  Suggestions: "建议",
  "Auto-fill definitions in the word list": "自动填入释义",
  "When you drag a word into the Vocabulary pane, fill its Meaning with the Merriam-Webster definition automatically. Turn this off to add the word with an empty Meaning and write your own definition.":
    "拖词进生词本时，自动把韦氏释义填入 Meaning。关闭后只添加单词，Meaning 留空，由你自己写释义。",
  "Look up dictionary words while typing": "输入时自动查词",
  "The Dictionary tool queries the built-in Merriam-Webster index as you type. Turn it off to look up only when you press Enter, or to add your own definition instead.":
    "词典工具会在输入时自动查询内置韦氏索引。关闭后只有按回车才查询，也方便直接添加自己的释义。",
  "{title} · {count} entries · local, no tokens.":
    "{title} · {count} 个词条 · 本地查询，不消耗 token。",
  "Merriam-Webster · local, no tokens.": "韦氏词典 · 本地查询，不消耗 token。",
  "Look up any word from the question.": "查题干里的任意单词。",
  "Definitions come from the bundled Merriam-Webster index. Your own definitions are checked first.":
    "释义来自内置韦氏索引；如果有自定义释义，会优先查询。",
  "Add my own definition": "添加自定义释义",
  "Can't find it? Add my own definition": "没找到？添加自定义释义",
  "Part of speech (optional)": "词性（可选）",
  "Save definition": "保存释义",
  "Saved “{word}” to My dictionary ({count} words).":
    "已把「{word}」保存到我的词典（共 {count} 个单词）。",
  "Auto lookup is off — press Enter in the search box to look a word up.":
    "自动查词已关闭——在搜索框按回车查词。",
  "Your own definitions are saved locally and checked first.":
    "自定义释义保存在本地，并优先查询。",
  "Auto lookup is on. Change it in Settings → Look up dictionary words while typing.":
    "自动查词已开启。可在 设置 → 输入时自动查词 中修改。",
  "Auto lookup is off. Change it in Settings → Look up dictionary words while typing.":
    "自动查词已关闭。可在 设置 → 输入时自动查词 中修改。",
  "No exams yet": "还没有考试",
  "Import an exam, then drag words from the review workspace into its vocabulary list. Every exam keeps its own list, and re-practising edits the same one.":
    "先导入一套考试，然后在复盘工作台中把单词拖入它的词表。每套试卷都有自己的词表，重新练习时会编辑同一份。",
  "How words get here": "单词从哪里来",
  "+ Row": "+ 行",
  "+ Column": "+ 列",
  "Reset view": "重置视图",
  "{count} words": "{count} 个单词",
  "{count} shown": "显示 {count} 个",
  "Column name": "列名",
  "Sort column": "排序列",
  "Sort by {column}": "按「{column}」排序",
  "Delete column": "删除列",
  "Delete {column}": "删除「{column}」",
  "Filter…": "筛选…",
  "Filter {column}": "筛选「{column}」",
  "Resize {column}": "调整「{column}」宽度",
  "Add column": "添加列",
  "{column} row {row}": "{column} 第 {row} 行",
  "Delete row": "删除行",
  "Delete row {row}": "删除第 {row} 行",
  "No words yet — add your first row.": "还没有单词——先添加一行。",
  "No rows match the filter.": "没有符合筛选条件的行。",
  "Vocabulary pane": "生词本面板",
  unsaved: "未保存",
  "Add a word manually…": "手动添加单词…",
  "Add a word manually": "手动添加单词",
  "Added “{word}”. Add a meaning below or in the Vocabulary page.":
    "已添加「{word}」。可在下方或生词本页面补充释义。",
  "Could not load vocabulary.": "无法加载生词本。",
  "Drop to add · Merriam-Webster sense for this sentence":
    "松开以添加 · 使用最贴合这句话的韦氏释义",
  "Looking up the word…": "正在查词…",
  "Drag a word from a question or option onto the Vocabulary pane in the review workspace — the dictionary sense that fits the sentence is added. AI sense matching, English-learner definitions, and My dictionary can be toggled in Settings. You can also add words here or edit any cell above.":
    "在复盘工作台中，把题目或选项里的单词拖到生词本面板，系统会添加最贴合句子的词典义项。AI 义项匹配、英语学习者释义和「我的词典」都可以在设置中切换。你也可以在这里手动添加单词，或直接编辑上方表格。",
  "Could not load vocabulary: {error}": "无法加载生词本：{error}",
  "Loading vocabulary…": "正在加载生词本…",
  "Go to Library": "前往题库",
  "Word list": "单词表",
  "Vocabulary views": "生词本视图",
  "Word test": "单词考试",
  "My words": "我的单词",
  "Select an exam to see its word list.": "选择一套试卷查看词表。",
  "No words yet.": "还没有单词。",
  "Word": "单词",
  "Meaning": "释义",
  "Notes": "笔记",
  "Look up": "查词",
  "Search the dictionary…": "搜索词典…",
  "No entry found.": "没有找到词条。",
  "Merriam-Webster": "韦氏词典",
  "Custom dictionary": "自定义词典",
  "Definition": "释义",
  "Part of speech": "词性",
  "Export word list": "导出词表",
  "Delete word": "删除单词",
  "Delete “{word}” from the list?": "从词表中删除「{word}」？",
  "Add from dictionary": "从词典添加",
  "Start word test": "开始单词考试",
  "See the word, write its meaning.": "看单词，写出它的释义。",
  "See the meaning, spell the word.": "看释义，拼写单词。",
  "Write its meaning": "写出它的释义",
  "Spell the English word": "拼写英文单词",
  "Type the meaning…": "输入释义…",
  "Type the word…": "输入单词…",
  "Submit test": "提交测试",
  "Submit now": "立即提交",
  "Test how well “{title}” stuck — {count} words in this list.":
    "测试「{title}」记得怎么样——词表中共有 {count} 个单词。",
  "This list is empty": "这个词表是空的",
  "Drag words into the Vocabulary pane while reviewing, or add them in the word list, then come back to take a test.":
    "复盘时把单词拖入生词本面板，或直接在词表中添加，然后回来考试。",
  "Back to word list": "返回单词表",
  Mode: "模式",
  "Local grading compares text, so an English definition from the list works best. Enable AI grading in Settings to accept a Chinese paraphrase.":
    "本地判分按文本比较，所以填写词表中的英文释义效果最好。如需接受中文释义，可在设置中开启 AI 判分。",
  "How many words": "单词数量",
  "All {count} words": "全部 {count} 个单词",
  "Random selection from the list.": "从词表中随机抽取。",
  "Checking how this test will be graded…": "正在检查本次测试的判分方式…",
  "AI grading is on — your model checks both directions against the word list and Merriam-Webster.":
    "AI 判分已开启——模型会参考词表与韦氏词典检查两个方向。",
  "AI grading is on, but no model is configured yet, so grading stays local.":
    "AI 判分已开启，但还没有配置模型，因此仍使用本地判分。",
  "AI grading is off — grading is local and free.":
    "AI 判分已关闭——使用本地免费判分。",
  "Building test…": "正在生成测试…",
  "Start test": "开始测试",
  "Word test result": "单词考试结果",
  "New test": "再测一次",
  Accuracy: "正确率",
  Scope: "考察范围",
  "{tested} of {eligible} eligible words": "考察 {tested} / {eligible} 个可用单词",
  " · {count} skipped (no meaning)": " · 跳过 {count} 个（没有释义）",
  "{correct} / {total} correct": "{correct} / {total} 题正确",
  "All {count} eligible words were tested.": "已考察全部 {count} 个可用单词。",
  "{tested} of {eligible} eligible words were tested.":
    "已考察 {tested} / {eligible} 个可用单词。",
  "List positions: {positions}": "词表位置：{positions}",
  "AI graded": "AI 判分",
  "Local grading": "本地判分",
  "local fallback": "本地兜底",
  local: "本地",
  "Result QR": "结果二维码",
  "{count} codes": "{count} 个二维码",
  "Download .json": "下载 .json",
  "Encodes the accuracy, the tested word range, and every word's correct answer and your answer. Large tests produce several codes — scan them in order; each starts with IFWT1|<id>|part/total|.":
    "二维码包含正确率、考察范围，以及每个单词的正确答案和你的答案。题量大时会生成多个二维码——请按顺序扫描；每个都以 IFWT1|<id>|part/total| 开头。",
  "Word exam result part {number}": "单词考试结果第 {number} 部分",
  "Part {part} of {total}": "第 {part} / {total} 部分",
  "Every word": "每个单词",
  "Prompt: {prompt}": "题面：{prompt}",
  "Number of words": "单词数量",
  "Test all": "全测",
  "English → Chinese": "英译中",
  "Chinese → English (spelling)": "中译英（拼写）",
  "Exam mode": "考试模式",
  "Your answer…": "你的答案…",
  "Correct rate": "正确率",
  "Range": "考察范围",
  "Expected": "正确答案",
  "Your response": "你的作答",
  "Download JSON": "下载 JSON",
  "Test again": "再测一次",
  "Choose an exam": "选择一套试卷",
  "The word list is empty.": "词表是空的。",
  "Words tested": "考察单词数",
  "Result": "结果",

  // --- review / mistakes --------------------------------------------------
  "Review sets": "复习集",
  "Your latest wrong answers and the questions you starred, across every attempt. Read or write the analysis here — it is the same notebook as the review workspace.":
    "汇总所有作答中的最近错题与你标星的题目。可在这里读写分析——与复盘工作台使用同一套笔记本。",
  "Search papers, stems and options…": "搜索试卷、题干和选项…",
  "Search review sets": "搜索复习集",
  "Newest first": "最新优先",
  "Oldest first": "最早优先",
  "All exams": "全部试卷",
  "Filter by exam": "按试卷筛选",
  "Loading mistakes…": "正在加载错题…",
  "Loading starred questions…": "正在加载精选题…",
  "No mistakes yet.": "还没有错题。",
  "No starred questions yet.": "还没有精选题。",
  "No questions match.": "没有匹配的题目。",
  "Submit an attempt and every wrong answer will collect here.":
    "提交一次作答后，所有错题都会汇总到这里。",
  "Tap ☆ Star while practising or reviewing to build this set.":
    "在练习或复盘时点击 ☆ 标星，即可建立这个集合。",
  "Try a different search or exam filter.": "换一个搜索词或试卷筛选试试。",
  "Open attempt": "打开这次作答",
  "Earlier analyses": "早期分析",
  "Legacy analysis": "旧版分析",
  "Saved analysis": "已保存分析",
  "Pick a question": "选择一道题",
  "Its question, answers and analysis will open here.":
    "题目、答案和分析会显示在这里。",
  "Correct: {answer}": "正确答案：{answer}",
  "Yours: {answer}": "你的答案：{answer}",
  "Star question {number}": "为第 {number} 题标星",
  "Unstar question {number}": "取消第 {number} 题的星标",
  "Remove from Starred": "取消星标",
  "Add to Starred": "添加到精选题",
  "Select a question": "选择一道题",
  "Hide panel": "收起面板",
  Explanation: "解析",
  "Select a question in the list.": "请在列表中选择一道题。",
  "Why is the correct answer right? Write it in your own words…":
    "为什么正确答案是对的？用你自己的话写下来…",
  "AI Answer": "AI 答案",
  "No answer key for this question — enter the answers first.":
    "这道题还没有答案——请先录入答案。",
  "Context: this question + its correct answer only.":
    "上下文：仅包含这道题和它的正确答案。",
  "Questions, answers and explanations as a document (no AI involved).":
    "把题目、答案和解析导出为文档（不涉及 AI）。",
  "Save the explanation first — unsaved changes are not included.":
    "请先保存解析——未保存的修改不会包含在导出中。",
  "Question {number} · {section}": "第 {number} 题 · {section}",
  "Mistakes": "错题",
  "Starred questions": "精选题",
  "Search questions or options…": "搜索题干或选项…",
  "Sort": "排序",
  "Show analysis": "查看分析",
  "Hide analysis": "收起分析",
  "No analysis for this question yet.": "这道题还没有分析。",

  // --- import pipeline ----------------------------------------------------
  Detect: "识别",
  Convert: "转换",
  Commit: "确认",
  "text layer": "文本层",
  "OCR · low confidence": "OCR · 置信度低",
  "OCR unavailable": "OCR 不可用",
  "OCR failed": "OCR 失败",
  "no text": "无文本",
  detecting: "正在识别",
  converting: "正在转换",
  review: "待检查",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
  "Import failed": "导入失败",
  "Import cancelled": "导入已取消",
  "Import pipeline": "导入流程",
  "source: {source}": "来源：{source}",
  "counting pages": "正在统计页数",
  "{done}/{total} pages": "{done}/{total} 页",
  "Conversion progress": "转换进度",
  "Pages ({done}/{total})": "页面（{done}/{total}）",
  "Page {number}": "第 {number} 页",
  "from file": "来自文件",
  "external key": "外部答案",
  "AI used": "使用 AI",
  yes: "是",
  "no (0 token)": "否（0 token）",
  "Run AI fallback on unreadable pages": "对无法识别的页面运行 AI 兜底",
  "Running AI fallback…": "正在运行 AI 兜底…",
  "Uses the configured LLM to extract questions from pages with OCR issues ({count} pages).":
    "使用配置的模型从 OCR 有问题的页面中提取题目（共 {count} 页）。",
  "Looks good — import": "确认无误 — 导入",
  "Review the pages above before importing.": "导入前请先检查上面的页面。",
  "Imported {count} questions.": "已导入 {count} 道题。",
  "Preparing…": "准备中…",
  "Detecting file type…": "正在识别文件类型…",
  "Converting pages…": "正在转换页面…",
  "Conversion finished. Review the result before saving.":
    "转换完成。请检查结果后再保存。",
  "Import finished.": "导入完成。",
  "Import failed.": "导入失败。",
  "Review import": "检查导入结果",
  "Commit import": "确认导入",
  "Cancel import": "取消导入",
  "Page": "页",
  "Questions found": "识别到的题目",
  "Pages": "页数",
  "Warnings": "警告",
  "No warnings.": "没有警告。",
  "Low confidence": "置信度低",
  "Used AI": "使用了 AI",
  "Built-in": "内置",
  "Add to my papers": "添加到我的试卷",
  "Already added": "已添加",
  "Open": "打开",
  "Subject for this import": "本次导入的学科",
  "Select a subject…": "选择学科…",

  // --- custom dictionary --------------------------------------------------
  "My dictionary": "我的词典",
  "Entries": "词条",
  "Import dictionary": "导入词典",
  "Add entry": "添加词条",
  "Search my dictionary…": "搜索我的词典…",
  "No entries yet.": "还没有词条。",
  "No matching entries.": "没有匹配的词条。",
  "Import CSV / TSV / JSON / TXT": "导入 CSV / TSV / JSON / TXT",
  "Imported {added} new, updated {updated}, skipped {skipped}.":
    "导入完成：新增 {added} 条，更新 {updated} 条，跳过 {skipped} 条。",
  "Delete entry “{word}”?": "删除词条「{word}」？",

  // --- themes -------------------------------------------------------------
  Appearance: "外观",
  Theme: "主题",
  "Applies to the whole workspace — the practice screen keeps its own high-contrast look. Saved locally on this machine.":
    "应用于整个工作区——考试页面保留自己的高对比度外观。偏好保存在本机。",
  "Blue on white, crisp rules and square corners. The calm default.":
    "白底蓝字，清晰的线条与直角。沉稳的默认外观。",
  "Warm paper, serif headings, seal-red accents. A printed booklet.":
    "暖色纸张、衬线标题与印章红点缀，像一本印刷小册子。",
  "Neutral greys, no decoration, near-black accents. Notion-quiet.":
    "中性灰、无多余装饰、近黑色点缀，安静得像 Notion。",
  "Deep navy ground with a soft blue highlight. For late sessions.":
    "深海军蓝底色配柔和蓝色高光，适合夜间学习。",
  "Cream paper, terracotta accents, magazine-scale headings.":
    "奶油纸色、陶土色点缀与杂志级大标题。",
  "Clear Blue": "Clear Blue",
  "Paper & Ink": "Paper & Ink",
  "Minimal Light": "Minimal Light",
  "Midnight Navy": "Midnight Navy",
  "Warm Editorial": "Warm Editorial",

  // --- toasts / common ----------------------------------------------------
  "Copied": "已复制",
  "Something went wrong.": "出了点问题。",
  "Show more": "显示更多",
  "Show less": "收起",
};

function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] === undefined || vars[key] === null ? match : String(vars[key]),
  );
}

export function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

export function translate(
  language: Language,
  source: string,
  vars?: MessageVars,
): string {
  const template = language === "zh" ? MESSAGES[source] ?? source : source;
  return interpolate(template, vars);
}

export function localeFor(language: Language): string {
  return language === "zh" ? "zh-CN" : "en-US";
}

interface I18nValue {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (source: string, vars?: MessageVars) => string;
}

const I18nContext = createContext<I18nValue>({
  language: "en",
  locale: "en-US",
  setLanguage: () => undefined,
  t: (source, vars) => interpolate(source, vars),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      /* private mode: the choice still applies for this visit */
    }
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  // Keep multiple tabs in sync with the same preference.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY) return;
      setLanguageState(event.newValue === "zh" ? "zh" : "en");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);
  const t = useCallback(
    (source: string, vars?: MessageVars) => translate(language, source, vars),
    [language],
  );
  const value = useMemo<I18nValue>(
    () => ({ language, locale: localeFor(language), setLanguage, t }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Shorthand for components that only need the translation function. */
export function useT(): I18nValue["t"] {
  return useContext(I18nContext).t;
}
