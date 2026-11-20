# Phase 4 · Bằng chứng và trạng thái

Ngày kiểm tra: 2026-11-20. Contract v1.3.

## Đã kiểm chứng

- `npm run build` — PASS: cú pháp các file server, mô phỏng, renderer, UI, leaderboard, verifier và scripts.
- `npm run verify` — PASS: contract 1.3, thời lượng/điểm bắt đầu đêm, sự kiện bắt đầu, snapshot, spawn và các hồi quy gameplay Phase 1–3 còn hiệu lực.
- `npm run soak -- --seed 7 --nights 10 --out docs/proof/soak.json` — PASS: 10 đêm trong cùng tiến trình, `crashes=0`, 34.6 giây; RSS đầu/cuối 36.9/43.5 MB, tỷ lệ 1.18 (ngưỡng ≤1.2). Cả 10 đêm thua; kết quả chứng minh ổn định bộ nhớ với input giả lập, không chứng minh khả năng thắng.
- `node server.mjs --export-leaderboard docs/proof/leaderboard-export.json` — PASS: tạo JSON theo schema `{"entries":[]}` từ bảng cục bộ hiện chưa có điểm.
- Đã đóng gói bản web tự chạy kèm mã nguồn và hướng dẫn tại [dao-den-long-v1.0.0-web.zip](../../dist/dao-den-long-v1.0.0-web.zip).
- Leaderboard có kiểm tra dữ liệu, xếp điểm giảm dần/đạt sớm trước, giới hạn top 10, lưu tệp cục bộ và hỗ trợ xuất qua `node server.mjs --export-leaderboard out.json`.
- Cài đặt trợ năng được lưu; có đổi phím và báo đụng phím, chế độ bảng màu, giảm chuyển động, chữ lớn, cùng chỉ báo Bóng Mực/gió/10 giây cuối/dầu thấp.

## Chưa đạt / chưa có artifact

- Benchmark browser chưa xuất được report. Chrome/Edge phần cứng trên máy này không khởi tạo ổn định; sau khi chuyển sang SwiftShader runner chưa nhận được tín hiệu scene-ready. Vì thế chưa có số FPS hợp lệ hoặc `bench.json`; không ghi số đo giả.
- Chưa có ảnh/GIF chụp từ game cho README và chưa có video demo `.mp4` dưới 5 phút.
- Chưa tạo tag GitHub `phase-4` hoặc Release `v1.0.0`; release chỉ được đánh dấu hoàn tất sau khi có artifact chạy được.
- Tag phase 1–3 cũng không có trong checkout trước khi bắt đầu; không tạo tag lịch sử trỏ sai commit.

Lệnh benchmark để chạy trên máy có Chrome/WebGL hoạt động:

```sh
npm run bench -- --seed 42 --duration 30 --out docs/proof/bench.json
```

Soak evidence: [soak.json](soak.json).
