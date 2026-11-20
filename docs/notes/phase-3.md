# Phase 3 · Giả định và kế hoạch kiểm chứng

## Các quyết định triển khai

- Mô phỏng giữ nhiên liệu dưới dạng số nguyên `1/60` đơn vị: đèn có tối đa 6.000 phần; hao tự nhiên `-1` phần/tick, mỗi Bóng Mực ở `drain` hút `-5` phần/tick. Snapshot mới làm tròn đến 1 chữ số thập phân.
- Hết dầu đặt đèn thành tắt, `fuel = 0`, `deposited = 0`; `ever_lit` và `relit_count` vẫn được giữ.
- Đèn chưa từng sáng tốn 10 đom đóm; đèn từng sáng tốn 5 mỗi lần thắp lại. Châm dầu chỉ chọn đèn sáng chưa đầy và lấy đủ số đom đóm cần theo công thức `ceil((100-fuel)/10)` (giới hạn bởi số đang mang).
- Nạp hoàn tất một lần thắp tăng `successful_lights`; sức chứa sau đó là `min(20, 10 + 2 × successful_lights)`. Đèn scenario không tính vào bộ đếm.
- Khi bình minh, Đêm 1/2/3 yêu cầu lần lượt ít nhất 3/4/5 đèn sáng. Hết lửa được xét trước bình minh.
- Bóng Mực `wander` ưu tiên đèn yếu gần nhất; trạng thái `drain` giữ nguyên mục tiêu. Chỉ chuyển `chase` khi Mây vào 6 m; hút kết thúc khi đèn tắt, được châm tới 30, hoặc Bóng đi quá 2 m.
- Khi được châm lên ít nhất 30 fuel, Bóng Mực trong 6 m được đẩy ra rìa vùng an toàn và được miễn sát thương 30 tick.
- UI Phase 3 đã được tích hợp: chế độ màu dễ phân biệt và giảm chuyển động trong cài đặt; mức dầu hiển thị trên cột đèn; đèn yếu nhấp nháy; hình dạng đèn dùng lồng mở để vẫn nhìn thấy nguồn sáng. Những tính năng này ở `src/main.js`, `src/renderer.js`, `index.html`, `style.css`. Kiểm tra tự động hiện chỉ bao phủ mô phỏng; chưa lưu bằng chứng ảnh/video kiểm tra UI.

## Bằng chứng dự kiến

`npm run verify` kiểm tra tuning/contract, tính tất định, dầu và hết dầu, châm dầu, thắp lại, hút dầu và event theo 60 tick, không thắng sớm, thắng/thua bình minh, cùng các hồi quy Phase 2 còn hiệu lực. `npm run build` kiểm tra cú pháp dự án.

Scenario thắng Phase 1 `all_lit` không còn kiểm tra hợp lệ vì yêu cầu mới cấm thắng sớm; được thay bằng scenario `dawn-win` và `no-early-win` trong verifier. Output Phase 1 cũ vẫn lưu như bằng chứng lịch sử, không đại diện contract 1.2. Contract metadata nâng tiếp lên 1.3 ở Phase 4; luật gameplay này vẫn là tuning 1.2.
