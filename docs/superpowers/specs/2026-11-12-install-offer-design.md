# Home-screen install offer — design

Owner request (2026-11-12): *"I would want to prompt users on mobile phones to add the app to the mobile screen (and
actually make it simpler for the users)."* Choices made with the owner in a short Q&A; the rest took Claude's
recommendation ("pick recommended"). Decision record: DECISIONS #140.

## What was there

`src/lib/install.ts` captured `beforeinstallprompt` at start-up and Settings showed "Install Teleo" (Android/desktop
Chrome) or two text lines for iPhone Safari (#100). Nothing invited anyone; the iPhone lines assumed Safari with Share
in the toolbar (Safari 26 moved it behind ⋯), and in-app browsers — where friends' links often open — got steps that
cannot work there.

## Decisions (owner)

1. **When:** after the first finished session — on its summary, once the result has been seen.
2. **iPhone too:** the owner tested live speech in the installed app on an iPhone; it works.
3. **"Not now":** back after a later session at least 7 days on; after the third, never by itself.
4. **Simpler, all four:** drawn iPhone guide per browser; in-app browser rescue; Firefox/other Android menu path; a
   permanent *Install* entry on Today.
5. **Approach A:** own pure detector + one guide component, in the design system (not a library, not a web component).

## Decisions (recommended, taken on "pick recommended")

- In-app browsers hear it on **Today right after the setup** (after the tour's invitation), not after a session:
  nothing done there moves to Safari or Chrome.
- iPhone in-app: **Copy link** only — the `x-safari-https://` jump has a single, untested source.
- The *Install* chip sits **next to Today's avatar**.

## Shape

- `src/domain/install/platform.ts` — `detectInstallPlatform(env)`: `installed | native | ios-safari(menu|toolbar) |
  ios-chrome | ios-other | android-menu | in-app(app, os) | unavailable`; `isMobileDevice`, `inAppBrowser`,
  `chromeIntentUrl`.
- `src/domain/install/offer.ts` — `shouldOfferInstall({ platform, mobile, offer, now, moment })`, `afterDismissal`.
- `meta.installOffer { dismissals, lastDismissedAt }`; `dismissInstallOffer()` in `src/services/settings.ts`; optional
  in the backup validator.
- `src/components/install/InstallGuide.tsx` (steps with drawn button/menu-row mocks and a pointer arrow) and
  `InstallSheet.tsx` (`InstallOffer` host, `InstallChip`). Settings' section uses the same guide.
- Strings in `install.*` (PL + EN); the old `settings.install*` strings moved there.

## Testing

Unit: platform detection over real user agents (Safari 26/18, iPad as Mac, Chrome/Firefox/Edge on iPhone, Chrome and
Firefox on Android, Instagram/Facebook/Messenger/TikTok/Google app/Android WebView, desktops), the offer rule (moments,
gap, limit), the dismissal service. e2e (phone projects): the chip opens the guide without counting; the first summary
offers it and "Nie teraz" is stored; an Instagram user agent gets the rescue on Today. Other e2e tests switch the offer
off in `declineTour`.

## To check on a device

The Polish system labels quoted, Safari 26's ⋯ → Share → *Do ekranu początkowego* path on iPhone and iPad, and *Open in
Chrome* from Instagram/Facebook on Android.
