<?php

namespace App\Console\Commands;

use App\Models\Job;
use App\Models\Company;
use Illuminate\Console\Command;

class GenerateSitemap extends Command
{
    protected $signature = 'sitemap:generate';
    protected $description = 'Generate sitemap.xml for SEO';

    public function handle(): int
    {
        $baseUrl = rtrim(config('app.url'), '/');
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

        // 固定ページ
        $staticPages = [
            ['loc' => '/', 'changefreq' => 'daily', 'priority' => '1.0'],
            ['loc' => '/jobs', 'changefreq' => 'hourly', 'priority' => '0.9'],
            ['loc' => '/register', 'changefreq' => 'monthly', 'priority' => '0.6'],
            ['loc' => '/login', 'changefreq' => 'monthly', 'priority' => '0.5'],
            ['loc' => '/terms', 'changefreq' => 'yearly', 'priority' => '0.3'],
            ['loc' => '/privacy', 'changefreq' => 'yearly', 'priority' => '0.3'],
            ['loc' => '/resumes/guest', 'changefreq' => 'monthly', 'priority' => '0.7'],
        ];

        foreach ($staticPages as $page) {
            $xml .= $this->urlEntry($baseUrl . $page['loc'], null, $page['changefreq'], $page['priority']);
        }

        // アクティブ求人
        $jobs = Job::where('status', 'active')
            ->select('id', 'updated_at')
            ->orderByDesc('updated_at')
            ->limit(50000)
            ->get();

        foreach ($jobs as $job) {
            $xml .= $this->urlEntry(
                $baseUrl . '/jobs/' . $job->id,
                $job->updated_at?->toW3cString(),
                'daily',
                '0.8'
            );
        }

        // 承認済み企業
        $companies = Company::where('verification_status', 'approved')
            ->select('id', 'updated_at')
            ->orderByDesc('updated_at')
            ->limit(50000)
            ->get();

        foreach ($companies as $company) {
            $xml .= $this->urlEntry(
                $baseUrl . '/companies/' . $company->id,
                $company->updated_at?->toW3cString(),
                'weekly',
                '0.6'
            );
        }

        $xml .= '</urlset>' . "\n";

        $path = public_path('sitemap.xml');
        file_put_contents($path, $xml);

        $jobCount = $jobs->count();
        $companyCount = $companies->count();
        $this->info("Sitemap generated: {$jobCount} jobs, {$companyCount} companies → {$path}");

        return self::SUCCESS;
    }

    private function urlEntry(string $loc, ?string $lastmod, string $changefreq, string $priority): string
    {
        $entry = "  <url>\n    <loc>" . htmlspecialchars($loc) . "</loc>\n";
        if ($lastmod) {
            $entry .= "    <lastmod>{$lastmod}</lastmod>\n";
        }
        $entry .= "    <changefreq>{$changefreq}</changefreq>\n";
        $entry .= "    <priority>{$priority}</priority>\n";
        $entry .= "  </url>\n";
        return $entry;
    }
}
