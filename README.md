# Subscription Hub

一个给你和 agent 共用的本地订阅管理中枢。

## 启动

```bash
npm install
npm run dev
```

Web 操作台默认在 `http://localhost:5177`，API 默认在 `http://localhost:4177`。

## CLI

```bash
node bin/subhub.js summary
node bin/subhub.js list
node bin/subhub.js due --days 14
node bin/subhub.js add --name "Example" --amount 9.99 --next 2026-07-15 --cycle monthly --category ai --owner agent
node bin/subhub.js update sub_openai --value 5 --notes "Daily AI workbench"
node bin/subhub.js cancel sub_figma
```

数据默认保存在 `data/subscriptions.json`。如果需要让 agent 操作另一份数据，可以设置：

```bash
SUBHUB_DATA_FILE=/absolute/path/subscriptions.json node bin/subhub.js list
```

真实订阅数据不会提交到 GitHub。仓库只包含 `data/subscriptions.example.json` 作为示例。

## 当前能力

- Web 仪表盘：月均支出、年化支出、近期扣费、低价值候选
- Web 管理：新增、搜索、按状态筛选、标记取消、删除、打开订阅官网
- CLI 管理：list、add、show、update、cancel、remove、due、summary
- 本地 API：`/api/subscriptions`、`/api/summary`

## 下一步可以做

- 账号和付款方式的更细粒度管理
- 月度复盘报告
- 取消提醒和日历导出
- 多币种汇率换算
- agent 自动审计策略，比如识别重复 AI 工具或连续低价值服务
