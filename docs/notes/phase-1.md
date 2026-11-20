# Phase 1 · Giả định và ghi chép

## Giả định gameplay

> Các giả định ở mục này ghi lại baseline Phase 1. Những điểm về thời lượng, sức chứa, dầu đèn, điểm và điều kiện thắng đã bị Ticket-03 / Phase 3 thay thế; xem [ADR-003](../decisions/ADR-003-fuel-and-dawn.md) và [ghi chú Phase 3](phase-3.md).

- Đêm 1 dài 300 giây; Mây có 3 ngọn lửa sức sống, mang tối đa 6 đom đóm. Mỗi đèn cần 5 đom đóm.
- `interact` là hành động nhấn cạnh (false → true), nạp tối đa lượng còn thiếu của đèn gần nhất trong bán kính 2,6 m. Có thể nạp nhiều lần.
- `pulse` tiêu 1 đom đóm đang mang, có hồi chiêu 0,8 giây; đẩy và làm choáng các Bóng Mực trong bán kính 8 m.
- Va chạm trong bán kính 1,3 m gây mất 1 lửa. Bất tử tạm thời 1,2 giây; rơi `floor(carried × 0,5)` đom đóm. Bóng Mực bị choáng không gây va chạm.
- Chỉ đèn đã thắp tạo vùng an toàn 4 m. Đảo có bán kính 42 m; `fall_enabled=false` nên Mây bị chặn ở mép đảo.
- Người chơi thắng khi cả 5 đèn sáng; thua khi hết lửa hoặc hết giờ. Nếu hết lửa trong cùng tick hoàn thành mục tiêu, thua được ưu tiên.
- Điểm: +10 mỗi đom đóm nhặt, +100 mỗi đèn thắp, +15 mỗi Bóng Mực mới bị choáng, +2 mỗi giây còn lại khi thắng, +25 mỗi lửa còn lại khi thắng.
- Nếu bị đánh, số đom đóm rơi làm tròn xuống; scenario đặt `lit:true` không phát event và không cộng điểm.
- Nếu thời gian hết trong cùng tick với việc thắp đèn cuối, thắng được ưu tiên hơn `dawn`; hết lửa vẫn ưu tiên thua.
- Mặc định có 42 đom đóm và 3 Bóng Mực trên đảo; vị trí được dựng bằng RNG có seed. Không sinh thêm Bóng Mực giữa đêm.

## Giả định contract

- Mỗi frame có hiệu lực từ tick ghi trong file; trường vắng mặt giữ giá trị trước. Frame quá `--ticks` không được áp dụng.
- Trong một tick: di chuyển/nhảy, nhặt, pulse, nạp đèn, Bóng Mực di chuyển, va chạm, cập nhật giờ và kiểm tra kết thúc.
- Event phát sinh trong bước k mang tick k+1; snapshot tick 0 là sau scenario, snapshot kế tiếp theo chu kỳ. Dòng cuối luôn là `end`; nếu game kết thúc sớm, `end.ticks` là số tick thực chạy.
- Scenario thay thế danh sách đom đóm/Bóng Mực nếu có trường tương ứng. Mặc định bỏ qua random nếu đặt `random_*: false`. Scenario không tự phát event hay cộng điểm.
- Tọa độ kiểm tra khoảng cách trên mặt phẳng XZ; Y của người chơi là độ cao chân khi nhảy, Y Bóng Mực là tâm.

## Tiêu chí nghiệm thu

- WebGL hiển thị màn chơi 3D và có thể hoàn thành hoặc thua, xem HUD và chơi lại.
- `game.contract.json` khớp `TUNING`; CLI chấp nhận contract args, chạy không cần GPU và xuất JSONL hợp lệ.
- Mote pickup, deposit/light, pulse/stun, hit và end có event đúng schema. Lỗi scenario/inputs trả mã 2 và báo lỗi qua stderr.
- Cùng seed/scenario/inputs cho output byte-identical.
- README chỉ cách cài/chạy trong tối đa 3 lệnh và nêu điều khiển, điểm, giả định, headless.

## Nhật ký AI và đánh giá sơ bộ

- Dùng Codex để đọc PRD-0, dựng mô phỏng thuần JS, CLI contract, giao diện WebGL và kiểm tra headless.
- Khi review logic, phát hiện cạnh nhấn action bị so sánh với chính trạng thái hiện tại nên không thể kích hoạt; đã đổi sang trạng thái nút của tick trước.
- Tối ưu token bằng cách dùng Node built-in, không cài dependency/engine, một nguồn tuning, và tách renderer khỏi mô phỏng.
- Ước tính token/chi phí: giao diện này không cung cấp usage theo phase; người nộp cần bổ sung con số thực tế từ dashboard trước khi gắn tag.
- Đánh giá cuối phase và bằng chứng chạy thật sẽ cập nhật sau khi chạy `npm run verify` và thử game trên trình duyệt.
