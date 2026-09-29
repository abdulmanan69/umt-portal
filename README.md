# UMT Portal — Reimagined

Two pieces that work together:

- **`extension/`** — a Chrome/Edge extension that rebuilds the UMT Student Portal
  interface in place, and reads your records once so every screen loads instantly.
- **`webapp/`** — a static TypeScript PWA for GitHub Pages that takes those records
  and reminds you before every class. See [webapp/README.md](webapp/README.md).

The portal sends no CORS headers **and** `X-Frame-Options: SAMEORIGIN`, so no other
website can read it or embed it in an iframe. The extension reads the portal where
you are already signed in; the web app receives that record by paste, bridge, sync
link or file, and works offline from there.

**Live app:** https://abdulmanan69.github.io/umt-portal/

**Walkthrough:** [`video/umt-companion-demo.mp4`](video/umt-companion-demo.mp4) - a
minute from first open to a class reminder.

### Install it on your phone

1. Open the link above in **Chrome** (Android) or **Safari** (iPhone).
2. Android: tap the menu, then **Install app** or **Add to Home screen**.
   iPhone: tap Share, then **Add to Home Screen**.
3. Open it from the home screen, choose **Paste from the portal**, and follow the
   three steps on screen.
4. Settings, then **Remind me before class**, and allow notifications.

Installed on Android, the app can also wake in the background to remind you. On
iPhone reminders arrive while the app is open, which is a limit of the platform,
not of this app.

---

## The extension

A Chrome/Edge extension that rebuilds the interface of the UMT Student Portal
(`online.umt.edu.pk`) without touching the portal itself. It restyles every screen,
makes the whole thing work on a phone, and adds an academic overview built from
your own transcript record.

Nothing is sent anywhere. The extension runs only on `online.umt.edu.pk`, reads the
pages you are already signed in to, and keeps its cache in your own browser.

## Install

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose the `extension` folder inside this project.
4. Open https://online.umt.edu.pk and sign in as usual.

To update after editing any file, press the reload icon on the extension card.

## What it does

**Every page**
- A lifted dark theme built on indigo rather than near-black, with an ambient colour
  wash so no screen reads as flat grey. Light theme included, toggle in the top bar.
- Hover never swaps a colour: surfaces lift and borders brighten, text stays put.
- Hovering a table row is unmistakable - the row lifts to a clearly brighter surface,
  its text brightens, and an amber edge marks where the row begins.
- A single type
  system: Space Grotesk for headings, IBM Plex Sans for text, IBM Plex Mono for
  IDs, codes, grades and credit hours. All three fonts ship inside the extension,
  so nothing is fetched from a font CDN.
- A sidebar with grouped sections, an active-page marker, and a collapsed icon rail
  (Ctrl+B, remembered between visits).
- A top bar that names the page you are on, shows who is signed in, and carries
  search and the theme switch.
- Search: press **Ctrl+K** or **/** to jump to any portal page by name.
- Tables turn into readable cards below 700px, so nothing needs sideways scrolling.
- Announcements that the portal scrolls in a marquee are shown as a normal banner.
- Icons the portal ships but cannot render (its regular Font Awesome face is missing)
  are corrected to the solid face.

**Dashboard**
- A hero banner over the UMT campus photograph the portal already ships, carrying
  your name, programme, ID, credits, and quick links to transcript, attendance and
  fee voucher.
- A CGPA dial that fills on load, with the semester trend line beneath it.
- Stat cards: CGPA, credits earned, latest semester with its change, best semester,
  and semesters on record.
- **Your degree so far** — one row per semester, one chip per course, coloured by
  grade band and sized by credit hours, so a whole degree reads at a glance.
- Two columns on a wide screen: your record on the left, the portal's service tiles
  on the right, each tile carrying its own artwork as a backdrop.

**This semester**
- The timetable opens as a week board: one column per day you have class, each class
  a card with its time, course, room, type and mode. Today's column is marked, a
  class running right now is badged, and each course keeps the same colour all week.
- Above it, the next class you have: which one, what day, what time and which room.
- The panel headings carry the totals - classes and contact hours a week, courses
  and credit hours for the term.
- Registered courses become cards showing credit hours, core or elective, section,
  mode and how many times a week the course meets.
- Both keep a table view for anyone who prefers the original grid.
- Cards, chips, the dial and the trend line animate in once, and hold still for
  anyone who asks for reduced motion.

**Transcript**
- The SSRS report is replaced by a readable view: the same header and stats, a
  labelled semester GPA chart, the degree map, and a clean table per semester.
- **Where you stand** gathers the figures the Controller of Examinations reports -
  credit hours earned, credit hours for GPA, total grade points, CGPA, best semester -
  with a bar showing how your grades split across the whole degree.
- Each semester carries its credits, course count (and how many are labs), SGPA with
  the change from the semester before, CGPA at that point, and its own grade split.
- Every grade is one chip of the same size and shape, coloured by band, so a column
  of them can be read at a glance. Labs and repeats are tagged.
- A filter box narrows every semester at once by course, code or grade.
- Your saved copy paints instantly while the live report loads.
- **Official report** brings the original portal report back, and **Print this page**
  produces a clean printout.

**Payments**
- The fee report is read and rebuilt: total paid, last payment, largest payment and
  this year's total, then every payment grouped by year with its challan number and
  bank. Your saved copy paints instantly; the original report is a toggle away.

**Road Map, Store, Advisor, Fee voucher**
- Report frames get a taller view, an open-in-new-tab, and an optional dark rendering
  that matches the theme.
- These reports build once per page load, so when the portal answers with "Object
  reference not set" the extension says so and offers a page reload rather than
  re-pointing the frame, which is what provokes the error in the first place.
- The portal also returns a blank report now and then, on its own, with or without
  this extension. Revealing an empty report shows what happened and offers a reload
  or the report in its own tab, rather than a white rectangle.

**Requests**
- A count of all requests by status above the table.

**Empty screens**
- "You have no registered courses" and similar screens get the obvious next action.

**Sign-in screen**
- The form sits on a single card over the portal's own background photo, with the
  security code shown beside the field it belongs to (above it on a phone), the
  white UMT mark on the dark card, and the account links gathered into one row.

**Toolbar popup**
- CGPA, credits, semesters and total paid at a glance, how old each record is, a
  refresh button, quick links and the theme switch.

## How records are kept

Your transcript changes about twice a year and your fee history every few months,
so the extension does not re-read them on every visit.

- **Stored, not expired.** Both records live in `localStorage` with the time they
  were read. Nothing is thrown away on a timer, so pages paint from your saved copy
  in well under a second instead of waiting ten to fifteen seconds for the portal
  report service.
- **Warmed in the background.** A few seconds after any portal page settles, anything
  missing or older than its window (45 days for the transcript, 30 for payments) is
  read quietly out of sight. Nothing blocks, and a failure is silent because you
  already have the earlier copy on screen.
- **Refreshed when you ask.** The refresh button in the top bar re-reads the records
  that matter on the page you are on, spins while it works, and tells you what landed.
  Every panel built from a record also carries an "Updated ..." line with its own
  refresh. The toolbar popup shows both ages and can trigger the same refresh in an
  open portal tab.

## Where your data comes from

Both records come from the portal's own reports, parsed in the page:

- the transcript from `/Reports/Transcript.aspx`, which answers with a 500 until the
  session has opened `/Transcript` once, so the extension falls back to loading that
  page out of sight and reading the report from there;
- the fee history from `/Reports/Payments.aspx`, which only ever renders inside its
  own page, so it is always read that way.

Nothing else is fetched, and nothing leaves your browser.

## Files

```
extension/
  manifest.json        MV3 manifest
  src/theme.css        design tokens and every visual override
  src/core.js          storage, helpers, route table
  src/data.js          transcript fetch, parse, cache, derived stats
  src/shell.js         theme, sidebar, top bar, command palette, tables, toasts
  src/widgets.js       hero, stat cards, GPA ridge, degree map
  src/pages.js         per-page behaviour
  src/boot.js          start-up and ajax watching
  fonts/               Space Grotesk, IBM Plex Sans, IBM Plex Mono (woff2)
  icons/               toolbar icons
  popup/               toolbar popup
```

## Keyboard

| Key | Action |
| --- | --- |
| Ctrl+K or / | Open search |
| Ctrl+B | Collapse the sidebar, or open the drawer on a phone |
| Esc | Close search or the drawer |

## Notes

- Grades shown here are read from the portal and are not official. For anything
  official, request a transcript from the Office of the Controller of Examinations.
- The extension never stores your password and asks for no permission beyond
  `online.umt.edu.pk` and local storage.
- Checked against the live portal at 1440px and 390px across 20 screens (40 checks),
  including a full sign-in. The toolbar popup is the one piece that can only be exercised once
  the extension is loaded in Chrome.
