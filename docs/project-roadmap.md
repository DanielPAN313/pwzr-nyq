# 宁约球小程序当前进度与路线图

更新时间：2026-07-02

这份文档是项目协作总览。它回答三个问题：

- 现在已经做到哪一步。
- 你和 UI 同伴分别该做什么。
- 后面上线前还差什么。

## 当前主线

当前项目主线是微信小程序，不再按 Android、APK、Capacitor 或 H5 手机壳方向推进。

主要分支：

- `feature-miniprogram-flow`：当前功能集成分支。
- `ui-polish`：UI 同伴应从 `feature-miniprogram-flow` 新建的 UI 分支。

当前开发方式：

- 未注册小程序也能继续开发。
- 微信开发者工具使用 `touristappid`。
- 本地后端默认 `http://localhost:4174`。
- 默认使用模拟登录和模拟支付。

## 已完成

### 小程序基础

- `miniprogram/` 已作为小程序主目录。
- `project.config.json` 和 `miniprogram/project.config.json` 保持 `touristappid`。
- `utils/config.js` 统一管理 API 地址、登录模式和存储 key。
- `utils/api.js` 统一请求、loading、错误、token 和用户 header。
- `utils/api.js` 支持请求超时、弱网错误文案、HTTP 状态文案和 GET/HEAD 轻量重试。
- `utils/auth.js` 支持本地模拟登录，也预留 `wx.login` 真实登录。
- `app.wxss` 已统一主按钮、次按钮、小按钮、禁用态和状态面板基础样式。

### 用户端主流程

- 首页接入 `/api/sports-app/bootstrap`。
- 首页支持统计概览、快捷入口、待处理事项、推荐场馆和推荐球局。
- 订场页接入真实场馆列表。
- 订场页支持关键词搜索和运动类型筛选。
- 订场页支持错误重试、清空筛选和无结果引导。
- 场馆详情页支持查看开放时段、选择时段并生成待支付订单。
- 场馆详情页支持价格、联系方式、开放说明和当前选择提示。
- 场馆详情页支持加载失败重试、返回订场和无可约时段引导。
- 球局页接入真实球局列表。
- 球局页支持关键词搜索和运动类型筛选。
- 球局页支持错误重试、清空筛选和无结果引导。
- 球局详情页支持报名、查看球友和赛后互评。
- 球局详情页支持人数进度、下一步提示和互评状态引导。
- 球局详情页支持加载失败重试、返回球局和空球友状态引导。
- 创建球局页已接入后端。
- 创建球局页支持发布预览、提交校验和发布后跳转球局详情。
- 创建球局页支持逐项校验清单、场馆加载重试和跳转订场。
- 订单页支持支付、取消、核销码、核销和赛后评价入口。
- 订单页支持按状态展示下一步提示。
- 订单页支持错误重试和空订单时跳转报名/订场。
- 消息页支持跳转关联订单或球局。
- 消息页支持未读/已读分组和关联动作提示。
- 消息页支持错误重试和空消息时回首页/看订单。
- 我的页接入订单、球局、信用分基础数据。
- 我的页支持关键数据概览和用户/场馆入口分组。
- 我的球局页支持统计概览、分类筛选、状态分组、人数进度和下一步动作。
- 信用分页支持等级说明、到场率统计、恢复建议、信用规则和信用记录分组。
- 合规说明页已从我的页接入，展示隐私政策、用户协议、支付说明和场馆合作开发版摘要。

### 场馆端

- 场馆管理页已存在。
- 支持申请入驻场馆。
- 支持维护自己场馆的价格、联系方式和开放时段。
- 用户端场馆详情能展示场馆端维护的开放时段。
- 场馆端支持订单列表和核销码核销。
- 后端已限制场馆端只能核销自己管理场馆的订单。
- 场馆管理页支持入驻、维护、核销三步引导和订单处理提示。
- 场馆管理页支持加载失败重试、入驻/维护校验清单、无场馆和无订单状态引导。

### 登录与支付预留

- 微信登录接口形状已预留：`/api/sports-app/auth/wechat-login`。
- 未配置 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` 时继续使用开发身份。
- 订单支付已拆成预支付和确认支付：
  - `/api/sports-app/orders/:id/prepay`
  - `/api/sports-app/orders/:id/pay/confirm`
- 微信支付回调预留：`/api/sports-app/payment/wechat/notify`。
- 当前不会真实扣款，仍是本地模拟支付。

### 上线准备

- 已有 Dockerfile 和 docker-compose.yml。
- 已新增 `.env.example` 和 `.env.server.example`。
- 已新增 `npm run check:deploy`。
- `npm run check` 已覆盖：
  - 小程序结构检查
  - 主流程契约检查
  - 小程序运行时检查
  - H5 预览检查
  - `wx.*` 桥接覆盖检查
  - 协作文档和自测清单检查
  - 演示/交接准备检查
  - 部署准备检查
- 合规材料草案已放在 `docs/legal/`。
- 微信开发者工具自测清单已放在 `docs/miniprogram-self-test.md`。
- UI 分支合并检查清单已放在 `docs/ui-merge-checklist.md`。
- GitHub PR 模板已放在 `.github/pull_request_template.md`，Actions 会在 `main`、`feature-miniprogram-flow` 和 PR 上运行检查。

## 当前还不是正式上线版的原因

还没有完成这些真实生产能力：

- 正式微信小程序 AppID。
- 真实微信登录的 AppID/AppSecret 配置。
- 微信支付商户号、证书、API v3 key、验签和退款回调。
- HTTPS 线上服务器和微信合法请求域名。
- 运营主体、客服电话、隐私政策、用户协议等正式发布信息。
- 真实场馆合作、结算和审核规则。

## 你现在应该做什么

### 你自己

优先保持功能线稳定：

1. 确保本地代码在 `feature-miniprogram-flow`。
2. 每次大改后运行 `npm run check`。
3. 暂时不急着买服务器和域名，等要真机体验版、外部测试或提交审核时再买。
4. 如果 UI 同伴推了 `ui-polish`，先检查她是否只改了 `.wxml` / `.wxss` / `app.wxss`。

### UI 同伴

UI 同伴从最新功能分支开始：

```bash
git fetch origin
git checkout feature-miniprogram-flow
git pull origin feature-miniprogram-flow
git checkout -b ui-polish
```

主要改：

- `miniprogram/pages/**/*.wxml`
- `miniprogram/pages/**/*.wxss`
- `miniprogram/app.wxss`

先不要改：

- `miniprogram/pages/**/*.js`
- `miniprogram/utils/`
- `scripts/`
- `db/`

改完后运行：

```bash
npm run check
git push origin ui-polish
```

## 下一步执行顺序

### P0：继续稳定当前功能

1. UI polish：统一视觉、间距、按钮、状态标签和空状态。
2. 真机前自测：微信开发者工具打开 `miniprogram/`，逐页检查不报错。
3. 合并 UI 分支前跑 `npm run check`。
4. 继续补齐页面视觉统一，并按自测清单做微信开发者工具/真机检查。
5. 演示或交接前确认 `npm run check` 中的 `check:demo-readiness` 通过。

### P1：注册小程序后做

1. 替换正式 AppID。
2. 配置 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`。
3. 把 `useMockAuth` 切到 `false`。
4. 用真实 `wx.login` 验证登录。

### P2：准备体验版或审核前做

1. 购买服务器和域名。
2. 部署 Docker Compose。
3. 配置 HTTPS 反向代理。
4. 在微信公众平台配置 request 合法域名。
5. 把小程序 `apiBaseUrl` 改成 HTTPS 域名。
6. 跑 `npm run check:deploy`。

### P3：真实交易前做

1. 开通微信支付商户号。
2. 配置商户证书和 API v3 key。
3. 实现支付通知验签。
4. 实现退款申请和退款通知验签。
5. 增加对账和异常订单处理。

### P4：正式发布前做

1. 补齐 `docs/legal/` 里的运营主体、联系方式、生效日期。
2. 确认隐私政策和用户协议。
3. 确认场馆合作、结算和争议处理规则。
4. 完成微信小程序用户隐私保护指引配置。
5. 准备审核截图、服务类目和客服资料。

## 常用命令

```bash
npm ci
npm run dev
npm run check
npm run check:deploy
```

查看当前分支：

```bash
git status --short --branch
```

推送当前功能分支：

```bash
git push origin feature-miniprogram-flow
```

## 关键文档入口

- MacBook 复现：`docs/macbook-repro.md`
- 协作说明：`docs/collaboration-plan.md`
- 小程序自测：`docs/miniprogram-self-test.md`
- UI 合并检查：`docs/ui-merge-checklist.md`
- 服务器上线：`docs/server-deploy.md`
- 合规材料：`docs/legal/`
- 产品需求：`docs/snapsport-c-prd.md`
- UI 设计系统：`docs/ui-design-system.md`
