# InteFlow

> 本地优先（local-first）的学习工作流：**导入题库（PDF/DOCX/Markdown）→ 刷题 → 逐题复盘错题 → 写解析 / 查词 / 问 AI → 导出错题分析与生词文件。**

**English**: [README.md](README.md)

![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss&logoColor=white)
![Tests](https://img.shields.io/badge/pytest-187%20passed-2E7D32)

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
| **答案录入** | 逐题 A–D 网格 + **批量粘贴**（`1-A 2-C` / `1. A` / `ACBDA`）+ 校验 + 预览，同步回写源文件 |
| **练习** | 考试风格全屏、**正计时 / 倒计时两种计时**、单题视图、题号导航、标记、键盘 `A–D` / `← →`、交卷确认 |
| **结果 / 复盘** | 得分 / 分板块 / 用时统计、`All · Correct · Wrong` 过滤、三栏 master–detail、补键重判（regrade） |
| **工作区** | 手写解析（直存本地）、生词表 `Word \| Meaning \| Notes`（增删改 + 导出 `.xlsx`）、**AI 讲解**（显式触发）、导出入口 |
| **导出** | **PDF**（WeasyPrint，页脚页码、图片、MathJax SVG 公式）、**DOCX**（python-docx）、生词 **`.xlsx`** |
| **设置** | 19 家 LLM 服务商目录、protocol（openai / anthropic）、Base URL、API Key（掩码）、模型、连通性测试 |

> **规划中（已留入口，细节待定）：** 应用内**查词**（选中单词查词典）、专门的**错题分析导出**。
> 见 [`docs/IDEAS.md`](docs/IDEAS.md) 与 [`ROADMAP.md`](ROADMAP.md)。

## 两条铁律

1. **LLM 不在主链路**：导入/解析/判分/导出全部是确定性本地计算，**0 token**；只有你在复盘页显式点了
   **AI Answer**（或手动点了连通性测试）才会调用外部 API。
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

### macOS / Linux

```bash
git clone <你的仓库地址> InteFlow
cd InteFlow

# 首次运行：一键建环境 + 装依赖（可重复运行，幂等）
./scripts/setup.sh

# 启动开发环境（后端 :8000 + 前端 :5173）
./scripts/dev.sh
```

### Windows (PowerShell)

```powershell
git clone <你的仓库地址> InteFlow
cd InteFlow

.\scripts\setup.ps1
.\scripts\dev.ps1
```

- 后端 API：<http://localhost:8000>（健康检查 <http://localhost:8000/api/health>）
- 前端页面：<http://localhost:5173> ← **浏览器打开这个**

按 `Ctrl-C` 同时停止两端。

<details>
<summary><b>不用 dev.sh / dev.ps1 的手动启动方式</b></summary>

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

打开 <http://localhost:5173>，左侧栏固定五个 tab：**Exams**（选卷开考）、**Library**（导入文件 / 内置题库 / 试卷列表 / 删除）、
**Mistakes**（错题分析集合，占位）、**Vocabulary**（单词整理集合，占位）、**Settings**（LLM 设置）。

1. 点侧栏 **Library** 进入题库页。
2. **上传文件**：把文件拖到 *Drag a file here* 区域，或点 **choose a file**。
   支持 `PDF · DOCX · .md · .markdown · .ifmd.md`（≤ 60 MB；题目需带编号 `1.` `2.` …，每题四个选项）。
3. **等待流水线跑完**：`detect → convert → review` 三阶段，附**逐页报告**（该页是文本/OCR/低置信/无引擎）。
   - 转换结果干净 → 自动提交入库；
   - 有疑点 → 停在复核阶段，由你点 **Commit** 落库或 **Cancel** 取消（全程 0 token）。
4. **（可选）用内置题库**：Library 页的题库卡展开后按日期分组列出 44 个单元，单个点 **Add**，或点 **Add all** 整库导入。
5. **回首页开考**：返回 **Select an exam**，新导入的卷子直接点 **Start** 开考。

<details>
<summary>没有题库文件？自己写 IFMD</summary>

Library 页的模板卡提供一份可复制/下载的 `.ifmd.md` 模板，按 [`docs/IFMD.md`](docs/IFMD.md) 的格式手写即可。
</details>

### 2. 录入答案

文档解析出题目但**答案键缺失/不全**时（列表里会提示），点 **Answers** 进入 `/doc/:id/answers`：

- **逐题网格**：每题点 A/B/C/D；
- **Bulk entry 批量粘贴**：输入框支持 `1-A 2-C 3-D`、`1. A`、`12B`、裸字母串 `ACBDA`，点 **Apply to grid** 一次性填充；
- 保存时自动校验（只接受 A–D），并同步回写 `doc.ifmd.md`；**Preview** 区可先检查再保存。

> 也可以先不录答案直接练习：交卷后会引导你来这页补录，保存后自动重判。

### 3. 全屏练习

在 **Select an exam** 点 **Start** 进入开始屏：

1. 开始屏显示 *Ready to begin* + 题目数量，选择**计时模式**：
   - **正计时（Count-up）**：只累计用时；
   - **倒计时（Countdown）**：手输 `mm:ss`，应用会记住你上次的数值。
2. 点 **Begin — enter fullscreen** 进入全屏，**计时从此刻开始**（也可先点 *Enter answers first* 去补录答案）；
3. 作答方式：鼠标点选项，或按键盘 **`A` `B` `C` `D`**；**`←` `→`** 切换上/下一题；底部题号面板可任意跳题；
   **Mark for review** 标记当前题；
4. 做完点 **Submit** → 弹确认框 → 再点 **Submit** 交卷判分。

### 4. 结果与复盘

交卷后进入 `/session/:sid/result`：

- **统计面板**：Score、按本卷实际出现的**板块**各一张卡片、Time，以及 **Wrong answers** 错题 chips（点击跳题）；
- **过滤 Tab**：`All` / `Correct` / `Wrong`；
- **三栏布局**：左侧题号索引（状态色）→ 中间单题区（`←` `→` 键盘切题、`n / total`）→ 右侧常驻工作区。

**工作区（右侧）**：

| 分区 | 用法 |
|---|---|
| **Explanation** | 给当前题手写解析，点保存直接入库（0 token） |
| **Vocabulary** | 生词表，列 `Word \| Meaning \| Notes`，可增删行/列、编辑后保存；**Export .xlsx** 导出 |
| **AI Answer** | 显式点击才调用 LLM（题干 + 正确选项作为上下文） |
| **Export** | **Export .pdf** / **Export .docx**，导出题目、答案与解析（不经过 AI） |

### 5. 导出

- **整份文档**：工作区 **Export** 分区 → `Export .pdf` 或 `Export .docx`。
- **生词本**：**Export .xlsx**。

### 6. 设置 LLM（可选）

**除 AI 讲解外都不需要配置。** 在侧栏点 **Settings**（`/settings`）：

1. **Provider** 下拉（内置 19 家目录，**默认 OrcaRouter**，含 Base URL 与默认模型）；
2. **Base URL** 可覆盖；
3. **API Key** 只写不回显（掩码显示）；
4. **Model** 填模型名；
5. **Save settings** / **Test connection**。

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

端口：后端 `8000`、前端 `5173`。

> ⚠️ `data/` 是真实数据目录（已被 `.gitignore` 忽略），清空前请先备份。

## 开发与测试

```bash
# 后端测试（基线 187 passed, 1 skipped；用临时数据目录，不动你的数据）
cd backend && ../.venv/bin/python -m pytest -q

# 前端类型检查 + 构建（0 错误）
cd frontend && npm run build

# 前端组件测试
cd frontend && npm test

# 本地开发（后端 :8000 + 前端 :5173）
./scripts/dev.sh
```

## 项目结构

```
InteFlow/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI 装配（/api/health、6 个 router）
│   │   ├── api/               documents · imports · builtin · sessions · settings · ai
│   │   ├── convert/           pdf · docx · twocolumn · images · normalize · ocr/ · llm_fallback
│   │   ├── ifmd/              InteFlow-MD 解析 + 回写（确定性状态机）
│   │   ├── export/            PDF (WeasyPrint) · docx · math_render(+mathjax 桥)
│   │   ├── repos/ · llm/      持久化 · LLM 传输层
│   │   ├── sections.py        自由板块标签
│   │   ├── providers.py       19 家服务商目录
│   │   └── builtin/           内置题库（44 单元随仓库分发）
│   ├── tests/                 pytest（187）
│   └── requirements.txt
├── frontend/                  Vite + React 19 + TS + Tailwind 4
│   └── src/pages/             ExamHome · Library(Import) · Mistakes · Vocabulary · AnswerKey · Practice · Result · Settings
├── scripts/dev.sh             一键起前后端
├── data/                      运行期数据（gitignore）
└── docs/                      ARCHITECTURE · IFMD · IDEAS · legacy/
```

## 常见问题排查

| 现象 | 解决 |
|---|---|
| `dev.sh` 报端口被占用 | `lsof -i :8000` / `:5173` 找到进程并结束，或换端口启动 |
| 页面一直 Loading / 提示连不上后端 | 确认后端活着：<http://localhost:8000/api/health>；前端指向其他后端时设置 `INTEFLOW_API` 后重启 vite |
| 导入扫描 PDF 提示需要 OCR | 安装 `tesseract`，或 macOS 上 `pip install pyobjc-framework-Vision`，重启后端后重新导入 |
| DOCX 导入被拒绝 | 上传前做了 zip 安全校验（条目数/解压总量/压缩比/宏），异常或加密文档会被拒；请用正常导出的 `.docx` |
| PDF 导出失败 | 安装 WeasyPrint 系统库（见[环境要求](#环境要求)折叠块） |
| 导出里公式变成纯文本 | `cd backend/app/export/mathjax && npm install` 后重试 |
| `npm run build` 报类型错误 | `cd frontend && npm install` 后重跑 |
| 想从零开始 | 备份后删除 `data/`（或指定 `INTEFLOW_DATA` 到新目录），重启后端会自动建库 |

## 相关文档

- [`README.md`](README.md) — 英文 README
- [`AGENT.md`](AGENT.md) — 项目交接 / 给 AI agent 与贡献者的工作说明（中文）
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 系统架构、数据模型、API 面
- [`docs/IFMD.md`](docs/IFMD.md) — InteFlow-MD 题目格式规范
- [`docs/IDEAS.md`](docs/IDEAS.md) — 修改想法记录
- [`ROADMAP.md`](ROADMAP.md) — 路线图与已知缺口
- [`docs/legacy/`](docs/legacy) — 前身项目的历史规划文档（仅作参考）

## License

[MIT](LICENSE)
