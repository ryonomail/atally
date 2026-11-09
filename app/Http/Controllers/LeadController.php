<?php

namespace App\Http\Controllers;

use App\Jobs\CollectLeadsJob;
use App\Models\AdminAuditLog;
use App\Models\LeadCollectionRun;
use App\Models\LeadCompany;
use App\Services\LeadCollectorService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * 管理画面 > 営業リスト（見込み企業の自動収集・管理）
 */
class LeadController extends Controller
{
    public function index(Request $request)
    {
        $sort = in_array($request->input('sort'), ['name', 'rating', 'review_count', 'job_count', 'created_at', 'updated_at'], true)
            ? $request->input('sort') : 'created_at';
        $dir = $request->input('dir') === 'asc' ? 'asc' : 'desc';

        $leads = $this->filtered($request)
            ->orderBy($sort, $dir)->orderByDesc('id')
            ->paginate(min(200, max(10, (int) $request->input('per_page', 50))));

        return response()->json($leads);
    }

    /** 地図用: 位置情報のある企業（軽量カラムのみ） */
    public function map(Request $request)
    {
        $points = $this->filtered($request)
            ->whereNotNull('lat')->whereNotNull('lng')
            ->orderByDesc('id')
            ->limit(3000)
            ->get(['id', 'name', 'category', 'address', 'lat', 'lng', 'status', 'has_website', 'email', 'job_count',
                'instagram', 'twitter', 'facebook', 'tiktok', 'youtube', 'line']);

        return response()->json($points);
    }

    public function stats()
    {
        $snsAny = function (Builder $q) {
            $q->where(function ($w) {
                foreach (LeadCompany::SNS_FIELDS as $f) $w->orWhereNotNull($f);
            });
        };

        return response()->json([
            'total'      => LeadCompany::count(),
            // HPなしは「調査済みで見つからなかった」企業のみ（未調査は含めない）
            'no_website' => LeadCompany::where('has_website', false)->whereNotNull('enriched_at')->count(),
            'with_sns'   => LeadCompany::where($snsAny)->count(),
            'no_website_with_sns' => LeadCompany::where('has_website', false)->whereNotNull('enriched_at')->where($snsAny)->count(),
            'with_email' => LeadCompany::whereNotNull('email')->count(),
            'unenriched' => LeadCompany::whereNull('enriched_at')->count(),
            'by_status'  => LeadCompany::select('status', DB::raw('count(*) as c'))->groupBy('status')->pluck('c', 'status'),
            'by_source'  => LeadCompany::select('source', DB::raw('count(*) as c'))->groupBy('source')->pluck('c', 'source'),
            // 取り込み可能なハローワーク求人の事業所数（重いので10分キャッシュ）
            'hellowork_employers' => Cache::remember('leads:hw_employers', 600, fn () => (int) DB::table('jobs')
                ->where('source', 'hellowork')->whereNotNull('employer_name')->distinct()->count('employer_name')),
            'sources'    => LeadCollectorService::availableSources(),
        ]);
    }

    public function runs()
    {
        return response()->json(LeadCollectionRun::orderByDesc('id')->limit(20)->get());
    }

    /** 「収集」ボタン: キューに収集ジョブを投入 */
    public function collect(Request $request)
    {
        $validated = $request->validate([
            'keyword'   => ['nullable', 'string', 'max:100'],
            'area'      => ['nullable', 'string', 'max:100'],
            'sources'   => ['required', 'array', 'min:1'],
            'sources.*' => ['in:hellowork,google,osm'],
        ]);
        $keyword = trim((string) ($validated['keyword'] ?? ''));
        $area = trim((string) ($validated['area'] ?? ''));
        $external = array_intersect($validated['sources'], ['google', 'osm']);
        if ($external && ($keyword === '' || $area === '')) {
            return response()->json(['message' => 'Googleマップ / OpenStreetMap から収集するには業種とエリアの両方を入力してください。'], 422);
        }

        if ($this->isRunning()) {
            return response()->json(['message' => '別の収集が実行中です。完了までお待ちください。'], 409);
        }

        $run = LeadCollectionRun::create([
            'keyword'  => $keyword,
            'area'     => $area,
            'sources'  => array_values($validated['sources']),
            'status'   => 'queued',
            'admin_id' => auth()->id(),
        ]);

        CollectLeadsJob::dispatch($run->id);

        AdminAuditLog::log(auth()->id(), 'lead.collect', 'lead_collection_run', $run->id, implode(',', $run->sources) . " {$keyword} / {$area}");

        return response()->json([
            'message' => '収集を開始しました。HP・メールの調査も含め数分かかります。',
            'run'     => $run,
        ], 202);
    }

    /** 「HP・メールを探す」: 未調査の企業を求人数の多い順に ENRICH_BATCH 件調査 */
    public function enrichBatch()
    {
        if ($this->isRunning()) {
            return response()->json(['message' => '別の収集が実行中です。完了までお待ちください。'], 409);
        }
        if (!LeadCompany::whereNull('enriched_at')->exists()) {
            return response()->json(['message' => '未調査の企業はありません。'], 422);
        }

        $run = LeadCollectionRun::create([
            'keyword' => '', 'area' => '', 'sources' => ['enrich'], 'status' => 'queued', 'admin_id' => auth()->id(),
        ]);
        CollectLeadsJob::dispatch($run->id);

        return response()->json([
            'message' => sprintf('未調査の企業を最大%d件調査します。', LeadCollectorService::ENRICH_BATCH),
            'run'     => $run,
        ], 202);
    }

    private function isRunning(): bool
    {
        return LeadCollectionRun::whereIn('status', ['queued', 'running'])
            ->where('created_at', '>', now()->subMinutes(30))
            ->exists();
    }

    public function update(Request $request, LeadCompany $lead)
    {
        $validated = $request->validate([
            'status'    => ['sometimes', Rule::in(LeadCompany::STATUSES)],
            'memo'      => ['sometimes', 'nullable', 'string', 'max:5000'],
            'name'      => ['sometimes', 'string', 'max:255'],
            'phone'     => ['sometimes', 'nullable', 'string', 'max:50'],
            'email'     => ['sometimes', 'nullable', 'email', 'max:191'],
            'website'   => ['sometimes', 'nullable', 'url', 'max:500'],
            'instagram' => ['sometimes', 'nullable', 'url', 'max:500'],
            'twitter'   => ['sometimes', 'nullable', 'url', 'max:500'],
            'facebook'  => ['sometimes', 'nullable', 'url', 'max:500'],
            'tiktok'    => ['sometimes', 'nullable', 'url', 'max:500'],
            'youtube'   => ['sometimes', 'nullable', 'url', 'max:500'],
            'line'      => ['sometimes', 'nullable', 'url', 'max:500'],
        ]);
        if (array_key_exists('website', $validated)) {
            $validated['has_website'] = !empty($validated['website']);
        }
        $lead->update($validated);

        return response()->json($lead);
    }

    /** 個別に公式サイト/SNSを再取得 */
    public function enrich(LeadCompany $lead, LeadCollectorService $service)
    {
        $service->enrich([$lead]);
        return response()->json($lead->fresh());
    }

    public function destroy(LeadCompany $lead)
    {
        $lead->delete();
        return response()->json(['message' => '削除しました']);
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids'   => ['required', 'array', 'min:1', 'max:1000'],
            'ids.*' => ['integer'],
        ]);
        $n = LeadCompany::whereIn('id', $validated['ids'])->delete();
        AdminAuditLog::log(auth()->id(), 'lead.bulk_delete', null, null, "{$n}件");
        return response()->json(['message' => "{$n}件を削除しました"]);
    }

    /** CSV エクスポート（Excel で開けるよう BOM 付き UTF-8） */
    public function export(Request $request)
    {
        $cols = [
            'name' => '会社名', 'category' => '業種', 'address' => '住所', 'phone' => '電話番号', 'email' => 'メール',
            'website' => 'ホームページ', 'instagram' => 'Instagram', 'twitter' => 'X(Twitter)', 'facebook' => 'Facebook',
            'tiktok' => 'TikTok', 'youtube' => 'YouTube', 'line' => 'LINE', 'google_maps_url' => 'Googleマップ',
            'rating' => '評価', 'review_count' => '口コミ数', 'job_count' => 'ハローワーク求人数', 'lat' => '緯度', 'lng' => '経度', 'status' => 'ステータス',
            'memo' => 'メモ', 'source' => '取得元', 'search_keyword' => '検索キーワード', 'search_area' => '検索エリア',
            'created_at' => '登録日時',
        ];
        $query = $this->filtered($request)->orderByDesc('id');

        return response()->streamDownload(function () use ($query, $cols) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, array_values($cols));
            $query->chunk(500, function ($rows) use ($out, $cols) {
                foreach ($rows as $r) {
                    fputcsv($out, array_map(fn ($c) => (string) ($r->{$c} ?? ''), array_keys($cols)));
                }
            });
            fclose($out);
        }, 'leads_' . now()->format('Ymd_His') . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    private function filtered(Request $request): Builder
    {
        $q = LeadCompany::query();

        if ($kw = trim((string) $request->input('q'))) {
            $q->where(function ($w) use ($kw) {
                $like = '%' . addcslashes($kw, '%_\\') . '%';
                $w->where('name', 'like', $like)
                    ->orWhere('address', 'like', $like)
                    ->orWhere('category', 'like', $like)
                    ->orWhere('phone', 'like', $like);
            });
        }
        if ($status = $request->input('status')) {
            $q->where('status', $status);
        }
        if ($request->input('website') === 'yes') $q->where('has_website', true);
        if ($request->input('website') === 'no') $q->where('has_website', false)->whereNotNull('enriched_at');

        $sns = $request->input('sns');
        if ($sns === 'any') {
            $q->where(function ($w) {
                foreach (LeadCompany::SNS_FIELDS as $f) $w->orWhereNotNull($f);
            });
        } elseif ($sns === 'none') {
            foreach (LeadCompany::SNS_FIELDS as $f) $q->whereNull($f);
        } elseif (in_array($sns, LeadCompany::SNS_FIELDS, true)) {
            $q->whereNotNull($sns);
        }

        if ($request->input('email') === 'yes') $q->whereNotNull('email');
        if ($request->input('email') === 'no') $q->whereNull('email');

        if ($runId = $request->input('run_id')) $q->where('last_run_id', (int) $runId);
        if ($source = $request->input('source')) $q->where('source', $source);

        return $q;
    }
}
