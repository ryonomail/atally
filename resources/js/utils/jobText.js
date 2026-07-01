// ハローワーク等の求人フリーテキストを「読みやすく整形」するユーティリティ。
// 全角スペースによるレイアウト・重複トークン・記号だけの行・囲み「」などを正規化する。
// 意味を壊さないよう保守的に処理（クリーンなAtally入力に適用しても実害なし）。

export function cleanJobText(input) {
    if (input == null) return '';
    let s = String(input);

    // 文字化けの置換文字を除去し、制御文字は改行・タブ以外を落とす
    s = s.replace(/�/g, '').replace(/\p{Cc}/gu, m => (m === '\n' || m === '\t') ? m : '');
    // 全角英数 → 半角
    s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    // ハローワーク由来の重複トークンを圧縮
    s = s.replace(/(月平均)+/g, '月平均').replace(/(時間)+/g, '時間').replace(/(円)+/g, '円');
    // レイアウト目的の空白連続（全角/半角2つ以上）は改行に、単独の全角空白は半角に
    s = s.replace(/[ \t　]{2,}/g, '\n').replace(/　/g, ' ');
    // 箇条書き記号を「・」に統一（※は注記なのでそのまま）
    s = s.replace(/^[ \t]*[●○◎■◆▶►・]\s*/gm, '・');

    // 行単位で整形：トリム、記号だけの行を除去、連続重複行を圧縮
    const out = [];
    for (const raw of s.split('\n')) {
        const l = raw.trim();
        if (/^[-ー―−‐=＝*_～〜─━┈┅▬│｜＿\s]*$/.test(l)) { // 罫線・区切りだけの行
            if (out.length && out[out.length - 1] !== '') out.push('');
            continue;
        }
        if (out.length && out[out.length - 1] === l) continue; // 直前と同一行は捨てる
        out.push(l);
    }
    s = out.join('\n');

    // 改行の詰めすぎ/開けすぎを整える
    s = s.replace(/\n{3,}/g, '\n\n').trim();
    // 全体が「」で囲まれていれば外す
    s = s.replace(/^「([\s\S]*)」$/, '$1').trim();
    return s;
}
