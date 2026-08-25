<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class InstanceController extends Controller
{
  private string $baseUrl;

  public function __construct()
  {
    $this->baseUrl = config('services.messages.url');
  }

  public function create(Request $request): JsonResponse
  {
    $response = Http::post("{$this->baseUrl}instance/create", $request->all());

    return response()->json($response->json(), $response->status());
  }

  public function connect(Request $request): JsonResponse
  {
    $response = Http::get("{$this->baseUrl}instance/connect", $request->all());

    return response()->json($response->json(), $response->status());
  }

  public function verify(Request $request): JsonResponse
  {
    $response = Http::get("{$this->baseUrl}instance/verify", $request->all());

    return response()->json($response->json(), $response->status());
  }

  public function disconnect(Request $request): JsonResponse
  {
    $response = Http::post("{$this->baseUrl}instance/desconnect", $request->all());

    return response()->json($response->json(), $response->status());
  }

  public function delete(Request $request): JsonResponse
  {
    $response = Http::post("{$this->baseUrl}instance/delete", $request->all());

    return response()->json($response->json(), $response->status());
  }
}