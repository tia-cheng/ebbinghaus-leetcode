![puppy using Ebbinghaus Leetcode](./assets/banner.jpeg)

# Ebbinghaus Leetcode
Always forget the same leetcode even if you AC several time already?!
基于艾宾浩斯记忆曲线的 LeetCode 间隔重复复习 Chrome 扩展。

自动捕获你在 leetcode.com / leetcode.cn 上的 Accepted 提交，按 **1 / 3 / 7 / 15 / 30 天**
的间隔安排复习提醒，并在 LeetCode 首页右下角显示一个悬浮复习清单。

## Tech Stack

- [Plasmo](https://www.plasmo.com/)（Chrome 扩展框架）
- React 18 + TypeScript
- Tailwind CSS（通过 Shadow DOM 与宿主页面样式隔离）
- Headless UI（悬浮窗的 Popover / Transition 交互）
- `@plasmohq/storage`（`chrome.storage.local` 封装 + React Hook）
- `@plasmohq/messaging`（content script ↔ background 通信）

## 项目初始化命令

本仓库的文件已经手工搭建完成，若想从零复现该结构，可参考以下命令：

```bash
# 1. 使用 pnpm 初始化 Plasmo 项目（选择 with TypeScript）
pnpm create plasmo --with-src ebbinghaus-leetcode
cd ebbinghaus-leetcode

# 2. 安装 Tailwind CSS 相关依赖
pnpm add -D tailwindcss postcss autoprefixer
pnpm dlx tailwindcss init -p

# 3. 安装 Headless UI（交互组件）
pnpm add @headlessui/react

# 4. 安装存储与消息通信封装
pnpm add @plasmohq/storage @plasmohq/messaging
```

## 本地开发

```bash
pnpm install
pnpm dev
```

然后在 Chrome 中打开 `chrome://extensions`，开启"开发者模式"，
点击"加载已解压的扩展程序"，选择项目生成的 `build/chrome-mv3-dev` 目录。

## 目录结构

```
src/
  background/
    messages/
      capture-submission.ts   # 接收 Accepted 上报，写入复习队列
  contents/
    interceptor.ts            # MAIN world：拦截 fetch/XHR，捕获判题结果
    capture.ts                 # ISOLATED world：网络事件 + DOM 兜底，双通道上报
    panel.tsx                  # 首页悬浮窗 Content Script UI（Shadow DOM 样式隔离）
  components/
    ReviewPanel.tsx            # 悬浮窗面板（Headless UI Popover + Transition）
    ReviewItem.tsx              # 单个待复习题目
  lib/
    types.ts                   # 数据结构定义
    spaced-repetition.ts        # 间隔重复算法（1/3/7/15/30 天）
    storage.ts                  # 存储读写唯一入口
    use-review-queue.ts         # 悬浮窗使用的自定义 Hook
    logger.ts                   # 统一日志前缀，便于调试反馈
  style.css                     # Tailwind 入口
```

## 捕获机制说明

Manifest V3 的 background service worker 无法通过 `chrome.webRequest` 读取响应体，
因此判题结果的捕获改为在页面 **MAIN world** 注入 `interceptor.ts`，重写
`fetch` / `XMLHttpRequest` 拦截 `/submissions/detail/:id/check/` 接口的响应，
再通过 `CustomEvent` 广播给运行在 **ISOLATED world** 的 `capture.ts` 转发给 background。
`capture.ts` 中同时保留了一份基于 `MutationObserver` 的 DOM 兜底逻辑作为双保险。

若 LeetCode 调整了接口或 DOM 结构导致捕获失效，Console 中会打印带
`[Ebbinghaus-LeetCode]` 前缀的日志，把相关报错反馈回来即可快速定位修复。
