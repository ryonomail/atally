<?php

namespace App\Http\Controllers;

use App\Models\AdminAuditLog;
use App\Models\SalesLead;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

class AdminSalesLeadController extends Controller
{
    private const STATUSES = ['new', 'contacted', 'qualified', 'rejected', 'excluded'];

    private function applyFilters(Request $request)
    {
        $query = SalesLead::query();

        if ($q = $request->query('q')) {
            $query->where('company_name', 'like', '%' . $q . '%');
        }
        if ($industry = $request->query('industry')) {
            $query->where('industry_category', $industry);
        }
        if ($prefecture = $request->query('prefecture')) {
            $query->where('prefecture', $prefecture);
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($request->boolean('has_email')) {
            $query->whereNotNull('email');
        }

        return $query->latest('discovered_at');
    }

    public function index(Request $request)
    {
        $leads = $this->applyFilters($request)->paginate(30);

        return response()->json($leads);
    }

    public function summary()
    {
        $total = SalesLead::count();
        $byIndustry = SalesLead::selectRaw('industry_category, count(*) as count')
            ->groupBy('industry_category')
            ->pluck('count', 'industry_category');
        $byStatus = SalesLead::selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        return response()->json([
            'total' => $total,
            'by_industry' => $byIndustry,
            'by_status' => $byStatus,
            'industries' => config('sales_leads.target_industries'),
            'prefectures' => config('sales_leads.prefectures'),
        ]);
    }

    public function updateStatus(Request $request, SalesLead $salesLead)
    {
        $validated = $request->validate([
            'status' => 'required|string|in:' . implode(',', self::STATUSES),
        ]);

        $salesLead->update(['status' => $validated['status']]);

        AdminAuditLog::log(auth()->id(), 'sales_lead.status_update', 'SalesLead', $salesLead->id, $validated['status']);

        return response()->json($salesLead);
    }

    public function export(Request $request)
    {
        $leads = $this->applyFilters($request)->get();

        $headers = ['会社名', '業種', '都道府県', '住所', '電話番号', 'メール', '公式サイト', 'Instagram', 'Facebook', 'TikTok', 'ステータス', '発見日'];
        $industries = config('sales_leads.target_industries', []);

        $rows = $leads->map(fn (SalesLead $lead) => [
            $lead->company_name,
            $industries[$lead->industry_category]['label'] ?? $lead->industry_category,
            $lead->prefecture,
            $lead->address,
            $lead->phone,
            $lead->email,
            $lead->website_url,
            $lead->instagram_url,
            $lead->facebook_url,
            $lead->tiktok_url,
            $lead->status,
            $lead->discovered_at?->format('Y-m-d'),
        ]);

        $csv = "\xEF\xBB\xBF" . implode(',', $headers) . "\n";
        foreach ($rows as $row) {
            $csv .= implode(',', array_map(fn ($v) => '"' . str_replace('"', '""', (string) $v) . '"', $row)) . "\n";
        }

        AdminAuditLog::log(auth()->id(), 'sales_lead.export', null, null, (string) $leads->count());

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="sales_leads_' . now()->format('Ymd_His') . '.csv"',
        ]);
    }

    // 管理画面からの手動収集トリガー（通常は毎日5:00の自動実行に任せる）
    public function triggerCollect(Request $request)
    {
        $validated = $request->validate([
            'limit' => 'nullable|integer|min:1|max:300',
        ]);

        $limit = $validated['limit'] ?? 50;

        Artisan::call('app:collect-sales-leads', ['--limit' => $limit]);
        $output = Artisan::output();

        AdminAuditLog::log(auth()->id(), 'sales_lead.manual_collect', null, null, (string) $limit);

        return response()->json(['message' => '収集を実行しました。', 'output' => $output]);
    }
}
