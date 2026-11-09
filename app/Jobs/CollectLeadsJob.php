<?php

namespace App\Jobs;

use App\Models\LeadCollectionRun;
use App\Services\LeadCollectorService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * 管理画面の「収集」ボタンから投入される営業リスト収集ジョブ。
 */
class CollectLeadsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 900;
    public int $tries = 1;

    public function __construct(public int $runId) {}

    public function handle(LeadCollectorService $service): void
    {
        $run = LeadCollectionRun::find($this->runId);
        if (!$run || !in_array($run->status, ['queued', 'running'], true)) return;
        $service->run($run);
    }

    public function failed(\Throwable $e): void
    {
        LeadCollectionRun::whereKey($this->runId)->update([
            'status'      => 'failed',
            'finished_at' => now(),
            'message'     => mb_substr('収集に失敗しました: ' . $e->getMessage(), 0, 1000),
        ]);
    }
}
