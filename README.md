This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Local Windows Dev Note

- This project intentionally uses `webpack` for `npm run dev` on this machine (`next dev --webpack`) for improved local stability.
- On Windows, adding Microsoft Defender / antivirus exclusions for this project folder can improve local development performance.

### DEV RUNNING

- Run only one dev server at a time.
- If `http://localhost:3000` is already working, do not run `npm run dev` again.
- If a stuck server must be stopped on Windows, use:

```cmd
taskkill /PID <PID> /F
```

### Temporary Debug Mode (Turbopack Trace)

Use this only when diagnosing local performance issues. Keep normal daily dev on webpack.

PowerShell:

```powershell
# 1) Start a local OTLP collector endpoint first (example: 4318)
# 2) Run Next.js dev in Turbopack mode and upload trace data
npx next dev --turbo --experimental-upload-trace http://127.0.0.1:4318/v1/traces
```

CMD:

```cmd
REM 1) Start a local OTLP collector endpoint first (example: 4318)
REM 2) Run Next.js dev in Turbopack mode and upload trace data
npx next dev --turbo --experimental-upload-trace http://127.0.0.1:4318/v1/traces
```

Optional CPU profile capture during diagnosis:

```powershell
npx next dev --turbo --experimental-cpu-prof
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
