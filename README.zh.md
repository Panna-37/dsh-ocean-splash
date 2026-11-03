# ASCII Ocean Splash · 深海开机动画

中文 | [English](README.md)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 做的开机片头：纯黑，一条极细的水线，一个 `DEEPSEEK HARNESS` 字标——然后四条字符鲨鱼游进来，把字一格一格吃掉。字全没了之后停三秒，再渐暗进入主界面。

![预览](docs/preview.gif)

鲨鱼不是这里手画的：插件内置了 [`dsh-ascii-ocean`](https://github.com/GqqQq-Q/dsh-ascii-ocean)（MIT）的海洋渲染器，所以它和你会话页背景里的鱼**同源**——同样的方块格子、同一套字符（`: ; t % S X 8 # @`）、同样靠脊柱链摆动。

## 过程

| 时间 | 发生什么 |
| --- | --- |
| 0 – 1.7s | 一条 1px 水线从左划开；32% 高度处浮现一条更淡的远线 |
| 1.5 – 3.0s | `DEEPSEEK HARNESS` 淡入 |
| 0.3s / 1.5s | 两条**按路线**的鲨鱼从屏幕两侧游入（一条正常、一条 1.45 倍） |
| 3.0s / 3.6s | 两条**自由游动**的鲨鱼加入，走引擎自己的 AI，没有固定路线 |
| 约 10–12s | 两条路线鲨鱼穿过字标，它们盖住的每一格都被**永久擦除** |
| 覆盖率归零 | **纯黑停 3 秒** |
| +3s | 用 1.8 秒渐暗，进入主界面 |

按 <kbd>Esc</kbd> 或点一下任意位置可以跳过。

## 安装

需要 DeepSeek Harness 桌面版 0.2.1（实测版本）和 `desktop` profile。

```bash
dsh plugin --profile desktop add github:Panna/dsh-ocean-splash
```

本地目录：

```bash
dsh plugin --profile desktop add "file:C:/path/to/dsh-ocean-splash"
```

装完要**完全退出再打开**——片头只在冷启动播。Windows 上点 × 只是缩到托盘，从托盘菜单退出才算。

## 调整

没有设置页，参数都在 [`lib/boot.js`](lib/boot.js) 顶部：

| 常量 | 含义 |
| --- | --- |
| `WORD` / `TRACKING` / `FONT_SIZE` | 字标内容、字距、字号 |
| `HOLD` | 字被吃光后黑屏停留时长（毫秒） |
| `FADE` | 渐暗时长（毫秒） |
| `SPAWNS` | 四条鱼：出场时间、是否按路线、方向、体型 |
| `renderer.settings.sharkColor` | 鲨鱼颜色，默认 `#4284FF` |
| `renderer.settings.cellSize` | 格子大小，默认 `6` |

30fps 上限和 45 秒兜底是有意的：前者把 CPU 让给正在加载的主界面，后者保证任何异常都不会把你困在黑屏。

## 实现

- `index.js` 跑在宿主：注册两个脚本路由，并通过 `webserver/index-inject` 把 `/dsh-ocean-splash/splash.js` 注入 `<head>`，所以遮罩在第一帧之前就存在。
- `lib/boot.js` 建全屏遮罩、按**墙钟**推进时间线、用渲染器自己的鲨鱼格子擦除字标、最后淡出。
- `lib/ocean-renderer.js` 是内置的海洋渲染器，相对上游改了两处：关掉"避开标题区"的转向力（否则鱼不会游过字标），以及调低巡航速度。
- Windows 上只在这段片头期间隐藏原生窗口按钮：把标题栏取色用的探测 span 通过一条 CSS 规则变成全透明，片头结束即摘掉规则。

插件**不会碰** Harness 的 `window.__ModuleLoader__`——内置渲染器走自己的 `window.__DSH_OCEAN_LOADER__` 入口，客户端插件照常加载。

## 已知限制

- 每次冷启动只播一次，没有重播命令。
- 时间线写死约 16 秒（其中 10–12 秒是鲨鱼穿场）。
- 隐藏原生窗口按钮只在 Windows 生效，其他平台自动跳过。
- 动画按墙钟推进，窗口被挂起后回来会直接对齐到该到的时间点。

## 致谢与许可

MIT，见 [LICENSE](LICENSE)。

`lib/ocean-renderer.js` 派生自 [`dsh-ascii-ocean`](https://github.com/GqqQq-Q/dsh-ascii-ocean)（MIT）里的海洋渲染器，后者移植自 [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks)。上游的 MIT 授权与版权声明保留；本仓库做的修改列在「实现」一节。
