# 小程序协作计划

当前项目只按微信小程序方向推进。历史 Android、APK、Capacitor、旧 H5 手机壳不作为当前主线。

总路线图和当前进度看：`docs/project-roadmap.md`。

自测和 UI 合并看：

- `docs/miniprogram-self-test.md`
- `docs/ui-merge-checklist.md`

## 分支规则

- `main`：稳定基线。
- `feature-miniprogram-flow`：当前小程序功能集成分支。
- `ui-polish`：UI 同伴可以从 `feature-miniprogram-flow` 拉出自己的 UI 分支。

推荐 UI 同伴执行：

```bash
git checkout feature-miniprogram-flow
git pull origin feature-miniprogram-flow
git checkout -b ui-polish
```

改完后：

```bash
npm run check
git status
git add miniprogram
git commit -m "Polish miniprogram UI"
git push origin ui-polish
```

推到 GitHub 后建议创建 Pull Request。PR 页面会自动带出 `.github/pull_request_template.md`，按模板勾选 `npm run check`、自测清单和 UI 合并清单即可。

## 当前功能范围

小程序当前已覆盖这些主流程：

- 首页 bootstrap 数据
- 订场列表和场馆详情
- 场馆预约下单
- 球局列表、球局详情、创建球局
- 报名生成订单
- 订单支付、取消、核销
- 消息中心跳转关联订单或球局
- 我的订单、我的球局、信用分
- 场馆管理页
- 场馆入驻申请
- 场馆资料维护：价格、联系方式、开放时段
- 场馆端核销码核销：仅限自己管理的场馆订单
- 赛后互评

`npm run check` 已经加入主流程契约检查，误删关键入口会失败。

## 分工建议

### 功能开发

主要文件：

```text
miniprogram/pages/**/*.js
miniprogram/utils/
scripts/serve-local-mirror.mjs
db/schema.sql
```

负责：

- 接口字段
- 页面数据映射
- 下单、支付、核销、消息、评价逻辑
- 检查脚本

### UI 同伴

主要文件：

```text
miniprogram/pages/**/*.wxml
miniprogram/pages/**/*.wxss
miniprogram/app.wxss
docs/ui-design-system.md
```

负责：

- 页面布局
- 视觉层级
- 按钮、卡片、列表、空状态
- 移动端适配

UI 同伴先不要改 JS。如果需要新增交互状态，先说明需要的数据字段或事件名。

### 文档和部署

主要文件：

```text
README.md
docs/
.github/workflows/
```

负责：

- MacBook 复现
- 微信开发者工具导入
- 服务器和域名上线步骤
- 团队协作说明

## 提交前检查

每次提交前必须运行：

```bash
npm run check
```

这个命令会检查：

- 小程序结构
- 页面四件套
- WXML 事件是否有对应 JS 方法
- 小程序运行时加载
- H5 预览路由
- `wx.*` 桥接覆盖
- 主流程契约：订单定位、场馆入驻、场馆资料维护、场馆核销权限、赛后互评等
- 协作文档：自测清单和 UI 合并清单是否存在并覆盖关键步骤
- 演示准备：README、关键文档、环境模板和忽略规则是否齐全
- GitHub 协作：PR 模板和 Actions 是否覆盖功能分支与 UI 分支协作

## 不要提交

```text
.env
.env.server
miniprogram/project.private.config.json
node_modules/
*.log
*.png
*.apk
```

这些已经在 `.gitignore` 中，但提交前仍要看 `git status`。

## 微信开发者工具

导入目录必须是：

```text
pwzr-nyq/miniprogram
```

不要导入：

```text
pwzr-nyq
pwzr-nyq/site
pwzr-nyq/android
```

没有正式 AppID 时：

```text
AppID: touristappid
后端服务: 不使用云服务
```

## 当前优先级

P0 已完成并持续维护：

- API 配置
- 统一请求
- 本地模拟登录
- 首页、订场、球局、消息、我的接真实接口
- loading/error/empty 基础状态
- 主流程检查

下一阶段优先级：

- 场馆端账号和权限：已完成基础所有权校验，后续接真实微信身份
- 真实微信登录：前后端接口已预留，注册后配置 AppID/AppSecret 即可切换
- 真实支付和退款回调：已拆出预支付、确认支付和微信回调预留；后续补商户号、证书和验签
- 生产服务器、HTTPS 域名和微信合法域名配置：已补环境模板和检查脚本，后续购买服务器/域名后实配
- UI polish、一致性设计和按 `docs/miniprogram-self-test.md` 做真机自测
