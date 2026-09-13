<?php

namespace App\Services;

use App\Support\InventoryContext;
use Illuminate\Http\Request;

class RealtimePublisher
{
    public const GLOBAL_CHANNEL = 'global';

    private const MAX_EVENTS = 100;

    public function publishFromActivity(string $action, ?string $entityType, ?Request $request = null): ?array
    {
        $mapped = $this->mapActivity($action, $entityType);
        if (!$mapped) {
            return null;
        }

        [$type, $global] = $mapped;

        return $this->publish($type, [
            'action' => $action,
            'entityType' => $entityType,
        ], $request, $global);
    }

    public function publish(string $type, array $payload = [], ?Request $request = null, bool $global = false): array
    {
        $request ??= request();
        $channel = $global
            ? self::GLOBAL_CHANNEL
            : (InventoryContext::current($request)?->slug ?? self::GLOBAL_CHANNEL);
        $user = $request->session()->get('user');

        $event = [];
        $this->mutate($channel, function (array $state) use ($type, $payload, $channel, $user, &$event) {
            $id = ((int) ($state['lastId'] ?? 0)) + 1;
            $event = [
                'id' => $id,
                'type' => $type,
                'channel' => $channel,
                'actorId' => isset($user['id']) ? (int) $user['id'] : null,
                'payload' => $payload,
                'at' => now()->timestamp,
            ];

            $events = $state['events'] ?? [];
            $events[] = $event;
            if (count($events) > self::MAX_EVENTS) {
                $events = array_slice($events, -self::MAX_EVENTS);
            }

            return [
                'lastId' => $id,
                'events' => array_values($events),
            ];
        });

        return $event;
    }

    public function since(string $channel, int $afterId): array
    {
        $events = $this->read($channel)['events'] ?? [];

        return array_values(array_filter(
            $events,
            fn ($event) => (int) ($event['id'] ?? 0) > $afterId
        ));
    }

    public function lastId(string $channel): int
    {
        return (int) ($this->read($channel)['lastId'] ?? 0);
    }

    private function mapActivity(string $action, ?string $entityType): ?array
    {
        if (in_array($action, ['login', 'logout'], true)) {
            return null;
        }

        if (str_starts_with($action, 'procurement_')) {
            return ['procurement', false];
        }

        if (str_starts_with($action, 'issuance_')) {
            return ['issuance', false];
        }

        if (in_array($action, ['stock_added', 'stock_used'], true)
            || in_array($entityType, ['item', 'category'], true)
        ) {
            return ['inventory', false];
        }

        if (in_array($entityType, ['user', 'department'], true)) {
            return ['users', true];
        }

        return ['activity', false];
    }

    private function read(string $channel): array
    {
        $path = $this->path($channel);
        if (!is_file($path)) {
            return ['lastId' => 0, 'events' => []];
        }

        $handle = fopen($path, 'rb');
        if (!$handle) {
            return ['lastId' => 0, 'events' => []];
        }

        flock($handle, LOCK_SH);
        $raw = stream_get_contents($handle);
        flock($handle, LOCK_UN);
        fclose($handle);

        $decoded = json_decode((string) $raw, true);

        return is_array($decoded) ? $decoded : ['lastId' => 0, 'events' => []];
    }

    private function mutate(string $channel, callable $callback): array
    {
        $path = $this->path($channel);
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $handle = fopen($path, 'c+');
        if (!$handle) {
            return ['lastId' => 0, 'events' => []];
        }

        flock($handle, LOCK_EX);
        $raw = stream_get_contents($handle);
        $state = $raw ? (json_decode($raw, true) ?: []) : [];
        if (!isset($state['lastId'], $state['events'])) {
            $state = ['lastId' => (int) ($state['lastId'] ?? 0), 'events' => $state['events'] ?? []];
        }

        $next = $callback($state);
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($next));
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);

        return $next;
    }

    private function path(string $channel): string
    {
        $safe = preg_replace('/[^a-z0-9\-]/i', '', $channel) ?: self::GLOBAL_CHANNEL;

        return storage_path('app/realtime/'.$safe.'.json');
    }
}
