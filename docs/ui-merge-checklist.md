# UI 分支合并检查清单

这份清单用于检查 UI 同伴的 `ui-polish` 分支。目标是允许她大胆改视觉，但不破坏小程序功能流。

## 1. 合并前准备

先在本地功能分支更新：

```bash
git fetch origin
git checkout feature-miniprogram-flow
git pull origin feature-miniprogram-flow
```

查看 UI 分支差异：

```bash
git fetch origin ui-polish
git diff --stat feature-miniprogram-flow..origin/ui-polish
git diff --name-only feature-miniprogram-flow..origin/ui-polish
```

## 2. UI 分支允许主要修改

优先允许：

```text
miniprogram/pages/**/*.wxml
miniprogram/pages/**/*.wxss
miniprogram/app.wxss
docs/ui-design-system.md
```

谨慎允许：

```text
miniprogram/pages/**/*.json
```

需要功能开发同意后再改：

```text
miniprogram/pages/**/*.js
miniprogram/utils/
scripts/
db/
package.json
```

不要提交：

```text
.env
.env.server
miniprogram/project.private.config.json
node_modules/
*.log
```

## 3. 不能删的关键绑定

UI 改 WXML 时，不要删除这些能力：

- 首页：快捷入口、待处理事项、推荐场馆、推荐球局。
- 订场页：搜索、筛选、重试、清空筛选、订场按钮。
- 场馆详情页：日期选择、时段选择、生成待支付订单。
- 球局页：搜索、筛选、重试、清空筛选、发起球局、报名按钮。
- 发起球局页：发布预览、校验清单、发布按钮。
- 球局详情页：报名进度、赛后互评、重试、返回球局。
- 订单页：支付、取消、核销、评价入口。
- 消息页：未读/已读分组、关联订单/球局跳转。
- 我的页：订单、我的球局、信用分、场馆端入口。
- 场馆端：入驻申请、资料维护、核销码核销、订单核销。

如果必须重命名事件或数据字段，先同步功能开发一起改 JS 和流程检查。

## 4. 本地检查命令

UI 分支改完后运行：

```bash
npm run check
```

必须通过后再提交：

```bash
git status
git add miniprogram docs/ui-design-system.md
git commit -m "Polish miniprogram UI"
git push origin ui-polish
```

## 5. 人工验收

按 `docs/miniprogram-self-test.md` 走一遍。

特别注意：

- 模拟器窄屏下文字不重叠。
- 按钮文字不溢出。
- loading、error、empty 三种状态看起来统一。
- 页面没有嵌套卡片堆叠过重。
- tab 页面切换后展示一致。
- 订场页和球局页在放大/缩小时内容一致。

## 6. 合并方式

推荐先开 PR，检查通过后合并。

如果本地合并：

```bash
git checkout feature-miniprogram-flow
git pull origin feature-miniprogram-flow
git merge origin/ui-polish
npm run check
git push origin feature-miniprogram-flow
```

如果合并冲突集中在 `.wxml` / `.wxss`，优先保留 UI 同伴的视觉改动，但必须保留功能事件绑定和数据字段。
