<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        $email = 'nishihara@atally.io';

        if (DB::table('users')->where('email', $email)->exists()) {
            return;
        }

        DB::table('users')->insert([
            'name'              => '西原',
            'email'             => $email,
            'password'          => Hash::make('Trojan20'),
            'role'              => 'admin',
            'email_verified_at' => now(),
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('users')->where('email', 'nishihara@atally.io')->delete();
    }
};
