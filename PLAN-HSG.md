# Kế hoạch nâng cấp: App ôn thi HSG tiếng Anh lớp 8

Nâng cấp app từ vựng Destination B1 (xem [PLAN.md](PLAN.md)) thành app ôn thi học sinh giỏi tiếng Anh **lớp 8**, dành cho **một học sinh**. Nội dung chính là **bộ đề có sẵn được import vào app**. App **không dùng AI chấm bài**: bài viết tự do do học sinh tự đối chiếu với đáp án mẫu.

---

## 1. Phạm vi

**Giữ nguyên:**
- 838 từ vựng B1 và 5 chế độ học; B1 vừa với trình độ HSG lớp 8.
- Tài khoản và đồng bộ Netlify, dùng khi học trên nhiều máy.
- Giao diện, router và cách lưu tiến độ.

**Thêm mới:**
1. Import bộ đề (Word/PDF) thành dữ liệu có cấu trúc.
2. Làm đề thi thử nguyên bộ, có tính giờ và chấm điểm.
3. Luyện theo dạng bài, dùng các câu tách ra từ những đề đã import.
4. Sổ lỗi sai, ôn lại theo lặp lại ngắt quãng (SRS).
5. Thống kê điểm mạnh và yếu theo dạng bài.

**Không làm:**
- AI chấm bài, trang giáo viên, nhiều học sinh.
- Phần nghe. Chỉ làm khi trong bộ đề có file âm thanh.

---

## 2. Dạng bài thường gặp trong đề HSG lớp 8

| Mã `type` | Dạng bài | Chấm |
|---|---|---|
| `pronunciation` | Chọn từ có phần gạch chân phát âm khác | Tự động |
| `stress` | Chọn từ có trọng âm khác | Tự động |
| `mcq` | Trắc nghiệm từ vựng, ngữ pháp, giới từ, phrasal verb | Tự động |
| `error-id` | Tìm lỗi sai (A/B/C/D), có thể kèm sửa lỗi | Tự động |
| `word-form` | Cho dạng đúng của từ trong ngoặc | Tự động, chấp nhận nhiều đáp án |
| `verb-form` | Chia động từ trong ngoặc | Tự động, chấp nhận nhiều đáp án |
| `preposition` | Điền giới từ hoặc tiểu từ | Tự động |
| `cloze-mcq` | Đọc đoạn văn, chọn từ điền vào chỗ trống | Tự động |
| `cloze-open` | Đọc đoạn văn, tự điền một từ | Tự động, chấp nhận nhiều đáp án |
| `reading` | Đọc hiểu: trắc nghiệm, True/False hoặc trả lời câu hỏi | Tự động; câu trả lời tự do thì tự đối chiếu |
| `transform` | Viết lại câu không đổi nghĩa, có thể có từ gợi ý | Tự động so với các đáp án mẫu |
| `writing` | Viết đoạn văn hoặc bài luận | Không chấm; hiện bài mẫu (nếu có) để tự đối chiếu |

Khi import, dạng nào không khớp bảng này được gắn `type: 'other'` và hiển thị nguyên văn. Như vậy không câu nào trong đề bị mất.

---

## 3. Mô hình dữ liệu

```ts
interface Exam {
  id: string;              // "hsg8-2023-huyen-x", cố định sau khi import
  title: string;
  year?: number;
  level?: 'truong' | 'huyen' | 'tinh';
  minutes: number;
  maxScore: number;        // theo đề: 20, 100...
  sections: Section[];
  source: string;          // tên file gốc
}

interface Section {
  id: string;
  instruction: string;     // nguyên văn yêu cầu trong đề
  type: QuestionType;
  points: number;          // điểm của cả phần
  passage?: string;        // đoạn văn của cloze hoặc reading
  questions: Question[];
}

interface Question {
  id: string;              // `${examId}-${sectionId}-${n}`
  type: QuestionType;
  prompt: string;          // phần gạch chân lưu dạng <u>…</u>
  options?: string[];
  answers: string[];       // các đáp án được chấp nhận; rỗng nếu đề không có đáp án
  explanation?: string;    // có thể bổ sung dần
  tags?: string[];         // chủ điểm: "passive", "conditionals"...
}
```

**Quy ước khi ghi đề** (đã chốt ở bước 1; xem đề mẫu `src/data/exams/mau-01.json`):
- Câu chọn đáp án: `options` theo thứ tự A, B, C, D; `answers` ghi chữ cái (`["B"]`). True/False cũng là chọn đáp án: `options: ["True", "False"]`.
- Câu tự điền: `answers` liệt kê mọi đáp án được chấp nhận. Trong một đáp án, `(…)` là phần có thể bỏ, `a/ b` là hai từ thay thế cho nhau.
- Khi chấm, không phân biệt hoa thường, bỏ qua dấu câu, và coi dạng viết tắt bằng dạng đầy đủ (`doesn't` = `does not`).
- Phát âm: phần gạch chân trong từng lựa chọn viết `<u>…</u>`.
- Tìm lỗi sai: đánh dấu 4 phần trong câu bằng `<u>…</u>`; `options` là 4 phần đó theo thứ tự; `fix` là các cách sửa đúng.
- Viết lại câu: `lead` là phần mở đầu đề cho sẵn. Học sinh gõ có hoặc không có phần mở đầu đều được chấm.
- Bài viết: `answers: []`, bài mẫu để ở `sample`.
- Mỗi câu ăn `points / số câu` của phần đó. Câu chưa có đáp án vẫn hiện nhưng không tính điểm.

- Mỗi đề lưu thành một file `src/data/exams/<id>.json` và được tải theo nhu cầu bằng `import()`, để trang đầu vẫn nhẹ.
- Ngân hàng câu hỏi luyện theo dạng không phải dữ liệu riêng. Nó được ghép từ mọi đề, nên không có hai bản dữ liệu để phải giữ khớp nhau.

---

## 4. Quy trình import đề

Import chạy **trên máy tính, do người lớn làm**, không làm trong app. Chất lượng file đề rất khác nhau, nên lần nào cũng cần người xem lại.

```
file đề (.docx / .pdf)
  → npm run import:exam <file>   trích chữ, nhận diện phần và câu, ghép đáp án
  → src/data/exams/<id>.json     bản nháp, kèm danh sách cảnh báo
  → xem lại và sửa JSON (hoặc dùng trang xem trước)
  → npm run check:data           kiểm tra
  → commit
```

**Trích chữ:**
- `.docx`: dùng thư viện `mammoth`, giữ được **gạch chân** (cần cho dạng ngữ âm) và in đậm.
- `.pdf` có lớp chữ: dùng `pdfjs-dist`. Phần gạch chân bị mất, nên script sẽ cảnh báo để người sửa thêm `<u>` bằng tay.
- PDF scan hoặc ảnh: không có chữ để trích, phải OCR hoặc gõ lại. Script báo lỗi, không đoán.

**Nhận diện cấu trúc:**
- Đầu phần: dòng bắt đầu bằng `I.`, `II.`, `PART`, `Section`, `Question 1`… Dạng bài xác định theo từ khóa trong yêu cầu, ví dụ "underlined part" → `pronunciation`, "stress" → `stress`, "correct form of the word" → `word-form`, "rewrite"/"same meaning" → `transform`, "mistake"/"error" → `error-id`.
- Điểm của mỗi phần: lấy từ chữ `(2.0 points)` hoặc `(10 điểm)` nếu đề có ghi.
- Câu hỏi: số thứ tự đầu dòng. Đáp án trắc nghiệm: `A.` `B.` `C.` `D.`, kể cả khi nằm trên cùng một dòng.

**Ghép đáp án:**
- Đáp án ở cuối file hoặc ở file riêng (`--key dapan.docx`), ghép với câu hỏi theo phần và số câu.
- Dấu `/` trong đáp án được hiểu là nhiều đáp án được chấp nhận.
- Câu không tìm được đáp án vẫn được giữ lại, gắn cảnh báo. Trong app, câu đó hiện "Chưa có đáp án" và không tính điểm.

**Trang xem trước** (`#/admin/exam/<id>`, chỉ chạy với `npm run dev`): hiện đề đã import cạnh danh sách cảnh báo, để soát nhanh trước khi commit.

**Cách dùng (đã làm):**
```bash
# đặt file đề vào de-thi/ (đã nằm trong .gitignore, không bị commit)
npm run import:exam -- de-thi/de-2024.docx --id hsg8-2024-huyen-x --level huyen [--key de-thi/dap-an.docx] [--minutes 120] [--max 20]
npm run dev        # mở #/exams → "Xem trước đề (dev)" để soát từng câu với đáp án
npm run check:data # kiểm tra lại sau khi sửa JSON bằng tay
```
- Đọc được `.docx` (giữ gạch chân, đánh số tự động của Word, lựa chọn trong bảng) và `.txt`. **Chưa đọc PDF**: mở PDF bằng Word rồi lưu thành `.docx`.
- `npm run test:import` chạy bộ phân tích trên đề thử `scripts/fixtures/de-thu.{txt,docx}` và các kiểu trình bày hay gặp.
- Còn lại: chỉnh bộ nhận diện theo 2–3 đề thật của bạn.

**`check:data` mở rộng:**
- id không trùng.
- Câu `mcq` có đáp án nằm trong `options`.
- Câu `pronunciation` có `<u>`.
- Tổng điểm các phần bằng `maxScore`.
- In số câu chưa có đáp án của từng đề.

---

## 5. Tính năng trong app

### 5.1 Thi thử (`#/exams`, `#/exam/<id>`)
- Danh sách đề hiện năm, cấp, điểm cao nhất và số lần đã làm.
- Khi làm bài, đồng hồ đếm ngược theo `minutes`. Có thể làm các phần theo thứ tự bất kỳ, và đánh dấu câu muốn xem lại.
- Bài đang làm được lưu liên tục, nên tắt app vẫn làm tiếp được.
- Nộp bài: điểm quy đổi theo thang của đề, cùng điểm từng phần.
- Xem lại từng câu với đáp án đúng và giải thích (nếu có).
- Phần `writing`: học sinh viết vào ô, nộp xong thì hiện bài mẫu và một danh sách tự kiểm (đủ ý, đúng thì, đủ số từ, có từ nối). Học sinh tự cho điểm phần này. Ô nhập có đếm số từ.

### 5.2 Luyện theo dạng (`#/practice/<type>`)
- Chọn dạng bài (có thể thêm chủ điểm), rồi làm 10/20 câu lấy ngẫu nhiên từ mọi đề. Đáp án hiện ngay sau mỗi câu.
- Ưu tiên câu chưa làm và câu hay sai.

### 5.3 Sổ lỗi sai (`#/mistakes`)
- Câu sai trong thi thử hoặc luyện tập đều vào sổ.
- Ôn theo SRS: đúng thì giãn lịch ôn (1 → 3 → 7 → 14 ngày), sai thì quay về 1 ngày.
- Từ vựng B1 chưa dùng lịch ôn này: vẫn ôn qua mục "Ôn tập từ khó" như cũ (để sau, vì cần đổi cách tính "từ khó" ở mọi chế độ học từ).

### 5.4 Thống kê (`#/stats`)
- Biểu đồ điểm các lần thi thử theo thời gian.
- Tỉ lệ đúng theo từng dạng bài, làm nổi 3 dạng yếu nhất, mỗi dạng có nút "Luyện ngay".
- Trang chủ có mục "Hôm nay": số câu đến hạn ôn và gợi ý dạng cần luyện.

### 5.5 Điều hướng
Thanh dưới trên mobile và sidebar trên desktop gồm 5 mục: **Trang chủ / Thi thử / Luyện tập / Từ vựng / Cá nhân** (Cá nhân gồm sổ lỗi sai, thống kê và cài đặt).

---

## 6. Thay đổi kỹ thuật

- **Bộ chấm chung** `src/lib/grade.ts`: tách luật chấm gõ từ hiện có trong `src/lib/text.ts`. Thêm các bước chuẩn hóa: dấu nháy `'`/`’`, dạng viết tắt (`don't` = `do not`) và dấu câu cuối câu. Câu viết lại đúng khi khớp một trong các đáp án mẫu sau khi chuẩn hóa.
- **Tiến độ v2** (`ProgressState.version: 2`) thêm các trường sau:
  ```ts
  questions: Record<string, { right: number; wrong: number; t: number; srs?: { due: number; step: number } }>;
  attempts: { id: string; examId: string; startedAt: number; submittedAt?: number;
              answers: Record<string, string>; score?: number; selfScore?: number; t: number }[];
  ```
  - Hàm migrate tự chuyển dữ liệu v1 lên v2, giữ nguyên tiến độ từ vựng.
  - Luật gộp giữa các máy giữ như cũ: mỗi câu lấy bản có `t` mới nhất; các lần làm đề hợp lại theo `id`.
  - Bổ sung test vào `scripts/test-server.ts`.
- **Router:** thêm các route `exams`, `exam/<id>`, `exam/<id>/review/<attemptId>`, `practice/<type>`, `mistakes`, `stats`, và `admin/exam/<id>` (chỉ ở chế độ dev).
- **Thư viện mới:** chỉ cần `mammoth` và `pdfjs-dist`, đều là devDependency cho script import, nên không làm nặng app.

---

## 7. Lộ trình

| # | Giai đoạn | Việc chính | Xong khi |
|---|---|---|---|
| 1 | ✅ **Nền tảng** | Kiểu `Exam`/`Question`, `grade.ts`, tiến độ v2 và migrate, router mới, `check:data` cho đề | Build và test chạy; tiến độ cũ còn nguyên |
| 2 | ½ **Import** | `npm run import:exam` cho .docx, rồi .pdf; ghép đáp án; trang xem trước | Import được 2–3 đề thật, chỉ còn ít cảnh báo |
| 3 | ✅ **Thi thử** | Giao diện cho từng dạng bài, đồng hồ, lưu bài đang làm, chấm điểm, xem lại, tự chấm phần viết | Làm trọn được một đề thật |
| 4 | ✅ **Luyện tập và sổ lỗi** | Luyện theo dạng, sổ lỗi sai, SRS chung cho câu hỏi và từ vựng | Câu sai tự quay lại đúng lịch |
| 5 | ✅ **Thống kê** | Biểu đồ điểm, tỉ lệ đúng theo dạng, mục "Hôm nay" | Biết dạng nào yếu và luyện được ngay |
| 6 | ½ **Hoàn thiện** | ✅ PWA để làm bài offline (hỏi trước khi cập nhật). Còn: thêm giải thích cho những câu hay sai (cần đề thật) | |

Giai đoạn 2 phụ thuộc vào **file đề thật**. Nên có vài file mẫu ngay từ đầu để thiết kế script nhận diện cho sát.

---

## 8. Cần chuẩn bị

- Các file đề (Word hoặc PDF), kèm đáp án nếu có.
- Cho biết đề là Word, PDF có chữ chọn được, hay bản scan.
- Đáp án nằm cuối đề hay ở file riêng.
- Lưu ý bản quyền: đề sưu tầm chỉ dùng cá nhân. Nếu deploy lên Netlify thì nên bật mật khẩu cho site, hoặc để repo ở chế độ private.
