# Kế hoạch Web Học Từ Vựng Destination B1 (v2)

Ứng dụng web học từ vựng dựa trên tài liệu *678270937-B1-Destination-Vocabulary.pdf*, dùng tốt trên **điện thoại, máy tính bảng và máy tính**.

> **Thay đổi so với v1:** sửa lại tổng số từ; id của từ không còn phụ thuộc số thứ tự; định nghĩa rõ trạng thái học; thêm luật chấm điểm cho chế độ gõ từ; có điều hướng bằng hash (nút Back trên điện thoại hoạt động); phát âm có dự phòng giọng; đáp án nhiễu cùng nhóm; Ghép thẻ và Gõ từ tách thành 2 chế độ riêng; có script kiểm tra dữ liệu.

---

## 1. Dữ liệu

### 1.1 Thống kê (sau khi chuẩn hóa)

PDF có 14 unit, **không có nhãn section** (Topic Vocab, Phrasal Verbs…): mỗi unit là một bảng đánh số liên tục. Thứ tự trong bảng thường là: từ vựng chủ đề → phrasal verbs → cụm giới từ → word patterns → từ bổ sung.

| Unit | Chủ đề | Số mục | Ghi chú chuẩn hóa |
| :--- | :--- | :---: | :--- |
| 03 | Fun and Games | 55 | PDF ghi "Fun and Game" |
| 06 | Learning and Doing | 56 | PDF đánh trùng số 54 |
| 09 | Coming and Going | 51 | PDF ghi nhầm tiêu đề "Friends and Relations" |
| 12 | Friends and Relations | 51 | Bỏ 1 mục trùng (`confident`) |
| 15 | Buying and Selling | 60 | |
| 18 | Inventions and Discoveries | 60 | |
| 21 | Sending and Receiving | 54 | |
| 24 | People and Daily Life | 65 | Bỏ 1 mục trùng (`prison`); tách 2 dòng PDF bị gộp: `angry (with sb) about` + `guilty of`, `accuse sb of` + `blame sb for` |
| 27 | Working and Earning | 61 | Bỏ 3 mục trùng (`boss`, `fame`, `retire` dịch sai) |
| 30 | Body and Lifestyle | 63 | |
| 33 | Creating and Building | 66 | `do off` → `do up`, `stripped` → `striped` |
| 36 | Nature and the Universe | 66 | |
| 39 | Laughing and Crying | 65 | Bỏ 1 mục trùng (`emotion`); PDF đánh trùng số 2 |
| 42 | Problems and Solutions | 65 | Bỏ 1 mục trùng (`refuse` dịch sai thành "tái sử dụng") |
| | **Tổng** | **838** | Bảng của plan v1 cộng lại ra 840, không phải ~815 |

### 1.2 Quy tắc chuẩn hóa

- **Sửa lỗi trích xuất:** IPA bị vỡ hoặc thiếu dấu `/`, chữ dính nhau (`giảitrí`), nghĩa bị tách sai cột (Unit 09: `go away`, `set off`, `take off`…), `gt on(to)` → `get on(to)`, `tobe` → `be`, `smth` → `sth`.
- **Bổ sung nghĩa bị thiếu:** `out of order` (hỏng, không hoạt động), `go off` (ôi thiu/ reo chuông), `run away from` (bỏ chạy khỏi).
- **Sửa nghĩa sai hoặc lệch ngữ cảnh:** `retire`, `refuse`, `share out`, `sensible`, `platform` (sân ga), `delay`, `shower` (mưa rào), `the number of` (+ động từ số ít)… Tổng cộng khoảng 280 mục đã được sửa, bỏ hoặc gộp.
- **Từ đồng nghĩa và cấu trúc** (`= focus on`, `+ V-ing`, `+ N số nhiều`) được chuyển sang trường `note` riêng, không trộn vào từ hay nghĩa.
- **Nhóm (`category`) được gán tường minh** cho từng mục, không đoán bằng regex lúc chạy:
  - `word`: từ đơn, danh từ ghép (`board game`)
  - `phrasal-verb`: động từ + tiểu từ (`give up`, `get on(to)`)
  - `phrase`: cụm giới từ, word pattern, collocation (`be keen on`, `in cash`, `make progress`)

### 1.3 Định danh ổn định

- `id = <unit>-<slug của từ>`, ví dụ `u18-out-of-order`. Nếu trong cùng unit có hai mục trùng chữ thì thêm từ loại vào cuối: `u09-crash-v`, `u09-crash-n`.
- Sửa nghĩa hoặc IPA thì **không đổi id**, nên tiến độ đã lưu không bị lệch.
- `npm run check:data` kiểm tra: id không trùng, mục nào cũng có nghĩa, từ đơn có IPA, IPA có dạng `/…/`, mỗi unit có đủ 3 nhóm.

---

## 2. Kiến trúc

- **React 18 + TypeScript + Vite**, **Tailwind CSS**, **lucide-react**, **canvas-confetti**. Không dùng thư viện router: điều hướng bằng hash.
- **Điều hướng (hash routing):**
  - `#/`: trang chủ
  - `#/units`: danh sách unit
  - `#/unit/u18/<mode>`: học một unit
  - `#/review/<mode>`: ôn từ khó
  - `#/settings`: cài đặt

  Với `mode ∈ list | flashcards | quiz | match | spell`. Nút Back trên điện thoại và trình duyệt hoạt động bình thường, và có thể gửi link sang thẳng một chế độ học.
- **Phát âm (Web Speech API):**
  - Chọn giọng theo thứ tự: đúng giọng người dùng chọn (en-GB/en-US) → giọng tiếng Anh khác → giọng mặc định.
  - Cài đặt hiển thị giọng đang dùng, và cảnh báo nếu máy không có giọng tiếng Anh.
  - Chỉ phát âm khi người dùng thao tác (yêu cầu của iOS). Lưu ý: một số giọng, ví dụ Google trên Chrome desktop, vẫn cần mạng.
  - Khi đọc: `sb` → "somebody", `sth` → "something", `a/ b` → "a or b".
- **Lưu trữ (`localStorage`, key `b1vocab:v1`):** mọi thao tác đọc ghi đều bọc `try/catch`. Nếu bộ nhớ bị chặn, app vẫn chạy được nhưng không lưu.

### 2.1 Mô hình tiến độ

```ts
WordProgress = { status?: 'learning' | 'mastered'; starred?: boolean; wrong?: number; right?: number }
ScopeScore   = { bestQuiz?: number /* % */; bestMatchMs?: number; bestSpell?: number /* % */; lastStudied?: string }
```

- **Trạng thái:** *Chưa học* (không có `status`) → *Đang học* (bấm "Cần ôn lại") → *Đã thuộc*.
- **Gắn sao:** cờ riêng, do học sinh tự bấm.
- **Từ khó** (dùng cho trang Ôn tập) = gắn sao **hoặc** Đang học **hoặc** (từng làm sai và chưa Đã thuộc). Khi đánh dấu Đã thuộc, số lần sai được đặt lại về 0.
- **Tiến độ unit (%)** = số từ Đã thuộc / tổng số từ của unit.
- **Sao lưu:** xuất/nhập tiến độ ra file JSON, dùng khi đổi máy hoặc đổi trình duyệt.

---

## 3. Chế độ học (5 tab, dùng chung cho Unit và Ôn tập)

1. **Danh sách:** STT, từ, từ loại, IPA, nghĩa, ghi chú.
   - Nút 🔊, ⭐ và ✓ (Đã thuộc) trên mỗi dòng.
   - Tìm kiếm trong unit.
   - Lọc theo nhóm (Tất cả/ Từ đơn/ Phrasal verb/ Cụm từ) và theo trạng thái (Chưa học/ Đang học/ Đã thuộc/ Gắn sao).
   - Che cột nghĩa hoặc cột từ để tự kiểm tra; chạm vào ô bị che để hiện.
   - Màn ≥ 768px hiển thị dạng bảng, màn nhỏ hơn hiển thị dạng thẻ.
2. **Flashcards 3D:**
   - Mặt trước: từ, từ loại, IPA, 🔊. Mặt sau: nghĩa và ghi chú.
   - Chạm hoặc `Space` để lật; `←/→` để chuyển thẻ; `S` để phát âm; `1` = Cần ôn lại; `2` = Đã thuộc.
   - Vuốt phải = Đã thuộc, vuốt trái = Cần ôn lại.
   - Có nút Trộn thẻ và tùy chọn "Chỉ thẻ chưa thuộc".
3. **Trắc nghiệm:**
   - Chọn 15/ 30/ toàn bộ câu; chiều Anh → Việt hoặc Việt → Anh.
   - Đáp án nhiễu ưu tiên cùng nhóm, không trùng nghĩa với đáp án đúng.
   - Phản hồi ngay, tự phát âm (tắt được trong cài đặt), tổng kết điểm, nút "Làm lại câu sai".
   - Lưu điểm cao nhất; ghi nhận đúng/sai vào tiến độ từng từ.
4. **Ghép thẻ:** lưới 12 thẻ (6 từ + 6 nghĩa, không trùng nghĩa), có đồng hồ, lưu thời gian tốt nhất.
5. **Gõ từ:**
   - Đề bài: nghĩa, IPA và từ loại; có thể nghe phát âm và xin gợi ý từng chữ cái.
   - **Luật chấm:**
     - Không phân biệt hoa thường; bỏ qua dấu câu và khoảng trắng thừa.
     - `sb`/`sth` có thể gõ hoặc bỏ, và chấp nhận cả `somebody`/`something`.
     - Phần trong ngoặc là tùy chọn: `go back (to)` chấp nhận `go back` hoặc `go back to`.
     - Dấu `/` là các lựa chọn thay thế: `cheat at/ in` chấp nhận `cheat at` hoặc `cheat in`.

---

## 4. Giao diện đa thiết bị

- **Mobile (< 768px):**
  - Header gọn có nút quay lại; thanh điều hướng dưới (Trang chủ / Units / Ôn tập / Cài đặt).
  - Tab chế độ cuộn ngang.
  - Flashcard và Quiz cao theo `100dvh`, để không bị thanh địa chỉ của Safari che.
  - Thẻ flashcard dùng `touch-action: pan-y`, nên vuốt ngang không tranh chấp với cuộn dọc.
- **Tablet/Desktop (≥ 768px):** sidebar gồm 14 unit kèm thanh tiến độ, Ôn tập và Cài đặt; vùng học rộng; có đầy đủ phím tắt.
- Nút bấm tối thiểu 44px; vẫn dùng được khi bật `prefers-reduced-motion` (confetti tự tắt).

---

## 5. Lộ trình

1. ✅ Khởi tạo project (Vite, React, TypeScript, Tailwind).
2. ✅ Số hóa và chuẩn hóa dữ liệu: `src/data/units.ts` (838 mục) và script `npm run check:data`.
3. ✅ Phần core:
   - Lưu tiến độ, phát âm, điều hướng bằng hash.
   - Layout responsive.
   - Trang chủ, gồm thống kê, tìm kiếm toàn cục và lối vào Ôn tập.
   - Trang Cài đặt: giọng đọc, tốc độ, tự phát âm, xuất/nhập/xóa tiến độ.
4. ✅ 5 chế độ học: Danh sách, Flashcards, Trắc nghiệm, Ghép thẻ, Gõ từ.
5. ✅ Kiểm thử:
   - `npm run check:data`, `npm run build` (type-check).
   - Chạy `npm run dev` và thử ở các bề rộng 375 / 768 / 1280px.

## 6. Ngoài phạm vi (quyết định sau)

- **Triển khai online** (Vercel/GitHub Pages) và PWA để học offline. Lưu ý: nội dung lấy từ sách thương mại, nên chỉ chia sẻ nội bộ lớp.
- **Nhiều học sinh dùng chung một máy:** hiện có một hồ sơ cho mỗi trình duyệt; dùng chức năng xuất/nhập để chuyển tiến độ.
- **Lặp lại ngắt quãng (SRS)** theo lịch ôn.

## 7. Thiết kế giao diện (áp dụng skill `design-taste-frontend`)

Skill này viết cho website giới thiệu công ty, nên chỉ lấy những phần hợp với một app học:

- **Bảng màu do skill tự chọn** (`start.mjs deal`), lấy phương án đầu tiên: *cool-white-slate*.
  - Nền `#f7f9fa`, chữ `#1f3038`, một màu nhấn teal `#0d7480` dùng cho nút chính, tiến độ và viền focus.
  - Giao diện giữ 90–95% trung tính. Không dùng tím, không gradient, không mỗi unit một màu.
- **Font:** Be Vietnam Pro (tiêu đề + chữ thường, đủ dấu tiếng Việt) + Noto Sans Mono (phiên âm IPA, đủ ký tự IPA).
  - Skill gợi ý cặp này cho app tiêu dùng và vui tươi, hợp với học sinh lớp 8 hơn cặp đầu tiên (Host Grotesk, vốn dành cho phần mềm nghiêm túc).
  - Bo góc kiểu `round`.
- **Điểm nhấn bằng chữ:** số unit đặt rất to, như trang mục lục của sách, thay cho icon trong ô màu.
- **Flashcard như thẻ ghi chú giấy:** mặt trước có một vạch màu trên đỉnh, đổi màu theo trạng thái; mặt sau có dòng kẻ mờ.
- **Chuyển động** theo `references/motion.md`:
  - Nút nhích lên 1px khi rê chuột, lún 1px và thu nhỏ còn 0.985 khi bấm.
  - Thẻ có link nâng lên 2px.
  - Tiêu đề trang chủ trượt vào một lần khi tải trang.
  - Không nảy, không vượt đà; tắt hết khi máy bật `prefers-reduced-motion`.
- **Chữ** theo `references/copy-tells.md`: bỏ emoji và dấu chấm than, bỏ dải bốn con số, bỏ chữ in hoa giãn cách. Câu ngắn, nói thẳng việc cần làm; chữ nhỏ nhất 13px, chữ phụ đạt độ tương phản ≥ 4.5:1.
- **Mỗi màn hình chỉ có một nút tô màu** cho hành động chính. Ví dụ ở Flashcard, "Đã thuộc" là nút chính, còn "Cần ôn lại" là nút viền.
- **Không áp dụng** vì dành cho landing page: mỗi section một màn hình, ảnh chụp, hero, footer, form, và bộ kiểm tra `gate.mjs`.

## 8. Backend: đồng bộ tiến độ giữa các máy (Netlify, miễn phí)

**Kiến trúc:** Netlify Functions (một function `/api/*`) cùng Netlify Blobs (kho key–value có sẵn của Netlify). Cả hai đều nằm trong gói Free; không có database hay dịch vụ ngoài. Frontend và API deploy chung một site, chung domain.

| File | Vai trò |
| :--- | :--- |
| `server/core.ts` | Toàn bộ logic: đăng ký, đăng nhập, token, đọc/ghi tiến độ. Không phụ thuộc Netlify |
| `netlify/functions/api.mts` | Nối `core.ts` với Netlify Blobs (store `users`, `progress`, consistency `strong`) |
| `src/lib/state.ts` | Làm sạch dữ liệu và luật gộp tiến độ, dùng chung cho trình duyệt và server |
| `src/lib/progress.tsx`, `src/lib/api.ts` | Lưu trên máy trước, rồi tự đồng bộ |
| `vite.config.ts` | `npm run dev` chạy luôn API thật, dữ liệu nằm trong `.dev-data/api.json` |

**Tài khoản:** tên đăng nhập (3–24 ký tự) và mật khẩu (≥ 6 ký tự), **không cần email**.
- Mật khẩu được băm bằng `scrypt` với salt riêng cho từng tài khoản.
- Đăng nhập xong, máy nhận token có ký HMAC-SHA256 (khóa `SESSION_SECRET`), hạn 180 ngày.
- Sai mật khẩu 8 lần thì tài khoản bị khóa 10 phút.

**API:**
- `POST /api/auth/register`, `POST /api/auth/login`: trả về `{ username, token }`.
- `GET /api/progress`, `PUT /api/progress` (header `Authorization: Bearer <token>`): `PUT` gộp dữ liệu gửi lên với bản trên server rồi trả về bản đã gộp.

**Luật gộp** (không mất dữ liệu khi học trên nhiều máy, kể cả lúc offline):
- Mỗi từ có dấu thời gian `t`; bản sửa sau cùng thắng. Khi bỏ đánh dấu, mục đó vẫn được giữ lại kèm `t` để thay đổi cũng truyền sang máy khác.
- Điểm cao: lấy giá trị tốt nhất (quiz và gõ từ lấy cao nhất, ghép thẻ lấy nhanh nhất).
- "Xóa tiến độ" ghi lại thời điểm `resetAt`; dữ liệu cũ hơn mốc này bị bỏ ở mọi máy.
- Khi ghi, server so `etag` (ghi có điều kiện của Blobs) và thử lại nếu có máy khác vừa ghi xen vào.

**Khi nào đồng bộ:**
- App luôn lưu vào `localStorage` trước.
- Đẩy lên server 1,5 giây sau lần sửa cuối, và khi rời tab.
- Kéo về khi mở app, khi quay lại tab, khi có mạng trở lại, hoặc khi bấm "Đồng bộ ngay".
- Đăng nhập lần đầu: tiến độ đã học trên máy (chưa đăng nhập) được gộp vào tài khoản.
- Đăng xuất: đẩy nốt dữ liệu rồi xóa trắng máy, để máy dùng chung ở trường không lộ tiến độ.

**Deploy lên Netlify:**
1. Đưa code lên GitHub/GitLab, rồi trên Netlify chọn *Add new site → Import an existing project*. Build command và thư mục publish đã có sẵn trong `netlify.toml`.
2. Vào *Site configuration → Environment variables*, thêm `SESSION_SECRET` là một chuỗi ngẫu nhiên ≥ 32 ký tự (tạo bằng `openssl rand -base64 48`).
   - Không đổi khóa này sau khi đã có người dùng: đổi thì mọi người bị đăng xuất.
   - Thiếu khóa này thì API trả lỗi 500 "chưa cấu hình SESSION_SECRET".
3. Deploy. Kiểm tra bằng cách mở `https://<site>.netlify.app/api/health`, kết quả phải là `{"ok":true}`.

**Kiểm thử:**
- `npm run test:server`: 13 test cho đăng ký/đăng nhập, khóa tài khoản, token giả mạo/hết hạn, gộp hai máy, xóa tiến độ, dữ liệu rác, ghi đồng thời.
- `npm run typecheck:server`: kiểm tra kiểu cho phần server.

**Giới hạn hiện tại:**
- Chưa có chức năng lấy lại mật khẩu (vì không có email), đổi mật khẩu, hay xóa tài khoản.
- Muốn đặt lại mật khẩu thì phải xóa key `user/<tên>` trong Netlify Blobs (giao diện Netlify → Blobs), rồi học sinh tạo lại tài khoản cùng tên. Tiến độ vẫn còn vì nằm ở key `progress/<tên>`.
