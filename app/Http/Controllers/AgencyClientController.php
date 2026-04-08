<?php

namespace App\Http\Controllers;

use App\Models\AgencyClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AgencyClientController extends Controller
{
    /**
     * クライアント一覧
     */
    public function index()
    {
        $company = Auth::user()->company;
        if (!$company || !$company->isAgency()) {
            return response()->json(['message' => '人材紹介会社のみ利用可能です'], 403);
        }

        $clients = AgencyClient::where('company_id', $company->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($clients);
    }

    /**
     * クライアント作成
     */
    public function store(Request $request)
    {
        $company = Auth::user()->company;
        if (!$company || !$company->isAgency()) {
            return response()->json(['message' => '人材紹介会社のみ利用可能です'], 403);
        }

        $request->validate([
            'client_name' => 'required|string|max:255',
            'client_description' => 'nullable|string|max:2000',
            'contact_person' => 'nullable|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'contact_phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:500',
        ]);

        $client = AgencyClient::create([
            'company_id' => $company->id,
            'client_name' => $request->client_name,
            'client_description' => $request->client_description,
            'contact_person' => $request->contact_person,
            'contact_email' => $request->contact_email,
            'contact_phone' => $request->contact_phone,
            'address' => $request->address,
        ]);

        return response()->json($client, 201);
    }

    /**
     * クライアント更新
     */
    public function update(Request $request, AgencyClient $client)
    {
        $company = Auth::user()->company;
        if (!$company || $client->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'client_name' => 'required|string|max:255',
            'client_description' => 'nullable|string|max:2000',
            'contact_person' => 'nullable|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'contact_phone' => 'nullable|string|max:50',
            'address' => 'nullable|string|max:500',
        ]);

        $client->update($request->only([
            'client_name',
            'client_description',
            'contact_person',
            'contact_email',
            'contact_phone',
            'address',
        ]));

        return response()->json($client);
    }

    /**
     * クライアント削除
     */
    public function destroy(AgencyClient $client)
    {
        $company = Auth::user()->company;
        if (!$company || $client->company_id !== $company->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $client->delete();

        return response()->json(['message' => 'クライアントを削除しました']);
    }
}
