<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Throwable;

/** System-wide key/value settings. */
class AppSetting extends Model
{
    public const PROCUREMENT_LEAD_TIME_MONTHS = 'procurement_lead_time_months';

    public const DEFAULT_LEAD_TIME_MONTHS = 3.5;

    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    public static function getValue(string $key, ?string $default = null): ?string
    {
        try {
            return static::query()->find($key)?->value ?? $default;
        } catch (Throwable) {
            // Table missing until migrations run: fall back to the default.
            return $default;
        }
    }

    public static function setValue(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /** Months from ordering until delivery, used for LTD, SS, ROP, and MSL. */
    public static function leadTimeMonths(): float
    {
        $value = (float) static::getValue(self::PROCUREMENT_LEAD_TIME_MONTHS, (string) self::DEFAULT_LEAD_TIME_MONTHS);

        return $value > 0 ? $value : self::DEFAULT_LEAD_TIME_MONTHS;
    }
}
