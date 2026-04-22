function fmtValue(value, isSmallUnit) {
    if (!value && value !== 0) return null;
    if (isSmallUnit || value < 100000) return `${Number(value).toLocaleString()}円`;
    return `${Math.round(value / 10000)}万円`;
}

/**
 * 給与を salary_type に応じた表示文字列に変換する
 *   時給/日給 → "時給 1,050円〜1,200円"
 *   月給      → "月給 22万円"
 *   年収      → "年収 500万円"
 *   null(大)  → "年収 500万円"（100万円以上は年収とみなす）
 *   null(小)  → "20万円" （salary_type 不明の月給相当等）
 */
export function formatSalary(job) {
    const { salary_min, salary_max, salary_type } = job;
    if (!salary_min && !salary_max) return null;
    const isSmallUnit = salary_type === '時給' || salary_type === '日給';
    const fmt = v => fmtValue(v, isSmallUnit);
    let range;
    if (salary_min && salary_max) range = `${fmt(salary_min)}〜${fmt(salary_max)}`;
    else if (salary_min)          range = `${fmt(salary_min)}〜`;
    else                          range = `〜${fmt(salary_max)}`;
    const label = salary_type
        || ((salary_min >= 1000000 || salary_max >= 1000000) ? '年収' : '');
    return label ? `${label} ${range}` : range;
}
