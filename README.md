# Subscription Hub

Subscription Hub is an open-source subscription command center for people and agents. It can run locally, or be deployed as a signed-in web app with Supabase and Vercel.

The project language is English by default. The web app also includes a Chinese language option.

## Quick Start

```bash
npm install
npm run dev
```

The web console runs at `http://localhost:5177` by default, and the local API runs at `http://localhost:4177`.

Local JSON mode does not require Supabase. Cloud mode requires copying `.env.example` to `.env.local` and adding your Supabase project URL and anon key.

## Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/202606300001_initial_schema.sql` in the SQL Editor.
3. Enable Google sign-in in Authentication.
4. Add your Project URL and anon public key to `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUBHUB_SUPABASE_URL=https://your-project-ref.supabase.co
SUBHUB_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Vercel

Set these Vercel environment variables:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Then deploy:

```bash
vercel
vercel --prod
```

## CLI

Quick install or update:

```bash
curl -fsSL https://raw.githubusercontent.com/IIIIQIIII/subscription-hub/main/install.sh | bash
```

The installer puts the project in `~/.subhub/subscription-hub` and creates `~/.local/bin/subhub`. It expects `git`, `node`, and `npm` to be available. Run the same command again to pull the latest version and update dependencies.

If your terminal cannot find `subhub`, add `~/.local/bin` to PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

For local development, you can also link the command from the repository with `npm link`.

```bash
subhub summary
subhub list
subhub due --days 14
subhub add --name "Example" --amount 9.99 --next 2026-07-15 --cycle monthly --category ai --owner agent
subhub update sub_openai --value 5 --notes "Daily AI workbench"
subhub cancel sub_figma
```

Remote Supabase mode:

```bash
subhub cloud configure --url "$SUBHUB_SUPABASE_URL" --anon-key "$SUBHUB_SUPABASE_ANON_KEY"
subhub cloud connect-project --project-ref your-project-ref --user-email you@gmail.com
subhub cloud import-local --dry-run
subhub cloud import-local
subhub --remote list
subhub --remote add --name "Example" --amount 9.99 --next 2026-07-15
```

`connect-project` reads project access through the Supabase CLI and stores the cloud connection details agents need in `~/.subhub/config.json`. After that, subscription management can happen through `subhub --remote ...`, without direct agent access to the Supabase API.

Local data is stored in `data/subscriptions.json` by default. To point an agent at a different file, set:

```bash
SUBHUB_DATA_FILE=/absolute/path/subscriptions.json subhub list
```

Real subscription data is not committed to GitHub. The repository only includes `data/subscriptions.example.json` as sample data.

## Features

- Web dashboard: monthly spend, annualized spend, upcoming charges, low-value candidates
- Web management: add, search, filter by status, mark cancelled, delete, open subscription website
- CLI management: list, add, show, update, cancel, remove, due, summary
- Cloud CLI: Supabase configuration, login, logout, identity check, local import, remote subscription management
- Local API: `/api/subscriptions`, `/api/summary`

## 中文说明

Subscription Hub 默认使用英文作为项目语言。Web 界面右上角提供中文切换，CLI 和 README 以英文为主，便于开源用户理解和参与。

快速安装或更新：

```bash
curl -fsSL https://raw.githubusercontent.com/IIIIQIIII/subscription-hub/main/install.sh | bash
```

常用命令：

```bash
subhub --remote list
subhub --remote add --name "Example" --amount 9.99 --next 2026-07-15
subhub summary
```
