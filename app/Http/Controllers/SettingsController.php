<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Services\ActivityLogger;
use App\Support\ActivityChangeSet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __construct(private ActivityLogger $activity)
    {
    }

    public function leadTime(): JsonResponse
    {
        return response()->json(['leadTimeMonths' => AppSetting::leadTimeMonths()]);
    }

    public function updateLeadTime(Request $request): JsonResponse
    {
        $data = $request->validate([
            'leadTimeMonths' => ['required', 'numeric', 'min:0.1', 'max:24'],
        ], [
            'leadTimeMonths.min' => 'Lead time must be at least 0.1 months.',
            'leadTimeMonths.max' => 'Lead time cannot be more than 24 months.',
        ]);

        $before = AppSetting::leadTimeMonths();
        $after = round((float) $data['leadTimeMonths'], 2);

        if ($after !== $before) {
            AppSetting::setValue(AppSetting::PROCUREMENT_LEAD_TIME_MONTHS, (string) $after);

            $this->activity->log(
                $request,
                'lead_time_updated',
                'Changed procurement lead time from '.$before.' to '.$after.' months',
                'setting',
                null,
                [
                    'changes' => ActivityChangeSet::diff(
                        ['Lead time (months)' => (string) $before],
                        ['Lead time (months)' => (string) $after]
                    ),
                ]
            );
        }

        return response()->json(['success' => true, 'leadTimeMonths' => $after]);
    }
}
