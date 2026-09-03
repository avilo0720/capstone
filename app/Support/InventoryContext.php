<?php

namespace App\Support;

use App\Models\Inventory;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class InventoryContext
{
    public const DEFAULT_SLUG = 'stock-materials';

    public static function current(?Request $request = null): ?Inventory
    {
        $request ??= request();
        $allowed = self::allowed($request);
        if ($allowed->isEmpty()) {
            return null;
        }

        $slug = $request->query('inventory')
            ?? $request->session()->get('inventory_slug');

        $match = $slug ? $allowed->firstWhere('slug', $slug) : null;

        return $match ?: $allowed->first();
    }

    public static function currentId(?Request $request = null): ?int
    {
        $inventory = self::current($request);

        return $inventory?->id;
    }

    public static function remember(Request $request, Inventory $inventory): void
    {
        $request->session()->put('inventory_slug', $inventory->slug);
    }

    public static function all()
    {
        return Inventory::query()->orderBy('id')->get();
    }

    public static function allowed(?Request $request = null): Collection
    {
        $request ??= request();
        $slugs = self::allowedSlugs($request->session()->get('user'));
        if (!$slugs) {
            return collect();
        }

        return Inventory::query()
            ->whereIn('slug', $slugs)
            ->orderBy('id')
            ->get();
    }

    public static function allowedSlugs(?array $sessionUser): array
    {
        if (!is_array($sessionUser)) {
            return PermissionCatalog::inventoryDatasetSlugs();
        }

        if (array_key_exists('inventories', $sessionUser)) {
            $slugs = array_values(array_intersect(
                PermissionCatalog::inventoryDatasetSlugs(),
                array_map('strval', $sessionUser['inventories'] ?? [])
            ));

            return $slugs;
        }

        // Older sessions created before per-inventory access.
        return PermissionCatalog::inventoryDatasetSlugs();
    }

    public static function canAccessSlug(?Request $request, string $slug): bool
    {
        return self::allowed($request)->contains(fn (Inventory $inventory) => $inventory->slug === $slug);
    }
}
