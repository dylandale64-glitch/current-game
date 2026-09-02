# Getting to the App Store from a Windows PC

Verified pieces, unverified pipeline. Prove each step with a hello-world export before
building anything on top of it.

## Costs

| Item | Cost | Note |
|---|---|---|
| Apple Developer Program | $99 / year | Fee waivers exist for accredited educational institutions - ask MSU's engineering or CS department before paying |
| Google Play Console | ~$25 one-time | No Mac needed |
| GitHub Actions macOS runner | free on public repos | $0.062/min on private repos |
| Godot 4 | free | Runs on Windows |

## The route

1. Rebuild in Godot 4 on Windows. This is 2D canvas work; Godot handles it and exports to iOS and Android.
2. Push to a **public** GitHub repo. macOS runners are free there.
3. CI runs the Xcode build and signing. Certificates and provisioning profiles are made in a browser on Apple's developer portal; the signing request can be generated with `openssl` on Windows.
4. Upload to TestFlight, test on your own phone, then submit.

## Two warnings

**Do not ship the web build in a native wrapper.** Apple's review guideline 4.2 targets thin
web wrappers, and you would lose Core Haptics - the single biggest missing piece of this game.

**Android first is the cheaper proof.** $25, no Mac, no CI puzzle. Chrome on Android supports
the Vibration API, so you can tune the haptic mapping there before committing to iOS.
`navigator.vibrate` is unsupported in Safari on iOS in every version, so the web build cannot
buzz on an iPhone at all.
