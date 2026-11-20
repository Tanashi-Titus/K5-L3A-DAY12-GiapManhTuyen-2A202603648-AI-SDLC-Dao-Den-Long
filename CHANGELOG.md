# Changelog

## Phase 1 · Contract 1.0

- Tạo game WebGL 3D Đêm 1, mô phỏng tách biệt khỏi renderer và CLI headless xuất JSONL có seed.
- Thêm điều khiển, HUD, đom đóm, đèn lồng và Bóng Mực; ghi giả định ban đầu trong `docs/notes/phase-1.md`.

## Phase 2 · Contract 1.1

- Mở rộng ba đêm với di chuyển theo camera, nhảy/lướt, tạm dừng, gió, Drifter, bùa gió và các đảo nhiều tầng.
- Bổ sung trạng thái, sự kiện, scenario và hồi quy headless theo [đặc tả Phase 2](docs/spec/phase-2.md).
- Các luật về nhiên liệu, điểm và thời lượng sau đó được thay rõ trong Phase 3 / contract 1.2.

## Phase 3 · Contract 1.2

### Breaking changes

- Contract `1.1` → `1.2`; đêm dài 240 / 270 / 300 giây.
- Đèn đang sáng hao 1 fuel/giây, có thể tắt; thêm `fuel`, `ever_lit`, `relit_count`, event `refuel`, `lantern_out`, `fuel_drain`, và cờ `relight` trên `lantern_lit`.
- Thắp lần đầu tốn 10 đom đóm, thắp lại tốn 5; châm dầu dùng 1 đom đóm cho 10 fuel. Sức chứa tăng thêm 2 sau mỗi lần thắp thành công, tối đa 20.
- Bóng Mực có trạng thái `drain` và có thể hút đèn yếu; đèn dưới 30 fuel không còn vùng an toàn.
- Thắng sớm `all_lit` bị bỏ. Kết quả chỉ xét bình minh: cần ít nhất 60% đèn sáng và còn sống; reason thắng là `dawn_survived`.
- Công thức điểm Phase 2 bị thay bằng điểm nạp/thắp/thắp lại, stun thường/drain và thưởng bình minh. Thưởng thời gian bị bỏ.
- Snapshot thêm `player.capacity`, `lantern.fuel`, `ever_lit`, `relit_count` và mục tiêu đèn của Bóng Mực.

### Ghi chú tương thích

- Di chuyển, nhảy, dash, pause, gió, Drifter, bùa gió, va chạm và hành vi Bóng Mực ngoài các thay đổi nêu trên tiếp tục theo Phase 2.
- Bằng chứng `phase-1-win.jsonl` là output của contract trước thay đổi, không phải kỳ vọng Phase 3; thay bằng scenario thắng bình minh trong `scripts/verify-headless.mjs`.

## Phase 4 · Contract 1.3

### Breaking changes

- Contract version changes from `1.2` to `1.3`; readers should recognize the new `bench_cmd` and `soak_cmd` metadata. Gameplay tuning and deterministic headless output remain compatible with Phase 3.
- Package release version changes to `1.0.0`.

- Contract metadata nâng lên `1.3`; tuning gameplay Phase 3 và thời lượng 240 / 270 / 300 giây giữ nguyên.
- Thêm bảng xếp hạng top 10 cục bộ, kiểm tra dữ liệu đầu vào và sắp xếp điểm bằng thời điểm đạt.
- Thêm lệnh benchmark trình duyệt và soak nhiều đêm vào contract/package scripts.
- Mở rộng verifier để kiểm tra version contract, thời lượng/điểm bắt đầu đêm, `night_start` tick 1, snapshot bất tử dạng boolean và spawning của Bóng Mực.
- Các yêu cầu phát hành, kết quả đo và giới hạn bằng chứng được ghi trong [Phase 4 notes](docs/notes/phase-4.md) và [Phase 4 proof](docs/proof/phase-4.md).
