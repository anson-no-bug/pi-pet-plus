# @anson-no-bug/pi-pet-plus

[English README](./README.md) | 中文

这是一个给 [pi](https://shittycodingagent.ai/) 用的全局宠物插件，特点是：

- 紧凑的 ASCII 宠物 widget
- 长期成长系统
- 中英文本地化
- 可选的 `pet-news` 新闻播报模块
- 跨项目、跨 session 的全局存档

## 安装

### 从 npm 安装

```bash
pi install npm:@anson-no-bug/pi-pet-plus
```

### 本地开发加载

```bash
pi -e ./src/index.ts
```

## 目前包含什么

### 模块

- **pet-core**
  - 宠物 widget
  - 成长系统
  - speech 气泡层
  - 命令与设置
- **pet-news**
  - 新闻抓取
  - 轮播
  - 以宠物发言为主的播报方式
  - 可选 footer 模式

### 当前物种

- 猫
- 狗
- 牛
- 马
- 电气鼠
- 种子兽
- 火龙兽

### 成长阶段

分支前的可见阶段：

1. 宝宝
2. 学园期
3. 高中
4. 大学

大学毕业后可选两条职业线：

- **学术线**：硕士 → 博士 → 教授 → 院士
- **工程线**：实习生 → 工程师 → 高级工程师 → 领域专家

## 交互式使用方式

### 主宠物菜单

打开菜单：

```text
/pet
```

你可以在菜单里：

- 查看状态
- 切换宠物
- 新建宠物
- 删除宠物
- 打开 `pet-news`
- 毕业后选择职业线
- 打开设置
- 显示 / 隐藏 widget

### 新闻菜单

可以直接打开：

```text
/news
```

也可以从宠物里进入：

```text
/pet news
```

在新闻详情面板里，点击 **Open ↗** 可以打开完整文章链接。

## 命令列表

### 宠物命令

```text
/pet
/pet status
/pet new
/pet rename <name>
/pet switch
/pet switch <name>
/pet delete <name>
/pet news
/pet branch
/pet preview <state>
/pet demo
/pet config
/pet toggle
```

### 新闻命令

```text
/news
/news open
/news toggle
/news on
/news off
/news next
/news prev
/news refresh
/news config
/news add-rss <url> [label]
/news remove <sourceId>
/news status
```

## 默认设置

当前默认值：

- 宠物动画速度：**0.5 FPS**
- 新闻滚动速度：**100ms**
- 语言：**zh**
- 新闻展示方式：**speech**

设置入口：

```text
/pet config
/news config
```

## 开发 / 调试命令

本地调试视觉时可以使用：

```text
/pet dev xp <totalXp>
/pet dev stage <baby|kindergarten|elementary|middle-school|high-school|university>
/pet dev branch <none|academia|engineering> [rank]
/pet dev reset
```

例如：

```text
/pet dev stage baby
/pet dev stage university
/pet dev branch academia 4
/pet dev branch engineering 4
```

## 存储位置

全局文件位于：

- `~/.pi/agent/pet/config.json`
- `~/.pi/agent/pet/state.json`
- `~/.pi/agent/pet/news-cache.json`

## 开发

```bash
npm run typecheck
npm test
```

## 相关文档

- [English README](./README.md)

## License

MIT
