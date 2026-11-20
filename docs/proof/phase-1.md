# Phase 1 · Bằng chứng

> Output `phase-1-win.jsonl` bên dưới được giữ làm bằng chứng lịch sử của contract Phase 1. `all_lit` đã bị Ticket-03 thay thế; kiểm tra hiện hành là các scenario bình minh trong [bằng chứng Phase 3](phase-3.md).

## Kiểm chứng tự động

- `npm run build` — PASS (kiểm tra cú pháp các module JS).
- `npm run verify` — PASS: tuning khớp; hai lần chạy cùng seed giống byte; movement; pickup; deposit/lit; pulse/stun đúng thời lượng; hit/drop; thắng/thua; JSONL end; input scenario sai trả mã 2 và stderr.
- Tình huống thắng có thể tái chạy bằng lệnh dưới; đầu ra lưu ở `phase-1-win.jsonl`.

```sh
node src/cli.js --seed 2026 --night 1 --scenario docs/proof/phase-1-win-scenario.json --inputs docs/proof/phase-1-win-inputs.json --ticks 12 --snapshot-every 1 --out docs/proof/phase-1-win.jsonl
```

## Hiệu năng cục bộ

- Máy chạy kiểm chứng: Windows, Node.js cục bộ, chế độ headless.
- 18.000 tick (đêm đủ 300 giây), seed 5, snapshot mặc định mỗi 10 tick: **0,643 giây**, output 60.437 byte.
- Đây là số đo của máy phát triển; máy chấm có thể khác.

## Ma trận yêu cầu

| Yêu cầu | Cách kiểm chứng | Kết quả |
|---|---|---|
| Contract tuning trùng luật game | `npm run verify` | Đạt |
| Determinism theo seed | Chạy hai lần và so byte trong harness | Đạt |
| Nhặt đom đóm | Scenario pickup trong harness | Đạt |
| Nạp/thắp đèn, thắng cả 5 đèn | Harness + scenario/input/output đã lưu | Đạt |
| Pulse làm choáng Bóng Mực | Scenario pulse trong harness | Đạt |
| Thua khi hết lửa | Scenario 0 lửa trong harness | Đạt |
| Lỗi scenario trả mã 2 và stderr | Scenario JSON lỗi trong harness | Đạt |
| Cảnh WebGL, HUD, timer và bản đồ nhỏ | Mở local trong trình duyệt; scene hiển thị, timer chạy, không có lỗi console | Đạt, kiểm tra trực quan cục bộ |
| Game chơi trực tiếp từ đầu đến thắng/thua | Chưa thực hiện một lượt người chơi hoàn chỉnh | Chưa kiểm chứng trực tiếp |

## File bằng chứng

- `phase-1-win-scenario.json` và `phase-1-win-inputs.json`: đầu vào scenario kiểm chứng.
- `phase-1-win.jsonl`: output JSONL nguyên bản từ CLI; kết thúc `won`, `all_lit` tại tick 9.
- `npm run verify`: kiểm chứng còn lại, chạy được bằng một lệnh.
