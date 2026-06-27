<?php

namespace App\Console\Commands;

use App\Models\Job;
use Illuminate\Console\Command;

/**
 * 無料掲載の求人を掲載期限（expires_at）で自動終了する。
 *
 * 対象: 自社掲載（source=atally）の active 求人で、expires_at を過ぎ、かつ無料（daily_budget<=0）のもの。
 * 除外:
 *   - ハローワーク求人（source=hellowork）… API側の紹介期限で別管理
 *   - ブースト中（daily_budget>0）… 課金中は終了させない
 */
class CloseExpiredJobs extends Command
{
    protected $signature = 'app:close-expired-jobs';
    protected $description = '無料掲載求人を掲載期限(30日)で自動終了する（ハロワ求人・ブースト中は除外）';

    public function handle(): int
    {
        $count = Job::where('status', 'active')
            ->where('source', 'atally')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->where(function ($q) {
                $q->whereNull('daily_budget')->orWhere('daily_budget', '<=', 0);
            })
            ->update(['status' => 'closed', 'updated_at' => now()]);

        $this->info("掲載期限切れの無料求人を {$count} 件 自動終了しました。");

        return self::SUCCESS;
    }
}
