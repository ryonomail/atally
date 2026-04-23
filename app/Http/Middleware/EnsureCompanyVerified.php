<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureCompanyVerified
{
    public function handle(Request $request, Closure $next)
    {
        $company = $request->user()?->company;

        if (!$company) {
            return response()->json(['message' => '企業情報が登録されていません。'], 403);
        }

        if ($company->verification_status !== 'verified') {
            return response()->json(['message' => '企業審査が完了していません。'], 403);
        }

        return $next($request);
    }
}
