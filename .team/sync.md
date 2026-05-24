# 🔄 Sync gates

Tick your cell (`✅`) when **you** have finished that phase. A phase may begin
only when its **required gate** is `✅` for **all four** agents. While waiting,
set `.team/status/<you>.md` to `WAITING` and re-read this file to poll.

| Gate | Meaning | Atlas | Forge | Prism | Sentinel |
|------|---------|:-----:|:-----:|:-----:|:--------:|
| GATE-0 | Read role + protocol, checked in (`ready`) | ⬜ | ⬜ | ⬜ | ⬜ |
| GATE-A | Domain audit complete (`findings/<you>.md` filled) | ⬜ | ⬜ | ⬜ | ⬜ |
| GATE-B | Roadmap ratified (exactly 100 items agreed) | ⬜ | ⬜ | ⬜ | ⬜ |
| GATE-C | All my items `done` **with Acceptance proven** | ⬜ | ⬜ | ⬜ | ⬜ |
| GATE-D | Suite green + every 🔴/🟠 done-or-waived (Sentinel-validated) | ⬜ | ⬜ | ⬜ | ⬜ |
| GATE-E | Release-readiness signed off | ⬜ | ⬜ | ⬜ | ⬜ |

> Legend: ⬜ not yet · 🔄 in progress · ✅ done
>
> GATE-D is primarily Sentinel's call (it runs the suite); the others tick once
> their items pass. GATE-E is Atlas + Sentinel.
