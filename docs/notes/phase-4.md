# Phase 4 · Ghi chú triển khai và giả định

## Những gì đang có trong checkout

- Contract metadata được nâng lên `1.3`; các giá trị gameplay của Phase 3 vẫn giữ nguyên.
- Bảng xếp hạng top 10 chạy cục bộ qua `server.mjs`, kiểm tra tên/điểm/timestamp/seed và sắp theo điểm, sau đó ưu tiên lượt đạt điểm sớm hơn.
- `npm run bench` đo renderer trong trình duyệt ở 1280×720 sau 3 giây làm nóng, lưu JSON và ảnh chụp.
- `npm run soak` chạy các đêm mô phỏng liên tiếp, đổi đêm 1→2→3 và ghi kết quả/thời gian/bộ nhớ.
- UI có remap đủ hành động, lưu cài đặt, báo Bóng Mực/gió/10 giây cuối/dầu thấp, tùy chọn giảm chuyển động và chữ lớn. Ở viewport desktop (`min-width: 901px`), stylesheet đặt cỡ chữ nội dung UI tối thiểu 18 px.

## Tiêu chí Ticket-04 cần chốt

- Benchmark chuẩn: cửa sổ 1280×720, seed 42, 200 Bóng Mực, 100 đom đóm, 3 đèn, Mây đứng yên, camera bay vòng 15 giây/vòng; khởi động 3 giây rồi đo 30 giây. Ngưỡng máy chấm: `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000`. Báo cáo phải nói rõ renderer và hệ điều hành.
- Soak chuẩn: 10 đêm trong cùng tiến trình, seed từ 7; đạt khi `crashes = 0` và RSS cuối không quá 1,2 lần RSS đầu.
- Leaderboard: top 10 lưu cục bộ, thời điểm đạt sớm thắng khi bằng điểm, cho nhập tên sau thua hoặc sau thắng Đêm 3; có API export.
- README cần ảnh/GIF, yêu cầu hệ thống, cài/chạy, test, headless, bench, soak; changelog đủ 4 phase; Release có bản chạy; retro 1–2 trang và video `.mp4` dưới 5 phút.

Soak là mô phỏng gameplay bằng seed và điều khiển giả lập; kết quả `lost` vẫn hữu ích cho crash/memory, không chứng minh khả năng thắng. Benchmark trên máy phát triển hiện chưa hoàn tất vì SwiftShader không báo scene-ready; không có số đo để thay cho máy chấm.

Token/chi phí theo phase không được Codex cung cấp trong workspace; cần người nộp điền con số từ dashboard. Không ước đoán thay.
