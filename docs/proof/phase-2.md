# Phase 2 · Bằng chứng và giới hạn

## Kiểm chứng có thể chạy lại

Chạy `npm run verify`. Các scenario hiện có kiểm tra di chuyển/tick cố định, dash, pause/resume, Bóng Mực tuần tra ngoài vùng phát hiện, stun, Drifter, bùa gió và gió Đêm 3. Phase 3 verifier tiếp tục chạy các hồi quy này cùng contract mới.

## Truy vết

| Yêu cầu | Bằng chứng hiện có | Kết quả |
|---|---|---|
| Mô phỏng headless tất định, đầu ra JSONL | `determinism-a/b`, JSONL end trong `scripts/verify-headless.mjs` | Đạt |
| Di chuyển, dash, pause/resume | `movement`, `dash`, `paused` scenarios | Đạt |
| Bóng Mực lang thang, choáng, gây sát thương | `shade-wander`, `stun-duration`, `hit` scenarios | Đạt |
| Drifter và bùa gió | `drifter`, `charm` scenarios | Đạt |
| Gió Đêm 3 | `wind` scenario | Đạt |
| Điều khiển trái/phải theo góc camera trong trình duyệt | Công thức có trong `src/sim.js` và `src/main.js`; verifier hiện chỉ kiểm tra vector headless | Chưa có bằng chứng tương tác UI lưu lại |
| Mở trình duyệt và hoàn thành một đêm | Không có video/ảnh Phase 2 trong checkout | Chưa có bằng chứng lưu |

Phase 2 tuning lịch sử được giữ trong [đặc tả](../spec/phase-2.md); những luật bị Phase 3 thay được ghi rõ trong [changelog](../../CHANGELOG.md).
