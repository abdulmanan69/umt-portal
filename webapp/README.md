# UMT Companion

A static, offline-first web app for your UMT timetable, class reminders and academic
record. TypeScript, no framework, no backend. It builds to plain files and runs on
GitHub Pages.

## Why the portal is not embedded here

Two separate walls, both measured against the live site rather than assumed:

- `online.umt.edu.pk` answers cross-origin requests with an **opaque response**. It
  sends no CORS headers, so a page on `github.io` cannot read a single byte of it,
  with or without your password.
- It also sends **`X-Frame-Options: SAMEORIGIN`**. Every browser refuses to put it
  in an iframe on another site. An embedded portal renders as an empty frame, and
  even if it did render, same-origin rules would keep its contents unreadable.

The only way around either would be a server in the middle holding your
credentials. This project does not do that.

So your record comes across by other means, and then lives on your device:

| Route | Where it fits |
| --- | --- |
| **Paste from the portal** | A phone with no extension. Open the portal, copy the timetable table, paste it in. The parser reads values by shape, so missing cells do not shift the columns. |
| **Extension push** | A computer where you already use the portal. Press **Send to web app** in the extension popup. |
| **Sync link or QR** | Moving a record to a phone. The data rides in the URL fragment, which browsers never send to a server. |
| **Exported file** | Backups, or a device with no extension. |
| **By hand** | Timetable editor: add, correct or remove a class yourself. |

Sign-in here is a passcode that locks this device. It is not portal authentication
and does not pretend to be.

## Class reminders

The timetable already carries start times, so the app schedules a notification a
set number of minutes before each class. What that means in practice:

- **App open:** exact timers, to the minute. Verified firing 15 minutes ahead.
- **Installed to the home screen, Chrome or Edge:** the service worker also gets
  periodic background sync and catches classes while the app is closed.
- **Everywhere else, including iOS Safari:** reminders arrive while the app is
  open. The web platform gives no reliable background wake-up without a push
  server.

Settings lets you change the warning time, mute individual days, and send a test.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173/umt-companion/
npm run test       # parser checks against real copied portal text
npm run build      # typecheck + tests + bundle into dist/
npm run preview
```

`npm run build` will not produce a bundle unless the type check and the parser
checks both pass, so a broken paste parser cannot reach Pages.

## Publishing to GitHub Pages

1. Push this repository to GitHub.
2. Settings -> Pages -> Build and deployment -> Source: **GitHub Actions**.
3. Push to `main`. `.github/workflows/deploy.yml` type checks, builds and deploys.

The workflow sets the Vite base path from the repository name, so
`https://<user>.github.io/<repo>/` works without editing anything. Building by
hand for a different path: `UMT_BASE="/my-path/" npm run build`.

## What is in here

```
src/
  core/
    types.ts          the domain: classes, courses, semesters, payments
    parse.ts          reads pasted portal tables by shape, not by column
    time.ts           clock parsing, next occurrence, relative time
    store.ts          localStorage persistence, settings, passcode
    sync.ts           extension bridge, sync links, file import and export
    notifications.ts  permission, scheduling, handoff to the service worker
  app/
    router.ts         hash routing, so Pages needs no rewrite rules
    shell.ts          rail, top bar, mobile drawer and tab bar
    theme.ts          dark and light
  ui/
    dom.ts            a typed element builder
    components.ts     buttons, cards, stats, pills, toasts, icons
  views/
    gate.ts           how your data gets in, and the passcode lock
    paste.ts          the portal paste importer and the timetable editor
    today.ts          countdown, today's classes, what is next
    week.ts           week board, academic record, fees
    schedule.ts       the class card and week board themselves
    settings.ts       reminders, data, sync link, device
public/
  sw.js               offline shell plus background class checks
  manifest.webmanifest
test/
  parse.check.ts      28 checks against text copied from the real portal
```

The service worker names its cache after the build id, so each deploy replaces the
previous one instead of serving a stale app forever. When a new build lands while
the app is open, it says so rather than swapping under you.

## Privacy

Everything lives in `localStorage` on the device you are using. There is no
server, no analytics and no account. Erase everything from Settings, or clear site
data, and nothing of yours remains.
