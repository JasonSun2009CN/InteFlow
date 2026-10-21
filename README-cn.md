# InteFlow

> 本地优先（local-first）的学习工作流：**导入题库（PDF/DOCX/Markdown）→ 刷题 → 逐题复盘错题 → 写解析 / 查词 / 问 AI → 导出错题分析与生词文件。**

**English**: [README.md](README.md)

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/pytest-304%20passed-2E7D32)

---

## 目录

- [它是什么](#它是什么)
- [核心特性](#核心特性)
- [两条铁律](#两条铁律)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [使用方法](#使用方法)
- [可选功能](#可选功能)
- [配置与环境变量](#配置与环境变量)
- [开发与测试](#开发与测试)
- [项目结构](#项目结构)
- [常见问题排查](#常见问题排查)
- [相关文档](#相关文档)
- [License](#license)

---

## 它是什么

InteFlow 是一个**跑在你自己电脑上的 Web 应用**（FastAPI 后端 + React 前端 + SQLite 单文件）。
把题库文档（PDF / Word / Markdown）拖进来，它会在**本地、不花任何 token** 的情况下解析成结构化题目；
然后给你一个干净的考试风格全屏练习界面，做完自动判分，并在复盘工作区里逐题处理错题：写自己的解析、
攒生词本、以及（只有你显式点击时才）调用 AI 讲解。最后把复盘和生词导出成文件。

它起源于一个 SAT 刷题工具，但**不局限于 SAT**：题目的「板块」是自由标签（`rw`、`math`、`physics`、`history` …），
任何「带题号、每题四个选项」的题库都能用。

```
导入 PDF / DOCX / Markdown ──► 本地解析（0 token）──► 补录答案
        ──► 考试风格全屏练习 ──► 判分 + 复盘工作区
        ──► 解析 / 生词 / AI 讲解 ──► 导出复盘 · 生词
```

## 核心特性

| 模块 | 能力 |
|---|---|
| **导入** | PDF（PyMuPDF 确定性转换：分栏/题号/选项/**答案键回填**/图片抽取）、DOCX（段落/表格/图片 + zip 安全校验）、`.md` / `.ifmd.md`、**扫描件 OCR**（macOS Vision 或系统 `tesseract`）、导入流水线（逐页报告、可取消）、上限 60 MB |
| **内置题库** | `SAT机考25年语文合集（下）` —— **44 个单元 / 1186 题**，离线一键 **Add** / **Add all**，0 token，幂等 |
| **资料库** | 文档列表（题数、已作答数、答案状态）、练习历史、删除（级联） |
| **学科分类** | 自定义学科（如 SAT Math、Physics）+ 颜色；每套试卷最多一个学科，可在 Library 行内或答案页顶部直接归类、现场新建；支持改名/换色/删除与按学科筛选。删除学科只把试卷移回 Uncategorized，不影响题目/答案/分析/词表 |
| **答案录入** | 选择题 A–Z 网格（题面有几个选项就显示几个，如 AMC 的 A–E；**多选**题可勾多个）+ **填空题多答案**（加号添加可接受答案）+ **批量粘贴**（`1-A 2-C` / `1. A` / `ACBDA` / 多选 `3-AC` / `1-E`）+ 校验 + 预览，同步回写源文件 |
| **练习** | 考试风格全屏、**正计时 / 倒计时两种计时**、单题视图、题号导航、标记、键盘 `选项字母` / `← →`、多选与填空作答、交卷确认 |
| **结果 / 复盘** | 得分 / 分板块 / 用时统计、**全屏复盘**（无侧栏）、`All · Correct · Wrong` 过滤、左上角可折叠题号导航、左题面 + 右 Pages 式分析编辑器（自动保存 / 续写）、补键重判（regrade） |
| **工作区** | 每题分析页（Markdown，支持公式/图片）、生词表 `Word \| Meaning \| Notes`（增删改 + 导出 `.xlsx`）、**AI 讲解**（显式触发）、导出抽屉 |
| **生词本** | 一套试卷一份词表（Word · POS · Meaning · Notes）、本地韦氏词典查词、拖词入表、按条添加、`.xlsx` 导出 |
| **单词考试** | Vocabulary 页内 **Word list / Word test** 两 tab：随机抽题或全测，**English → Chinese**（手写释义，本地宽松判分）或 **Chinese → English**（看释义拼写，忽略大小写/空格/标点）；结果含正确率、考察范围、每题正确答案/用户答案 + 紧凑 JSON 二维码；可选 AI 严格判分 |
| **错题集 / 精选题集** | 侧栏 **Review**：**Mistakes** 按题去重并保留最近一次作答（后来做对自动移出）；**Starred** 是练习/复盘/错题列表中点星收藏的题目。支持按套题/题干/选项搜索、exam 过滤、时间正倒序，并共用分析编辑器；旧分析只读列出 |
| **导出** | **PDF**（WeasyPrint，页脚页码、图片、MathJax SVG 公式）、**DOCX**（python-docx）、**复盘笔记本 md/docx/pdf**（只含已写解析的题，存 `data/exports/`）、生词 **`.xlsx`** |
| **设置** | 19 家 LLM 服务商目录、protocol（openai / anthropic）、Base URL、API Key（掩码）、模型、连通性测试、**用户名**（导出封面）、**题目识别 API 兜底**、**AI 选义**、**Definition for English Learners**、**My dictionary**、**单词考试 AI 评分** |

> **词典说明**：本地韦氏 `.eudb` 的索引里会保留部分词条自带的 **Definition for English Learners** 栏目；
> 开启对应设置后优先显示该栏，没有就回退普通释义。**My dictionary** 是独立的用户词典，可在 Settings
> 导入 CSV / TSV / JSON / TXT 或手动增删；开启后查词先自定义、再韦氏，全部 0 token。

## 两条铁律

1. **LLM 不在主链路**：导入/解析/判分/导出默认都是确定性本地计算，**0 token**；只有显式操作才会调用外部 API：
   复盘页点 **AI Answer**、手动点连通性测试，或在 Settings 开启 **AI grading for word tests** 后提交单词考试
   （默认关闭；无 key/失败会自动回退本地判分）。
2. **本地优先**：所有数据都在仓库的 `data/` 目录（`app.db` + 每篇文档的 `doc.ifmd.md` 和图片），不上传任何云端。

## 环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Python | **3.11+**（实测 3.13） | 后端 |
| Node.js | **18+** | 前端构建 / dev server；（可选）导出公式渲染 |
| `pip install -r backend/requirements.txt` | — | fastapi · uvicorn · pymupdf · httpx · weasyprint · python-docx · openpyxl · cairosvg … |
| `npm install`（`frontend/`） | — | React 19 + Vite 7 + Tailwind 4 |

<details>
<summary><b>WeasyPrint（PDF 导出）需要的系统库</b></summary>

PDF 导出依赖 pango/cairo/gdk-pixbuf/harfbuzz：

```bash
# macOS
brew install pango cairo gdk-pixbuf harfbuzz

# Debian / Ubuntu
sudo apt install libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 libharfbuzz0b
```

未安装时**只有 PDF 导出会失败**，其余功能不受影响。
</details>

## 快速开始

### 一键启动（推荐）

```bash
git clone <你的仓库地址> InteFlow
cd InteFlow

# macOS / Linux
./start.sh
```

```powershell
# Windows (PowerShell)
.\start.ps1
```

`start.sh` / `start.ps1` **幂等**：首次运行自动建 `.venv`、装前后端依赖（缺才装），之后再运行直接启动。
它会同时拉起**后端 :8000** 与**前端 :5173**，等后端健康后**自动打开浏览器**，按 `Ctrl-C` 同时停止两端。

- **macOS 双击启动**：在 Finder 里双击 **`InteFlow.command`**。
- **Windows 双击启动**：双击 **`start.bat`**。
- 换端口：`INTEFLOW_BACKEND_PORT=8010 INTEFLOW_FRONTEND_PORT=5174 ./start.sh`
  （Windows：`$env:INTEFLOW_FRONTEND_PORT=5174; .\start.ps1`）。
- 端口被占用、缺 Python/Node、依赖异常时会给出明确提示并退出。

- 后端 API：<http://localhost:8000>（健康检查 <http://localhost:8000/api/health>）
- 前端页面：<http://localhost:5173> ← **浏览器打开这个**

<details>
<summary><b>分步启动（先 setup 再 dev）与纯手动启动</b></summary>

```bash
# 步骤 1：只建环境 + 装依赖（幂等）
./scripts/setup.sh          # Windows: .\scripts\setup.ps1

# 步骤 2：启动开发环境
./scripts/dev.sh            # Windows: .\scripts\dev.ps1
```

```bash
# 1) 后端（终端 A）
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --reload --port 8000

# 2) 前端（终端 B）
cd frontend
npm install
npm run dev
```
</details>

## 使用方法

> 界面为英文，下面保留按钮/页面的英文原文方便对照。

### 1. 导入题库

打开 <http://localhost:5173>，左侧栏固定六个 tab：**Exams**（选卷开考）、**Library**（导入文件 / 内置题库 / 试卷列表 / 学科管理 / 删除）、
**Sessions**（作答历史：**只有提交过才记录**，可搜索/删除）、**Review**（错题集 + 精选题集）、**Vocabulary**（按试卷整理生词 + 本地韦氏查词 + 拖词入表 + 单词考试）、**Settings**（LLM / 用户名 / 兜底 / 生词本 / 单词考试评分开关）。桌面端可点侧栏顶部按钮收缩为**纯图标 Compact 栏**（悬浮显示名称），选择会记住（`inteflow.sidebar.compact`）；移动端抽屉始终完整显示。

1. 点侧栏 **Library** 进入题库页。
2. **上传文件**：把文件拖到 *Drag a file here* 区域，或点 **choose a file**。
   支持 `PDF · DOCX · .md · .markdown · .ifmd.md`（≤ 60 MB；题目需带编号 `1.` `2.` …；选择题四个选项，**无选项按填空处理**）。
3. **等待流水线跑完**：`detect → convert → review` 三阶段，附**逐页报告**（该页是文本/OCR/低置信/无引擎）。
   - 转换结果干净 → 自动提交入库；
   - 有疑点 → 停在复核阶段，由你点 **Commit** 落库或 **Cancel** 取消（全程 0 token）。
4. **（可选）用内置题库**：Library 页的题库卡展开后按日期分组列出 44 个单元，单个点 **Add**，或点 **Add all** 整库导入。
5. **回首页开考**：返回 **Select an exam**，新导入的卷子直接点 **Start** 开考。

**按学科分组（可选）**：Library 每套试卷那一行有 **Subject** 下拉，选已有学科，或点 **+ New subject…**
现场创建（如 *SAT Math*）并立即归类；上传框上方也能预选“这次导入归到哪个学科”。**Manage subjects**
可改名、换色、删除；删除只把试卷移回 *Uncategorized*，题目、答案、分析、词表都不动。**Exams** 首页显示
学科徽章并支持按学科筛选，答案录入页顶部也能直接改学科。

<details>
<summary>没有题库文件？自己写 IFMD</summary>

Library 页的模板卡提供一份可复制/下载的 `.ifmd.md` 模板，按 [`docs/IFMD.md`](docs/IFMD.md) 的格式手写即可。
</details>

### 2. 录入答案

文档解析出题目但**答案键缺失/不全**时（列表里会提示），点 **Answers** 进入 `/doc/:id/answers`：

- **选择题网格**：每题点 A/B/C/D；**多选**题（题干标 `multi`）可勾多个；
- **填空题**：输入框直接写答案，点 **⊕ Add acceptable answer** 可添加多个可接受答案（判分时任一匹配即算对）；
- **Bulk entry 批量粘贴**：输入框支持 `1-A 2-C 3-D`、`1. A`、`12B`、裸字母串 `ACBDA`、多选 `3-AC`，点 **Apply to grid** 一次性填充；
- 保存时自动校验并同步回写 `doc.ifmd.md`；**Preview** 区可先检查再保存。

> 也可以先不录答案直接练习：交卷后会引导你来这页补录，保存后自动重判。

### 3. 全屏练习

在 **Select an exam** 点 **Start** 进入开始屏：

1. 开始屏显示 *Ready to begin* + 题目数量，选择**计时模式**：
   - **正计时（Count-up）**：只累计用时；
   - **倒计时（Countdown）**：手输 `mm:ss`，应用会记住你上次的数值。
2. 点 **Begin — enter fullscreen** 进入全屏，**计时从此刻开始**（也可先点 *Enter answers first* 去补录答案）；
3. 作答方式：鼠标点选项，或按键盘 **`A` `B` `C` `D`**（选择题）；**多选**题可勾多个，**填空题**直接输入文本；
   **`←` `→`** 切换上/下一题；底部题号面板可任意跳题；**Mark for review** 标记当前题；
4. 做完点 **Submit** → 弹确认框 → 再点 **Submit** 交卷判分。

### 4. 结果与复盘

交卷后进入 `/session/:sid/result`（**全屏复盘，无左侧栏**）：

- **左上角题目导航**：默认缩成一个小 pill，点击后箭头旋转、**悬浮展开**全部题号（状态色），可选 `All` / `Wrong` / `Correct`；点某题即选中并自动收起（`Esc` 或点空白处关闭）。
- **左右分屏**：左侧显示当前题的题干、正确选项、你的选择；右侧是 **Pages 式分析编辑器**（一题一页）。
- **分析编辑器**：支持 Markdown（公式 `$x^2$`、图片 `![](assets/…)`）；`Write` / `Preview` 切换；输入后**自动保存**（约 0.9 秒防抖，也可 `⌘S` / 点 Save）。下次进入自动续写。
- **Notebook（整套解析预览）**：复盘页顶部 **Notebook** 按钮打开全屏预览——从试卷标题开始，依次显示所有已写解析的题目（题干、图表、解析），并可直接导出。
- **工具栏抽屉**：`AI`（显式调用 LLM 讲解）、`Vocabulary`（本卷生词表，可导出 `.xlsx`）、`Export`（导出复盘笔记本，见 §7）。
- 若答卷时没答案键，保存后会自动重判（regrade）。

### 5. 生词本与单词考试

侧栏点 **Vocabulary**，页面顶部有两个 tab：

- **Word list**：左侧选试卷，右侧编辑该卷词表（Word · POS · Meaning · Notes）。可手动增删改、用本地韦氏词典查词、
  在复盘工作区把题目/选项里的词拖进生词本，并导出 `.xlsx`。
- **Word test**：选择当前试卷、考试模式和题量：
  1. **English → Chinese**：显示英文单词，手写释义。本地判分刻意**宽松**（精确、分段、足够长的子串，或多词全部命中）。
  2. **Chinese → English**：显示 Meaning 列（为空时回退韦氏首义），拼写英文单词；忽略大小写、空格和标点。
     Word 列可用 `;`、`/`、`|`、换行分隔多个可接受拼写（全是单个词时也支持逗号）。
  3. 选择题量或 **test all** 开始；题目从当前词表随机抽取，正确答案在提交前不会下发到前端。
  4. 提交后显示正确率、考察的单词范围，以及每题正确答案/你的答案；结果同时编码成**紧凑 JSON 二维码**
     （题量大时自动拆成多个 QR，前缀 `IFWT1|<id>|part/total|`），也可下载 `.json`。
  5. AI 评分**默认关闭**。在 Settings 打开 **AI grading for word tests** 后，模型会参考词表释义 + 韦氏词典
     严格判分两种模式（提示词明确拒绝含糊/宽泛答案）；没有配置 key 或调用失败时自动回退本地判分并提示。

### 6. 错题集与精选题集（Review）

侧栏点 **Review**，页面内有两个 tab，用顶部的滑动分段控件切换：

- **Mistakes（错题集）**：所有已提交作答里的错题，**每题只出现一次**，取你**最近一次**的作答；
  如果后来同一题做对了，会自动移出。重复做错不会重复堆积。
- **Starred（精选题集）**：你主动收藏的题。练习页点 **☆ Star for review**、复盘工作台点 **☆ Star**、
  或错题列表右侧的星标按钮即可加入；星标立即保存，中途退出练习也不丢。

两个 tab 共用同一套工具与右侧编辑器：

1. 搜索套题标题、题干、选项和答案；用下拉只看某套试卷；点 **Newest first / Oldest first** 切换时间排序。
2. 点左侧题目，右侧显示题目、正确答案/你的答案，以及 **Analysis** 编辑器。它和复盘工作台是同一份笔记本，
   在这里改的分析会同步过去。
3. 如果该题还有旧分析（legacy 记录或额外页面），会以只读卡片列在编辑器下方。
4. **Open attempt** 打开该次的完整复盘；**Practice** 重新进入这套试卷。

### 7. 导出

- **复盘笔记本**：复盘页顶部 **Notebook** 先预览整套解析，再导出 **Markdown / DOCX / PDF**（工具栏 **Export** 同样可导出）。一份试卷一套分析（封面含用户名与成绩），**只包含已写解析的题目**；浏览器下载的同时会在 `data/exports/` 留一份，界面会显示保存路径。
- **整份文档**：Library 里对文档导出 **PDF** / **DOCX**（题目、答案与解析）。
- **生词本**：**Export .xlsx**。

### 8. 设置（用户名 / LLM / 兜底 / 生词本 / 单词考试评分）

**除 AI 讲解 / 单词考试 AI 评分外都不需要配置。** 在侧栏点 **Settings**（`/settings`）：

1. **Your name**：填名字，用于复盘笔记本导出封面；
2. **AI recognition fallback**：导入识别失败时的 LLM 兜底开关（默认开）；关闭后导入失败会提示你启用，
   并在你打开开关、配好 API Key 后再试；
3. **Provider** 下拉（内置 19 家目录，**默认 OrcaRouter**，含 Base URL 与默认模型）；
4. **Base URL** 可覆盖；
5. **API Key** 只写不回显（掩码显示）；
6. **Model** 填模型名；
7. **AI sense matching**：拖词入生词本时是否让模型选最贴合上下文的韦氏释义（关闭 = 取第一条，0 token）；
8. **Definition for English Learners**：词条自带该栏目时优先使用（没有则回退普通释义）；
9. **My dictionary**：是否优先查用户自定义词典；**Manage my dictionary** 可导入 CSV/TSV/JSON/TXT 或逐条增删；
10. **AI grading for word tests**：提交单词考试时是否让模型判分（关闭 = 本地判分、0 token；无 key/失败自动回退本地）；
11. **Save settings** / **Test connection**。

Base URL **按各官方文档原样存**：OpenAI 系自带 `/v1`，Anthropic 系不带（SDK 自己补），程序只在缺版本段时补 `/v1` —— 所以官方文档上的 URL 可以直接粘贴。

## 可选功能

| 功能 | 说明 | 安装 |
|---|---|---|
| **扫描 PDF OCR** | 逐页检测文本密度，低密度页栅格化后识别，坐标归一回原管线 | 任选其一：系统 `tesseract`，或 macOS 上 `pip install pyobjc-framework-Vision`。未安装时导入页会给出提示，不会崩溃 |
| **导出数学公式** | TeX → SVG（PDF 内联 / DOCX 转 PNG） | `cd backend/app/export/mathjax && npm install`（缺失时公式**降级为纯文本**，导出不失败） |

## 配置与环境变量

| 变量 | 默认值 | 作用 |
|---|---|---|
| `INTEFLOW_DATA` | `./data` | 数据根目录（`app.db`、`docs/<id>/`、`tmp/`、`exports/`、`jobs/`）。测试会用临时目录隔离 |
| `INTEFLOW_API` | `http://localhost:8000` | Vite 开发代理的后端地址 |
| `INTEFLOW_OCR_LANG` | `eng` | Tesseract OCR 语言 |
| `INTEFLOW_DEFAULT_SECTION` | `rw` | 转换器未识别到板块标题时的回退标签 |
| `INTEFLOW_DICTIONARY` | `./dictionary` | 标准 Eudic `.eudb` 文件或目录 |
| `INTEFLOW_DICTIONARY_INDEX` | `data/dictionary/mw.db` | 词典索引路径（源文件或索引版本变化时自动重建） |

端口：后端 `8000`、前端 `5173`。

> ⚠️ `data/` 是真实数据目录（已被 `.gitignore` 忽略），清空前请先备份。

## 开发与测试

```bash
# 后端测试（基线 304 passed, 1 skipped；用临时数据目录，不动你的数据）
cd backend && ../.venv/bin/python -m pytest -q

# 前端类型检查 + 构建（0 错误）
cd frontend && npm run build

# 前端组件测试
cd frontend && npm test

# 一键启动（缺环境先 setup + 起前后端 + 开浏览器）
./start.sh

# 或者：环境已就绪时直接起（不做前置检查）
./scripts/dev.sh
```

## 项目结构

```
InteFlow/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI 装配（/api/health、13 个 router）
│   │   ├── api/               documents · imports · builtin · sessions · settings · ai · analysis · dictionary · custom_dictionary · vocabulary · word_exam · subjects · review
│   │   ├── convert/           pdf · docx · twocolumn · images · normalize · ocr/ · llm_fallback
│   │   ├── ifmd/              InteFlow-MD 解析 + 回写（确定性状态机；多选/填空）
│   │   ├── export/            PDF (WeasyPrint) · docx · notebook(复盘) · math_render(+mathjax 桥)
│   │   ├── repos/ · llm/      持久化 · LLM 传输层
│   │   ├── sections.py        自由板块标签
│   │   ├── providers.py       19 家服务商目录
│   │   ├── vocab_assist.py    拖词选义（可选 AI）
│   │   ├── word_exam.py       单词考试：抽题 / 本地判分 / 可选 AI 判分
│   │   ├── repos/subjects.py  学科：CRUD + 试卷归属
│   │   ├── repos/review.py    错题集 + 精选题集
│   │   ├── repos/custom_dictionary.py 用户自定义词典：CRUD、导入、查词
│   │   └── builtin/           内置题库（44 单元随仓库分发）
│   ├── tests/                 pytest（304）
│   └── requirements.txt
├── frontend/                  Vite + React 19 + TS + Tailwind 4
│   ├── src/pages/             ExamHome · Library(Import) · Sessions · Review (Mistakes) · Vocabulary · AnswerKey · Practice · Result · Settings
│   ├── src/components/        复盘分屏 · VocabGrid · WordExamPanel / WordExamResultView · SubjectControls · CustomDictionaryManager · 导入/资料库 UI
│   └── src/lib/               wordExamQr（紧凑 JSON + 多段 QR）· subjects（调色板）· theme · sections
├── start.sh / start.ps1       一键启动（自动 setup + 起前后端 + 开浏览器）
├── InteFlow.command           macOS 双击启动
├── start.bat                  Windows 双击启动
├── scripts/dev.sh             一键起前后端（不做前置检查）
├── data/                      运行期数据（gitignore）
├── website/                   项目官网（GitHub Pages）
├── theme-examples/            5 套主题预览（设计参考）
└── docs/                      ARCHITECTURE · IFMD · IDEAS · legacy/
```

## 常见问题排查

| 现象 | 解决 |
|---|---|
| `dev.sh` 报端口被占用 | `lsof -i :8000` / `:5173` 找到进程并结束，或换端口启动（`start.sh` 会先检测并提示） |
| 页面一直 Loading / 提示连不上后端 | 确认后端活着：<http://localhost:8000/api/health>；前端指向其他后端时设置 `INTEFLOW_API` 后重启 vite |
| 导入扫描 PDF 提示需要 OCR | 安装 `tesseract`，或 macOS 上 `pip install pyobjc-framework-Vision`，重启后端后重新导入 |
| DOCX 导入被拒绝 | 上传前做了 zip 安全校验（条目数/解压总量/压缩比/宏），异常或加密文档会被拒；请用正常导出的 `.docx` |
| PDF 导出失败 | 安装 WeasyPrint 系统库（见[环境要求](#环境要求)折叠块） |
| 导出里公式变成纯文本 | `cd backend/app/export/mathjax && npm install` 后重试 |
| `npm run build` 报类型错误 | `cd frontend && npm install` 后重跑 |
| 想从零开始 | 备份后删除 `data/`（或指定 `INTEFLOW_DATA` 到新目录），重启后端会自动建库 |

## 相关文档

- [`README.md`](README.md) — 英文 README
- [`website/`](website/) — 项目官网（静态站点，GitHub Pages；本地预览 `python3 -m http.server 4173 --directory website`）
- [`AGENT.md`](AGENT.md) — 项目交接 / 给 AI agent 与贡献者的工作说明（中文）
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 系统架构、数据模型、API 面
- [`docs/IFMD.md`](docs/IFMD.md) — InteFlow-MD 题目格式规范
- [`docs/IDEAS.md`](docs/IDEAS.md) — 修改想法记录
- [`ROADMAP.md`](ROADMAP.md) — 路线图与已知缺口
- [`docs/legacy/`](docs/legacy) — 前身项目的历史规划文档（仅作参考）

## License

[MIT](LICENSE)
