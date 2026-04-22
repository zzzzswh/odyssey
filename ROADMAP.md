# Odyssey.md — 开发路线图

> 产品定义见 `PRODUCT.md`(v0.4 定稿)
> 本文件是开发计划,每个阶段完成后会更新进度。

---

## 北极星

- **灵魂是视觉**:功能残缺但美,好过功能齐全但丑
- **Replay 是高潮**:一切功能问一句"这能让 Replay 更动人吗?"
- **隐形复杂度**:用户只管记录,插件处理一切

## 反面参照(不要做成的样子)

- Anytype / Logseq / 其他功能堆砌型 PKM
- 默认样式的 FullCalendar / Leaflet

## 正面参照

- Notion Calendar / Arc / Things 3 / Day One(视觉)
- Polarsteps / Google Timeline / Strava Flyover(地图 + 回放)

---

## 五周节奏

| Week | 阶段     | 交付                                        | 状态 |
| ---- | -------- | ------------------------------------------- | ---- |
| 1    | 骨架     | 能创建 Entry,能在朴素日历上看到             | ✅   |
| 2    | 地图     | 能在地图上看到同一批 Entry                   | ✅   |
| 3    | 联动     | 日历和地图互相呼应,geocoding,Split view    | ✅   |
| 4    | Replay   | 灵魂功能:镜头跟飞 + 累积留痕                | ✅   |
| 5    | 打磨     | 视觉、动画、细节,真正向 Notion/Polarsteps 看齐 | ✅   |

每个 Week 结束时会打包一份开发环境备份。

---

## Week 1 详细计划(当前阶段)

**目标**:跑通数据流。创建 Entry → 文件 → 解析 → 渲染到日历。

**视觉标准**:可以很丑。本周的丑是故意的。

### Day 1-2:骨架 ✅
- [x] 项目结构搭建
- [x] TypeScript + esbuild 配置
- [x] React 接入 Obsidian 视图
- [x] "Hello from Odyssey" 能在 Obsidian 里显示

### Day 3-7:数据层 + 日历 + 命令 ✅
- [x] Entry 类型 + EntryStore(基于 Obsidian metadata cache)
- [x] 文件变化自动同步
- [x] New Entry Modal
- [x] 月视图网格
- [x] 点击 Entry 打开文件

### 用户反馈驱动的增强 ✅(Day 2 晚)
- [x] hover 出 "+" 号快速创建(预填当天日期)—— Notion Calendar 式交互
- [x] 跨天 Entry 的长条渲染
  - 跨周正确分段(一段在本周,一段在下周)
  - 起止端圆角正确(中段平直,起点左圆,终点右圆)
  - 泳道分配(重叠条自动堆叠)
  - 原本排在 Week 3,提前到 Week 1,因为"时间跨度是旅程感的本质"这条哲学决定了跨天必须第一天就对
- [x] **location 改为选填** —— 产品定义升级到 v0.5
  - 不是每件事都对应到地点(读书、deadline、心事)
  - 日历承载所有 entry,地图只承载有 location 的
  - 这个不对称是刻意的,避免产品变成 friction 工具

## Week 2 详细计划 ✅

**目标**:地图视图跑通。有坐标的 entry 能在地图上看到。

### 完成项
- [x] Entry schema 扩展:可选的 `lat` / `lng`
- [x] `NewEntryModal` 加 "Coordinates" 字段(接受 "35.67, 139.69" 格式,带校验)
- [x] `MapView.tsx` React 组件
  - MapLibre GL JS v5.23
  - CartoDB Positron 底图(极简灰度,让 marker 跳出来)
  - 每个有坐标的 entry 一个 marker
  - 点击 marker 出 popup(标题、日期、地点、"Open note →" 按钮)
  - 首次载入自动 fit-to-bounds,只有一个点时 flyTo + zoom 11
  - Toolbar 显示 "N locations" / "Fit all" / "+ New Entry"
  - 有 entry 但没坐标时显示友好提示
- [x] `MapItemView.ts` Obsidian ItemView 包装
- [x] 注册 `odyssey-map` 视图、"Open Map" 命令、ribbon 图标
- [x] MapLibre CSS 通过 esbuild text loader 嵌入 bundle,插件加载时注入 `<style>`
- [x] 构建通过,bundle 2.7 MB(含 MapLibre,一次性加载,可接受)

### Week 2 刻意不做(推到 Week 3+)
- Geocoding(文本地名 → 坐标):用户当前需手填经纬度
- 地图点选创建:在地图上戳一下自动填坐标
- 日历 ↔ 地图联动:悬停高亮、范围筛选
- Replay 动画:Week 4 的专属任务

## Week 2.5(用户反馈驱动的增强)✅

三个小需求一次做完:

- [x] **日历 ↔ 地图 in-place 切换**:两边 toolbar 各加一个按钮(📅 Calendar / 🗺 Map),点了直接让当前 tab 切换视图类型,不开新 tab
- [x] **hover 删除**:pill 和跨天 bar 上悬停时右侧淡入 × 按钮,点击弹确认 modal("Delete entry?"),确认后走 `vault.trash()` 进系统回收站(可恢复),不是永久删除
- [x] **多底图切换**:地图 toolbar 加一个 select,三个免费无 key 的底图:Positron(默认,极简灰)/ Voyager(彩色带路名)/ Dark Matter(深色)
- [x] 卫星图延后到 Week 5:需要 MapTiler/Mapbox API key,等做 settings 页时用户填 key 才解锁 Satellite 选项,符合"隐形复杂度"哲学

## Week 2.6(又一批用户需求)✅

- [x] **Drop pin 创建**:地图 toolbar 的 📍 Drop pin 按钮,进入 drop mode 后光标变十字、地图出现蓝色边框、顶部提示"Click the map to drop a pin here",点击地图任意位置弹 NewEntryModal 预填坐标,创建一个后自动退出,ESC 取消
- [x] **右键 marker 删除**:contextmenu 事件处理,`preventDefault + stopPropagation` 防止和浏览器/MapLibre 默认菜单冲突
- [x] **当前位置定位**:MapLibre 自带 `GeolocateControl`,点一下 flyTo 到当前位置 + 精度圆圈,不开 trackUserLocation(Odyssey 不是导航 app)

## Week 3 ✅

联动 + geocoding + split view。这是让两个视图真正"活在一起"的一周。

- [x] **Geocoding(Nominatim / OpenStreetMap)**
  - NewEntryModal 的 Coordinates 行加 📍 Resolve 按钮(放大镜图标)
  - 点击后调用 Nominatim,成功时坐标自动填入 + 下方绿色反馈条显示 "✓ Found: <完整地址>"
  - 失败时红色反馈条 + 提示原因("Couldn't find <query>", 网络错误, rate limit)
  - 客户端 rate limiting:两次调用最少间隔 1 秒(Nominatim 政策要求)
  - 遵守 usage policy:带 descriptive User-Agent
  - 如果用户在中国大陆,Nominatim 可能访问不了 —— 会在 Resolve 失败时给出网络错误,用户可改用手动粘贴坐标或 drop pin

- [x] **Hover 联动**
  - 共享事件总线 `ViewSync`(挂在 plugin 实例上,两个视图构造时注入)
  - Calendar pill/bar 有 mouseenter/leave → 广播 path
  - Map marker 也有 mouseenter/leave → 广播 path
  - 收到 hover 的视图给对应 entry 加 `.is-hovered` class:pill 加 accent 外描边,bar 变亮 + 白色外描边,marker 加 accent 色 drop-shadow 且 z-index 上浮

- [x] **Focus 跳转联动**
  - 点击日历 entry:打开笔记 + 让地图 flyTo 到这个 entry(如果有坐标且地图是开的)
  - 点击地图 marker:打开笔记 + 让日历跳到这个 entry 所在的月份
  - focus 是 one-shot 事件(不是状态),广播一次就清空

- [x] **Split view 按钮**
  - 两边 toolbar 都加 📑 Split 按钮,点击时:如果另一个视图已开就 reveal,没开就在当前 leaf 右侧 vertical split 一个新视图
  - 搭配上面的联动,就是 Notion Calendar 里"日历 + 项目详情"那种并排同步的体验

### Week 3 的设计决策

- **ViewSync 独立于 EntryStore**:EntryStore 管"有什么 entry",ViewSync 管"用户当前注意力在哪"。这两个生命周期和变更频率完全不同,揉在一起会让 re-render 逻辑很糟。
- **Focus 是事件,Hover 是状态**:Hover 持续存在(某一时刻只有一个 hovered entry),而 Focus 是动作(点了就该飞过去,不该"一直保持 focused 状态")。这是为什么 ViewSync 里 hover 用 `getHovered()` 读状态,focus 只发事件不存。
- **Nominatim 不做自动 geocoding**:按你 Q1=B 的选择,用户必须点 Resolve 才调用,给用户 sanity check 的机会;也避免了"填了个歧义地名,被静默 geocode 到错的地方"。

## Week 4 ✅ — Replay 灵魂功能

产品定义一直把 Replay 叫 "灵魂功能",这周真正做了出来。不是数据可视化,是仪式。

### 形态(按用户 Q&A 选择:A/C/C+D/A)

- **Q1=A 全屏接管**:点 ▶ Replay 后覆盖一层黑色半透明 veil,进入 picker 界面(日期范围 + 速度 + 进入按钮)。播放时 veil 消失,地图全显,只有左上角 title card 和底部控制条
- **Q2=C 混合镜头**:每个 stop dwell 0.5 秒 → flyTo 下一个(base 1.8s,按速度倍率缩放),给每个地方一个呼吸感但不拖沓
- **Q3=C+D 历史小圆点 + 虚线连线**:GeoJSON line layer(蓝色 3px 虚线 80% 透明)+ circle layer(蓝色 5px 带白色描边),用 `line-dasharray: [2, 2]`;当前 stop 用完整 MapLibre Marker 画在最上层,带 drop-shadow 呼吸动画
- **Q4=A 默认范围 = 最早到最晚**:`defaultRangeFromEntries()` 扫描所有 entry 取 min/max date

### 三个状态,一个机器

`ReplayOverlay` 是个状态机:`picking → playing ↔ paused → done`,用 React state 驱动,副作用在 useEffect 里:
- layer/source 管理(mount 时 add,unmount 时 remove)
- trail/dots GeoJSON 随 `stepIndex` 更新
- 播放定时器:dwell → flyTo → 下一 step
- 结束时自动进 done 阶段,不丢 "你刚看完了"

### 其他细节

- ESC 随时退出,Space 暂停/继续(只在 playing/paused 时)
- 退出时 flyTo 回用户进入 Replay 前的视角(保存 `originalCenterRef`)
- "Replay again" 按钮清空 trail/dots 重播
- 空 timeline 时 Start 按钮 disabled,显示 "No geolocated entries in this range"
- Title card 用 key={entry.path} 让 React 每次 step 都完整卸载重建,触发 CSS slide-in 动画
- 当前 marker 加 `.odyssey-replay-current` 类,drop-shadow 呼吸脉动(1.4s infinite)

## Week 5 ✅ — 视觉打磨

五周路线图的最后一站。没有新功能,全部是让已有功能**配得上它的野心**。

### 设计方向:Editorial Stillness

不是 Arc 的花哨,不是 Linear 的蓝色创业风,不是 Notion 的中性灰。Odyssey 是人生回看工具,该像一本**精心设计的个人日记**。

### 核心变化

- **完整的设计 token 系统**(`--ody-*` CSS 变量):surface / ink / accent / amber / shadow 各三到四个层级。明暗主题分别定义,所有组件都从 token 取色,不再到处硬编码。
- **新字体栈**:Fraunces(编辑体衬线)做 display,Inter Tight 做 UI,JetBrains Mono 做数字 —— 都靠系统 fallback 链保证覆盖,不引入 webfont。
- **新配色**:主色从 Obsidian 默认 `--interactive-accent` 改成自定义 **muted indigo** `#5b5bd6`。跨天条从 accent 改成 **warm amber**,因为"旅程"和"事件"是两种不同的语义,值得不同的视觉语言。
- **新 marker**:MapLibre 默认蓝色水滴 → 自定义 dot+ring 圆点,hover 时 lift + scale,is-hovered 时带 accent-soft 光晕。更干净更现代。
- **Popup 重做**:更接近 Notion 浮卡,更少 Google Maps 气泡感。明暗主题下都有独立的 bg/text/muted 颜色。
- **Replay 氛围升级**:picker/done 界面用 Fraunces 做大字标题,backdrop-filter 加到 `blur(14px) saturate(140%)`,进度条改成 accent → 白色的渐变,控制条的玻璃质感(`blur(18px) saturate(160%)`)更高级。
- **"Done" 文案变温暖**:"Replay again" → "Watch again","Done" → "Back to map","N stops · date → date" → "N stops between date and date"。

### 不做的

- 不引入 webfont(每个字体 200KB+,不值)—— 靠 fallback 链
- 不做卫星图(依然需要 API key,保持 MVP 最小化)
- 不做 Settings 页(等真正有用户反馈再加)

---

## 技术栈决定

| 项目        | 选择              | 理由                              |
| ----------- | ----------------- | --------------------------------- |
| 语言        | TypeScript        | Obsidian 官方                      |
| 构建        | esbuild           | Obsidian 模板自带                  |
| UI          | React 18          | 复杂动画和状态,vanilla 会痛苦      |
| 日期        | date-fns          | 比 moment 轻,比原生好用            |
| Frontmatter | gray-matter       | 事实标准                          |
| 地图(W2)  | MapLibre GL JS    | flyTo 动画现成,免费无锁定          |
| 动画(W5)  | framer-motion     | React 生态最成熟                   |

### 暂缓的决定

- **日历库**:倾向自己造(月视图 ~300 行),但 Week 1 先不纠结,用最简网格跑通数据流,Week 3 正式决定。
- **地理编码**:MVP 让用户手填经纬度或地图点选,不接第三方服务。

---

## 进度追踪

- **当前阶段**:🚀 **准备发布 Obsidian community store**。所有代码和元数据就绪,等用户完成 GitHub 侧的步骤。
- **开始日期**:2026-04-21
- **最后更新**:2026-04-21 (Week 6 收尾)
- **用户下一步**:按 `PUBLISHING.md` 走,填 YOUR_NAME_HERE / YOUR_GITHUB_USERNAME 占位,建仓,push tag,开 PR

## Week 6 — Publishing prep ✅

五周 MVP 收尾后,第六周把项目打包成"一提交就能过审"的状态。

- [x] manifest.json → v1.0.0,添加 author/authorUrl 占位符
- [x] versions.json 对齐 1.0.0
- [x] package.json 对齐 1.0.0
- [x] LICENSE(MIT)
- [x] README.md 重写成产品导向(之前是开发者笔记),作为 GitHub 门面 + Obsidian 插件页面内容
- [x] `.github/workflows/release.yml` —— push tag 自动构建 main.js/styles.css/manifest.json 并创建 draft release
- [x] PUBLISHING.md —— 一份完整的 step-by-step 清单(选 ID、建仓、打 tag、开 PR、应对 review 反馈)
- [x] 清理掉 `console.log` —— Obsidian 审核会 flag
- [x] 最终 build 通过
