<?php

namespace App\Support;

class ActivityChangeSet
{
    public static function diff(array $before, array $after, array $labels = []): array
    {
        $changes = [];
        $keys = array_unique([...array_keys($before), ...array_keys($after)]);

        foreach ($keys as $key) {
            $old = $before[$key] ?? null;
            $new = $after[$key] ?? null;
            if (self::same($old, $new)) {
                continue;
            }

            $changes[] = [
                'field' => $labels[$key] ?? $key,
                'from' => self::display($old),
                'to' => self::display($new),
            ];
        }

        return $changes;
    }

    public static function snapshot(array $values, array $labels = []): array
    {
        $changes = [];

        foreach ($values as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            $changes[] = [
                'field' => $labels[$key] ?? $key,
                'to' => self::display($value),
            ];
        }

        return $changes;
    }

    private static function same(mixed $left, mixed $right): bool
    {
        return self::canonical($left) === self::canonical($right);
    }

    private static function canonical(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? '1' : '0';
        }

        if (is_array($value)) {
            return json_encode(array_values($value), JSON_UNESCAPED_UNICODE);
        }

        $str = trim((string) $value);
        if ($str === '' || !is_numeric($str)) {
            return $str;
        }

        $num = (float) $str;
        if (abs($num - round($num)) < 0.0000001) {
            return (string) (int) round($num);
        }

        return number_format($num, 2, '.', '');
    }

    private static function display(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        return trim((string) $value);
    }
}
