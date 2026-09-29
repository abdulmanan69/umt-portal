# UMT Companion

**Live:** https://abdulmanan69.github.io/umt-portal/

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

## Setting it up

Three steps, and the first one is a single button:

1. **Get your timetable in.** Copy the table on the portal dashboard, then press
   *Paste from clipboard*. A sample timetable, the extension, a sync link and an
   exported file all sit behind *Other ways in*.
2. **Allow reminders**, and pick how much warning you want.
3. **Install it** to the home screen, with the instructions that match your device.

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

### What a reminder looks like

- **Title:** the course code and name.
- **Body:** how long you have, the start time, the room, which class of the day it
  is, and what follows it.
- **Picture:** a wide card drawn in the app's own colours, with the countdown set
  large. Android shows it under the notification; it is about 34 KB of JPEG.
- **The number is always the real one.** Whatever warning you choose is what the
  body and the picture say: set two minutes and the card reads "In 2 min" with a
  large 2. A background wake-up can arrive late, so the service worker redraws the
  card at the moment it fires rather than reusing the one painted earlier. A
  reminder that lands after the class began says "Started 7 min ago" and shows a
  7, instead of insisting the class is still to come.
- **Buttons:** *Open timetable* and *Remind in 5 min*.
- **Tone:** six to choose from in Settings, played by the app when a reminder lands
  while it is open. They are synthesised with the Web Audio API, so there are no
  audio files to download and they work offline. A notification raised by the phone
  while the app is closed plays whatever your notification settings say; no web app
  is allowed to override that.
- **Urgency:** inside five minutes a reminder vibrates harder and stays on screen
  until it is dealt with.
- **On screen:** if the app is open when a reminder fires, an animated card slides
  up with a ring that drains as the minutes go. An OS notification is drawn by the
  operating system and cannot be animated by a web app; this is the part that can.

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

## Installing it

Open the live link, then:

- **Android / Chrome:** menu, then *Install app*.
- **iPhone / Safari:** Share, then *Add to Home Screen*.
- **Desktop Chrome or Edge:** the install icon in the address bar.

Everything below the install is offline: the app opens with no network at all,
and your record never leaves the device.

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
