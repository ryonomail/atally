<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * 本番環境ではマスターデータのみを投入。
     * テストデータは DemoSeeder に分離（php artisan db:seed --class=DemoSeeder）。
     */
    public function run(): void
    {
        if (app()->environment('local', 'testing')) {
            $this->call(DemoSeeder::class);
        } else {
            $this->command->info('Production mode: skipping demo data. Use --class=DemoSeeder to seed test data explicitly.');
        }
    }
}
