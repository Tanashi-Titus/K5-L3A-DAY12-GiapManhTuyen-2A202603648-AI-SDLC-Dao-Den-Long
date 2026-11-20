# Retro tổng kết AI SDLC

## Đánh giá theo phase

- **Phase 1:** Tách mô phỏng khỏi WebGL, tạo CLI JSONL và dùng seed để có thể phát lại tình huống. Cách làm không phụ thuộc engine ngoài giúp chạy được cả trình duyệt lẫn headless.
- **Phase 2:** Bổ sung di chuyển theo camera, dash, pause, gió, Drifter và bùa gió. Phản hồi chơi thử phát hiện hướng trái/phải bị ngược và Bóng Mực đứng yên khi chưa thấy Mây; các scenario tuần tra ngoài vùng phát hiện được thêm vào verifier.
- **Phase 3:** Ticket thay điều kiện thắng sớm bằng sống đến bình minh, thêm nhiên liệu và khả năng hút dầu. Changelog/ADR và test ngưỡng bình minh giúp phân biệt luật mới với các output lịch sử Phase 1.
- **Phase 4:** Thêm leaderboard, công cụ benchmark/soak và cài đặt trợ năng. `build`, verifier và soak đã có bằng chứng trong `docs/proof`; benchmark trình duyệt, ảnh/GIF, video, tag và Release cần hoàn tất theo trạng thái ở checklist nộp bài.

## Dùng AI: điều hiệu quả và lỗi phát hiện được

Tách mô phỏng, renderer và CLI từ đầu giúp thay đổi đồ họa không làm thay đổi output headless. Một verifier chạy qua các scenario có seed cũng bắt được thay đổi sai giữa contract và tuning. Hướng dẫn agent, `game.contract.json`, changelog và skill shader là các phần harness hữu ích nhất trong repo.

Các lỗi/thiếu sót được phát hiện trong quá trình review:

- Một số lần chơi thử cho thấy ánh xạ trái/phải bị đảo; cần kiểm tra lại input dưới nhiều góc camera, không chỉ vector headless.
- Sau khi Phase 3 đổi thời lượng, README còn ghi contract 1.1 và đồng hồ màn hình khởi động còn hiện `05:00`; audit đã đồng bộ tài liệu và hiển thị với luật hiện hành.
- Khi tích hợp Phase 4, metadata `game.contract.json` lên 1.3 trước `src/sim.js` và benchmark report; verifier hiện kiểm tra phiên bản giữa contract và mô phỏng.
- Benchmark ban đầu không kết nối được Chrome DevTools; chuyển sang thử SwiftShader fallback và phải ghi rõ renderer, không xem FPS giả lập là số đo GPU.

Nếu làm lại, mình sẽ thêm kiểm tra cho mọi câu trả lời luật đã chốt ngay khi nhận ticket, giữ một bảng trạng thái duy nhất cho contract/version/tuning, và chạy benchmark browser sớm hơn để còn thời gian xử lý driver. Phần hình ảnh sẽ được review bằng screenshot ở từng milestone thay vì chỉ dựa vào mô tả.

## Token và chi phí

| Phase | Token/chi phí thực tế |
|---|---|
| 1 | Chưa lấy được số từ dashboard |
| 2 | Chưa lấy được số từ dashboard |
| 3 | Chưa lấy được số từ dashboard |
| 4 | Chưa lấy được số từ dashboard |
| **Tổng** | **Cần điền từ dashboard trước khi nộp** |

Workspace không cung cấp telemetry token/chi phí theo phase. Không tự ước lượng để tránh ghi sai. Cách tiết kiệm đang dùng: mô phỏng Node built-in, không cài engine/dependency nặng, một bộ tuning, verifier chạy nhiều scenario cùng lệnh và giới hạn benchmark theo cấu hình ticket.
