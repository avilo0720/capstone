<?php

namespace App\Http\Controllers;

use App\Services\RealtimePublisher;
use App\Support\InventoryContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RealtimeController extends Controller
{
    public function events(Request $request, RealtimePublisher $realtime): JsonResponse
    {
        $slug = InventoryContext::current($request)?->slug;
        $since = $request->has('since') ? (int) $request->query('since') : -1;
        $globalSince = $request->has('global_since') ? (int) $request->query('global_since') : -1;

        $events = [];
        if ($since >= 0 && $slug) {
            $events = array_merge($events, $realtime->since($slug, $since));
        }
        if ($globalSince >= 0) {
            $events = array_merge($events, $realtime->since(RealtimePublisher::GLOBAL_CHANNEL, $globalSince));
        }

        usort($events, fn (array $a, array $b) => ($a['at'] ?? 0) <=> ($b['at'] ?? 0));

        return response()->json([
            'lastId' => $slug ? $realtime->lastId($slug) : 0,
            'globalLastId' => $realtime->lastId(RealtimePublisher::GLOBAL_CHANNEL),
            'events' => array_values($events),
        ]);
    }
}
