# InteFlow-MD 格式规范 v1

InteFlow 的**中间交换格式**。所有导入的文档（PDF/DOCX/MD）先转成 InteFlow-MD，
再由确定性解析器转成 JSON 入库。**这条链路不消耗 LLM token。**

状态：`v1 draft`（实现前需确认 §7 未决项）

---

## 1. 文件约定

| 项 | 规则 |
|---|---|
| 扩展名 | `.ifmd.md` |
| 编码 | UTF-8，LF 换行 |
| 图片 | 存放在与 `.ifmd.md` 同级的 `assets/` 目录，MD 中用相对路径引用 |
| 一文档一文件 | 一份导入的源文档 = 一个 `.ifmd.md` + 一个 `assets/` |

## 2. Front matter（必需）

```yaml
---
ifmd: 1                      # 格式版本号，必需
title: "2024 International School Final"
source: "final-2024.pdf"      # 原始文件名，溯源用
lang: en                      # 题目语言：en | zh | mixed
imported_at: "2026-10-05T12:00:00Z"
answers: none                 # inline | external | none（见 §5）
---
```

- `ifmd` 版本不符 → 解析器直接拒绝并报错，不做降级猜测。
- front matter 之外、题目块之外的自由文本一律忽略（转换器用它放备注，用 `<!-- -->` 注释）。

## 3. 题目块 `:::q`

每题独立成块（**不存在跨题共享的 passage 块**；题干自带的阅读材料放在 `@material` 区）。

### 3.1 语法（按行的状态机）

```
:::q {#Q001 sec=rw}      ← 块开始：id + 属性
@material                  ← 可选：本题自带材料（阅读段落/图表说明）
……材料正文……
@material2                 ← 可选：双篇题的第二篇（SAT paired passages）
……第二篇正文……
@stem                      ← 可选但强烈建议：题干起点
……题干正文……
- A. 选项一                 ← 选择题：从 A 起连续的大写字母 + 点，至少 2 个（AMC 5 个，部分卷 6 个）
- B. 选项二
- C. 选项三
- D. 选项四
! answer: B                ← 可选元数据，见 §3.3
! explain: 因为第二段……      ← 可选
:::                        ← 块结束
```

- **无任何标记**：块内全部内容都是题干。
- **只有 `@stem`**：`@stem` 之前的内容自动作为材料（`@material` 的简写形式）。
- **`@material` 与 `@stem` 同时出现**：分别界定材料与题干；只有 `@material` 而没有 `@stem` 是错误。
- **`@material2`**：双篇题的第二篇材料，必须同时出现 `@material`，且顺序为
  `@material` → `@material2` → `@stem`；每个标记在块内只能出现一次，`@material2` 不能为空。
  双篇在界面上以 `Text 1` / `Text 2` 上下叠放显示；单篇仍然只显示 `Passage`。
- **换行**：材料正文里的**单个换行会保留**（诗歌、歌词、书信落款等源版式），段落之间用空行分隔。
  导入器只在识别为诗歌时保留视觉换行，普通被 PDF 折行的正文会自动合并成一段。
- **题型有两种**：
  - 选择题：选项行从 `A` 起**连续**排列（`A B C …`），至少 2 个、最多 26 个；跳号或不足 2 个 → **报错，不猜测**。
  - 填空题（`kind=blank`）：**没有选项行**。导入时若识别不到选项即按填空题处理（见 §3.2）。
- 块内禁止出现裸 `:::` 行（除非作为块结束）。

### 3.2 头部属性

| 属性 | 必需 | 取值 | 说明 |
|---|---|---|---|
| `id` | ✅ | `Q` + 数字/字符串，文档内唯一 | 例 `#Q001` |
| `sec` | ✅ | 自由短标签 | 板块/学科标签，如 `rw` `math` `physics` `general`。**不再限定取值**（InteFlow 不限于 SAT） |
| `no` | ⬜ | 整数 | 原卷题号，与 id 分开存 |
| `type` | ⬜ | 自由串 | 如 `vocab` `craft` `algebra` |
| `difficulty` | ⬜ | `e` \| `m` \| `h` | easy / medium / hard |
| `kind` | ⬜ | `choice` \| `blank` | 题型，缺省 `choice`；`blank` 表示填空题（无选项） |
| `multi` | ⬜ | `0` \| `1` | 选择题是否多选，缺省 `0`（单选） |

### 3.3 元数据行 `! key: value`

| key | 说明 |
|---|---|
| `answer` | 答案。选择题：`A`–`D`，多选用**逗号**分隔（`A,C`）；填空题：每个可接受答案用 **`\|`** 分隔（`the \| a`）。导入时没有就**不写这一行**，由后续答案录入页补 |
| `explain` | 解析/正确理由。可缺省，按需用 LLM 或手写补 |
| `source` | 溯源，如 `p.12` |

- 未知 key **原样保留并透传**（向前兼容），但不参与判分逻辑。

## 4. 数学与图片

- 行内公式 `$x^2$`，独立公式 `$$\frac{a}{b}$$`，前端用 KaTeX 渲染（**不经过 LLM**）。
- 图片：`![图表说明](assets/q003-fig1.png)`，路径相对于 `.ifmd.md`。
  转换器负责从 PDF 抠图并写入 `assets/`；图片在题干、材料、选项里都可能出现。

## 5. 答案的三种状态（`answers` 字段）

| 值 | 含义 | 后续动作 |
|---|---|---|
| `inline` | 源文档含答案/解析，转换时已填入 `! answer:` | 可直接判分 |
| `external` | 源文档末尾有独立答案表（如 `Answer Key` / `答案`） | 转换器按题号回填 |
| `none` | 源文档无答案 | 导入后进入**答案录入页**：显示题数，逐题或批量粘贴录入 |

`none` → 录入完成 → 落库时写入 questions 表，`.ifmd.md` 文件同步回写 `! answer:`（多选用 `A,C`，填空用 `|` 分隔）并把 `answers` 改为 `external`。

## 6. 示例

### 6.1 阅读题（自带材料，暂无答案）

```markdown
:::q {#Q001 sec=rw no=1 type=vocab difficulty=m}
@material
Despite the committee's reservations, the new policy was adopted
without amendment. Critics called the decision premature; supporters
insisted the data supported action.

@stem
The author's attitude toward the committee is best described as

- A. undisguised contempt
- B. cautious approval
- C. outright indifference
- D. blunt hostility
:::
```

### 6.2 数学题（含公式与图片，有答案）

```markdown
:::q {#Q002 sec=math no=12 difficulty=e}
! answer: B
! explain: 两边同减 5 再同除 3
If $3x + 5 = 20$, what is the value of $x$?

![number line](assets/q002-fig1.png)

- A. 3
- B. 5
- C. 8
- D. 15
:::
```

> 注：`sec` 是自由标签，`rw`/`math` 只是 SAT 卷的常见取值；其他学科可直接 `sec=physics`、`sec=history`。

### 6.3 填空题（无选项，多个可接受答案）

```markdown
:::q {#Q010 sec=rw no=10 kind=blank}
! answer: photosynthesis | photosynthesis in plants
What process do plants use to convert light into chemical energy?
:::
```

### 6.4 多选选择题（`multi=1`）

```markdown
:::q {#Q011 sec=rw no=11 multi=1}
! answer: A,C
Which TWO of the following are renewable energy sources?

- A. Solar
- B. Coal
- C. Wind
- D. Natural gas
:::
```

### 6.5 完整可直接导入示例

仓库内附带一份 10 题的简单数学演示卷：[`examples/simple-math.ifmd.md`](examples/simple-math.ifmd.md)。
它覆盖单选、多选（`multi=1`）、填空（`kind=blank`，多个可接受答案）、`@material` / `@stem` 与 `$...$` 公式，
可直接在 Library 页上传，也可以复制内容作为自己出题的起点。

### 6.6 双篇题（paired passages）

```markdown
:::q {#Q020 sec=rw no=20}
@material
Text 1
Cities should plant more street trees: shade and air quality improve
immediately, and the cost is modest.

@material2
Text 2
The same programme is expensive to maintain; pruning and irrigation
budgets are routinely underestimated.

@stem
How would the author of Text 2 respond to the claim in Text 1?

- A. By accepting the benefits but questioning the budget
- B. By denying that trees provide shade
- C. By proposing a different city
- D. By citing a third study
! answer: A
:::
```

> 导入 PDF / DOCX 时，源文件里的 `Text 1` / `Text 2`（或 `Passage 1` / `Passage 2`）标签会被
> 自动拆成 `@material` / `@material2`；标签不齐时保持原样，不猜测。

## 7. 设计决议（已确认）

1. 材料内标题不做独立字段，由转换器写成材料首行（如 `**Title — Source**`）。
2. 材料与题干的图片共用 `assets/`，用 `alt` 文本区分归属，不单独建字段。
3. **保序**：题目按块出现顺序存储（`order_idx`），`no` 只记录原卷题号。
4. **选择题字母从 A 起连续**（A、B、C、…），至少 2 个、最多 26 个；跳号或不足 2 个一律报错，答案字母必须落在题目已有的选项内。**填空题（`kind=blank`）刻意没有选项**——转换器识别不到选项时按填空处理，不再报"选项不足"。
5. **`sec` 自由标签**：解析器只要求非空，不校验取值（SAT 卷仍用 `rw`/`math`，其他学科自定）。转换器在无板块标题时回退到 `INTEFLOW_DEFAULT_SECTION`（默认 `rw`）。
6. **多答案**：选择题多选由头部 `multi=1` 声明，答案写成 `A,C`；填空题的多个可接受答案写成 `a | b`。
7. **双篇**：第二篇材料用 `@material2`，顺序固定为 `@material` → `@material2` → `@stem`；
   第二篇为空视为结构错误。导入器只在同时看到 `Text 1` 与 `Text 2` 标签时拆分。

## 8. 解析器实现约定

- 单一入口：`parse(text) -> {meta, questions[]}`，纯函数，**不调用 LLM、不做模糊推断**。
- 任何结构错误抛出带行号的 `IfmdError`，导入界面直接展示错误位置。
- 单元测试覆盖：正常块 / **无选项（填空题）** / 选项数不对（1–3 或 >4） / 版本不符 / 公式与图片 / `@material` 组合 / 未知 `!` key / **`multi=1` 与多答案 `A,C`** / **填空多答案 `a | b`** / **`@material2` 双篇与顺序校验**。

## 9. 题库包（Bank ZIP）

单份 `.ifmd.md` 是「一套试卷」；**题库包**是若干套试卷的 ZIP，用于一次性导入整套题库。
导入由 `POST /api/builtin/import` 处理，安装到本机 `data/banks/<bank_id>/`（0 token）。

### 9.1 标准布局

```
my-bank.zip
├── manifest.json
├── unit-1/
│   ├── doc.ifmd.md
│   └── assets/
│       └── p05-3d21f841.png
└── unit-2/
    ├── doc.ifmd.md
    └── assets/…
```

`manifest.json`：

```json
{
  "id": "my-bank",
  "title": "My question bank",
  "source": "my-bank.zip",
  "units": [
    { "id": "unit-1", "title": "Unit 1", "module": 1 },
    { "id": "unit-2", "title": "Unit 2", "module": 2 }
  ]
}
```

- `id` 只能包含 `A-Z a-z 0-9 . _ -`；缺省或非法时服务端会生成一个稳定 id。
- `questions` / `assets` 由服务端解析后重新计算，manifest 里不需要手填。
- 每个单元必须有 `<id>/doc.ifmd.md`；解析失败或 0 题会拒绝整个题库包。
- 单元目录里的 `assets/` 会随单元一起复制。

### 9.2 无 manifest（散装）

也可以只放若干 `.ifmd.md`（根目录或各自文件夹）：

```
alpha.ifmd.md
beta.ifmd.md
assets/…
```

服务端会扫描所有 `.ifmd.md`，用文件名/所在文件夹名作为 unit id，并自动生成 `manifest.json`。
ZIP 外面套了一层文件夹（macOS「压缩文件夹」）时会自动剥掉。

### 9.3 安全与限制

- 只接受 `.zip`；单包 ≤ 80 MB，解压后 ≤ 400 MB，条目 ≤ 5000，压缩比异常会被拒绝。
- 绝对路径、`..`、符号链接、未知文件类型会被拒绝；隐藏文件（`.DS_Store`、`__MACOSX`）忽略。
- 同一 `id` 已存在时返回 409；用户题库可通过 `DELETE /api/builtin/{bank_id}` 移除，
  已经 Add 到 Library 的试卷保留。
