# ADR-003: Dầu đèn và chiến thắng lúc bình minh

- Trạng thái: Chấp nhận cho Phase 3
- Ngày: 2026-11-20
- Bối cảnh: Ticket-03 thay mục tiêu “thắp hết đèn” bằng giữ đủ đèn sáng đến bình minh; đèn cần hao dầu và có thể bị Bóng Mực hút dầu.

## Quyết định

Đèn có state nhiên liệu riêng, lưu nội bộ bằng số nguyên theo đơn vị `1/60` để phép trừ mỗi tick không tích lũy sai số. `lit` phản ánh nhiên liệu còn lại; `ever_lit` và `relit_count` lưu lịch sử để áp dụng chi phí thắp lại. Event `lantern_out` phát khi nhiên liệu cạn.

Bóng Mực `wander` chọn đèn yếu làm mục tiêu và vào `drain` trong phạm vi 2 m. Hút dầu được áp dụng cùng bước cập nhật nhiên liệu với hao tự nhiên, có cộng dồn theo số Bóng Mực. Châm tới ngưỡng 30 khôi phục vùng an toàn và đẩy Bóng ra rìa.

Game chỉ kết thúc khi hết lửa hoặc hết giờ. Tại tick bình minh, hết lửa luôn thua trước; nếu còn sống thì số đèn đang sáng phải đạt `ceil(0.6 × tổng đèn)`. Điểm thưởng thời gian bị bỏ; điểm bình minh dựa trên đèn còn sáng, dầu còn lại và lửa còn lại.

## Hệ quả

- Contract đổi từ 1.1 sang 1.2; snapshot, scenario và events mở rộng.
- `all_lit` không còn là lý do kết thúc. Test thắng sớm Phase 1 được thay bằng kiểm tra không thắng sớm và kết quả bình minh.
- Các luật Phase 2 không được Ticket-03 thay thế tiếp tục giữ nguyên.
- Thay đổi giao diện/mù màu được ghi ở ghi chú Phase 3 và phối hợp riêng với phần đồ họa.
