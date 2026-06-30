# Subscription Hub

一个给你和 agent 共用的订阅管理中枢。它可以本地运行，也可以通过 Supabase + Vercel 部署成带登录的 Web 服务。

## 启动

```bash
npm install
npm run dev
```

Web 操作台默认在 `http://localhost:5177`，API 默认在 `http://localhost:4177`。

本地 JSON 模式不需要 Supabase。云端模式需要复制 `.env.example` 到 `.env.local`，并填入 Supabase 项目的 URL 和 anon key。

## Supabase

1. 在 Supabase 创建项目。
2. 在 SQL Editor 运行 `supabase/migrations/202606300001_initial_schema.sql`。
3. 在 Authentication 里启用 Google 登录。
4. 把 Project URL 和 anon public key 写入 `.env.local`：

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUBHUB_SUPABASE_URL=https://your-project-ref.supabase.co
SUBHUB_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Vercel

Vercel 环境变量需要设置：

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

然后部署：

```bash
vercel
vercel --prod
```

## CLI

本地开发时先链接一次命令：

```bash
npm link
```

```bash
subhub summary
subhub list
subhub due --days 14
subhub add --name "Example" --amount 9.99 --next 2026-07-15 --cycle monthly --category ai --owner agent
subhub update sub_openai --value 5 --notes "Daily AI workbench"
subhub cancel sub_figma
```

远程 Supabase 模式：

```bash
subhub cloud configure --url "$SUBHUB_SUPABASE_URL" --anon-key "$SUBHUB_SUPABASE_ANON_KEY"
subhub cloud connect-project --project-ref your-project-ref --user-email you@gmail.com
subhub cloud import-local --dry-run
subhub cloud import-local
subhub --remote list
subhub --remote add --name "Example" --amount 9.99 --next 2026-07-15
```

`connect-project` 会通过 Supabase CLI 读取项目权限，并把 agent 需要的云端连接信息保存在本机 `~/.subhub/config.json`。之后订阅管理都通过 `subhub --remote ...` 完成，不需要 agent 直接调用 Supabase API。

数据默认保存在 `data/subscriptions.json`。如果需要让 agent 操作另一份数据，可以设置：

```bash
SUBHUB_DATA_FILE=/absolute/path/subscriptions.json subhub list
```

真实订阅数据不会提交到 GitHub。仓库只包含 `data/subscriptions.example.json` 作为示例。

## 当前能力

- Web 仪表盘：月均支出、年化支出、近期扣费、低价值候选
- Web 管理：新增、搜索、按状态筛选、标记取消、删除、打开订阅官网
- CLI 管理：list、add、show、update、cancel、remove、due、summary
- 云端 CLI：Supabase 配置、登录、登出、身份检查、本地数据导入、远程订阅管理
- 本地 API：`/api/subscriptions`、`/api/summary`

## 下一步可以做

- 账号和付款方式的更细粒度管理
- 月度复盘报告
- 取消提醒和日历导出
- 多币种汇率换算
- agent 自动审计策略，比如识别重复 AI 工具或连续低价值服务
