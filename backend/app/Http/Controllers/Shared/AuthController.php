<?php

namespace App\Http\Controllers\Shared;

use App\Actions\Shared\Auth\LoginUserAction;
use App\Actions\Shared\Auth\RegisterMerchantAction;
use App\DTOs\Shared\Auth\RegisterMerchantData;
use App\Http\Controllers\Controller;
use App\Http\Requests\Shared\Auth\LoginRequest;
use App\Http\Requests\Shared\Auth\RegisterRequest;
use App\Support\Tenant;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function login(LoginRequest $request, LoginUserAction $action)
    {
        return response()->json($action->execute($request->validated('email'), $request->validated('password')));
    }

    public function register(RegisterRequest $request, RegisterMerchantAction $action)
    {
        return response()->json($action->execute(RegisterMerchantData::fromArray($request->validated())), 201);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load('store.plan'),
            'store' => Tenant::storeFor($request->user()),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out']);
    }
}