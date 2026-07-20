# Tars Trading — v2 Roadmap (seeded at v1 code-complete)

The next 50 begin here. Candidates, roughly ordered:

1. **Live paper accounts by default** — onboarding flow for Alpaca paper keys (secure enclave storage), replacing Secrets.swift hand-editing.
2. **WidgetKit + Live Activities** — portfolio widget, agent-session Live Activity / Dynamic Island (needs widget extension target in project.yml).
3. **On-device Tars** — MLX small open-weight model for offline mentoring; engine protocol is already in place.
4. **Real options paper trading** — swap the sandbox book for Alpaca paper options endpoints; keep the sandbox as the teaching layer.
5. **Streaming market data** — paid Massive tier; replace polling with websockets (the "no polling where streaming exists" rule fully realized).
6. **Agent evolution** — walk-forward optimizer UI, parameter sweeps with overfit guards, agent tournaments on paper capital.
7. **Android** — per CLOUD_DATA_MODEL playbook thinking: decide cloud sync story first (all state is currently local JSON).
8. **Social/allocator layer** — share agent cards (read-only, no money), classroom mode for the teen track.
9. **Localization** — layouts are RTL-ready; strings need catalogs.
10. **Live trading research track** — broker entitlements, KYC, and the regulatory reality: user's-own-money only; managing others' capital = RIA/fund registration, out of app scope.
