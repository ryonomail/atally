// 地図ピンのクエリを一元管理する。誤ピン・複数ピン・未ピンを避けるための正規化。
//
// 方針:
//  - 「都道府県」から始まる住所を必須にする。特定できなければ null（地図を出さない）。
//  - office_address は空白・括弧・読点で切って施設名/補足(FAX等)を除去。
//  - 「・」「/」での複数エリア列挙は先頭のみ採用。
//  - 建物名の接尾辞（ビル/マンション/階/号室 等）以降を除去。
//  - 「その他」「-」「在宅」等の使えない断片や、番地も住所字句も無い施設名だけの断片は、
//    市区町村レベル（region）の単一ピンにフォールバック。
//  - 全角英数は半角へ正規化（Google の住所解釈が安定する）。
//
// ※ 番地の直後に空白なしで付く建物名（例「1-1グランカーサ」）は、
//    数字が住所にも建物名にも現れ機械的に分離できないため、あえて切らない
//    （札幌「南11条西7丁目」等の正しい住所を壊さないことを優先）。

const PREF_RE = /^(北海道|東京都|京都府|大阪府|..県|...県)/;
const BLDG_STRIP_RE = /(ビル|ビルディング|マンション|ハイツ|コーポ|タワー|プラザ|スクエア|ゲート|号室|階).*$/;

function toHalfWidth(s) {
    return String(s || '').replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

// 住所として使えない断片（プレースホルダ・記号・勤務形態など）
function isJunkFragment(a) {
    if (!a || a.length <= 1) return true;
    if (/^[-ー−―‐~〜、。,.\s]+$/.test(a)) return true;
    if (/^(その他|なし|無し|未定|不明|該当なし|在宅|リモート|テレワーク|全国|各地|各現場|直行直帰|応相談)/.test(a)) return true;
    return false;
}

// job から地図検索クエリを組み立てる。特定できなければ null。
export function mapPinQuery(job) {
    if (!job) return null;
    const region = toHalfWidth([job.prefecture, job.city].filter(Boolean).join('') || job.location || '').trim();
    // 都道府県が特定できない住所は誤ピンになりやすいので地図を出さない
    if (!PREF_RE.test(region)) return null;

    let a = toHalfWidth(job.office_address).trim();
    if (a) a = a.split(/[ 　「」（(【\[]/)[0].trim();  // 施設名・補足以降を除去
    if (a) a = a.split(/[・／/]/)[0].trim();            // 複数エリア列挙は先頭のみ
    if (a) a = a.replace(BLDG_STRIP_RE, '').trim();     // 建物名(接尾辞)以降を除去

    // 使えない断片は市区町村レベルの単一ピンへ
    if (isJunkFragment(a)) return region;
    // 番地も住所字句も無い＝施設名/地名のみで誤ピンしやすい → 市区町村へ
    if (!/\d/.test(a) && !/[町丁目番地字条]/.test(a)) return region;

    // office_address が都道府県始まりならそのまま、そうでなければ region を前置
    return PREF_RE.test(a) ? a : region + a;
}
