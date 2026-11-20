# Phase 3 · Bằng chứng

## Kết quả kiểm chứng

- `npm run build` — PASS: JavaScript syntax checks completed.
- `npm run verify` — PASS: contract/tuning consistency, determinism, movement, pickup, fuel decay and shutoff, refuel, relight, shade draining and 60-tick event, drain pulse score, dawn thresholds for all three nights, no-early-win, no-flames priority, and retained Phase 2 checks. Current contract metadata is 1.3; gameplay tuning remains Phase 3's 1.2 rules.
- Headless performance — Night 3, 18,000 ticks completed in 4.13 s on the current Windows development environment (local measurement; machine-dependent).
- Direct CLI proof: [scenario](phase-3-dawn-win-scenario.json) → [raw JSONL](phase-3-dawn-win.jsonl); Mây survives dawn with 3/5 lamps lit and ends `won`, reason `dawn_survived`.

## Truy vết nhanh

| Yêu cầu | Kiểm chứng | Kết quả |
|---|---|---|
| Contract hiện hành và tuning Phase 3 khớp | `npm run verify` | Đạt |
| Đèn hao dầu, hết dầu thì tắt | `fuel-decay`, `lantern-out` scenarios | Đạt |
| Châm dầu và thắp lại | `refuel`, `relight` scenarios | Đạt |
| Bóng Mực hút dầu và phát event mỗi 60 tick | `shade-drain` scenario | Đạt |
| Không thắng sớm; tỷ lệ bình minh từng đêm | `no-early-win`, `dawn-night-*` scenarios | Đạt |
| Hết lửa ưu tiên ở tick bình minh cuối | `no-flames-at-dawn` scenario | Đạt |
| Cài đặt mù màu/giảm chuyển động, thanh dầu, nhấp nháy và lồng đèn | Đã tích hợp trong `src/main.js` và `src/renderer.js`; không được kiểm tra bởi headless verifier | Tính năng có trong code; chưa có ảnh/video UI làm bằng chứng |

Lệnh tạo JSONL tái lập:

```bash
node src/cli.js --seed 2026 --night 1 --ticks 5 --snapshot-every 1 --scenario docs/proof/phase-3-dawn-win-scenario.json --out docs/proof/phase-3-dawn-win.jsonl
```
