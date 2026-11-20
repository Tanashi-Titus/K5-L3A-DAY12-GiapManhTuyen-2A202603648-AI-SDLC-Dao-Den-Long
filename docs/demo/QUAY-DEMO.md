# Kịch bản quay demo

Video demo đã được lưu ở `docs/demo/demo.mp4` (MP4 H.264/AAC, 4 phút 13 giây); ảnh gameplay ở `docs/demo/gameplay.jpg`. Kịch bản dưới đây ghi lại các phần video đang thể hiện và checklist trước khi phát hành.

## Trình tự gợi ý

1. **Giới thiệu (15–20 giây):** nêu tên game, mục tiêu gom đom đóm và giữ đèn sáng tới bình minh.
2. **Chơi trực tiếp (1–2 phút):** bắt đầu Đêm 1; cho thấy điều khiển, gom đom đóm, thắp/nạp đèn và HUD. Có thể quay một cảnh Bóng Mực hoặc dùng sóng Q.
3. **Kiểm chứng (20–30 giây):** chạy `npm run verify` trong terminal và để kết quả hoàn tất hiện rõ. Không sửa nội dung đầu ra.
4. **Hiệu năng (nếu đã có số đo hợp lệ):** mở `docs/proof/bench.json`, cho thấy FPS, renderer và hệ điều hành. Nếu benchmark chưa chạy được, nói rõ đang thiếu report; không suy đoán FPS.
5. **Hồ sơ dự án (20–30 giây):** lướt qua `AGENTS.md`, skill trong `docs/skills/`, `CHANGELOG.md`, các proof Phase 1–4 và lịch sử/tag Git.

## Trước khi nộp

- Giữ video dưới 5 phút, định dạng MP4, mở được khi chưa đăng nhập.
- Chụp ảnh từ đúng bản game trong repo; không ghép ảnh từ phiên bản khác.
- Đưa video lên GitHub Release `v1.0.0` hoặc commit vào `docs/demo/demo.mp4`.
- Đặt link video ở đầu README; nhúng ảnh bằng `![Ảnh gameplay](docs/demo/gameplay.jpg)`.
- Nếu có thiếu sót như benchmark chưa có, nêu đúng trạng thái trong video và `docs/proof/phase-4.md`.
